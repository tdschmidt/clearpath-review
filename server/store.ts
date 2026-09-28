import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { REVIEWER, currentRevision, openBlockers } from '../shared/types.ts';
import type { Asset, CaseAction, Offer, PackageRevision, ReviewCase, RevisionInput, SubmissionInput } from '../shared/types.ts';

import { applyHandoff, validateFinding } from './handoffs.ts';
import { participant, listReferences, importFixtureReferenceSources } from './references.ts';

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
  constructor(readonly dataDir: string, initialOffers: Offer[], readonly examples: Example[] = []) {
    mkdirSync(dataDir, { recursive: true });
    this.assetsDir = join(resolve(dataDir), 'assets');
    mkdirSync(this.assetsDir, { recursive: true });
    const databasePath = join(dataDir, 'workflow.sqlite');
    const existed = existsSync(databasePath);
    this.db = new DatabaseSync(databasePath);
    const schemaVersion = Number(this.db.prepare('PRAGMA user_version').get()!.user_version);
    if (existed && schemaVersion < 2) {
      const backup = join(resolve(dataDir), `workflow-before-v2-${Date.now()}.sqlite`);
      this.db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
    }
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS cases (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, version INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests (scope TEXT NOT NULL, key TEXT NOT NULL, digest TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(scope,key));
      CREATE TABLE IF NOT EXISTS offers (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, data TEXT NOT NULL);`);
    this.transaction(() => {
      initialOffers.forEach(offer => this.db.prepare('INSERT OR IGNORE INTO offers(id,created_at,data) VALUES (?,?,?)').run(offer.id, offer.createdAt || '', JSON.stringify(offer)));
      importFixtureReferenceSources(this.db, this.assetsDir);
      if (schemaVersion < 2) {
        for (const row of this.db.prepare('SELECT id,data FROM cases').all()) {
          const c = JSON.parse(row.data as string) as ReviewCase;
          c.revisions.forEach(revision => {
            revision.product ??= c.product; revision.channel ??= c.channel; revision.launchDate ??= c.launchDate;
            revision.contextInherited = true;
          });
          c.findings.forEach(finding => { finding.audience ??= 'internal'; });
          c.publishedFeedback ??= []; c.publishedResults ??= []; c.responses ??= []; c.communications ??= []; c.submitterAssetIds ??= []; c.submitterRevisionIds ??= [];
          this.db.prepare('UPDATE cases SET data=? WHERE id=?').run(JSON.stringify(c), c.id);
        }
        this.db.exec('PRAGMA user_version=2');
      }
    });
  }
  get offers(): Offer[] { return listReferences(this.db); }
  close() { this.db.close(); }
  list(): ReviewCase[] {
    return this.db.prepare("SELECT data FROM cases ORDER BY json_extract(data, '$.updatedAt') DESC, id ASC").all().map(row => JSON.parse(row.data as string));
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
  private validateApplicability(offerId: string, launchDate: string, reason: string) {
    const offer = this.offers.find(item => item.id === offerId);
    if (offer?.withdrawnAt) throw new WorkflowError(400, 'The selected reference was withdrawn. Select a replacement reference.', 'reference_withdrawn');
    if (offer && launchDate && (launchDate < offer.validFrom || launchDate > offer.validTo) && !reason.trim()) throw new WorkflowError(400, 'The target launch is outside this reference’s recorded dates. Select a current reference or record why it applies.', 'reference_date_conflict');
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
  submit(input: SubmissionInput, files: Upload[], key?: string, external = false) {
    return this.request(external ? 'external-submission' : 'submission', key, input, files, written => {
      this.validateOffer(input.offerId, input.product);
      this.validatePackage(input, files);
      const at = now();
      const assets = this.writeAssets(files, written);
      const revision: PackageRevision = {
        id: id(), number: 1, createdAt: at, submittedBy: input.submittedBy, summary: input.summary,
        offerId: input.offerId, intendedUse: input.intendedUse, copy: input.copy, destinationUrl: input.destinationUrl,
        components: assets.map((asset, i) => ({ assetId: asset.id, role: input.fileRoles[i] })),
        product: input.product, channel: input.channel, launchDate: input.launchDate, advertisedOffer: input.advertisedOffer || '',
        applicabilityReason: input.applicabilityReason || '',
      };
      const c: ReviewCase = {
        id: id(), reference: '', title: input.title, product: input.product, submitter: input.submitter,
        submitterEmail: input.submitterEmail, channel: input.channel, launchDate: input.launchDate,
        owner: REVIEWER, nextOwner: REVIEWER, waitingReason: '', status: 'needs_intake', version: 1,
        createdAt: at, updatedAt: at, example: false, confirmedRevisionId: null,
        assets, revisions: [revision], findings: [], notes: [], decisions: [], drafts: [], history: [],
        publishedFeedback: [], publishedResults: [], responses: [], communications: [],
        submitterAssetIds: external ? assets.map(asset => asset.id) : [], submitterRevisionIds: external ? [revision.id] : [],
        ...(external ? { submitterToken: randomBytes(24).toString('base64url') } : {}),
      };
      this.event(c, 'submitted', 'Submission received. Awaiting intake.', input.submittedBy);
      return this.insert(c);
    });
  }
  revise(caseId: string, input: RevisionInput & { expectedVersion: number }, files: Upload[], key?: string, external = false) {
    return this.request(`revision:${caseId}`, key, input, files, written => {
      const c = this.get(caseId);
      this.version(c, input.expectedVersion);
      if (c.cancelled) throw new WorkflowError(409, 'This submission has been cancelled. Start a new submission.');
      this.validateOffer(input.offerId, input.product || c.product);
      const retained = input.retainedComponents;
      if (new Set(retained.map(component => component.assetId)).size !== retained.length || retained.some(component => !c.assets.some(asset => asset.id === component.assetId))) throw new WorkflowError(400, 'Retained attachments must be unique assets from this case.');
      this.validatePackage(input, files, retained);
      const replacements = input.replacements || files.map(() => null);
      if (replacements.length !== files.length || replacements.filter(Boolean).some(assetId => !currentRevision(c).components.some(component => component.assetId === assetId)) || new Set(replacements.filter(Boolean)).size !== replacements.filter(Boolean).length) throw new WorkflowError(400, 'Choose a different current attachment for each replacement.');
      if (replacements.some(assetId => assetId && retained.some(component => component.assetId === assetId))) throw new WorkflowError(400, 'A replaced attachment must not also be retained.');
      const assets = this.writeAssets(files, written);
      const previous = currentRevision(c);
      const revision: PackageRevision = {
        id: id(), number: previous.number + 1, createdAt: now(), submittedBy: input.submittedBy, summary: input.summary,
        offerId: input.offerId, intendedUse: input.intendedUse, copy: input.copy, destinationUrl: input.destinationUrl,
        components: [...retained, ...assets.map((asset, i) => ({ assetId: asset.id, role: input.fileRoles[i], ...(replacements[i] ? { replacesAssetId: replacements[i]! } : {}) }))],
        product: input.product || c.product, channel: input.channel ?? c.channel, launchDate: input.launchDate ?? c.launchDate,
        advertisedOffer: input.advertisedOffer ?? previous.advertisedOffer ?? '', applicabilityReason: input.applicabilityReason || '',
      };
      const context = (r: PackageRevision) => JSON.stringify([r.offerId, r.intendedUse, r.copy, r.destinationUrl, r.product, r.channel, r.launchDate, r.advertisedOffer]);
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
      if (external) { c.submitterAssetIds = [...(c.submitterAssetIds || []), ...assets.map(asset => asset.id)]; c.submitterRevisionIds = [...(c.submitterRevisionIds || []), revision.id]; }
      c.product = revision.product!; c.channel = revision.channel!; c.launchDate = revision.launchDate!;
      c.revisions.push(revision);
      c.confirmedRevisionId = null;
      c.status = 'needs_intake';
      c.nextOwner = c.owner;
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
      const actor = participant(action.actorId);
      if (['approved', 'rejected', 'cancelled'].includes(c.status) && !['add_note', 'save_draft', 'assign_owner', 'correct_contact', 'create_submitter_link', 'rotate_submitter_link', 'publish_result', 'record_communication', 'withdraw_approval', 'cancel', 'add_response', 'assess_response'].includes(action.type)) throw new WorkflowError(409, 'This revision has a final decision. Submit a new revision to resume review.', 'decision_closed');
      const event = (type: string, text: string) => this.event(c, type, text, actor.name);
      if (applyHandoff(c, action, actor.name, this.offers, event)) return this.save(c, action.expectedVersion);
      switch (action.type) {
        case 'confirm_intake': {
          const previousBasis = { offerId: revision.offerId, applicabilityReason: revision.applicabilityReason || '' };
          const nextBasis = { offerId: action.offerId ?? previousBasis.offerId, applicabilityReason: action.applicabilityReason ?? previousBasis.applicabilityReason };
          const basisChanged = previousBasis.offerId !== nextBasis.offerId || previousBasis.applicabilityReason !== nextBasis.applicabilityReason;
          if (basisChanged && c.decisions.some(decision => decision.revisionId === revision.id)) throw new WorkflowError(409, 'Submit a new revision before changing the reference for a previously decided package.');
          this.validateOffer(nextBasis.offerId, c.product, true);
          this.validateApplicability(nextBasis.offerId, c.launchDate, nextBasis.applicabilityReason);
          if (!revision.intendedUse.trim()) throw new WorkflowError(400, 'Describe the intended use before confirming intake.');
          Object.assign(revision, nextBasis);
          if (basisChanged) {
            const addressed = c.findings.filter(finding => finding.status !== 'open');
            addressed.forEach(finding => { finding.needsRecheck = true; });
            event('review_basis_changed', `Review basis changed from ${JSON.stringify(previousBasis)} to ${JSON.stringify(nextBasis)}. ${addressed.length} addressed finding${addressed.length === 1 ? '' : 's'} require recheck.`);
          }
          c.confirmedRevisionId = revision.id; c.status = 'in_review'; c.nextOwner = c.owner; c.waitingReason = '';
          event('intake_confirmed', `Intake confirmed for revision ${revision.number}.`);
          break;
        }
        case 'add_finding': {
          validateFinding(c, action.finding, this.offers);
          const finding = { ...action.finding, audience: action.finding.audience || 'internal' as const, id: id(), number: Math.max(0, ...c.findings.map(f => f.number)) + 1, status: 'open' as const, createdAt: now(), createdBy: actor.name, revisionId: revision.id, needsRecheck: false };
          c.findings.push(finding);
          event('finding_added', `Finding ${finding.number}: ${finding.title}`);
          break;
        }
        case 'disposition': {
          if (c.confirmedRevisionId !== revision.id) throw new WorkflowError(400, 'Confirm the current intake before changing findings.');
          const finding = c.findings.find(f => f.id === action.findingId);
          if (!finding) throw new WorkflowError(404, 'This finding was not found.', 'not_found');
          const responseIds = [...new Set(action.responseIds || [])];
          if (responseIds.some(responseId => !c.responses?.some(response => response.id === responseId && (!response.findingIds.length || response.findingIds.includes(finding.id))))) throw new WorkflowError(400, 'Choose responses linked to this finding or general case responses.');
          const sharedRequest = [...(c.publishedFeedback || [])].reverse().find(feedback => feedback.findings.some(shared => shared.id === finding.id));
          if (action.shareWithSubmitter && !sharedRequest) throw new WorkflowError(400, 'Only a previously shared request can receive a shared status update.');
          finding.status = action.status; finding.needsRecheck = false;
          finding.disposition = { reason: action.reason, at: now(), by: actor.name, revisionId: revision.id, ...(responseIds.length ? { responseIds } : {}) };
          if (action.shareWithSubmitter && sharedRequest) {
            c.publishedRequestUpdates ??= [];
            c.publishedRequestUpdates.push({ findingId: finding.id, feedbackId: sharedRequest.id, revisionId: revision.id, createdAt: now(), by: actor.name, status: action.status === 'resolved' ? 'accepted' : action.status === 'dismissed' ? 'no_longer_required' : 'open', receivedResponseIds: (c.responses || []).map(response => response.id) });
          }
          event(`finding_${action.status}`, `Finding ${finding.number} ${action.status}: ${action.reason}${responseIds.length ? ` Considered responses: ${responseIds.join(', ')}.` : ''}${action.shareWithSubmitter ? ' Request status shared with the submitter; internal reason remains internal.' : ''}`);
          if (actor.role === 'reviewer') {
            for (const response of c.responses || []) {
              if (!responseIds.includes(response.id) || response.assessment) continue;
              const allLinkedRequestsConsidered = response.findingIds.every(findingId => c.findings.some(item => item.id === findingId && !item.needsRecheck && item.disposition?.revisionId === revision.id && item.disposition.responseIds?.includes(response.id)));
              if (allLinkedRequestsConsidered) {
                response.assessment = { at: now(), by: actor.name, note: `Explicitly considered in recorded finding dispositions for revision ${revision.number}.` };
                event('response_assessed', `Response from ${response.author} assessed through the linked finding dispositions. No acknowledgment was automatically shared.`);
              }
            }
          }
          break;
        }
        case 'set_waiting':
          c.status = 'waiting'; c.nextOwner = action.nextOwner; c.waitingReason = action.reason;
          event('waiting', `Waiting on ${action.nextOwner}: ${action.reason}`);
          break;
        case 'resume':
          c.status = c.confirmedRevisionId === revision.id ? 'in_review' : 'needs_intake'; c.nextOwner = c.owner; c.waitingReason = '';
          event('resumed', 'Review resumed.');
          break;
        case 'add_note':
          c.notes.push({ id: id(), text: action.text, author: actor.name, createdAt: now() });
          event('note', 'An internal note was added.');
          break;
        case 'decide': {
          if (actor.role !== 'reviewer') throw new WorkflowError(400, 'Select a reviewer to record a decision.');
          if (!action.rationale.trim()) throw new WorkflowError(400, 'Record the rationale for this decision.');
          if (action.outcome === 'approved') {
            this.validateApplicability(revision.offerId, c.launchDate, revision.applicabilityReason || '');
            if (c.confirmedRevisionId !== revision.id || !action.reviewed || !action.scope.trim()) throw new WorkflowError(400, 'Approval requires confirmed intake, completed review, and a decision scope.', 'approval_requirements');
            if (openBlockers(c).length) throw new WorkflowError(409, 'Material findings still need resolution or recheck.', 'unresolved_findings');
          } else if (!action.rationale.trim()) throw new WorkflowError(400, 'Provide a reason for rejecting this revision.');
          const offer = this.offers.find(item => item.id === revision.offerId);
          c.decisions.push({ id: id(), outcome: action.outcome, reviewer: actor.name, revisionId: revision.id, offerId: revision.offerId, scope: action.scope, rationale: action.rationale, createdAt: now(), findingSnapshot: structuredClone(c.findings), ...(offer ? { offerSnapshot: structuredClone(offer) } : {}) });
          c.status = action.outcome; c.nextOwner = ''; c.waitingReason = '';
          event(action.outcome, `${action.outcome === 'approved' ? 'Approved' : 'Rejected'} revision ${revision.number}. ${action.scope}`);
          break;
        }
        case 'save_draft': {
          if (action.findingIds?.some(findingId => !c.findings.some(finding => finding.id === findingId))) throw new WorkflowError(400, 'Select findings from this case.');
          if (action.decisionId && !c.decisions.some(decision => decision.id === action.decisionId && decision.revisionId === revision.id && !decision.withdrawn)) throw new WorkflowError(400, 'Link this message only to a current, unwithdrawn decision.');
          const existing = action.draftId ? c.drafts.find(draft => draft.id === action.draftId) : undefined;
          if (action.draftId && !existing) throw new WorkflowError(404, 'This draft was not found.');
          if (existing && existing.revisionId !== revision.id) throw new WorkflowError(409, 'This draft belongs to an earlier revision. Create a new draft before reusing it.');
          if (existing) {
            existing.previousVersions ??= [];
            existing.previousVersions.push({ version: existing.version || 1, subject: existing.subject, body: existing.body, at: existing.updatedAt || existing.createdAt, ...(existing.decisionId ? { decisionId: existing.decisionId } : {}) });
            existing.subject = action.subject; existing.body = action.body; existing.findingIds = action.findingIds || [];
            existing.version = (existing.version || 1) + 1; existing.updatedAt = now();
            if (action.decisionId) existing.decisionId = action.decisionId; else delete existing.decisionId;
          } else c.drafts.push({ id: id(), subject: action.subject, body: action.body, createdAt: now(), revisionId: revision.id, status: 'prepared', version: 1, findingIds: action.findingIds || [], ...(action.decisionId ? { decisionId: action.decisionId } : {}) });
          event('draft_prepared', existing ? 'Reply draft updated. Nothing was sent.' : 'Reply draft prepared. Nothing was sent.');
          break;
        }
      }
      return this.save(c, action.expectedVersion);
    });
  }
  getByToken(token: string): ReviewCase {
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new WorkflowError(404, 'This submission link was not found.', 'not_found');
    const row = this.db.prepare("SELECT data FROM cases WHERE json_extract(data, '$.submitterToken')=?").get(token);
    if (!row) throw new WorkflowError(404, 'This submission link was not found or has been replaced.', 'not_found');
    return JSON.parse(row.data as string);
  }
  respond(token: string, input: { expectedVersion: number; submittedBy: string; text: string; findingIds: string[] }, files: Upload[], key?: string) {
    const found = this.getByToken(token);
    return this.request(`response:${found.id}`, key, input, files, written => {
      const c = this.getByToken(token);
      this.version(c, input.expectedVersion);
      const published = new Set((c.publishedFeedback || []).flatMap(feedback => feedback.findings.map(finding => finding.id)));
      if (input.findingIds.some(findingId => !published.has(findingId))) throw new WorkflowError(400, 'Respond only to requests shared on this submission.');
      if (files.reduce((size, file) => size + file.buffer.length, 0) > 25 * 1024 * 1024) throw new WorkflowError(413, 'Response attachments must total 25 MB or less.');
      const assets = this.writeAssets(files, written);
      c.assets.push(...assets); c.submitterAssetIds = [...(c.submitterAssetIds || []), ...assets.map(asset => asset.id)];
      c.responses ??= [];
      c.responses.push({ id: id(), author: input.submittedBy, createdAt: now(), text: input.text, findingIds: [...new Set(input.findingIds)], assetIds: assets.map(asset => asset.id), revisionId: currentRevision(c).id, audience: 'submitter' });
      this.event(c, 'response_received', 'A submitter response was received. Findings still require reviewer disposition.', input.submittedBy);
      return this.save(c, input.expectedVersion);
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
      c.revisions.forEach(revision => { revision.product ??= c.product; revision.channel ??= c.channel; revision.launchDate ??= c.launchDate; revision.contextInherited = true; revision.id = revisionIds.get(revision.id)!; revision.components.forEach(component => { component.assetId = assetIds.get(component.assetId)!; }); });
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
