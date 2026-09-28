import { randomBytes, randomUUID } from 'node:crypto';
import { currentRevision, pendingResponses, submitterRequestSnapshot } from '../shared/types.ts';
import type { CaseAction, FindingInput, Offer, ReviewCase } from '../shared/types.ts';
import { participant } from './references.ts';
import { WorkflowError } from './store.ts';

type Event = (type: string, text: string) => void;
const now = () => new Date().toISOString();
export function validateFinding(c: ReviewCase, finding: FindingInput, offers: Offer[]) {
  if (!finding.detail.trim()) throw new WorkflowError(400, 'Record the basis for this finding.');
  const revision = currentRevision(c);
  if (finding.assetId && !revision.components.some(component => component.assetId === finding.assetId && component.role !== 'excluded') && !finding.citations?.some(citation => citation.assetId === finding.assetId && c.revisions.find(item => item.id === citation.revisionId)?.components.some(component => component.assetId === citation.assetId && component.role !== 'excluded'))) throw new WorkflowError(400, 'Choose current material or cite the preserved revision containing this attachment.');
  for (const citation of finding.citations || []) {
    const citedRevision = c.revisions.find(item => item.id === citation.revisionId);
    if (!citedRevision?.components.some(component => component.assetId === citation.assetId && component.role !== 'excluded')) throw new WorkflowError(400, 'A material citation must refer to a preserved attachment in its stated revision.');
    const asset = c.assets.find(item => item.id === citation.assetId);
    if (citation.page && citation.page > 1 && asset?.mime !== 'application/pdf') throw new WorkflowError(400, 'Page numbers above one are available only for PDFs.');
  }
  for (const citation of finding.sourceCitations || []) {
    const offer = offers.find(item => item.id === citation.offerId);
    const asset = offer?.assets?.find(item => item.id === citation.assetId);
    if (!asset) throw new WorkflowError(400, 'A source citation must refer to a preserved offer document.');
    if (citation.page && citation.page > 1 && asset.mime !== 'application/pdf') throw new WorkflowError(400, 'Page numbers above one are available only for PDFs.');
  }
}
export function applyHandoff(c: ReviewCase, action: CaseAction, actor: string, offers: Offer[], event: Event): boolean {
  const revision = currentRevision(c);
  switch (action.type) {
    case 'assign_owner': {
      const owner = participant(action.ownerId);
      if (owner.role !== 'reviewer') throw new WorkflowError(400, 'Assign an accountable reviewer. Specialists can own findings.');
      const old = c.owner; c.owner = owner.name;
      if (c.nextOwner === old) c.nextOwner = owner.name;
      event('owner_changed', `Accountable reviewer changed from ${old} to ${owner.name}.`);
      return true;
    }
    case 'correct_contact':
      event('contact_corrected', `Title/contact corrected: ${action.reason}. Previous title: ${c.title}; submitter: ${c.submitter}; email: ${c.submitterEmail}.`);
      c.title = action.title; c.submitter = action.submitter; c.submitterEmail = action.submitterEmail;
      return true;
    case 'create_submitter_link':
    case 'rotate_submitter_link':
      if (!c.submitterToken || action.type === 'rotate_submitter_link') {
        c.submitterToken = randomBytes(24).toString('base64url');
        event('submitter_link', action.type === 'rotate_submitter_link' ? 'Submission link replaced. The previous link no longer works.' : 'Submission return link created.');
      }
      return true;
    case 'edit_finding': {
      const finding = c.findings.find(item => item.id === action.findingId);
      if (!finding) throw new WorkflowError(404, 'This finding was not found.');
      if (finding.status !== 'open') throw new WorkflowError(409, 'Reopen the finding before amending it.');
      validateFinding(c, action.finding, offers);
      const { kind, title, detail, request, location, assetId, owner, material, audience, citations, sourceCitations } = finding;
      finding.amendments ??= [];
      finding.amendments.push({ at: now(), by: actor, previous: { kind, title, detail, request, location, assetId, owner, material, audience, citations, sourceCitations } });
      Object.assign(finding, action.finding, { audience: action.finding.audience || 'internal' });
      event('finding_amended', `Finding ${finding.number} amended. Previously published feedback remains unchanged.`);
      return true;
    }
    case 'publish_feedback': {
      const selected = [...new Set(action.findingIds)].map(findingId => {
        const finding = c.findings.find(item => item.id === findingId);
        if (!finding || finding.audience !== 'submitter' || (finding.status !== 'open' && !finding.needsRecheck)) throw new WorkflowError(400, 'Share only pending findings explicitly addressed to the submitter.');
        return finding;
      });
      const findings = selected.map(finding => submitterRequestSnapshot(c, finding));
      c.submitterAssetIds = [...new Set([...(c.submitterAssetIds || []), ...findings.flatMap(finding => (finding.citations || []).map(citation => citation.assetId))])];
      c.publishedFeedback ??= [];
      c.publishedFeedback.push({ id: randomUUID(), revisionId: revision.id, createdAt: now(), publishedBy: actor, subject: action.subject, body: action.body, findings });
      c.submitterToken ||= randomBytes(24).toString('base64url');
      event('feedback_shared', `${findings.length} request${findings.length === 1 ? '' : 's'} shared on the submission page. No email was sent.`);
      if (action.waiting) {
        c.status = 'waiting'; c.nextOwner = action.waiting.nextOwner; c.waitingReason = action.waiting.reason;
        event('waiting', `Waiting on ${action.waiting.nextOwner}: ${action.waiting.reason}`);
      }
      return true;
    }
    case 'publish_result': {
      const decision = c.decisions.find(item => item.id === action.decisionId);
      if (!decision) throw new WorkflowError(404, 'This decision was not found.');
      if (decision.withdrawn) throw new WorkflowError(409, 'This approval has been withdrawn.');
      if (decision.revisionId !== revision.id) throw new WorkflowError(409, 'This decision belongs to an earlier package. Complete review of the current version before sharing a decision.', 'decision_not_current');
      const reference = offers.find(offer => offer.id === decision.offerId);
      if (decision.outcome === 'approved' && reference?.withdrawnAt) {
        throw new WorkflowError(409, 'The reference supporting this approval was withdrawn. Review a new revision with a current reference and record a new decision before sharing approval.', 'reference_recheck_required');
      }
      if (decision.outcome === 'approved' && pendingResponses(c).length) throw new WorkflowError(409, 'New responses need assessment before this approval can be shared. If they change the decision, withdraw approval and resume review.', 'unassessed_responses');
      const reviewed = c.revisions.find(item => item.id === decision.revisionId)!;
      const assetIds = reviewed.components.filter(component => ['creative', 'destination'].includes(component.role)).map(component => component.assetId);
      const resultId = randomUUID();
      c.publishedResults ??= [];
      c.publishedResults.push({ id: resultId, decisionId: decision.id, revisionId: reviewed.id, createdAt: now(), publishedBy: actor, outcome: decision.outcome, scope: decision.scope, message: action.message, copy: reviewed.copy, destinationUrl: reviewed.destinationUrl, assetIds });
      c.submitterAssetIds = [...new Set([...(c.submitterAssetIds || []), ...assetIds])];
      c.submitterToken ||= randomBytes(24).toString('base64url');
      event('result_shared', `Decision for revision ${reviewed.number} shared on the submission page. No email was sent.`);
      return true;
    }
    case 'record_communication': {
      const draft = c.drafts.find(item => item.id === action.messageId && (item.version || 1) === action.messageVersion);
      const priorDraft = c.drafts.find(item => item.id === action.messageId)?.previousVersions?.find(version => version.version === action.messageVersion);
      const shared = [...(c.publishedFeedback || []), ...(c.publishedResults || [])].some(item => item.id === action.messageId) && action.messageVersion === 1;
      if (!draft && !priorDraft && !shared) throw new WorkflowError(400, 'Select a saved message version to record communication.');
      if (new Date(action.occurredAt).getTime() > Date.now() + 60_000) throw new WorkflowError(400, 'A communication record cannot be dated in the future.');
      const result = action.messageVersion === 1 ? c.publishedResults?.find(item => item.id === action.messageId) : undefined;
      const decisionId = draft?.decisionId || priorDraft?.decisionId || result?.decisionId;
      const decision = decisionId ? c.decisions.find(item => item.id === decisionId) : undefined;
      // The form records minutes; tolerate its omitted seconds, not a pre-decision message.
      if (decision && Date.parse(action.occurredAt) < Date.parse(decision.createdAt) - 60_000) throw new WorkflowError(400, 'A decision cannot be communicated before it was recorded.');
      c.communications ??= [];
      c.communications.push({ id: randomUUID(), createdAt: now(), occurredAt: action.occurredAt, actor, recipient: action.recipient, messageId: action.messageId, messageVersion: action.messageVersion, channel: action.channel, note: action.note, ...(decisionId ? { decisionId } : {}) });
      event('communication_recorded', `${actor} recorded external communication with ${action.recipient} by ${action.channel}. Delivery was not verified.`);
      return true;
    }
    case 'assess_response': {
      if (participant(action.actorId).role !== 'reviewer') throw new WorkflowError(400, 'Select a reviewer to assess a response.');
      const response = c.responses?.find(item => item.id === action.responseId);
      if (!response) throw new WorkflowError(404, 'This response was not found.');
      if (response.assessment) throw new WorkflowError(409, 'This response has already been assessed.');
      if (action.sharedMessage?.trim() && response.audience !== 'submitter') throw new WorkflowError(400, 'An internal response cannot receive a submitter acknowledgment.');
      response.assessment = { at: now(), by: actor, note: action.note };
      if (action.sharedMessage?.trim()) response.sharedAcknowledgment = { at: now(), by: actor, message: action.sharedMessage.trim() };
      event('response_assessed', `Response from ${response.author} assessed. Findings require their own disposition.${response.sharedAcknowledgment ? ' An acknowledgment was shared with the submitter.' : ''}`);
      return true;
    }
    case 'add_response':
      if (action.findingIds.some(findingId => !c.findings.some(finding => finding.id === findingId))) throw new WorkflowError(400, 'Select findings from this review.');
      c.responses ??= [];
      c.responses.push({ id: randomUUID(), createdAt: now(), author: actor, text: action.text, findingIds: [...new Set(action.findingIds)], assetIds: [], revisionId: revision.id, audience: 'internal' });
      event('specialist_response', `${actor} recorded an internal response. Findings still require reviewer disposition.`);
      return true;
    case 'withdraw_approval': {
      const decision = c.decisions.find(item => item.id === action.decisionId);
      if (!decision || decision.outcome !== 'approved') throw new WorkflowError(400, 'Choose an approval to withdraw.');
      if (decision.withdrawn) throw new WorkflowError(409, 'This approval has already been withdrawn.');
      decision.withdrawn = { at: now(), by: actor, reason: action.reason };
      (c.publishedResults || []).filter(result => result.decisionId === decision.id).forEach(result => { result.withdrawn = { at: decision.withdrawn!.at, reason: 'This approval has been withdrawn. Contact the review team before using this material.' }; });
      if (decision.revisionId === revision.id) { c.status = 'needs_intake'; c.confirmedRevisionId = null; c.nextOwner = c.owner; c.waitingReason = ''; }
      event('approval_withdrawn', `Approval for revision ${c.revisions.find(item => item.id === decision.revisionId)?.number} withdrawn: ${action.reason}`);
      return true;
    }
    case 'cancel':
      if (c.status === 'approved') throw new WorkflowError(409, 'Withdraw the approval before cancelling this submission.');
      if (c.cancelled) throw new WorkflowError(409, 'This submission is already cancelled.');
      c.cancelled = { at: now(), by: actor, reason: action.reason }; c.status = 'cancelled'; c.nextOwner = ''; c.waitingReason = '';
      event('cancelled', `Submission cancelled: ${action.reason}`);
      return true;
    default: return false;
  }
}
