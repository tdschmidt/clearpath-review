import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { strFromU8, unzipSync } from 'fflate';
import { createApp } from './app.ts';
import { buildReviewExport } from './export.ts';
import { WorkflowStore } from './store.ts';
import { offers, examples } from '../fixtures/examples.ts';
import { currentRevision, pendingResponses, decisionHandoff, pendingDecisionHandoff, REVIEWER } from '../shared/types.ts';
import type { ReviewCase, SubmissionInput } from '../shared/types.ts';

const png = readFileSync('public/fixtures/loan/v1/social-ad.png');
const revisedPng = readFileSync('public/fixtures/loan/v2/social-ad.png');
const destination = readFileSync('public/fixtures/loan/v3/destination.pdf');
type FileInput = { name: string; bytes: Buffer; mime?: string };
const base: SubmissionInput = {
  title: 'Partner creative review', product: 'personal_loan', submitter: 'Nina Patel',
  submitterEmail: 'nina@partner.example', submittedBy: 'Nina Patel', channel: 'Affiliate / social',
  launchDate: '2026-10-05', summary: 'Initial package', offerId: offers[0].id,
  intendedUse: 'Named affiliate social placement and its destination', copy: 'Credit approval required.',
  destinationUrl: '', fileRoles: [],
};
const approved = { type: 'decide', outcome: 'approved', scope: 'This exact creative and supplied destination for the named offer.', rationale: 'Reviewed the supplied creative and destination against the selected offer reference.', reviewed: true };

async function setup(t: TestContext, seedDemo = false) {
  const dataDir = mkdtempSync(join(tmpdir(), 'clearpath-test-'));
  const app = createApp({ dataDir, seedDemo });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    app.locals.store.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  const json = async (path: string, body?: unknown) => {
    const response = await fetch(url + path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  };
  const multipart = async (path: string, payload: unknown, files: FileInput[] = [], key?: string) => {
    const form = new FormData();
    form.set('payload', JSON.stringify(payload));
    files.forEach(file => form.append('files', new Blob([new Uint8Array(file.bytes)], { type: file.mime || 'application/octet-stream' }), file.name));
    const response = await fetch(url + path, { method: 'POST', body: form, headers: key ? { 'Idempotency-Key': key } : {} });
    return { status: response.status, body: await response.json() as any };
  };
  const action = (c: ReviewCase, value: object) => json(`/api/cases/${c.id}/actions`, { expectedVersion: c.version, ...value });
  const revision = (c: ReviewCase, changes: object = {}) => ({
    ...currentRevision(c), submittedBy: 'Nina Patel', summary: 'Updated package',
    retainedComponents: currentRevision(c).components, fileRoles: [], expectedVersion: c.version,
    ...changes,
  });
  // Only user-editable revision input is sent; IDs and timestamps remain server-owned.
  const revise = (c: ReviewCase, changes: object = {}, files: FileInput[] = [], key?: string) => {
    const { id: _id, number: _number, createdAt: _createdAt, components: _components, contextInherited: _inherited, ...input } = revision(c, changes);
    return multipart(`/api/cases/${c.id}/revisions`, input, files, key);
  };
  return { app, dataDir, url, json, multipart, action, revise, initialAssetCount: readdirSync(join(dataDir, 'assets')).length };
}

test('a partial revision keeps its unresolved findings; approval belongs only to the reviewed revision', async t => {
  const h = await setup(t);
  let result = await h.json('/api/examples/personal-loan', {});
  assert.equal(result.status, 201);
  let c: ReviewCase = result.body;
  const firstRevision = structuredClone(currentRevision(c));
  assert.equal(c.findings.length, 2);
  assert.equal(c.findings[0].createdBy, REVIEWER);
  assert.equal((await h.action(c, approved)).body.code, 'unresolved_findings');

  c = (await h.action(c, { type: 'save_draft', subject: 'Changes needed', body: 'Please correct the fee claim and supply the destination.' })).body;
  assert.equal(c.drafts[0].status, 'prepared');
  assert.equal(c.status, 'in_review');
  c = (await h.action(c, { type: 'set_waiting', nextOwner: 'Nina Patel', reason: 'Two items requested in prepared feedback.' })).body;
  assert.equal(c.status, 'waiting');

  result = await h.revise(c, { retainedComponents: currentRevision(c).components.filter(item => item.role === 'evidence'), fileRoles: ['creative'] }, [{ name: 'social-ad.png', bytes: revisedPng }]);
  assert.equal(result.status, 200);
  c = result.body;
  assert.equal(c.status, 'needs_intake');
  assert.equal(c.confirmedRevisionId, null);
  assert.deepEqual(c.revisions[0], firstRevision);
  assert.deepEqual(c.findings.map(f => f.status), ['open', 'open']);
  assert.equal((await h.action(c, approved)).status, 400);
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[0].id, status: 'resolved', reason: 'Reviewed revised image against the 5% offer reference.' })).body;
  assert.equal((await h.action(c, approved)).body.code, 'unresolved_findings');

  c = (await h.revise(c, { fileRoles: ['destination'] }, [{ name: 'destination.pdf', bytes: destination }])).body;
  assert.notEqual(c.findings[0].needsRecheck, true);
  assert.equal(c.findings[1].status, 'open');
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[1].id, status: 'resolved', reason: 'Reviewed supplied destination, terms and relationship to the creative.' })).body;
  c = (await h.action(c, approved)).body;
  assert.equal(c.status, 'approved');
  assert.equal(c.decisions[0].revisionId, currentRevision(c).id);
  assert.equal((await h.action(c, { type: 'resume' })).body.code, 'decision_closed');

  const decision = structuredClone(c.decisions[0]);
  c = (await h.revise(c, { copy: 'A changed caption after approval.' })).body;
  assert.equal(c.status, 'needs_intake');
  assert.equal(c.confirmedRevisionId, null);
  assert.deepEqual(c.decisions[0], decision);
  assert.notEqual(c.decisions[0].revisionId, currentRevision(c).id);
  assert.ok(c.findings.every(f => f.needsRecheck));
});

test('approval gates are explicit while rejection can retain unresolved review issues', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', { ...base, offerId: '', intendedUse: '' })).body;
  assert.equal(c.status, 'needs_intake');
  assert.equal((await h.action(c, { type: 'confirm_intake' })).status, 400);
  const intakeFinding = await h.action(c, { type: 'add_finding', finding: { kind: 'evidence', title: 'Offer reference is missing', detail: 'The applicable offer cannot be established yet.', request: 'Supply the offer reference and intended use.', location: 'Intake', assetId: '', owner: 'Nina Patel', material: true } });
  assert.equal(intakeFinding.status, 200);
  c = intakeFinding.body;
  assert.equal(c.status, 'needs_intake');
  c = (await h.revise(c, { offerId: offers[0].id, intendedUse: base.intendedUse })).body;
  assert.equal((await h.action(c, approved)).body.code, 'approval_requirements');
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  assert.equal((await h.action(c, { ...approved, reviewed: false })).status, 400);
  assert.equal((await h.action(c, { ...approved, scope: ' ' })).status, 400);
  c = (await h.action(c, { type: 'add_finding', finding: { kind: 'evidence', title: 'Unverified funding claim', detail: 'Needs the applicable product fact.', request: 'Supply substantiation.', location: 'Caption', assetId: '', owner: 'Nina Patel', material: true } })).body;
  assert.equal((await h.action(c, { type: 'disposition', findingId: c.findings[0].id, status: 'resolved', reason: '' })).status, 400);
  assert.equal((await h.action(c, { ...approved, outcome: 'rejected', rationale: '' })).status, 400);
  c = (await h.action(c, { ...approved, outcome: 'rejected', reviewed: false, scope: '', rationale: 'Required substantiation was not supplied.' })).body;
  assert.equal(c.status, 'rejected');
  assert.equal(c.findings[0].status, 'open');
  assert.equal(c.decisions[0].rationale, 'Required substantiation was not supplied.');
});

