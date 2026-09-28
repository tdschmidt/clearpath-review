import { readFileSync } from 'node:fs';

// Add working examples through normal API transitions; never reset existing work.
const base = process.env.DEMO_BASE_URL || 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
  throw new Error('Run this against the local fictional demo, not a remote service.');
}
async function request(path, init) {
  const response = await fetch(`${base}${path}`, init);
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${JSON.stringify(result)}`);
  return result;
}
const json = (path, data) => request(path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});
async function upload(path, payload, files = [], key) {
  const body = new FormData();
  body.append('payload', JSON.stringify(payload));
  for (const file of files) {
    const mime = file.endsWith('.pdf') ? 'application/pdf' : 'image/png';
    body.append('files', new Blob([readFileSync(new URL(`../public/fixtures/${file}`, import.meta.url))], { type: mime }), file.split('/').at(-1));
  }
  return request(path, { method: 'POST', body, ...(key ? { headers: { 'Idempotency-Key': key } } : {}) });
}
const scenarios = [
  ['intake', 'Northstar · October loan launch'],
  ['partial', 'Northstar · Fee correction returned'],
  ['evidence', 'Northstar · Destination evidence received'],
  ['handoff', 'ClearPath · October social handoff'],
  ['shared', 'Northstar · October campaign approved'],
  ['withdrawn', 'Northstar · Offer reference withdrawn'],
];
const existing = await request('/api/cases');
const standard = (await request('/api/offers')).find(o => o.id === 'offer-personal-loan-v3');
if (!standard || standard.withdrawnAt) throw new Error('The standard fictional loan reference must be available. No cases were changed.');
for (const [stage, title] of scenarios) {
  const marker = `Sample scenario prepared: ${stage}.`;
  const previous = existing.find(c => c.title === title || c.notes.some(n => n.text.startsWith(marker)));
  if (previous) {
    if (!previous.notes.some(n => n.text.startsWith(marker))) throw new Error(`Existing or interrupted case ${previous.reference}: inspect it before retrying. Nothing in it was overwritten.`);
    console.log(`Kept ${previous.reference}: ${previous.title}`);
    continue;
  }
  let offer = standard;
  if (stage === 'withdrawn') {
    offer = await upload('/api/offers', {
      product: standard.product, name: 'Personal loan / Northstar archived reference',
      version: 'PL-2026.09 / v3 - withdrawal example', validFrom: standard.validFrom, validTo: standard.validTo,
      source: 'Fictional product team. Separate copy of the Standard reference for the withdrawal scenario; the original remains available.',
      disclosure: standard.disclosure, actorId: 'maya',
      facts: standard.facts.map(({ label, value }) => ({ label, value, sourceFileIndex: 0, page: 1 })),
    }, ['offers/personal-loan.pdf'], 'demo-scenarios-v1-reference');
  }
  const internal = stage === 'handoff';
  const submitter = internal ? 'Alex Rivera' : 'Nina Patel';
  const context = {
    submittedBy: submitter, intendedUse: `${internal ? 'ClearPath owned' : 'Northstar affiliate'} social image, caption, and named destination. California adults; Oct 5-Nov 15, 2026. Fictional closed-end unsecured loan. Any other placement or offer needs separate review.`,
    copy: 'Make room for what comes next with a ClearPath personal loan. Credit approval required. Sponsored by ClearPath.',
    destinationUrl: 'https://clearpath.example/personal-loans',
    advertisedOffer: 'Standard personal loan; origination fee applies and is deducted from proceeds.',
    channel: internal ? 'Owned / organic social' : 'Affiliate / paid social',
    launchDate: '2026-10-05', product: 'personal_loan',
  };
  const receipt = await upload('/api/submissions', {
    ...context, title, submitter, submitterEmail: internal ? 'alex@clearpath.example' : 'nina@northstar.example',
    summary: 'Fictional scenario: original image submitted; destination rendition to follow.', fileRoles: ['creative'],
  }, ['loan/v1/social-ad.png'], `demo-scenarios-v1-${stage}`);
  let c = (await request('/api/cases')).find(item => item.submitterToken === receipt.token);
  const refresh = async () => { c = await request(`/api/cases/${c.id}`); };
  const action = async data => { c = await json(`/api/cases/${c.id}/actions`, { ...data, actorId: 'maya', expectedVersion: c.version }); };
  const revision = () => c.revisions.at(-1);
  const finish = async () => {
    await action({ type: 'add_note', text: `${marker} Authored fictional workflow example, not an automated legal assessment. The stages use the same teaching assets so differences in workflow are easy to inspect. Dates are illustrative; no email was sent.` });
    console.log(`Added ${c.reference}: ${title} (${c.status}, version ${revision().number})`);
  };
  if (stage === 'intake') { await finish(); continue; }
  await action({ type: 'confirm_intake', offerId: offer.id });
  const original = revision().components[0].assetId;
  await action({ type: 'add_finding', finding: {
    kind: 'correction', title: 'Fee claim conflicts with the offer',
    detail: 'The image says no origination fee. The matching fictional product source specifies a mandatory 5% fee deducted from proceeds.',
    request: 'Replace the zero-fee claim and explain that an origination fee applies and is deducted from proceeds. Return the revised image.',
    location: 'Social image / fee callout and footer', assetId: original, owner: submitter, material: true, audience: 'submitter',
    citations: [{ revisionId: revision().id, assetId: original }],
    sourceCitations: [{ offerId: offer.id, assetId: offer.assets[0].id, page: 1 }],
  } });
  await action({ type: 'add_finding', finding: {
    kind: 'evidence', title: 'Destination rendition is missing',
    detail: 'A URL does not preserve the destination consumers will see. The supplied package cannot establish its terms or presentation.',
    request: 'Attach a complete rendered PDF of the proposed destination, including terms, and confirm this is the linked page.',
    location: 'Linked destination / complete page', assetId: '', owner: submitter, material: true, audience: 'submitter',
  } });
  const [fee, destination] = c.findings;
  await action({ type: 'publish_feedback', findingIds: [fee.id, destination.id], subject: 'Two items before this campaign can proceed', body: 'Please correct the fee wording and supply the destination rendition. A partial correction can be returned while the page is being finalized.', waiting: { nextOwner: submitter, reason: 'Waiting for the revised image and complete destination rendition.' } });
  await upload(`/api/submissions/${receipt.token}/revisions`, {
    ...context, summary: 'Fee wording corrected. Destination rendition is still outstanding.', expectedVersion: c.version,
    retainedComponents: [], fileRoles: ['creative'], replacements: [original],
  }, ['loan/v2/social-ad.png']);
  await refresh();
  await action({ type: 'confirm_intake' });
  if (stage === 'partial') { await finish(); continue; }
  await action({ type: 'disposition', findingId: fee.id, status: 'resolved', reason: 'Inspected the revised image: the zero-fee promise is removed and the fee/proceeds qualification is present. Destination remains outstanding.', shareWithSubmitter: true });
  await upload(`/api/submissions/${receipt.token}/responses`, {
    expectedVersion: c.version, submittedBy: submitter, text: 'Attached the complete two-page destination rendition, including terms. This is the page linked by the proposed creative.', findingIds: [destination.id],
  }, ['loan/v3/destination.pdf']);
  await refresh();
  if (stage === 'evidence') { await finish(); continue; }
  const response = c.responses.at(-1);
  c = await upload(`/api/cases/${c.id}/revisions`, {
    ...context, submittedBy: 'Maya Chen', offerId: offer.id, summary: 'Reviewer assembled the final package from the corrected image and supplied destination; originals remain preserved.',
    expectedVersion: c.version, retainedComponents: [...revision().components.map(({ assetId, role }) => ({ assetId, role })), ...response.assetIds.map(assetId => ({ assetId, role: 'destination' }))], fileRoles: [],
  });
  await action({ type: 'confirm_intake' });
  await action({ type: 'disposition', findingId: destination.id, status: 'resolved', responseIds: [response.id], reason: 'Fictional reviewer inspected both supplied destination pages with the corrected image and caption. The named destination is now included in this package.', shareWithSubmitter: true });
  await action({ type: 'decide', outcome: 'approved', reviewed: true,
    scope: `Version 3 only: exact image, caption and two-page destination for the stated ${internal ? 'owned' : 'Northstar affiliate'} social placement, California adults, Oct 5-Nov 15, 2026, Standard offer. Changes require review.`,
    rationale: 'Authored demonstration decision: fee correction and destination request explicitly resolved against the preserved package and product source. This is a fictional review outcome, not a legal opinion or automated clearance.',
  });
  const decision = c.decisions.at(-1);
  const message = `Review complete for ${c.reference}, version 3. ${decision.scope} Contact the review team before changing material or placement.`;
  await action({ type: 'save_draft', subject: `Review result - ${c.reference}`, body: message, decisionId: decision.id });
  if (stage === 'shared') await action({ type: 'publish_result', decisionId: decision.id, message });
  if (stage === 'withdrawn') await json(`/api/offers/${offer.id}/withdraw`, {
    actorId: 'maya', reason: 'Fictional product owner withdrew this archived source before the approval was shared. Obtain the current Standard reference and complete fresh review before sharing approval.',
  });
  await finish();
}
