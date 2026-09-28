import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { REVIEWER, currentRevision, openBlockers } from '../shared/types.ts';
import type { Asset, CaseAction, Offer, PackageRevision, ReviewCase, RevisionInput, SubmissionInput } from '../shared/types.ts';

export class WorkflowError extends Error {
  constructor(public status: number, message: string, public code = 'invalid_request', public currentVersion?: number) { super(message); }
}
export type Upload = { originalname: string; mimetype: string; buffer: Buffer };
export type Example = { key: string; case: ReviewCase; assets: { assetId: string; path: string }[] };
const id = () => randomUUID();
const now = () => new Date().toISOString();
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const cleanName = (value: string) => basename(value.replaceAll('\\', '/')).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || 'attachment';
const contentTypes: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' };

export function inspectUpload(file: Upload) {
  if (!file.buffer.length) throw new WorkflowError(400, 'Empty attachments cannot be submitted.');
  if (file.buffer.length > 10 * 1024 * 1024) throw new WorkflowError(413, 'Each attachment must be 10 MB or smaller.');
  const bytes = file.buffer;
  const mime = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
    : bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf' : 'application/octet-stream';
  const name = cleanName(file.originalname);
  const extension = name.slice(name.lastIndexOf('.')).toLowerCase();
  const expected = contentTypes[extension];
  if ((expected && expected !== mime) || (Object.values(contentTypes).includes(file.mimetype) && file.mimetype !== mime)) {
    throw new WorkflowError(400, `The contents of ${name} do not match its image/PDF file type.`, 'invalid_file_type');
  }
  return { name, mime, size: bytes.length, sha256: sha(bytes) };
}