test('rechecks use the resolution package and byte hashes: additions differ from changed creative, context, or removed proof', async t => {
  const h = await setup(t);
  async function resolvedFee() {
    let c: ReviewCase = (await h.json('/api/examples/personal-loan', {})).body;
    c = (await h.revise(c, { retainedComponents: currentRevision(c).components.filter(item => item.role === 'evidence'), fileRoles: ['creative'] }, [{ name: 'social-ad.png', bytes: revisedPng }])).body;
    c = (await h.action(c, { type: 'confirm_intake' })).body;
    c = (await h.action(c, { type: 'disposition', findingId: c.findings[0].id, status: 'resolved', reason: 'Reviewed the replacement creative against the supplied offer reference.' })).body;
    assert.equal(c.findings[0].disposition?.revisionId, currentRevision(c).id);
    assert.notEqual(c.findings[0].revisionId, currentRevision(c).id);
    return c;
  }
  let c = await resolvedFee();
  c = (await h.revise(c, { retainedComponents: currentRevision(c).components.filter(item => item.role === 'evidence'), fileRoles: ['creative'] }, [{ name: 'renamed-unchanged-creative.png', bytes: revisedPng }])).body;
  assert.notEqual(c.findings[0].needsRecheck, true, 'a new filename/asset ID with identical bytes is not changed creative');
  c = (await h.revise(c, { fileRoles: ['destination'] }, [{ name: 'destination.pdf', bytes: destination }])).body;
  assert.notEqual(c.findings[0].needsRecheck, true, 'adding a destination retains the fee resolution against unchanged creative');
  assert.equal(c.findings[1].status, 'open', 'additional evidence never resolves its own finding');
  c = (await h.revise(c, { retainedComponents: currentRevision(c).components.filter(item => item.role !== 'creative'), fileRoles: ['creative'] }, [{ name: 'renamed-unchanged-creative.png', bytes: png }])).body;
  assert.equal(c.findings[0].needsRecheck, true, 'same filename with changed bytes requires recheck');

  c = await resolvedFee();
  c = (await h.revise(c, { retainedComponents: currentRevision(c).components.filter(item => item.role !== 'evidence') })).body;
  assert.equal(c.findings[0].needsRecheck, true, 'removing proof included at resolution requires recheck');
  c = await resolvedFee();
  c = (await h.revise(c, { intendedUse: 'A different audience and placement' })).body;
  assert.equal(c.findings[0].needsRecheck, true, 'changed intended use requires recheck');
});

test('concurrent edits conflict instead of losing work; a successful retry does not duplicate cases or revisions', async t => {
  const h = await setup(t);
  const input = { ...base, fileRoles: ['creative'] };
  const files = [{ name: 'creative.png', bytes: png }];
  const [a, b] = await Promise.all([h.multipart('/api/cases', input, files, 'submission-1'), h.multipart('/api/cases', input, files, 'submission-1')]);
  assert.equal(a.status, 201);
  assert.deepEqual(a.body, b.body);
  assert.equal((await h.json('/api/cases')).body.length, 1);
  assert.equal(readdirSync(join(h.dataDir, 'assets')).length - h.initialAssetCount, 1);
  assert.equal((await h.multipart('/api/cases', { ...input, title: 'Different request' }, files, 'submission-1')).body.code, 'idempotency_conflict');
  const c: ReviewCase = a.body;
  const edits = await Promise.all([h.action(c, { type: 'add_note', text: 'First reviewer observation' }), h.action(c, { type: 'add_note', text: 'Second reviewer observation' })]);
  assert.deepEqual(edits.map(item => item.status).sort(), [200, 409]);
  const latest: ReviewCase = (await h.json(`/api/cases/${c.id}`)).body;
  assert.equal(latest.notes.length, 1);
  const revision = await h.revise(latest, { copy: 'Revised caption' }, [], 'revision-1');
  const retry = await h.revise(latest, { copy: 'Revised caption' }, [], 'revision-1');
  assert.deepEqual(retry, revision);
  assert.equal((await h.revise(latest, { copy: 'Different caption' }, [], 'revision-1')).body.code, 'idempotency_conflict');
  assert.equal((await h.json(`/api/cases/${c.id}`)).body.revisions.length, 2);
  assert.equal((await h.revise(latest, { copy: 'Stale new submission' })).body.code, 'version_conflict');
});

test('assets preserve original bytes and filenames, isolate cases, and force unsupported formats to download', async t => {
  const h = await setup(t);
  const first = await h.multipart('/api/cases', { ...base, fileRoles: ['creative', 'evidence'] }, [{ name: 'same-name.png', bytes: png }, { name: '../../page.html', bytes: Buffer.from('<script>alert(1)</script>'), mime: 'text/html' }]);
  assert.equal(first.status, 201);
  const c: ReviewCase = first.body;
  const image = await fetch(`${h.url}/api/cases/${c.id}/assets/${c.assets[0].id}`);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.match(image.headers.get('content-disposition')!, /^inline/);
  const received = Buffer.from(await image.arrayBuffer());
  assert.deepEqual(received, png);
  assert.equal(c.assets[0].sha256, createHash('sha256').update(received).digest('hex'));
  const html = await fetch(`${h.url}/api/cases/${c.id}/assets/${c.assets[1].id}`);
  assert.equal(html.headers.get('content-type'), 'application/octet-stream');
  assert.match(html.headers.get('content-disposition')!, /^attachment; filename="page.html"/);
  assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
  await html.arrayBuffer();
  const other: ReviewCase = (await h.multipart('/api/cases', base)).body;
  assert.equal((await fetch(`${h.url}/api/cases/${other.id}/assets/${c.assets[0].id}`)).status, 404);
  assert.equal((await h.revise(other, { retainedComponents: [{ assetId: c.assets[0].id, role: 'creative' }] })).status, 400);
  assert.equal((await h.multipart('/api/cases', { ...base, fileRoles: ['creative'] }, [{ name: 'fake.png', bytes: Buffer.from('<html>not an image</html>') }])).body.code, 'invalid_file_type');
  assert.equal((await h.json('/api/cases')).body.length, 2);
  assert.equal(readdirSync(join(h.dataDir, 'assets')).length - h.initialAssetCount, 2);
});

test('server rejects malformed fields, impossible dates, unsafe destinations, and oversized packages without partial writes', async t => {
  const h = await setup(t);
  for (const patch of [{ launchDate: '2026-99-99' }, { launchDate: '2026-02-30' }, { destinationUrl: 'javascript:alert(1)' }, { offerId: offers[1].id }, { product: 'unknown' }, { fileRoles: ['creative'] }, { copy: '', fileRoles: [] }]) {
    assert.equal((await h.multipart('/api/cases', { ...base, ...patch })).status, 400);
  }
  const large = Buffer.alloc(9 * 1024 * 1024);
  large.write('%PDF-1.7');
  assert.equal((await h.multipart('/api/cases', { ...base, fileRoles: ['creative', 'evidence', 'evidence'] }, [1, 2, 3].map(i => ({ name: `${i}.pdf`, bytes: large })))).status, 413);
  assert.equal((await h.multipart('/api/cases', { ...base, fileRoles: ['creative'] }, [{ name: 'huge.pdf', bytes: Buffer.alloc(10 * 1024 * 1024 + 1) }])).status, 413);
  assert.equal((await h.json('/api/cases')).body.length, 0);
  assert.equal(readdirSync(join(h.dataDir, 'assets')).length - h.initialAssetCount, 0);
  const c: ReviewCase = (await h.multipart('/api/cases', base)).body;
  assert.equal((await h.multipart(`/api/cases/${c.id}/revisions`, null)).status, 400);
  assert.equal((await h.action(c, { type: 'confirm_intake', unexpected: true })).status, 400);
});

test('records survive reopening SQLite and authored demos seed only an empty database', async t => {
  const h = await setup(t, true);
  let cases: ReviewCase[] = (await h.json('/api/cases')).body;
  assert.equal(cases.length, 3);
  assert.deepEqual(new Set(cases.map(c => c.product)), new Set(['personal_loan', 'credit_card', 'mortgage']));
  const loan = cases.find(c => c.product === 'personal_loan')!;
  assert.equal(loan.confirmedRevisionId, currentRevision(loan).id);
  assert.ok(loan.findings.every(f => f.assetId === currentRevision(loan).components[0].assetId));
  await h.action(loan, { type: 'add_note', text: 'Persistence check' });
  const reopened = new WorkflowStore(h.dataDir, offers, examples);
  try {
    reopened.seed();
    assert.equal(reopened.list().length, 3);
    assert.equal(reopened.get(loan.id).notes.at(-1)?.text, 'Persistence check');
    const fresh = reopened.freshExample('personal-loan');
    assert.notEqual(fresh.id, loan.id);
    assert.notEqual(fresh.assets[0].id, loan.assets[0].id);
    assert.equal(fresh.findings.length, 2);
    assert.equal(fresh.notes.length, loan.notes.length);
    assert.equal(reopened.list().length, 4);
  } finally { reopened.close(); }
});

