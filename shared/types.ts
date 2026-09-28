export type Product = "personal_loan" | "credit_card" | "mortgage";
export type CaseStatus =
  "needs_intake" | "in_review" | "waiting" | "approved" | "rejected" | "cancelled";
export type AssetRole = "creative" | "destination" | "evidence" | "excluded";
export type FindingKind = "correction" | "evidence" | "question";
export type FindingStatus = "open" | "resolved" | "dismissed";

export const PRODUCT_LABELS: Record<Product, string> = {
  personal_loan: "Personal loan",
  credit_card: "Credit card",
  mortgage: "Mortgage prequalification",
};
export const STATUS_LABELS: Record<CaseStatus, string> = {
  needs_intake: "Needs intake",
  in_review: "In review",
  waiting: "Waiting",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
export const ROLE_LABELS: Record<AssetRole, string> = {
  creative: "Creative",
  destination: "Destination",
  evidence: "Supporting evidence",
  excluded: "Not in review",
};
export const REVIEWER = "Maya Chen";

export interface Participant { id: string; name: string; role: "reviewer" | "specialist" }
export const PARTICIPANTS: Participant[] = [
  { id: "maya", name: "Maya Chen", role: "reviewer" },
  { id: "jonah", name: "Jonah Reed", role: "reviewer" },
  { id: "priya", name: "Priya Shah", role: "specialist" },
];
export interface MaterialCitation { revisionId: string; assetId: string; page?: number; note?: string }
export interface SourceCitation { offerId: string; assetId: string; page?: number; note?: string }
export interface Offer {
  id: string;
  product: Product;
  name: string;
  version: string;
  validFrom: string;
  validTo: string;
  facts: { label: string; value: string; citation?: SourceCitation }[];
  disclosure: string;
  source: string;
  assets?: Asset[];
  createdAt?: string;
  createdBy?: string;
  withdrawnAt?: string;
  withdrawalReason?: string;
  supersedesId?: string;
}
export interface Asset {
  id: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  createdAt: string;
}
export interface PackageRevision {
  id: string;
  number: number;
  createdAt: string;
  submittedBy: string;
  summary: string;
  offerId: string;
  intendedUse: string;
  copy: string;
  destinationUrl: string;
  components: { assetId: string; role: AssetRole; replacesAssetId?: string }[];
  product?: Product;
  channel?: string;
  launchDate?: string;
  contextInherited?: boolean;
  advertisedOffer?: string;
  applicabilityReason?: string;
}
export interface Finding {
  id: string;
  number: number;
  kind: FindingKind;
  title: string;
  detail: string;
  request: string;
  location: string;
  assetId: string;
  owner: string;
  material: boolean;
  status: FindingStatus;
  createdAt: string;
  createdBy: string;
  revisionId: string;
  disposition?: { reason: string; at: string; by: string; revisionId: string; responseIds?: string[] };
  needsRecheck?: boolean;
  audience?: "internal" | "submitter";
  citations?: MaterialCitation[];
  sourceCitations?: SourceCitation[];
  amendments?: { at: string; by: string; previous: FindingInput }[];
}
export interface ReviewNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}
export interface Decision {
  id: string;
  outcome: "approved" | "rejected";
  reviewer: string;
  revisionId: string;
  offerId: string;
  scope: string;
  rationale: string;
  createdAt: string;
  findingSnapshot?: Finding[];
  offerSnapshot?: Offer;
  withdrawn?: { at: string; by: string; reason: string };
}
export interface ReplyDraft {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  revisionId: string;
  status: "prepared";
  updatedAt?: string;
  version?: number;
  findingIds?: string[];
  previousVersions?: { version: number; subject: string; body: string; at: string }[];
}
export interface HistoryEvent {
  id: string;
  type: string;
  text: string;
  actor: string;
  createdAt: string;
  revisionId: string;
}
export interface PublishedFeedback {
  id: string; revisionId: string; createdAt: string; publishedBy: string;
  subject: string; body: string;
  findings: { id: string; number: number; title: string; request: string; location: string; material: boolean; citations?: MaterialCitation[] }[];
}
export interface SubmissionResponse {
  id: string; createdAt: string; author: string; text: string; findingIds: string[]; assetIds: string[]; revisionId: string;
  audience: "internal" | "submitter";
  assessment?: { at: string; by: string; note: string };
  sharedAcknowledgment?: { at: string; by: string; message: string };
}
export interface PublishedRequestUpdate {
  findingId: string; feedbackId: string; revisionId: string; createdAt: string; by: string;
  status: "accepted" | "no_longer_required" | "open";
  receivedResponseIds?: string[];
}
export interface SharedRequest {
  findingId: string; number: number; title: string; request: string; location: string; material: boolean;
  citations?: MaterialCitation[]; feedbackId: string; revisionId: string; sharedAt: string;
  statusRevisionId?: string; status: "open" | "response_received" | "accepted" | "no_longer_required";
  pendingResponseCount: number;
}
export interface CommunicationRecord {
  id: string; createdAt: string; occurredAt: string; actor: string; recipient: string;
  messageId: string; messageVersion: number; channel: string; note: string;
}
export interface PublishedResult {
  id: string; decisionId: string; revisionId: string; createdAt: string; publishedBy: string;
  outcome: "approved" | "rejected"; scope: string; message: string;
  copy: string; destinationUrl: string; assetIds: string[];
  withdrawn?: { at: string; reason: string };
}
export interface ReviewCase {
  id: string;
  reference: string;
  title: string;
  product: Product;
  submitter: string;
  submitterEmail: string;
  channel: string;
  launchDate: string;
  owner: string;
  nextOwner: string;
  waitingReason: string;
  status: CaseStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  example: boolean;
  confirmedRevisionId: string | null;
  assets: Asset[];
  revisions: PackageRevision[];
  findings: Finding[];
  notes: ReviewNote[];
  decisions: Decision[];
  drafts: ReplyDraft[];
  history: HistoryEvent[];
  submitterToken?: string;
  submitterAssetIds?: string[];
  submitterRevisionIds?: string[];
  publishedFeedback?: PublishedFeedback[];
  publishedRequestUpdates?: PublishedRequestUpdate[];
  publishedResults?: PublishedResult[];
  responses?: SubmissionResponse[];
  communications?: CommunicationRecord[];
  cancelled?: { at: string; by: string; reason: string };
}
export interface RevisionInput {
  submittedBy: string;
  summary: string;
  offerId: string;
  intendedUse: string;
  copy: string;
  destinationUrl: string;
  retainedComponents: { assetId: string; role: AssetRole }[];
  fileRoles: AssetRole[];
  replacements?: (string | null)[];
  product?: Product;
  channel?: string;
  launchDate?: string;
  advertisedOffer?: string;
  applicabilityReason?: string;
}
export interface SubmissionInput extends Omit<
  RevisionInput,
  "retainedComponents"
