import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { PRODUCT_LABELS, STATUS_LABELS, currentRevision } from '../shared/types.ts';
import type { Finding, Offer, ReviewCase } from '../shared/types.ts';
import { WorkflowError } from './store.ts';

const MAX_ORIGINAL_BYTES = 100 * 1024 * 1024;
const safeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 160) || 'attachment';
// Submitted prose stays prose, including in Markdown viewers that allow raw HTML.
const md = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/[\\`*_{}[\]()#+.!|]/g, '\\$&');
const quote = (value: string) => (value || '(Not recorded)').split('\n').map(line => `> ${md(line)}`).join('\n');

export function buildReviewExport(c: ReviewCase, offers: Offer[], assetsDir: string) {
  const tooLarge = () => new WorkflowError(413, 'This record contains more than 100 MB of original files. Download individual files from the case instead.', 'export_too_large');
  if (c.assets.reduce((total, asset) => total + asset.size, 0) > MAX_ORIGINAL_BYTES) throw tooLarge();
  let totalBytes = 0;
  const manifest = c.assets.map((asset, index) => {
    const path = join(assetsDir, asset.id);
    let file;
    try { file = lstatSync(path); } catch { throw new WorkflowError(404, `Cannot export: original file ${asset.name} is unavailable. The review record is unchanged.`, 'asset_unavailable'); }
    if (!file.isFile()) throw new WorkflowError(404, 'Cannot export: an original file is unavailable.', 'asset_unavailable');
    totalBytes += file.size;
    if (totalBytes > MAX_ORIGINAL_BYTES) throw tooLarge();
    if (file.size !== asset.size) throw new WorkflowError(409, `Cannot export: the preserved size of ${asset.name} does not match its recorded metadata.`, 'asset_integrity_error');
    return {
      ...asset, archivePath: `originals/${String(index + 1).padStart(4, '0')}-${safeFilename(asset.id)}-${safeFilename(asset.name)}`,
      versions: c.revisions.flatMap(revision => revision.components.filter(component => component.assetId === asset.id).map(component => ({ revisionId: revision.id, revisionNumber: revision.number, role: component.role }))),
    };
  });
  const { notes: _notes, drafts: _drafts, history, ...caseRecord } = c;
  const filteredHistory = history.filter(event => !['note', 'draft_prepared'].includes(event.type));
  const referencedOfferIds = [...new Set([...c.revisions.map(revision => revision.offerId), ...c.decisions.map(decision => decision.offerId)].filter(Boolean))];
  const catalogReferences = referencedOfferIds.map(offerId => ({ offerId, offer: offers.find(offer => offer.id === offerId) || null }));
  const exportedAt = new Date().toISOString();
  const exclusions = ['Internal note records', 'Prepared reply draft records', 'Activity events recording note or draft creation'];
  const record = {
    format: 'clearpath-review-record-v1', label: 'Internal review record', exportedAt, exclusions,
    interpretation: {
      audience: 'Internal use. Findings, rationale, and retained history may include internal review reasoning. This is not an external reply.',
      decisions: 'Decision snapshots, when present, were captured when that decision was recorded. Missing snapshots were not reconstructed from current findings or catalog values.',
      findings: 'The case findings describe their current state at export. They may differ from a historical decision snapshot.',
      offers: 'Catalog references below describe the catalog at export time. Historical offer values are supported only where a decision offerSnapshot exists or in the supplied original evidence.',
      originals: 'Every preserved original is included, including earlier and excluded components. Version membership and roles are recorded in assetManifest.',
    },
    case: { ...caseRecord, history: filteredHistory }, catalogReferences, assetManifest: manifest,
  };
  const revisionLabel = (id: string) => `v${c.revisions.find(revision => revision.id === id)?.number ?? '?'} (${id})`;
  const findingText = (finding: Finding) => [
    `### F${finding.number}: ${md(finding.title)}`,
    `- Type: ${finding.kind}; status: ${finding.status}; material: ${finding.material ? 'yes' : 'no'}; recheck: ${finding.needsRecheck ? 'required' : 'not marked'}`,
    `- Author: ${md(finding.createdBy)}; created: ${finding.createdAt}; original revision: ${md(revisionLabel(finding.revisionId))}`,
    `- Next-action owner: ${md(finding.owner)}; location: ${md(finding.location || 'Whole package')}; asset ID: ${md(finding.assetId || 'None')}`,
    '**Observation and basis**', quote(finding.detail), '**Requested action**', quote(finding.request),
    finding.disposition ? `**Latest disposition:** ${md(finding.disposition.by)} at ${finding.disposition.at}, ${md(revisionLabel(finding.disposition.revisionId))}\n\n${quote(finding.disposition.reason)}` : 'No disposition was recorded.',
  ].join('\n\n');
  const offerText = (offer: Offer) => [
    `**${md(offer.name)} — ${md(offer.version)}** (${md(offer.id)})`,
    `Validity: ${md(offer.validFrom)} to ${md(offer.validTo)}`,
    ...offer.facts.map(fact => `- ${md(fact.label)}: ${md(fact.value)}`),
    '**Offer context / disclosure reference**', quote(offer.disclosure), '**Source**', quote(offer.source),
  ].join('\n\n');
  const report = [
    `# ${c.reference} — Internal review record`, md(c.title),
    `Exported: ${exportedAt}. Case record version: ${c.version}.`,
    '**Internal use.** This archive may contain internal findings and decision reasoning. It is not a prepared external reply or a certification of legal compliance.',
    `**Excluded:** ${exclusions.join('; ')}. Original supporting files and other review history remain included.`,
    '## Current review state',
    `- Product: ${PRODUCT_LABELS[c.product]}; status: ${STATUS_LABELS[c.status]}; current package: v${currentRevision(c).number}`,
    `- Reviewer: ${md(c.owner)}; next-action owner: ${md(c.nextOwner || 'None')}`,
    `- Submitter: ${md(c.submitter)}; contact: ${md(c.submitterEmail || 'Not provided')}`,
    `- Placement: ${md(c.channel)}; target launch: ${md(c.launchDate || 'Not provided')}`,
    `- Created: ${c.createdAt}; last changed: ${c.updatedAt}; current intake confirmed: ${c.confirmedRevisionId === currentRevision(c).id ? 'yes' : 'no'}`,
    '**Waiting reason**', quote(c.waitingReason),
    '## Recorded decisions',
    ...(c.decisions.length ? c.decisions.flatMap(decision => [
      `### ${decision.outcome.toUpperCase()} — ${md(revisionLabel(decision.revisionId))}`,
      `Reviewer: ${md(decision.reviewer)}. Recorded: ${decision.createdAt}. Decision ID: ${decision.id}.`,
      '**Scope**', quote(decision.scope), '**Rationale**', quote(decision.rationale),
      decision.offerSnapshot ? '**Offer snapshot captured at decision time**\n\n' + offerText(decision.offerSnapshot) : `Offer reference: ${md(decision.offerId || 'Not recorded')}. No offer snapshot was recorded for this decision; current catalog values must not be treated as historical proof.`,
      decision.findingSnapshot ? '**Finding snapshot captured at decision time**\n\n' + (decision.findingSnapshot.length ? decision.findingSnapshot.map(findingText).join('\n\n') : 'No findings existed when this decision was recorded.') : 'No finding snapshot was recorded for this decision. Current findings below may have changed; consult retained history and original material.',
    ]) : ['No decision has been recorded.']),
    '## Current findings at export',
    c.findings.length ? c.findings.map(findingText).join('\n\n') : 'No findings are recorded. This does not represent automated clearance.',
    '## Preserved package versions',
    ...c.revisions.flatMap(revision => [
      `### Version ${revision.number} — ${revision.id}`,
      `Submitted by ${md(revision.submittedBy)} at ${revision.createdAt}. Offer reference: ${md(revision.offerId || 'Not provided')}.`,
      '**Revision note**', quote(revision.summary), '**Intended use**', quote(revision.intendedUse),
      '**Accompanying copy**', quote(revision.copy), '**Destination URL (reference only)**', quote(revision.destinationUrl),
      '**Components**',
      ...(revision.components.length ? revision.components.map(component => {
        const asset = manifest.find(item => item.id === component.assetId)!;
        return `- ${component.role}: ${md(asset.name)} — [preserved original](${asset.archivePath}); asset ID ${asset.id}`;
      }) : ['No file components; inspect the supplied copy and context.']),
    ]),
    '## Offer catalog references at export time',
    'These current catalog values are not reconstructed historical snapshots. Refer to the decision snapshots above and preserved offer evidence for the recorded basis.',
    ...(catalogReferences.length ? catalogReferences.map(reference => reference.offer ? offerText(reference.offer) : `Offer ${md(reference.offerId)} is unavailable in the current catalog.`) : ['No offer reference was supplied.']),
    '## Original-file manifest',
    ...manifest.flatMap(asset => [
      `### ${md(asset.name)}`, `[Preserved original](${asset.archivePath})`,
      `- ID: ${asset.id}; MIME: ${asset.mime}; bytes: ${asset.size}; received: ${asset.createdAt}`,
      `- SHA-256: \`${asset.sha256}\``,
      `- Membership: ${asset.versions.map(version => `v${version.revisionNumber} (${version.role})`).join(', ') || 'Not included in a package version'}`,
    ]),
    '## Retained review history',
    ...filteredHistory.map(event => `- ${event.createdAt} — ${md(event.actor)} — ${md(revisionLabel(event.revisionId))} — ${md(event.text)}`),
    '\nThe accompanying review-record.json contains the same structured record and explicit exclusions. Original bytes were checked against their recorded size and SHA-256 before this archive was generated.\n',
  ].join('\n\n');
  const entries: Record<string, Uint8Array> = { 'review-record.md': strToU8(report), 'review-record.json': strToU8(JSON.stringify(record, null, 2)) };
  for (const asset of manifest) {
    const bytes = readFileSync(join(assetsDir, asset.id));
    if (bytes.length !== asset.size || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new WorkflowError(409, `Cannot export: the preserved bytes of ${asset.name} do not match the recorded SHA-256.`, 'asset_integrity_error');
    entries[asset.archivePath] = bytes;
  }
  // Stored ZIP entries avoid recompressing already-compressed images/PDFs.
  // Preflight bounds original bytes before reading them into memory.
  const bytes = zipSync(entries, { level: 0 });
  return { filename: `${c.reference}-review-record.zip`, bytes: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength) };
}