test('optional submission notes work, required revision fields name the problem, and failed notes/drafts leave the record unchanged', async t => {
  const h = await setup(t);
  const submission = await h.multipart('/api/cases', { ...base, summary: '' });
  assert.equal(submission.status, 201);
  const c: ReviewCase = submission.body;
  assert.equal(currentRevision(c).summary, '');
  const revision = await h.revise(c, { summary: '' });
  assert.equal(revision.status, 400);
  assert.match(revision.body.error, /summary/i);
  const longContext = await h.revise(c, { intendedUse: 'x'.repeat(3001) });
  assert.equal(longContext.status, 400);
  assert.match(longContext.body.error, /intended use/i);
  assert.equal((await h.action(c, { type: 'add_note', text: '' })).status, 400);
  assert.equal((await h.action(c, { type: 'save_draft', subject: 'Changes requested', body: '' })).status, 400);
  assert.deepEqual((await h.json(`/api/cases/${c.id}`)).body, c);
  const updated: ReviewCase = (await h.action(c, { type: 'add_note', text: 'Private context for the reviewer' })).body;
  assert.equal((await h.action(c, { type: 'save_draft', subject: 'Stale draft', body: 'A draft from the older record' })).status, 409);
  assert.deepEqual((await h.json(`/api/cases/${c.id}`)).body, updated);
});

test('browser writes must originate in the workspace; direct clients remain intentionally unauthenticated', async t => {
  const h = await setup(t);
  const makeForm = () => { const form = new FormData(); form.set('payload', JSON.stringify(base)); return form; };
  const crossSite = await fetch(`${h.url}/api/cases`, { method: 'POST', body: makeForm(), headers: { Origin: 'https://other-site.example' } });
  assert.equal(crossSite.status, 403);
  assert.equal((await crossSite.json()).code, 'cross_site_request');
  const opaqueOrigin = await fetch(`${h.url}/api/cases`, { method: 'POST', body: makeForm(), headers: { Origin: 'null' } });
  assert.equal(opaqueOrigin.status, 403);
  await opaqueOrigin.arrayBuffer();
  const fetchMetadata = await fetch(`${h.url}/api/examples/personal-loan`, { method: 'POST', headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(fetchMetadata.status, 403);
  await fetchMetadata.arrayBuffer();
  assert.equal((await h.json('/api/cases')).body.length, 0);
  const sameSite = await fetch(`${h.url}/api/cases`, { method: 'POST', body: makeForm(), headers: { Origin: h.url } });
  assert.equal(sameSite.status, 201);
  await sameSite.arrayBuffer();
  assert.equal((await h.multipart('/api/cases', base)).status, 201);
  assert.equal((await h.json('/api/cases')).body.length, 2);
});

test('the review ZIP preserves every original and immutable decision basis while excluding notes and prepared replies', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.json('/api/examples/personal-loan', {})).body;
  c = (await h.action(c, { ...approved, outcome: 'rejected', rationale: 'Fee claim conflicts with supplied offer; destination rendition is missing.' })).body;
  const recordedDecision = structuredClone(c.decisions[0]);
  assert.deepEqual(recordedDecision.findingSnapshot?.map(finding => finding.status), ['open', 'open']);
  assert.equal(recordedDecision.offerSnapshot?.id, offers[0].id);
  c = (await h.action(c, { type: 'add_note', text: 'INTERNAL_NOTE_SHOULD_NOT_EXPORT_4289' })).body;
  c = (await h.action(c, { type: 'save_draft', subject: 'PRIVATE_DRAFT_SUBJECT_4289', body: 'PRIVATE_DRAFT_BODY_4289' })).body;
  c = (await h.revise(c, { retainedComponents: currentRevision(c).components.filter(component => component.role === 'evidence'), fileRoles: ['creative'], copy: '<script>Submitted text is data</script>' }, [{ name: 'social-ad.png', bytes: revisedPng }])).body;
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[0].id, status: 'resolved', reason: 'Reviewed the replacement image against the original offer reference.' })).body;
  assert.deepEqual(c.decisions[0], recordedDecision);
  assert.equal(c.findings[0].status, 'resolved');

  const response = await fetch(`${h.url}/api/cases/${c.id}/export`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/zip');
  assert.match(response.headers.get('content-disposition')!, new RegExp(`${c.reference}-review-record\\.zip`));
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  assert.equal(Object.keys(files).length, c.assets.length + 3);
  const report = strFromU8(files['review-record.md']);
  const record = JSON.parse(strFromU8(files['review-record.json']));
  assert.equal(record.label, 'Internal review record');
  assert.equal(record.case.notes, undefined);
  assert.equal(record.case.drafts, undefined);
  assert.ok(record.case.history.every((event: { type: string }) => !['note', 'draft_prepared'].includes(event.type)));
  assert.deepEqual(record.case.decisions[0], recordedDecision);
  assert.equal(record.case.findings[0].status, 'resolved');
  assert.equal(record.case.decisions[0].findingSnapshot?.[0].status, 'open');
  assert.equal(record.catalogReferences[0].offer.id, offers[0].id);
  assert.match(report, /Internal review record/);
  assert.match(report, /Finding snapshot captured at decision time/);
  assert.ok(!report.includes('<script>'));
  for (const secret of ['INTERNAL_NOTE_SHOULD_NOT_EXPORT_4289', 'PRIVATE_DRAFT_SUBJECT_4289', 'PRIVATE_DRAFT_BODY_4289']) {
    assert.ok(!report.includes(secret));
    assert.ok(!JSON.stringify(record).includes(secret));
  }
  assert.equal(new Set(record.assetManifest.map((asset: { archivePath: string }) => asset.archivePath)).size, c.assets.length + 1);
  for (const asset of record.assetManifest) {
    assert.match(asset.archivePath, /^originals\/[a-zA-Z0-9._-]+$/);
    assert.ok(!asset.archivePath.split('/').includes('..'));
    assert.deepEqual(Buffer.from(files[asset.archivePath]), readFileSync(join(h.dataDir, 'assets', asset.id)));
    assert.equal(createHash('sha256').update(files[asset.archivePath]).digest('hex'), asset.sha256);
    assert.ok(asset.versions.length > 0 || asset.offerIds.length > 0);
  }
  assert.equal(record.assetManifest.filter((asset: { name: string }) => asset.name === 'social-ad.png').length, 2);
  assert.deepEqual((await h.json(`/api/cases/${c.id}`)).body, c, 'export must not write a case event or version');

  const legacy = structuredClone(c);
  delete legacy.decisions[0].findingSnapshot;
  delete legacy.decisions[0].offerSnapshot;
  const legacyZip = unzipSync(buildReviewExport(legacy, offers, join(h.dataDir, 'assets')).bytes);
  assert.match(strFromU8(legacyZip['review-record.md']), /No finding snapshot was recorded for this decision/);
  assert.match(strFromU8(legacyZip['review-record.md']), /No offer snapshot was recorded for this decision/);
  assert.equal(JSON.parse(strFromU8(legacyZip['review-record.json'])).case.decisions[0].findingSnapshot, undefined);
});

test('export fails explicitly for oversized, changed, or missing originals and never mutates the case', async t => {
  const h = await setup(t);
  const c: ReviewCase = (await h.multipart('/api/cases', { ...base, fileRoles: ['creative'] }, [{ name: 'creative.png', bytes: png }])).body;
  const path = join(h.dataDir, 'assets', c.assets[0].id);
  const changed = Buffer.from(png);
  changed[changed.length - 1] ^= 1;
  writeFileSync(path, changed);
  let response = await fetch(`${h.url}/api/cases/${c.id}/export`);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'asset_integrity_error');
  // Sparse expansion checks the cap without allocating an oversized test buffer.
  truncateSync(path, 100 * 1024 * 1024 + 1);
  response = await fetch(`${h.url}/api/cases/${c.id}/export`);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, 'export_too_large');
  rmSync(path);
  response = await fetch(`${h.url}/api/cases/${c.id}/export`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, 'asset_unavailable');
  assert.deepEqual((await h.json(`/api/cases/${c.id}`)).body, c);
});


