export type Product = "personal_loan" | "credit_card" | "mortgage";
export type CaseStatus =
  "needs_intake" | "in_review" | "waiting" | "approved" | "rejected";
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
};
export const ROLE_LABELS: Record<AssetRole, string> = {
  creative: "Creative",
  destination: "Destination",
  evidence: "Supporting evidence",
  excluded: "Not in review",
};
export const REVIEWER = "Maya Chen";

export interface Offer {
  id: string;
  product: Product;
  name: string;
  version: string;
  validFrom: string;
  validTo: string;
  facts: { label: string; value: string }[];
  disclosure: string;
  source: string;
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
  components: { assetId: string; role: AssetRole }[];
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
  disposition?: { reason: string; at: string; by: string; revisionId: string };
  needsRecheck?: boolean;
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
}
export interface ReplyDraft {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  revisionId: string;
  status: "prepared";
}
export interface HistoryEvent {
  id: string;
  type: string;
  text: string;
  actor: string;
  createdAt: string;
  revisionId: string;
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
>;
export type CaseAction = { expectedVersion: number } & (
  | { type: "confirm_intake" }
  | { type: "add_finding"; finding: FindingInput }
  | {
      type: "disposition";
      findingId: string;
      status: FindingStatus;
      reason: string;
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
  | { type: "save_draft"; subject: string; body: string }
);

export const currentRevision = (c: ReviewCase) =>
  c.revisions[c.revisions.length - 1];
export const openBlockers = (c: ReviewCase) =>
  c.findings.filter(
    (f) => f.material && (f.status === "open" || f.needsRecheck),
  );
export const assetUrl = (caseId: string, assetId: string, download = false) =>
  `/api/cases/${encodeURIComponent(caseId)}/assets/${encodeURIComponent(assetId)}${download ? "?download=1" : ""}`;