export class WorkflowStore {
  readonly db: DatabaseSync;
  readonly assetsDir: string;
  constructor(readonly dataDir: string, readonly offers: Offer[], readonly examples: Example[] = []) {
    mkdirSync(dataDir, { recursive: true });
    this.assetsDir = join(resolve(dataDir), 'assets');
    mkdirSync(this.assetsDir, { recursive: true });
    this.db = new DatabaseSync(join(dataDir, 'workflow.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS cases (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, version INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests (scope TEXT NOT NULL, key TEXT NOT NULL, digest TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(scope,key));`);
  }
  close() { this.db.close(); }
  list(): ReviewCase[] {
    return this.db.prepare('SELECT data FROM cases ORDER BY seq DESC').all().map(row => JSON.parse(row.data as string));
  }
  get(caseId: string): ReviewCase {
    const row = this.db.prepare('SELECT data FROM cases WHERE id=?').get(caseId);
    if (!row) throw new WorkflowError(404, 'This review case was not found.', 'not_found');
    return JSON.parse(row.data as string);
  }
  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private version(c: ReviewCase, expected: number) {
    if (c.version !== expected) throw new WorkflowError(409, 'This case changed. Reload it before applying your action.', 'version_conflict', c.version);
  }
  private save(c: ReviewCase, expected: number) {
    c.version = expected + 1;
    c.updatedAt = now();
    const result = this.db.prepare('UPDATE cases SET version=?, data=? WHERE id=? AND version=?').run(c.version, JSON.stringify(c), c.id, expected);
    if (result.changes !== 1) throw new WorkflowError(409, 'This case changed. Reload and try again.', 'version_conflict');
    return c;
  }
  private insert(c: ReviewCase) {
    const result = this.db.prepare('INSERT INTO cases (id,version,data) VALUES (?,?,?)').run(c.id, c.version, '{}');
    c.reference = `CP-${1000 + Number(result.lastInsertRowid)}`;
    this.db.prepare('UPDATE cases SET data=? WHERE id=?').run(JSON.stringify(c), c.id);
    return c;
  }
  private event(c: ReviewCase, type: string, text: string, actor = REVIEWER) {
    c.history.push({ id: id(), type, text, actor, createdAt: now(), revisionId: currentRevision(c).id });
  }
  private validateOffer(offerId: string, product: ReviewCase['product'], required = false) {
    if (!offerId && !required) return;
    if (!this.offers.some(offer => offer.id === offerId && offer.product === product)) throw new WorkflowError(400, 'Choose an offer that matches this product.', 'offer_required');
  }
  private validatePackage(input: RevisionInput | SubmissionInput, files: Upload[], retained: PackageRevision['components'] = []) {
    if (files.length !== input.fileRoles.length) throw new WorkflowError(400, 'Provide one role for each uploaded attachment.');
    if (!input.copy.trim() && !retained.some(c => c.role === 'creative') && !input.fileRoles.includes('creative')) {
      throw new WorkflowError(400, 'Include creative copy or mark an attachment as the creative.');
    }
    if (files.reduce((size, file) => size + file.buffer.length, Buffer.byteLength(JSON.stringify(input))) > 25 * 1024 * 1024) throw new WorkflowError(413, 'The submission must be 25 MB or smaller.');
    files.forEach(inspectUpload);
  }
  private writeAssets(files: Upload[], written: string[]): Asset[] {
    return files.map(file => {
      const asset: Asset = { id: id(), createdAt: now(), ...inspectUpload(file) };
      const path = join(this.assetsDir, asset.id);
      writeFileSync(path, file.buffer, { flag: 'wx' });
      written.push(path);
      return asset;
    });
  }
  private request(scope: string, key: string | undefined, input: unknown, files: Upload[], work: (written: string[]) => ReviewCase) {
    const digest = sha(JSON.stringify({ input, files: files.map(file => ({ name: cleanName(file.originalname), mime: file.mimetype, hash: sha(file.buffer) })) }));
    const written: string[] = [];
    try {
      return this.transaction(() => {
        if (key) {
          const prior = this.db.prepare('SELECT digest,response FROM requests WHERE scope=? AND key=?').get(scope, key);
          if (prior) {
            if (prior.digest !== digest) throw new WorkflowError(409, 'This retry key was already used for different content.', 'idempotency_conflict');
            return JSON.parse(prior.response as string) as ReviewCase;
          }
        }
        const result = work(written);
        if (key) this.db.prepare('INSERT INTO requests(scope,key,digest,response) VALUES (?,?,?,?)').run(scope, key, digest, JSON.stringify(result));
        return result;
      });
    } catch (error) { written.forEach(path => rmSync(path, { force: true })); throw error; }
  }
  submit(input: SubmissionInput, files: Upload[], key?: string) {
    return this.request('submission', key, input, files, written => {
      this.validateOffer(input.offerId, input.product);
      this.validatePackage(input, files);
      const at = now();
      const assets = this.writeAssets(files, written);
      const revision: PackageRevision = {
        id: id(), number: 1, createdAt: at, submittedBy: input.submittedBy, summary: input.summary,
        offerId: input.offerId, intendedUse: input.intendedUse, copy: input.copy, destinationUrl: input.destinationUrl,
        components: assets.map((asset, i) => ({ assetId: asset.id, role: input.fileRoles[i] })),
      };
      const c: ReviewCase = {
        id: id(), reference: '', title: input.title, product: input.product, submitter: input.submitter,
        submitterEmail: input.submitterEmail, channel: input.channel, launchDate: input.launchDate,
        owner: REVIEWER, nextOwner: REVIEWER, waitingReason: '', status: 'needs_intake', version: 1,
        createdAt: at, updatedAt: at, example: false, confirmedRevisionId: null,
        assets, revisions: [revision], findings: [], notes: [], decisions: [], drafts: [], history: [],
      };
      this.event(c, 'submitted', 'Submission received. Awaiting intake.', input.submittedBy);
      return this.insert(c);
    });
  }
  revise(caseId: string, input: RevisionInput & { expectedVersion: number }, files: Upload[], key?: string) {
    return this.request(`revision:${caseId}`, key, input, files, written => {
      const c = this.get(caseId);
      this.version(c, input.expectedVersion);
      this.validateOffer(input.offerId, c.product);
      const retained = input.retainedComponents;
      if (new Set(retained.map(component => component.assetId)).size !== retained.length || retained.some(component => !c.assets.some(asset => asset.id === component.assetId))) throw new WorkflowError(400, 'Retained attachments must be unique assets from this case.');
      this.validatePackage(input, files, retained);
      const assets = this.writeAssets(files, written);
      const previous = currentRevision(c);
      const revision: PackageRevision = {
        id: id(), number: previous.number + 1, createdAt: now(), submittedBy: input.submittedBy, summary: input.summary,
        offerId: input.offerId, intendedUse: input.intendedUse, copy: input.copy, destinationUrl: input.destinationUrl,
        components: [...retained, ...assets.map((asset, i) => ({ assetId: asset.id, role: input.fileRoles[i] }))],
      };
      const context = (r: PackageRevision) => JSON.stringify([r.offerId, r.intendedUse, r.copy, r.destinationUrl]);
      const allAssets = new Map([...c.assets, ...assets].map(asset => [asset.id, asset]));
      const materials = (r: PackageRevision, creativeOnly = false) => r.components
        .filter(component => creativeOnly ? component.role === 'creative' : component.role !== 'excluded')
        .map(component => JSON.stringify([allAssets.get(component.assetId)!.sha256, component.role])).sort();
      const contextChanged = context(previous) !== context(revision);
      const creativeChanged = JSON.stringify(materials(previous, true)) !== JSON.stringify(materials(revision, true));
      c.findings.forEach(finding => {
        if (finding.status === 'open') return;
        const baseline = c.revisions.find(r => r.id === (finding.disposition?.revisionId || finding.revisionId));
        const remaining = materials(revision);
        const baselineRetained = baseline && materials(baseline).every(signature => {
          const index = remaining.indexOf(signature);
          if (index < 0) return false;
          remaining.splice(index, 1);
          return true;
        });
        // Additive supporting material does not erase a human resolution against
        // unchanged material. Changed context, creative, or removed proof needs review.
        if (contextChanged || creativeChanged || !baselineRetained) finding.needsRecheck = true;
      });
      c.assets.push(...assets);
      c.revisions.push(revision);
      c.confirmedRevisionId = null;
      c.status = 'needs_intake';
      c.nextOwner = REVIEWER;
      c.waitingReason = '';
      this.event(c, 'revision', `Revision ${revision.number} received. Earlier decisions remain historical; intake is required.`, input.submittedBy);
      return this.save(c, input.expectedVersion);
    });
  }
  action(caseId: string, action: CaseAction) {
    return this.transaction(() => {
      const c = this.get(caseId);
      this.version(c, action.expectedVersion);
      const revision = currentRevision(c);
      if (['approved', 'rejected'].includes(c.status) && !['add_note', 'save_draft'].includes(action.type)) throw new WorkflowError(409, 'This revision has a final decision. Submit a new revision to resume review.', 'decision_closed');
      switch (action.type) {
        case 'confirm_intake':
          this.validateOffer(revision.offerId, c.product, true);
          if (!revision.intendedUse.trim()) throw new WorkflowError(400, 'Describe the intended use before confirming intake.');
          c.confirmedRevisionId = revision.id; c.status = 'in_review'; c.nextOwner = REVIEWER; c.waitingReason = '';
          this.event(c, 'intake_confirmed', `Intake confirmed for revision ${revision.number}.`);
          break;
        case 'add_finding': {
          if (!action.finding.detail.trim()) throw new WorkflowError(400, 'Record the basis for this finding.');
          if (action.finding.assetId && !revision.components.some(component => component.assetId === action.finding.assetId && component.role !== 'excluded')) throw new WorkflowError(400, 'Choose an attachment in the current review package.');
          const finding = { ...action.finding, id: id(), number: Math.max(0, ...c.findings.map(f => f.number)) + 1, status: 'open' as const, createdAt: now(), createdBy: REVIEWER, revisionId: revision.id, needsRecheck: false };
          c.findings.push(finding);
          this.event(c, 'finding_added', `Finding ${finding.number}: ${finding.title}`);
          break;
        }
        case 'disposition': {
          if (c.confirmedRevisionId !== revision.id) throw new WorkflowError(400, 'Confirm the current intake before changing findings.');
          const finding = c.findings.find(f => f.id === action.findingId);
          if (!finding) throw new WorkflowError(404, 'This finding was not found.', 'not_found');
          finding.status = action.status; finding.needsRecheck = false;
          finding.disposition = { reason: action.reason, at: now(), by: REVIEWER, revisionId: revision.id };
          this.event(c, `finding_${action.status}`, `Finding ${finding.number} ${action.status}: ${action.reason}`);
          break;
        }
        case 'set_waiting':
          c.status = 'waiting'; c.nextOwner = action.nextOwner; c.waitingReason = action.reason;
          this.event(c, 'waiting', `Waiting on ${action.nextOwner}: ${action.reason}`);
          break;
        case 'resume':
          c.status = c.confirmedRevisionId === revision.id ? 'in_review' : 'needs_intake'; c.nextOwner = REVIEWER; c.waitingReason = '';
          this.event(c, 'resumed', 'Review resumed.');
          break;
        case 'add_note':
          c.notes.push({ id: id(), text: action.text, author: REVIEWER, createdAt: now() });
          this.event(c, 'note', 'An internal note was added.');
          break;
        case 'decide': {
          if (!action.rationale.trim()) throw new WorkflowError(400, 'Record the rationale for this decision.');
          if (action.outcome === 'approved') {
            if (c.confirmedRevisionId !== revision.id || !action.reviewed || !action.scope.trim()) throw new WorkflowError(400, 'Approval requires confirmed intake, completed review, and a decision scope.', 'approval_requirements');
            if (openBlockers(c).length) throw new WorkflowError(409, 'Material findings still need resolution or recheck.', 'unresolved_findings');
          } else if (!action.rationale.trim()) throw new WorkflowError(400, 'Provide a reason for rejecting this revision.');
          const offer = this.offers.find(item => item.id === revision.offerId);
          c.decisions.push({ id: id(), outcome: action.outcome, reviewer: REVIEWER, revisionId: revision.id, offerId: revision.offerId, scope: action.scope, rationale: action.rationale, createdAt: now(), findingSnapshot: structuredClone(c.findings), ...(offer ? { offerSnapshot: structuredClone(offer) } : {}) });
          c.status = action.outcome; c.nextOwner = ''; c.waitingReason = '';
          this.event(c, action.outcome, `${action.outcome === 'approved' ? 'Approved' : 'Rejected'} revision ${revision.number}. ${action.scope}`);
          break;
        }
        case 'save_draft':
          c.drafts.push({ id: id(), subject: action.subject, body: action.body, createdAt: now(), revisionId: revision.id, status: 'prepared' });
          this.event(c, 'draft_prepared', 'Reply draft prepared. Nothing was sent.');
          break;
      }
      return this.save(c, action.expectedVersion);
    });
  }
  seed() {
    if (!this.db.prepare('SELECT 1 FROM cases LIMIT 1').get()) this.examples.forEach(example => this.freshExample(example.key));
  }
  freshExample(key: string) {
    const example = this.examples.find(item => item.key === key);
    if (!example) throw new WorkflowError(404, 'This example was not found.', 'not_found');
    const files = example.assets.map(asset => ({ originalname: example.case.assets.find(a => a.id === asset.assetId)!.name, mimetype: '', buffer: readFileSync(resolve(asset.path)) }));
    return this.request(`example:${key}`, undefined, {}, files, written => {
      const c = structuredClone(example.case);
      const assets = this.writeAssets(files, written);
      const assetIds = new Map(example.assets.map((asset, i) => [asset.assetId, assets[i].id]));
      const revisionIds = new Map(c.revisions.map(revision => [revision.id, id()]));
      c.id = id(); c.version = 1; c.example = true; c.createdAt = now(); c.updatedAt = c.createdAt;
      c.assets = assets;
      c.revisions.forEach(revision => { revision.id = revisionIds.get(revision.id)!; revision.components.forEach(component => { component.assetId = assetIds.get(component.assetId)!; }); });
      c.confirmedRevisionId = c.confirmedRevisionId ? revisionIds.get(c.confirmedRevisionId)! : null;
      c.findings.forEach(finding => { finding.id = id(); finding.assetId = assetIds.get(finding.assetId) || ''; finding.revisionId = revisionIds.get(finding.revisionId)!; if (finding.disposition) finding.disposition.revisionId = revisionIds.get(finding.disposition.revisionId)!; });
      c.notes.forEach(note => { note.id = id(); });
      c.decisions.forEach(decision => { decision.id = id(); decision.revisionId = revisionIds.get(decision.revisionId)!; });
      c.drafts.forEach(draft => { draft.id = id(); draft.revisionId = revisionIds.get(draft.revisionId)!; });
      c.history.forEach(event => { event.id = id(); event.revisionId = revisionIds.get(event.revisionId)!; });
      return this.insert(c);
    });
  }
}