test('findings and decisions require a recorded human basis on the server', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', base)).body;
  const emptyFinding = { kind: 'question', title: 'Check claim', detail: ' ', request: 'Confirm the claim.', location: 'Caption', assetId: '', owner: REVIEWER, material: true };
  assert.equal((await h.action(c, { type: 'add_finding', finding: emptyFinding })).status, 400);
  assert.equal(h.app.locals.store.get(c.id).version, c.version);
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  assert.equal((await h.action(c, { ...approved, rationale: ' ' })).status, 400);
  assert.equal(h.app.locals.store.get(c.id).decisions.length, 0);
  assert.throws(() => h.app.locals.store.action(c.id, { ...approved, rationale: '', expectedVersion: c.version }), /rationale/);
  assert.throws(() => h.app.locals.store.action(c.id, { type: 'add_finding', finding: emptyFinding, expectedVersion: c.version }), /basis/);
});

test('reference versions preserve source bytes, citations, persistence, and withdrawal', async t => {
  const h = await setup(t);
  const input = { product: 'personal_loan', name: 'Fall offer', version: '1', validFrom: '2026-09-01', validTo: '2026-12-01', source: 'Pricing approved September 1', disclosure: 'Credit approval required.', actorId: 'priya', facts: [{ label: 'Fee', value: '5%', sourceFileIndex: 0, page: 1 }] };
  assert.equal((await h.multipart('/api/offers', input)).status, 400);
  let result = await h.multipart('/api/offers', input, [{ name: 'terms.pdf', bytes: destination }]);
  assert.equal(result.status, 201);
  const offer = result.body;
  assert.equal(offer.createdBy, 'Priya Shah');
  assert.equal(offer.facts[0].citation.offerId, offer.id);
  const download = await fetch(`${h.url}/api/offers/${offer.id}/assets/${offer.assets[0].id}`);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), destination);
  const second = new WorkflowStore(h.dataDir, []);
  assert.equal(second.offers.find(item => item.id === offer.id)?.facts[0].value, '5%');
  second.close();
  assert.equal((await h.json(`/api/offers/${offer.id}`, { facts: [] })).status, 404);
  result = await h.json(`/api/offers/${offer.id}/withdraw`, { reason: 'Pricing superseded this reference.', actorId: 'priya' });
  assert.equal(result.status, 200);
  assert.ok(result.body.withdrawnAt);
  assert.equal((await h.json(`/api/offers/${offer.id}/withdraw`, { reason: 'Again' })).status, 409);
});

test('legacy migration backs up records and preserves original IDs and bytes without sharing them', async t => {
  const h = await setup(t, true);
  const before = h.app.locals.store.list() as ReviewCase[];
  h.app.locals.store.db.exec('PRAGMA user_version=0');
  const migrated = new WorkflowStore(h.dataDir, offers);
  const after = migrated.list();
  assert.deepEqual(after.map(c => c.id).sort(), before.map(c => c.id).sort());
  assert.ok(readdirSync(h.dataDir).some(name => name.startsWith('workflow-before-v2-')));
  for (const c of after) {
    assert.equal(c.submitterToken, undefined);
    assert.deepEqual(c.submitterAssetIds, []);
    assert.ok(c.revisions.every(revision => revision.contextInherited));
    assert.ok(c.findings.every(finding => finding.audience === 'internal'));
    c.assets.forEach(asset => assert.equal(createHash('sha256').update(readFileSync(join(h.dataDir, 'assets', asset.id))).digest('hex'), asset.sha256));
  }
  migrated.close();
});

test('submitter receipt and return links expose only submitted material and cannot cross case boundaries', async t => {
  const h = await setup(t);
  const { offerId: _offerId, ...publicInput } = base;
  const first = await h.multipart('/api/submissions', { ...publicInput, advertisedOffer: 'Fall personal loan', fileRoles: ['creative'] }, [{ name: 'ad.png', bytes: png }], 'first-public');
  assert.equal(first.status, 201);
  const { token, submission } = first.body;
  assert.equal(submission.status, 'received');
  assert.ok(token);
  assert.equal((await h.multipart('/api/submissions', { ...publicInput, advertisedOffer: 'Fall personal loan', fileRoles: ['creative'] }, [{ name: 'ad.png', bytes: png }], 'first-public')).body.token, token);
  let c = (h.app.locals.store.list() as ReviewCase[]).find(item => item.reference === submission.reference)!;
  c = (await h.action(c, { type: 'add_note', text: 'Private legal discussion.' })).body;
  c = (await h.revise(c, { fileRoles: ['evidence'], summary: 'Internal-only revision summary sentinel' }, [{ name: 'internal-terms.pdf', bytes: destination }])).body;
  const external = (await h.json(`/api/submissions/${token}`)).body;
  assert.equal(external.assets.length, 1);
  assert.equal(external.revisions.at(-1).components.length, 1);
  for (const field of ['notes', 'history', 'findings', 'decisions', 'drafts', 'offerId', 'submitterToken']) assert.equal(external[field], undefined);
  assert.equal(JSON.stringify(external).includes('Private legal discussion'), false);
  assert.equal(JSON.stringify(external).includes('Internal-only revision summary sentinel'), false);
  assert.equal(external.revisions.length, 1);
  assert.equal(JSON.stringify(external).includes('internal-terms.pdf'), false);
  const privateAsset = c.assets.at(-1)!;
  assert.equal((await fetch(`${h.url}/api/submissions/${token}/assets/${privateAsset.id}`)).status, 404);
  const other = (await h.multipart('/api/submissions', publicInput)).body;
  assert.equal((await fetch(`${h.url}/api/submissions/${other.token}/assets/${submission.assets[0].id}`)).status, 404);
  assert.equal((await h.json(`/api/submissions/${token}/actions`, { type: 'decide' })).status, 404);
  assert.equal((await h.json('/api/submissions/not-a-link')).status, 404);
  assert.equal((await h.multipart(`/api/submissions/${token}/responses`, { expectedVersion: c.version, submittedBy: 'Nina Patel', text: 'A response', findingIds: ['unpublished'] })).status, 400);
  const response = await h.multipart(`/api/submissions/${token}/responses`, { expectedVersion: c.version, submittedBy: 'Nina Patel', text: 'Here is supporting evidence.', findingIds: [] }, [{ name: 'response.pdf', bytes: destination }]);
  assert.equal(response.status, 200);
  assert.equal(response.body.responses.length, 1);
  assert.equal(response.body.assets.length, 2);
});

test('explicit replacements preserve originals and capture placement and launch in each revision', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', { ...base, fileRoles: ['creative'] }, [{ name: 'ad.png', bytes: png }])).body;
  const oldAsset = c.assets[0].id;
  assert.equal((await h.revise(c, { fileRoles: ['creative'], replacements: [oldAsset] }, [{ name: 'ad.png', bytes: revisedPng }])).status, 400);
  c = (await h.revise(c, { retainedComponents: [], fileRoles: ['creative'], replacements: [oldAsset], channel: 'Email', launchDate: '2026-11-02' }, [{ name: 'ad.png', bytes: revisedPng }])).body;
  assert.equal(c.assets.length, 2);
  assert.equal(currentRevision(c).components[0].replacesAssetId, oldAsset);
  assert.equal(currentRevision(c).channel, 'Email');
  assert.equal(currentRevision(c).launchDate, '2026-11-02');
  assert.equal(c.revisions[0].channel, base.channel);
  assert.equal(c.revisions[0].launchDate, base.launchDate);
});