> {
  title: string;
  product: Product;
  submitter: string;
  submitterEmail: string;
  channel: string;
  launchDate: string;
}
export type FindingInput = Pick<
  Finding,
  | "kind"
  | "title"
  | "detail"
  | "request"
  | "location"
  | "assetId"
  | "owner"
  | "material"
> & Pick<Finding, "audience" | "citations" | "sourceCitations">;
export type CaseAction = { expectedVersion: number; actorId?: string } & (
  | { type: "confirm_intake"; offerId?: string; applicabilityReason?: string }
  | { type: "add_finding"; finding: FindingInput }
  | { type: "edit_finding"; findingId: string; finding: FindingInput }
  | { type: "assign_owner"; ownerId: string }
  | { type: "correct_contact"; title: string; submitter: string; submitterEmail: string; reason: string }
  | { type: "create_submitter_link" | "rotate_submitter_link" }
  | { type: "publish_feedback"; findingIds: string[]; subject: string; body: string; waiting?: { nextOwner: string; reason: string } }
  | { type: "publish_result"; decisionId: string; message: string }
  | { type: "record_communication"; messageId: string; messageVersion: number; recipient: string; occurredAt: string; channel: string; note: string }
  | { type: "add_response"; text: string; findingIds: string[] }
  | { type: "assess_response"; responseId: string; note: string; sharedMessage?: string }
  | { type: "withdraw_approval"; decisionId: string; reason: string }
  | { type: "cancel"; reason: string }
  | {
      type: "disposition";
      findingId: string;
      status: FindingStatus;
      reason: string;
      responseIds?: string[];
      shareWithSubmitter?: boolean;
    }
  | { type: "set_waiting"; nextOwner: string; reason: string }
  | { type: "resume" }
  | { type: "add_note"; text: string }
  | {
      type: "decide";
      outcome: "approved" | "rejected";
      scope: string;
      rationale: string;
      reviewed: boolean;
    }
  | { type: "save_draft"; subject: string; body: string; draftId?: string; findingIds?: string[] }
);

export const currentRevision = (c: ReviewCase) =>
  c.revisions[c.revisions.length - 1];
export const openBlockers = (c: ReviewCase) =>
  c.findings.filter(
    (f) => f.material && (f.status === "open" || f.needsRecheck),
  );
export const pendingResponses = (c: ReviewCase) =>
  (c.responses || []).filter(response => !response.assessment);
export const assetUrl = (caseId: string, assetId: string, download = false) =>
  `/api/cases/${encodeURIComponent(caseId)}/assets/${encodeURIComponent(assetId)}${download ? "?download=1" : ""}`;

// Explicit external contract: never serialize ReviewCase into a submitter response.
export interface ExternalRevision {
  id: string; number: number; createdAt: string; submittedBy: string; summary: string;
  product: Product; channel: string; launchDate: string; intendedUse: string;
  copy: string; destinationUrl: string; advertisedOffer: string;
  components: PackageRevision["components"];
}
export interface SubmitterCase {
  reference: string; title: string; product: Product; submitter: string; submitterEmail: string;
  version: number; status: "received" | "feedback_shared" | "approved" | "rejected" | "withdrawn" | "cancelled";
  createdAt: string; updatedAt: string; revisions: ExternalRevision[]; assets: Asset[];
  feedback: PublishedFeedback[]; results: PublishedResult[]; responses: Omit<SubmissionResponse, "assessment">[];
  sharedRequests: SharedRequest[];
  cancellationReason?: string;
}
export interface SubmitterReceipt { token: string; submission: SubmitterCase }
export interface OfferInput {
  product: Product; name: string; version: string; validFrom: string; validTo: string;
  source: string; disclosure: string; supersedesId?: string; actorId?: string;
  facts: { label: string; value: string; sourceFileIndex?: number; page?: number }[];
}
export const submitterAssetUrl = (token: string, assetId: string, download = false) =>
  `/api/submissions/${encodeURIComponent(token)}/assets/${encodeURIComponent(assetId)}${download ? "?download=1" : ""}`;
export const offerAssetUrl = (offerId: string, assetId: string, download = false) =>
  `/api/offers/${encodeURIComponent(offerId)}/assets/${encodeURIComponent(assetId)}${download ? "?download=1" : ""}`;
