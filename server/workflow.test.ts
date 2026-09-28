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
import { currentRevision, REVIEWER } from '../shared/types.ts';
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
    const { id: _id, number: _number, createdAt: _createdAt, components: _components, ...input } = revision(c, changes);
    return multipart(`/api/cases/${c.id}/revisions`, input, files, key);
  };
  return { app, dataDir, url, json, multipart, action, revise };
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
  assert.equal(readdirSync(join(h.dataDir, 'assets')).length, 1);
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
  assert.equal(readdirSync(join(h.dataDir, 'assets')).length, 2);
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
  assert.equal(readdirSync(join(h.dataDir, 'assets')).length, 0);
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
  assert.equal(Object.keys(files).length, c.assets.length + 2);
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
  assert.equal(new Set(record.assetManifest.map((asset: { archivePath: string }) => asset.archivePath)).size, c.assets.length);
  for (const asset of record.assetManifest) {
    assert.match(asset.archivePath, /^originals\/[a-zA-Z0-9._-]+$/);
    assert.ok(!asset.archivePath.split('/').includes('..'));
    assert.deepEqual(Buffer.from(files[asset.archivePath]), readFileSync(join(h.dataDir, 'assets', asset.id)));
    assert.equal(createHash('sha256').update(files[asset.archivePath]).digest('hex'), asset.sha256);
    assert.ok(asset.versions.length > 0);
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