test('published feedback separates audience and freezes requests; responses and draft edits never resolve findings', async t => {
  const h = await setup(t);
  const { offerId: _offer, ...input } = base;
  const receipt = (await h.multipart('/api/submissions', { ...input, fileRoles: ['creative'] }, [{ name: 'ad.png', bytes: png }])).body;
  let c = (h.app.locals.store.list() as ReviewCase[]).find(item => item.reference === receipt.submission.reference)!;
  c = (await h.action(c, { type: 'confirm_intake', offerId: offers[0].id, actorId: 'jonah' })).body;
  const finding = { kind: 'correction', title: 'Fee claim', detail: 'Internal pricing analysis sentinel', request: 'Revise the fee claim.', location: 'Headline', assetId: c.assets[0].id, owner: 'Nina Patel', material: true, audience: 'submitter', citations: [{ revisionId: currentRevision(c).id, assetId: c.assets[0].id, page: 1 }] };
  c = (await h.action(c, { type: 'add_finding', finding, actorId: 'jonah' })).body;
  assert.equal(c.findings[0].createdBy, 'Jonah Reed');
  c = (await h.action(c, { type: 'add_finding', finding: { ...finding, title: 'Pricing question', audience: 'internal', owner: 'Priya Shah', assetId: '', citations: [] } })).body;
  assert.equal((await h.action(c, { type: 'publish_feedback', subject: 'Feedback', body: 'Please revise.', findingIds: [c.findings[1].id] })).status, 400);
  c = (await h.action(c, { type: 'publish_feedback', subject: 'Please revise', body: 'Please address the fee claim.', findingIds: [c.findings[0].id] })).body;
  const publication = structuredClone(c.publishedFeedback![0]);
  c = (await h.action(c, { type: 'edit_finding', findingId: c.findings[0].id, finding: { ...finding, request: 'Amended request after publication.' } })).body;
  assert.deepEqual(c.publishedFeedback![0], publication);
  assert.equal(c.findings[0].amendments!.length, 1);
  c = (await h.action(c, { type: 'add_response', text: 'Internal specialist response sentinel', findingIds: [c.findings[1].id], actorId: 'priya' })).body;
  const externalResponse = await h.multipart(`/api/submissions/${receipt.token}/responses`, { expectedVersion: c.version, submittedBy: 'Nina Patel', text: 'I will revise the claim.', findingIds: [c.findings[0].id] });
  assert.equal(externalResponse.status, 200);
  assert.equal(JSON.stringify(externalResponse.body).includes('Internal pricing analysis sentinel'), false);
  assert.equal(JSON.stringify(externalResponse.body).includes('Internal specialist response sentinel'), false);
  assert.equal(externalResponse.body.feedback[0].findings[0].request, 'Revise the fee claim.');
  c = h.app.locals.store.get(c.id);
  assert.ok(c.findings.every(finding => finding.status === 'open'));
  c = (await h.action(c, { type: 'save_draft', subject: 'First', body: 'First exact message', findingIds: [c.findings[0].id] })).body;
  const draftId = c.drafts[0].id;
  c = (await h.action(c, { type: 'save_draft', draftId, subject: 'Edited', body: 'Edited exact message' })).body;
  assert.equal(c.drafts[0].version, 2);
  assert.equal(c.drafts[0].previousVersions![0].body, 'First exact message');
  c = (await h.action(c, { type: 'record_communication', messageId: draftId, messageVersion: 1, recipient: base.submitterEmail, occurredAt: new Date().toISOString(), channel: 'Email', note: 'Recorded manually.', actorId: 'jonah' })).body;
  assert.equal(c.communications![0].actor, 'Jonah Reed');
  assert.equal(c.communications![0].messageVersion, 1);
  const originalToken = c.submitterToken;
  c = (await h.action(c, { type: 'rotate_submitter_link' })).body;
  assert.notEqual(c.submitterToken, originalToken);
  assert.equal((await h.json(`/api/submissions/${originalToken}`)).status, 404);
});

test('offer applicability requires a human explanation and withdrawal invalidates intake and approval', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', { ...base, launchDate: '2026-12-15' })).body;
  assert.equal((await h.action(c, { type: 'confirm_intake' })).body.code, 'reference_date_conflict');
  c = (await h.action(c, { type: 'confirm_intake', applicabilityReason: 'Pricing confirmed this reference applies to the later placement.' })).body;
  assert.equal(currentRevision(c).applicabilityReason, 'Pricing confirmed this reference applies to the later placement.');
  assert.equal((await h.action(c, { ...approved, actorId: 'priya' })).status, 400);
  await h.json(`/api/offers/${base.offerId}/withdraw`, { reason: 'Reference superseded.' });
  assert.equal((await h.action(c, approved)).body.code, 'reference_withdrawn');
});

test('shared decisions contain exact deliverables, withdrawals supersede them without leaking rationale', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', { ...base, fileRoles: ['creative', 'evidence'] }, [{ name: 'ad.png', bytes: png }, { name: 'internal-reference.pdf', bytes: destination }])).body;
  c = (await h.action(c, { type: 'create_submitter_link' })).body;
  assert.equal((await h.json(`/api/submissions/${c.submitterToken}`)).body.revisions.length, 0);
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  c = (await h.action(c, approved)).body;
  const originalDecision = structuredClone(c.decisions[0]);
  assert.equal((await h.action(c, { type: 'cancel', reason: 'Stop campaign' })).status, 409);
  c = (await h.action(c, { type: 'publish_result', decisionId: c.decisions[0].id, message: 'Approved only for the recorded scope.' })).body;
  let external = (await h.json(`/api/submissions/${c.submitterToken}`)).body;
  assert.equal(external.status, 'approved');
  assert.equal(external.results[0].scope, approved.scope);
  assert.equal(external.assets.length, 1);
  assert.equal(JSON.stringify(external).includes('internal-reference.pdf'), false);
  assert.equal(JSON.stringify(external).includes(approved.rationale), false);
  assert.equal(external.revisions[0].summary, 'Material shared by the review team');
  c = (await h.action(c, { type: 'withdraw_approval', decisionId: c.decisions[0].id, reason: 'Private withdrawal basis sentinel', actorId: 'jonah' })).body;
  assert.equal(c.decisions[0].rationale, originalDecision.rationale);
  assert.equal(c.decisions[0].withdrawn?.by, 'Jonah Reed');
  external = (await h.json(`/api/submissions/${c.submitterToken}`)).body;
  assert.equal(external.status, 'withdrawn');
  assert.equal(JSON.stringify(external).includes('Private withdrawal basis sentinel'), false);
  c = (await h.action(c, { type: 'cancel', reason: 'Private cancellation basis sentinel' })).body;
  assert.equal(c.status, 'cancelled');
  external = (await h.json(`/api/submissions/${c.submitterToken}`)).body;
  assert.equal(external.status, 'cancelled');
  assert.equal(JSON.stringify(external).includes('Private cancellation basis sentinel'), false);
  assert.equal((await h.revise(c)).status, 409);
});

test('reference retries preserve one version and archives include source originals without return-link tokens', async t => {
  const h = await setup(t);
  const input = { product: 'personal_loan', name: 'Reference retry', version: '1', validFrom: '2026-09-01', validTo: '2026-12-01', source: 'Product team supplied this document.', disclosure: '', facts: [{ label: 'Fee', value: '5%', sourceFileIndex: 0, page: 1 }] };
  const files = [{ name: 'terms.pdf', bytes: destination }];
  const first = await h.multipart('/api/offers', input, files, 'reference-1');
  assert.equal(first.status, 201);
  assert.deepEqual((await h.multipart('/api/offers', input, files, 'reference-1')).body, first.body);
  assert.equal((await h.multipart('/api/offers', { ...input, source: 'Different content' }, files, 'reference-1')).body.code, 'idempotency_conflict');
  assert.equal((await h.multipart('/api/offers', input, files)).status, 409);
  let c: ReviewCase = (await h.multipart('/api/cases', { ...base, offerId: first.body.id })).body;
  c = (await h.action(c, { type: 'create_submitter_link' })).body;
  c = (await h.action(c, { type: 'save_draft', subject: 'Recorded message', body: 'This is the exact externally communicated message.' })).body;
  c = (await h.action(c, { type: 'record_communication', messageId: c.drafts[0].id, messageVersion: 1, recipient: base.submitterEmail, occurredAt: new Date().toISOString(), channel: 'Email', note: '' })).body;
  const archive = buildReviewExport(c, h.app.locals.store.offers, h.app.locals.store.assetsDir);
  const entries = unzipSync(archive.bytes);
  const recordText = strFromU8(entries['review-record.json']);
  assert.equal(recordText.includes(c.submitterToken!), false);
  const record = JSON.parse(recordText);
  assert.equal(record.communicatedMessages[0].body, 'This is the exact externally communicated message.');
  const source = record.assetManifest.find((asset: { id: string }) => asset.id === first.body.assets[0].id);
  assert.ok(source);
  assert.deepEqual(Buffer.from(entries[source.archivePath]), destination);
  assert.equal(record.case.drafts, undefined);
  assert.deepEqual(record.assetManifest[0].offerIds, [first.body.id]);
});


