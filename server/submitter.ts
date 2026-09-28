import type { ReviewCase, SubmitterCase } from '../shared/types.ts';
import { currentRevision } from '../shared/types.ts';

/** This is a separate response model, never a redacted spread of an internal case. */
export function submitterView(c: ReviewCase): SubmitterCase {
  const allowed = new Set(c.submitterAssetIds || []);
  const current = currentRevision(c);
  const submitted = new Set(c.submitterRevisionIds || []);
  const sharedRevisions = new Set([...submitted, ...(c.publishedFeedback || []).map(item => item.revisionId), ...(c.publishedResults || []).map(item => item.revisionId)]);
  const feedback = c.publishedFeedback || [];
  const results = c.publishedResults || [];
  const currentResult = [...results].reverse().find(result => result.revisionId === current.id);
  const status = c.cancelled ? 'cancelled' : currentResult?.withdrawn ? 'withdrawn'
    : currentResult ? currentResult.outcome : feedback.some(item => item.revisionId === current.id) ? 'feedback_shared' : 'received';
  return {
    reference: c.reference, title: c.title, product: c.product, submitter: c.submitter, submitterEmail: c.submitterEmail,
    version: c.version, status, createdAt: c.createdAt, updatedAt: c.updatedAt,
    revisions: c.revisions.filter(revision => sharedRevisions.has(revision.id)).map(revision => ({
      id: revision.id, number: revision.number, createdAt: revision.createdAt, submittedBy: submitted.has(revision.id) ? revision.submittedBy : 'Review team',
      summary: submitted.has(revision.id) ? revision.summary : 'Material shared by the review team', product: revision.product || c.product, channel: revision.channel ?? c.channel,
      launchDate: revision.launchDate ?? c.launchDate, intendedUse: revision.intendedUse,
      copy: revision.copy, destinationUrl: revision.destinationUrl, advertisedOffer: revision.advertisedOffer || '',
      components: revision.components.filter(component => allowed.has(component.assetId)).map(component => ({ ...component })),
    })),
    assets: c.assets.filter(asset => allowed.has(asset.id)),
    feedback: feedback.map(item => ({ ...item, findings: item.findings.map(finding => ({ ...finding,
      citations: finding.citations?.filter(citation => allowed.has(citation.assetId)),
    })) })),
    results: results.map(item => ({ ...item, assetIds: item.assetIds.filter(assetId => allowed.has(assetId)) })),
    responses: (c.responses || []).filter(response => response.audience === 'submitter').map(response => ({ ...response, assetIds: response.assetIds.filter(assetId => allowed.has(assetId)) })),
    ...(c.cancelled ? { cancellationReason: 'This submission has been cancelled. Contact the review team if you need to submit a new package.' } : {}),
  };
}