test('historical material citations stay editable and reference sources cannot cross cases', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', { ...base, fileRoles: ['creative'] }, [{ name: 'ad.png', bytes: png }])).body;
  const oldAsset = c.assets[0].id;
  const oldRevision = currentRevision(c).id;
  const finding = { kind: 'correction', title: 'Fee claim', detail: 'The offer includes a fee.', request: 'Revise the claim.', location: 'Headline', assetId: oldAsset, owner: base.submitter, material: true, citations: [{ revisionId: oldRevision, assetId: oldAsset, page: 1 }] };
  c = (await h.action(c, { type: 'add_finding', finding })).body;
  c = (await h.revise(c, { retainedComponents: [], fileRoles: ['creative'], replacements: [oldAsset] }, [{ name: 'ad.png', bytes: revisedPng }])).body;
  const revised = await h.action(c, { type: 'edit_finding', findingId: c.findings[0].id, finding: { ...finding, request: 'Check the new version against this old claim.' } });
  assert.equal(revised.status, 200);
  c = revised.body;
  assert.equal(c.findings[0].citations?.[0].revisionId, oldRevision);
  assert.equal(c.findings[0].assetId, oldAsset);
  const second: ReviewCase = (await h.multipart('/api/cases', { ...base, fileRoles: ['creative'] }, [{ name: 'other.png', bytes: png }])).body;
  assert.equal((await h.action(c, { type: 'add_finding', finding: { ...finding, citations: [{ revisionId: currentRevision(second).id, assetId: second.assets[0].id }] } })).status, 400);
  assert.equal((await h.action(c, { type: 'add_finding', finding: { ...finding, sourceCitations: [{ offerId: base.offerId, assetId: second.assets[0].id, page: 1 }] } })).status, 400);
  const reference = h.app.locals.store.offers.find((offer: { id: string }) => offer.id === base.offerId);
  assert.equal((await h.action(c, { type: 'add_finding', finding: { ...finding, sourceCitations: [reference.facts[0].citation] } })).status, 200);
});


test('changing an intake reference or applicability basis requires explicit recheck of prior resolutions', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', base)).body;
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  const finding = { kind: 'question', title: 'Check fee terms', detail: 'The recorded offer is the basis for this review.', request: 'Confirm the fee terms.', location: 'Caption', assetId: '', owner: REVIEWER, material: true };
  c = (await h.action(c, { type: 'add_finding', finding })).body;
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[0].id, status: 'resolved', reason: 'Checked against the original reference.' })).body;
  const originalDisposition = structuredClone(c.findings[0].disposition);
  c = (await h.revise(c, { fileRoles: ['evidence'] }, [{ name: 'extra-evidence.pdf', bytes: destination }])).body;
  assert.notEqual(c.findings[0].needsRecheck, true);
  const reference = (await h.multipart('/api/offers', { product: 'personal_loan', name: 'Changed offer terms', version: '4', validFrom: '2026-09-01', validTo: '2026-11-30', source: 'New reference supplied for re-review.', disclosure: '', facts: [{ label: 'Fee', value: 'Different terms require review', sourceFileIndex: 0, page: 1 }] }, [{ name: 'changed-terms.pdf', bytes: destination }])).body;
  c = (await h.action(c, { type: 'confirm_intake', offerId: reference.id })).body;
  assert.equal(c.findings[0].status, 'resolved');
  assert.equal(c.findings[0].needsRecheck, true);
  assert.deepEqual(c.findings[0].disposition, originalDisposition);
  const basisChange = c.history.findLast(event => event.type === 'review_basis_changed')!;
  assert.ok(basisChange.text.includes(base.offerId));
  assert.ok(basisChange.text.includes(reference.id));
  assert.equal((await h.action(c, approved)).body.code, 'unresolved_findings');
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[0].id, status: 'dismissed', reason: 'Rechecked and documented why no change is needed.' })).body;
  c = (await h.action(c, { type: 'confirm_intake', offerId: reference.id })).body;
  assert.notEqual(c.findings[0].needsRecheck, true);
  c = (await h.action(c, { type: 'confirm_intake', applicabilityReason: 'Updated applicability explanation.' })).body;
  assert.equal(c.findings[0].needsRecheck, true);
  assert.equal((await h.action(c, approved)).body.code, 'unresolved_findings');
});


test('responses remain actionable until assessed and acknowledgment never substitutes for finding disposition', async t => {
  const h = await setup(t);
  const { offerId: _offer, ...input } = base;
  const receipt = (await h.multipart('/api/submissions', input)).body;
  let c = (h.app.locals.store.list() as ReviewCase[]).find(item => item.reference === receipt.submission.reference)!;
  c = (await h.action(c, { type: 'confirm_intake', offerId: base.offerId })).body;
  c = (await h.action(c, { type: 'add_finding', finding: { kind: 'evidence', title: 'Fee proof', detail: 'Needs substantiation.', request: 'Supply fee evidence.', location: 'Caption', assetId: '', owner: base.submitter, material: true, audience: 'submitter' } })).body;
  c = (await h.action(c, { type: 'publish_feedback', subject: 'Fee evidence', body: 'Please attach the fee evidence.', findingIds: [c.findings[0].id], waiting: { nextOwner: base.submitter, reason: 'Evidence and a separate specialist review are outstanding.' } })).body;
  assert.equal(c.status, 'waiting');
  await h.multipart(`/api/submissions/${receipt.token}/responses`, { expectedVersion: c.version, submittedBy: base.submitter, text: 'Attached.', findingIds: [c.findings[0].id] }, [{ name: 'proof.pdf', bytes: destination }]);
  c = h.app.locals.store.get(c.id);
  const response = c.responses![0];
  assert.equal(pendingResponses(c).length, 1);
  assert.equal(c.status, 'waiting');
  assert.equal((await h.json(`/api/submissions/${receipt.token}`)).body.sharedRequests[0].status, 'response_received');
  assert.equal((await h.action(c, { type: 'assess_response', responseId: response.id, note: 'Specialist cannot assess.', actorId: 'priya' })).status, 400);
  c = (await h.action(c, { type: 'assess_response', responseId: response.id, note: 'PRIVATE_ASSESSMENT_SENTINEL', sharedMessage: 'We reviewed your response. The request still needs a decision.' })).body;
  assert.equal(pendingResponses(c).length, 0);
  assert.equal(c.findings[0].status, 'open');
  assert.equal(c.status, 'waiting');
  assert.equal(c.nextOwner, base.submitter);
  let external = (await h.json(`/api/submissions/${receipt.token}`)).body;
  assert.equal(external.responses[0].assessment, undefined);
  assert.equal(JSON.stringify(external).includes('PRIVATE_ASSESSMENT_SENTINEL'), false);
  assert.equal(external.responses[0].sharedAcknowledgment.message, 'We reviewed your response. The request still needs a decision.');
  assert.equal((await h.action(c, { type: 'assess_response', responseId: response.id, note: 'Overwrite assessment' })).status, 409);
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[0].id, status: 'resolved', reason: 'PRIVATE_RESOLUTION_SENTINEL', responseIds: [response.id] })).body;
  assert.deepEqual(c.findings[0].disposition?.responseIds, [response.id]);
  external = (await h.json(`/api/submissions/${receipt.token}`)).body;
  assert.equal(external.sharedRequests[0].status, 'open');
  assert.equal(JSON.stringify(external).includes('PRIVATE_RESOLUTION_SENTINEL'), false);
  c = (await h.action(c, approved)).body;
  await h.multipart(`/api/submissions/${receipt.token}/responses`, { expectedVersion: c.version, submittedBy: base.submitter, text: 'A late clarification.', findingIds: [] });
  c = h.app.locals.store.get(c.id);
  assert.equal(pendingResponses(c).length, 1);
  c = (await h.action(c, { type: 'assess_response', responseId: c.responses!.at(-1)!.id, note: 'Read after the decision.' })).body;
  assert.equal(c.status, 'approved');
  assert.equal(pendingResponses(c).length, 0);
});

test('shared requests aggregate batches and expose only explicitly shared dispositions for the applicable revision', async t => {
  const h = await setup(t);
  const { offerId: _offer, ...input } = base;
  const receipt = (await h.multipart('/api/submissions', input)).body;
  let c = (h.app.locals.store.list() as ReviewCase[]).find(item => item.reference === receipt.submission.reference)!;
  c = (await h.action(c, { type: 'confirm_intake', offerId: base.offerId })).body;
  const finding = { kind: 'question', title: 'First request', detail: 'Internal reasoning.', request: 'Confirm the terms.', location: 'Caption', assetId: '', owner: base.submitter, material: true, audience: 'submitter' };
  c = (await h.action(c, { type: 'add_finding', finding })).body;
  c = (await h.action(c, { type: 'add_finding', finding: { ...finding, title: 'Second request' } })).body;
  const [first, second] = c.findings;
  c = (await h.action(c, { type: 'publish_feedback', subject: 'First batch', body: 'First request.', findingIds: [first.id] })).body;
  c = (await h.action(c, { type: 'publish_feedback', subject: 'Second batch', body: 'Second request.', findingIds: [second.id] })).body;
  let external = (await h.json(`/api/submissions/${receipt.token}`)).body;
  assert.deepEqual(external.sharedRequests.map((request: { findingId: string }) => request.findingId), [first.id, second.id]);
  c = (await h.action(c, { type: 'disposition', findingId: first.id, status: 'resolved', reason: 'PRIVATE_STATUS_BASIS', shareWithSubmitter: true })).body;
  external = (await h.json(`/api/submissions/${receipt.token}`)).body;
  assert.equal(external.sharedRequests[0].status, 'accepted');
  assert.equal(external.sharedRequests[1].status, 'open');
  assert.equal(external.sharedRequests[0].statusRevisionId, currentRevision(c).id);
  assert.equal(JSON.stringify(external).includes('PRIVATE_STATUS_BASIS'), false);
  c = (await h.action(c, { type: 'disposition', findingId: second.id, status: 'dismissed', reason: 'No longer needed.', shareWithSubmitter: true })).body;
  assert.equal((await h.json(`/api/submissions/${receipt.token}`)).body.sharedRequests[1].status, 'no_longer_required');
  await h.multipart(`/api/submissions/${receipt.token}/revisions`, { submittedBy: base.submitter, summary: 'New creative copy.', intendedUse: base.intendedUse, copy: 'A changed caption.', destinationUrl: '', retainedComponents: [], fileRoles: [], expectedVersion: c.version });
  c = h.app.locals.store.get(c.id);
  external = (await h.json(`/api/submissions/${receipt.token}`)).body;
  assert.ok(external.sharedRequests.every((request: { status: string }) => request.status === 'open'));
  assert.notEqual(external.sharedRequests[0].statusRevisionId, currentRevision(c).id);
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  c = (await h.action(c, { type: 'disposition', findingId: first.id, status: 'open', reason: 'Need new wording.' })).body;
  c = (await h.action(c, { type: 'edit_finding', findingId: first.id, finding: { ...finding, request: 'Updated explicitly shared request.' } })).body;
  c = (await h.action(c, { type: 'publish_feedback', subject: 'Revised request', body: 'Use the updated request.', findingIds: [first.id] })).body;
  external = (await h.json(`/api/submissions/${receipt.token}`)).body;
  assert.equal(external.sharedRequests.length, 2);
  assert.equal(external.sharedRequests[0].request, 'Updated explicitly shared request.');
  assert.equal(external.feedback[0].findings[0].request, 'Confirm the terms.');
  assert.equal(external.sharedRequests[0].status, 'open');
});

test('dispositions cannot cite another finding’s response or share an unpublished request', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', base)).body;
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  const finding = { kind: 'question', title: 'Unshared request', detail: 'Internal question.', request: 'Confirm.', location: 'Caption', assetId: '', owner: REVIEWER, material: true };
  c = (await h.action(c, { type: 'add_finding', finding })).body;
  c = (await h.action(c, { type: 'add_finding', finding: { ...finding, title: 'Another request' } })).body;
  c = (await h.action(c, { type: 'add_response', text: 'For the first finding.', findingIds: [c.findings[0].id] })).body;
  assert.equal((await h.action(c, { type: 'disposition', findingId: c.findings[1].id, status: 'resolved', reason: 'Wrong response.', responseIds: [c.responses![0].id] })).status, 400);
  assert.equal((await h.action(c, { type: 'disposition', findingId: c.findings[0].id, status: 'resolved', reason: 'Not published.', shareWithSubmitter: true })).status, 400);
  assert.equal((await h.action(c, { type: 'assess_response', responseId: c.responses![0].id, note: 'Internal response', sharedMessage: 'Must not share this.' })).status, 400);
});


test('explicit response evidence clears attention only after all linked findings have been considered', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', base)).body;
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  const finding = { kind: 'question', title: 'Terms question', detail: 'Need product context.', request: 'Confirm.', location: 'Caption', assetId: '', owner: REVIEWER, material: true };
  c = (await h.action(c, { type: 'add_finding', finding })).body;
  c = (await h.action(c, { type: 'add_finding', finding: { ...finding, title: 'Another terms question' } })).body;
  c = (await h.action(c, { type: 'add_response', text: 'Evidence for both requests.', findingIds: c.findings.map(finding => finding.id), actorId: 'priya' })).body;
  const responseId = c.responses![0].id;
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[0].id, status: 'resolved', reason: 'Read the first part of the response.', responseIds: [responseId] })).body;
  assert.equal(pendingResponses(c).length, 1);
  assert.equal(c.responses![0].assessment, undefined);
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[1].id, status: 'open', reason: 'Read the response, but another document is still needed.', responseIds: [responseId] })).body;
  assert.equal(pendingResponses(c).length, 0);
  assert.equal(c.findings[1].status, 'open');
  assert.equal(c.responses!.find(response => response.id === responseId)?.assessment?.by, REVIEWER);
  assert.equal(c.responses![0].sharedAcknowledgment, undefined);
  assert.equal((await h.action(c, approved)).body.code, 'unresolved_findings');
  c = (await h.action(c, { type: 'add_response', text: 'An unlinked general case answer.', findingIds: [], actorId: 'priya' })).body;
  const generalId = c.responses!.at(-1)!.id;
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[1].id, status: 'open', reason: 'Read general answer as a specialist.', responseIds: [generalId], actorId: 'priya' })).body;
  assert.equal(pendingResponses(c).length, 1);
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[1].id, status: 'resolved', reason: 'The reviewer considered the general answer.', responseIds: [generalId] })).body;
  assert.equal(pendingResponses(c).length, 0);
});


test('decision handoff requires the exact result or an explicitly bound communicated message version', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', base)).body;
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  c = (await h.action(c, { type: 'save_draft', subject: 'Earlier request', body: 'Please supply context.' })).body;
  const unrelated = c.drafts[0];
  c = (await h.action(c, approved)).body;
  const decision = c.decisions[0];
  assert.equal(pendingDecisionHandoff(c)?.id, decision.id);
  assert.equal(decisionHandoff(c, decision), 'pending');
  c = (await h.action(c, { type: 'record_communication', messageId: unrelated.id, messageVersion: 1, recipient: base.submitterEmail, occurredAt: new Date().toISOString(), channel: 'Email', note: '' })).body;
  assert.equal(pendingDecisionHandoff(c)?.id, decision.id);
  assert.equal(c.communications![0].decisionId, undefined);
  assert.equal((await h.action(c, { type: 'save_draft', subject: 'Invalid', body: 'Invalid binding.', decisionId: 'some-other-decision' })).status, 400);
  c = (await h.action(c, { type: 'save_draft', subject: 'Review result', body: 'The exact scoped result.', decisionId: decision.id })).body;
  const resultDraft = c.drafts.at(-1)!;
  assert.equal(decisionHandoff(c), 'pending');
  c = (await h.action(c, { type: 'save_draft', draftId: resultDraft.id, subject: 'Unrelated edit', body: 'New unrelated message.' })).body;
  assert.equal(c.drafts.at(-1)!.decisionId, undefined);
  assert.equal(c.drafts.at(-1)!.previousVersions![0].decisionId, decision.id);
  c = (await h.action(c, { type: 'record_communication', messageId: resultDraft.id, messageVersion: 2, recipient: base.submitterEmail, occurredAt: new Date().toISOString(), channel: 'Email', note: '' })).body;
  assert.equal(decisionHandoff(c), 'pending');
  assert.equal((await h.action(c, { type: 'record_communication', messageId: resultDraft.id, messageVersion: 1, recipient: base.submitterEmail, occurredAt: '2020-01-01T00:00:00.000Z', channel: 'Email', note: '' })).status, 400);
  c = (await h.action(c, { type: 'record_communication', messageId: resultDraft.id, messageVersion: 1, recipient: base.submitterEmail, occurredAt: new Date().toISOString(), channel: 'Email', note: '' })).body;
  assert.equal(c.communications!.at(-1)!.decisionId, decision.id);
  assert.equal(decisionHandoff(c), 'recorded');
  assert.equal(pendingDecisionHandoff(c), undefined);
  c = (await h.action(c, { type: 'publish_result', decisionId: decision.id, message: 'The result is now also available on this page.' })).body;
  assert.equal(decisionHandoff(c), 'shared');
  c = (await h.revise(c, { copy: 'A new version needs its own review.' })).body;
  assert.equal(pendingDecisionHandoff(c), undefined);
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  c = (await h.action(c, approved)).body;
  assert.equal(decisionHandoff(c), 'pending');
  assert.equal(pendingDecisionHandoff(c)?.id, c.decisions.at(-1)!.id);
  c = (await h.action(c, { type: 'withdraw_approval', decisionId: c.decisions.at(-1)!.id, reason: 'Withdraw current approval.' })).body;
  assert.equal(pendingDecisionHandoff(c), undefined);
});


test('response attachments enter a review package only through an explicit revision with a chosen role', async t => {
  const h = await setup(t);
  const { offerId: _offer, ...input } = base;
  const receipt = (await h.multipart('/api/submissions', { ...input, fileRoles: ['creative'] }, [{ name: 'creative.png', bytes: png }])).body;
  let c = (h.app.locals.store.list() as ReviewCase[]).find(item => item.reference === receipt.submission.reference)!;
  const creativeId = c.assets[0].id;
  await h.multipart(`/api/submissions/${receipt.token}/responses`, { expectedVersion: c.version, submittedBy: base.submitter, text: 'Here is the rendered destination.', findingIds: [] }, [{ name: 'destination.pdf', bytes: destination }]);
  c = h.app.locals.store.get(c.id);
  const response = c.responses![0];
  const destinationId = response.assetIds[0];
  assert.equal(currentRevision(c).components.some(component => component.assetId === destinationId), false);
  assert.equal(c.revisions.length, 1);
  const adoption = await h.revise(c, { offerId: base.offerId, summary: 'Include the returned destination for review.', retainedComponents: [...currentRevision(c).components, { assetId: destinationId, role: 'destination' }] });
  assert.equal(adoption.status, 200);
  c = adoption.body;
  assert.equal(c.revisions.length, 2);
  assert.equal(c.assets.length, 2);
  assert.equal(currentRevision(c).components.find(component => component.assetId === destinationId)?.role, 'destination');
  assert.equal(c.status, 'needs_intake');
  assert.equal(c.confirmedRevisionId, null);
  assert.deepEqual(c.responses![0], response);
  c = (await h.revise(c, { retainedComponents: [{ assetId: destinationId, role: 'destination' }], fileRoles: ['creative'], replacements: [creativeId] }, [{ name: 'creative.png', bytes: revisedPng }])).body;
  assert.equal((await h.revise(c, { retainedComponents: [...currentRevision(c).components, { assetId: creativeId, role: 'creative' }] })).status, 400);
  const { offerId: _offerId, applicabilityReason: _applicability, ...publicRevision } = { submittedBy: base.submitter, summary: 'Do not adopt response through an unrelated retain request.', intendedUse: base.intendedUse, copy: base.copy, destinationUrl: '', fileRoles: [], retainedComponents: [{ assetId: creativeId, role: 'creative' }], expectedVersion: c.version, offerId: base.offerId, applicabilityReason: '' };
  assert.equal((await h.multipart(`/api/submissions/${receipt.token}/revisions`, publicRevision)).status, 400);
});


test('explicit response acknowledgment accepts an optional empty assessment note', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', base)).body;
  c = (await h.action(c, { type: 'add_response', text: 'A specialist supplied context.', findingIds: [], actorId: 'priya' })).body;
  const result = await h.action(c, { type: 'assess_response', responseId: c.responses![0].id, note: '' });
  assert.equal(result.status, 200);
  c = result.body;
  assert.equal(c.responses![0].assessment?.note, '');
  assert.equal(c.responses![0].assessment?.by, REVIEWER);
  assert.equal(pendingResponses(c).length, 0);
  assert.equal(c.status, 'needs_intake');
});


test('revisions preserve an omitted applicability basis and recheck explicit changes or removal', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.multipart('/api/cases', base)).body;
  c = (await h.action(c, { type: 'confirm_intake', applicabilityReason: 'Original applicability explanation.' })).body;
  c = (await h.action(c, { type: 'add_finding', finding: { kind: 'question', title: 'Reference applicability', detail: 'Review against the stated basis.', request: 'Confirm applicability.', location: 'Context', assetId: '', owner: REVIEWER, material: true } })).body;
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[0].id, status: 'resolved', reason: 'Original applicability basis reviewed.' })).body;
  c = (await h.revise(c, { applicabilityReason: undefined })).body;
  assert.equal(currentRevision(c).applicabilityReason, 'Original applicability explanation.');
  assert.notEqual(c.findings[0].needsRecheck, true);
  c = (await h.revise(c, { applicabilityReason: 'A changed applicability explanation.' })).body;
  assert.equal(c.findings[0].needsRecheck, true);
  assert.equal(c.revisions[0].applicabilityReason, 'Original applicability explanation.');
  c = (await h.action(c, { type: 'confirm_intake' })).body;
  assert.equal((await h.action(c, approved)).body.code, 'unresolved_findings');
  c = (await h.action(c, { type: 'disposition', findingId: c.findings[0].id, status: 'resolved', reason: 'Changed basis reviewed.' })).body;
  c = (await h.revise(c, { applicabilityReason: '' })).body;
  assert.equal(currentRevision(c).applicabilityReason, '');
  assert.equal(c.findings[0].needsRecheck, true);
});

test('disposition returns a waiting case to review only through explicit handoff', async t => {
  const h = await setup(t);
  let c: ReviewCase = (await h.json('/api/examples/personal-loan', {})).body;
  const [firstId, secondId] = c.findings.map(finding => finding.id);
  c = (await h.action(c, { type: 'add_response', text: 'Evidence for both requests is available.', findingIds: [firstId, secondId] })).body;
  const responseId = c.responses![0].id;
  c = (await h.action(c, { type: 'set_waiting', nextOwner: 'Product specialist', reason: 'Still waiting for confirmation.' })).body;
  c = (await h.action(c, { type: 'disposition', findingId: firstId, status: 'resolved', reason: 'The first request was assessed.', responseIds: [responseId] })).body;
  assert.equal(c.status, 'waiting');
  assert.equal(c.nextOwner, 'Product specialist');
  assert.equal(c.waitingReason, 'Still waiting for confirmation.');
  assert.equal(c.responses![0].assessment, undefined);

  let result = await h.action(c, { type: 'disposition', findingId: firstId, status: 'resolved', reason: 'Ready for reviewer follow-up; the other request stays open.', responseIds: [responseId], resumeReview: true });
  assert.equal(result.status, 200);
  c = result.body;
  assert.equal(c.status, 'in_review');
  assert.equal(c.nextOwner, c.owner);
  assert.equal(c.waitingReason, '');
  assert.equal(c.findings[1].status, 'open');
  assert.equal((await h.action(c, approved)).body.code, 'unresolved_findings');
  assert.equal(c.history.at(-1)?.type, 'resumed');

  c = (await h.action(c, { type: 'set_waiting', nextOwner: 'Product specialist', reason: 'Second confirmation.' })).body;
  result = await h.action(c, { type: 'disposition', findingId: secondId, status: 'resolved', reason: 'The remaining request was assessed.', responseIds: [responseId], resumeReview: true });
  assert.equal(result.status, 200);
  c = result.body;
  assert.equal(c.status, 'in_review');
  assert.equal(c.nextOwner, c.owner);
  assert.equal(pendingResponses(c).length, 0);
  assert.ok(c.findings.every(finding => finding.status === 'resolved'));
  assert.equal(c.history.at(-1)?.type, 'resumed');
  assert.equal((await h.action(c, approved)).status, 200);
});
