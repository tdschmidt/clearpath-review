import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileUp,
  FolderOpen,
  LoaderCircle,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { api, ApiError, multipart } from "./api";
import { clearDrafts, useDraftState } from "./drafts";
import { bytes, ErrorMessage, Modal } from "./components";
import {
  currentRevision,
  openBlockers,
  PRODUCT_LABELS,
  REVIEWER,
  PARTICIPANTS,
  ROLE_LABELS,
  type AssetRole,
  type CaseAction,
  type Finding,
  type FindingInput,
  type Offer,
  type Product,
  type ReviewCase,
  type RevisionInput,
  type SubmissionInput,
} from "../shared/types";

export type ActionInput = CaseAction extends infer A
  ? A extends { expectedVersion: number }
    ? Omit<A, "expectedVersion">
    : never
  : never;
type ActionProps = {
  review: ReviewCase;
  onAction: (action: ActionInput) => Promise<void>;
  onClose: () => void;
  reviewerName?: string;
};
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button type="submit" className="button primary" disabled={busy}>
      {busy ? <LoaderCircle size={17} className="spin" /> : null}
      {children}
    </button>
  );
}

export function SubmissionForm({
  offers,
  existing,
  onLatest,
  onSaved,
  onClose,
}: {
  offers: Offer[];
  existing?: ReviewCase;
  onLatest?: (c: ReviewCase) => void;
  onSaved: (c: ReviewCase) => void;
  onClose: () => void;
}) {
  const previous = existing && currentRevision(existing);
  const draftKey = `submission/${existing?.id || "new"}/`;
  const [data, setData] = useDraftState<SubmissionInput>(draftKey + "fields", {
    title: existing?.title || "",
    product: existing?.product || "personal_loan",
    submitter: existing?.submitter || "",
    submitterEmail: existing?.submitterEmail || "",
    channel: existing?.channel || "Paid social",
    launchDate: existing?.launchDate || "",
    submittedBy: existing?.submitter || "",
    summary: "",
    offerId: previous?.offerId || "",
    intendedUse: previous?.intendedUse || "",
    copy: previous?.copy || "",
    destinationUrl: previous?.destinationUrl || "",
    fileRoles: [],
  });
  const [files, setFiles] = useDraftState<
    { file: File; role: AssetRole; replaces?: string }[]
  >(draftKey + "files", [], true);
  const [retained, setRetained] = useDraftState(
    draftKey + "retained",
    previous?.components || [],
    true,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const key = useRef({ signature: "", value: crypto.randomUUID() });
  const update = <K extends keyof SubmissionInput>(
    name: K,
    value: SubmissionInput[K],
  ) => setData((d) => ({ ...d, [name]: value }));
  function addFiles(incoming: File[]) {
    if (files.length + incoming.length > 10) {
      setError("A submission can include up to 10 new files.");
      return;
    }
    if (incoming.some((f) => f.size > 10 * 1024 * 1024)) {
      setError(
        "Each file must be 10 MB or smaller. Please use a smaller rendition.",
      );
      return;
    }
    if (
      [...files.map((f) => f.file), ...incoming].reduce(
        (n, f) => n + f.size,
        0,
      ) >
      25 * 1024 * 1024
    ) {
      setError("Keep new uploads under 25 MB per submission.");
      return;
    }
    setError("");
    setFiles((old) => [
      ...old,
      ...incoming.map((file) => ({ file, role: "creative" as const })),
    ]);
  }
  async function sample() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/fixtures/loan/v1/social-ad.png");
      if (!response.ok)
        throw new Error(
          "Sample files are not available yet. You can upload your own files.",
        );
      const blob = await response.blob();
      const offer = offers.find((o) => o.product === "personal_loan");
      setData((d) => ({
        ...d,
        title: "A fresh start for your finances",
        product: "personal_loan",
        offerId: offer?.id || "",
        submitter: "Jordan Lee",
        submitterEmail: "jordan@example.com",
        submittedBy: "Jordan Lee",
        intendedUse:
          "Paid social placement promoting the ClearPath personal loan. Landing-page rendition to follow.",
        copy: "Bring your balances together. Explore a personal loan from ClearPath.",
        summary: "Initial social creative. Please review before launch.",
      }));
      setFiles([
        {
          file: new File([blob], "social-ad.png", { type: "image/png" }),
          role: "creative",
        },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = existing
        ? ({
            submittedBy: data.submittedBy || data.submitter,
            summary: data.summary,
            offerId: data.offerId,
            intendedUse: data.intendedUse,
            copy: data.copy,
            destinationUrl: data.destinationUrl,
            product: data.product,
            channel: data.channel,
            launchDate: data.launchDate,
            replacements: files.map((f) => f.replaces || null),
            fileRoles: files.map((f) => f.role),
            retainedComponents: retained,
            expectedVersion: existing.version,
          } satisfies RevisionInput & { expectedVersion: number })
        : {
            ...data,
            submittedBy: data.submitter,
            fileRoles: files.map((f) => f.role),
          };
      const signature = JSON.stringify([
        payload,
        files.map((f) => [f.file.name, f.file.size, f.file.lastModified]),
      ]);
      if (key.current.signature !== signature)
        key.current = { signature, value: crypto.randomUUID() };
      const saved = await api<ReviewCase>(
        existing ? `/api/cases/${existing.id}/revisions` : "/api/cases",
        multipart(
          payload,
          files.map((f) => f.file),
          key.current.value,
        ),
      );
      clearDrafts(draftKey);
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && existing && onLatest) {
        const latest = await api<ReviewCase>(`/api/cases/${existing.id}`);
        onLatest(latest);
        setError(
          `This case changed. Version ${currentRevision(latest).number} is now loaded. Your text and uploads were kept; reconcile the retained files and context before saving again.`,
        );
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={existing ? "Submit an updated package" : "New submission"}
      description={
        existing
          ? "Select the files to keep and upload any replacements."
          : "Add the creative, offer reference, and intended use."
      }
      onClose={onClose}
      wide
      busy={busy}
    >
      <form onSubmit={submit}>
        <div className="modal-body submission-body">
          <p className="demo-notice">
            Use fictional materials only. Submissions in this demo are shared
            with everyone who has its link.
          </p>
          {!existing && (
            <div className="sample-callout">
              <span>
                <FolderOpen size={18} /> Sample personal-loan submission
              </span>
              <button
                type="button"
                className="text-button"
                onClick={sample}
                disabled={busy}
              >
                Use sample <ArrowRight size={15} />
              </button>
            </div>
          )}
          <section className="form-section">
            <div className="section-heading">
              <span className="step-number">1</span>
              <h3>Review context</h3>
            </div>
            {!existing && (
              <Field label="Submission name">
                <input
                  required
                  maxLength={160}
                  placeholder="e.g. Spring personal loan · social campaign"
                  value={data.title}
                  onChange={(e) => update("title", e.target.value)}
                />
              </Field>
            )}
            <div className="form-grid">
              <Field label="Product">
                <select
                  value={data.product}
                  onChange={(e) => {
                    update("product", e.target.value as Product);
                    update("offerId", "");
                  }}
                >
                  {Object.entries(PRODUCT_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Offer reference"
                hint="Missing facts can be requested during intake."
              >
                <select
                  value={data.offerId}
                  onChange={(e) => update("offerId", e.target.value)}
                >
                  <option value="">Not provided yet</option>
                  {offers
                    .filter((o) => o.product === data.product)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} · {o.version}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Placement">
                <select
                  value={data.channel}
                  onChange={(e) => update("channel", e.target.value)}
                >
                  {[
                    "Paid social",
                    "Organic social",
                    "Landing page",
                    "Display advertising",
                    "Marketing email",
                    "Other",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Target launch date · optional">
                <input
                  type="date"
                  value={data.launchDate}
                  onChange={(e) => update("launchDate", e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Intended use"
              hint="Include placement, audience/geography, and any affiliate, targeting, or compensation context that matters. Note what is still unknown."
            >
              <textarea
                rows={2}
                maxLength={3000}
                placeholder="Where and how will this material be used?"
                value={data.intendedUse}
                onChange={(e) => update("intendedUse", e.target.value)}
              />
            </Field>
          </section>
          <section className="form-section">
            <div className="section-heading">
              <span className="step-number">2</span>
              <h3>Material to review</h3>
            </div>
            {previous && (
              <div className="retained-files">
                <p className="eyebrow">FROM VERSION {previous.number}</p>
                {previous.components.map((comp) => {
                  const asset = existing!.assets.find(
                    (a) => a.id === comp.assetId,
                  )!;
                  const included = retained.some(
                    (c) => c.assetId === comp.assetId,
                  );
                  return (
                    <div className="retain-row" key={comp.assetId}>
                      <span>
                        {asset.name}
                        <small>
                          {included
                            ? "Kept in this version"
                            : files.some((f) => f.replaces === comp.assetId)
                              ? "Replacement selected"
                              : "Removed from this version"}
                        </small>
                      </span>
                      <select
                        aria-label={`Role for retained ${asset.name}`}
                        disabled={!included}
                        value={
                          retained.find((c) => c.assetId === comp.assetId)
                            ?.role || comp.role
                        }
                        onChange={(e) =>
                          setRetained((old) =>
                            old.map((c) =>
                              c.assetId === comp.assetId
                                ? { ...c, role: e.target.value as AssetRole }
                                : c,
                            ),
                          )
                        }
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busy}
                        onClick={() => {
                          setFiles((old) =>
                            old.filter((f) => f.replaces !== comp.assetId),
                          );
                          setRetained((old) =>
                            included
                              ? old.filter((c) => c.assetId !== comp.assetId)
                              : [...old, comp],
                          );
                        }}
                      >
                        {included ? "Remove" : "Keep"}
                      </button>
                      <label className="button secondary">
                        Replace
                        <input
                          type="file"
                          hidden
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 10 * 1024 * 1024) {
                              setError("Each file must be 10 MB or smaller.");
                              return;
                            }
                            const role =
                              retained.find((c) => c.assetId === comp.assetId)
                                ?.role || comp.role;
                            setFiles((old) => [
                              ...old.filter((f) => f.replaces !== comp.assetId),
                              { file, role, replaces: comp.assetId },
                            ]);
                            setRetained((old) =>
                              old.filter((c) => c.assetId !== comp.assetId),
                            );
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
                <small>
                  Replacing removes the earlier file from this version only. All
                  originals remain in history.
                </small>
              </div>
            )}
            <div
              className={`upload-zone ${dragging ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <FileUp size={26} strokeWidth={1.4} />
              <button
                type="button"
                className="text-button"
                onClick={() => input.current?.click()}
              >
                Choose files <span>or drop them here</span>
              </button>
              <small>
                Preview PNG, JPG, and PDF · Other files kept for manual review
                <br />
                Up to 10 files · 10 MB each · 25 MB total
              </small>
              <input
                ref={input}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []));
                  e.target.value = "";
                }}
              />
            </div>
            {files.length > 0 && (
              <div className="upload-list">
                {files.map(({ file, role }, index) => (
                  <div className="upload-row" key={index}>
                    <FileUp size={18} />
                    <span className="upload-name">
                      {file.name}
                      <small>{bytes(file.size)}</small>
                    </span>
                    <select
                      aria-label={`Role for ${file.name}`}
                      value={role}
                      onChange={(e) =>
                        setFiles((old) =>
                          old.map((f, i) =>
                            i === index
                              ? { ...f, role: e.target.value as AssetRole }
                              : f,
                          ),
                        )
                      }
                    >
                      {Object.entries(ROLE_LABELS).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() =>
                        setFiles((old) => old.filter((_, i) => i !== index))
                      }
                    >
                      <X size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Field
              label="Accompanying copy · optional"
              hint="Caption, subject line, or ad copy that should be reviewed with the files."
            >
              <textarea
                rows={3}
                maxLength={20000}
                placeholder="Paste the consumer-facing copy here…"
                value={data.copy}
                onChange={(e) => update("copy", e.target.value)}
              />
            </Field>
            <Field
              label="Destination URL · optional"
              hint="A link is a reference. Upload a screenshot or PDF when the destination needs review."
            >
              <input
                type="url"
                placeholder="https://…"
                value={data.destinationUrl}
                onChange={(e) => update("destinationUrl", e.target.value)}
              />
            </Field>
          </section>
          <section className="form-section">
            <div className="section-heading">
              <span className="step-number">3</span>
              <h3>{existing ? "What changed?" : "Submission details"}</h3>
            </div>
            {!existing ? (
              <div className="form-grid">
                <Field label="Submitted by">
                  <input
                    required
                    maxLength={120}
                    placeholder="Name or team"
                    value={data.submitter}
                    onChange={(e) => update("submitter", e.target.value)}
                  />
                </Field>
                <Field label="Contact email · optional">
                  <input
                    type="email"
                    value={data.submitterEmail}
                    onChange={(e) => update("submitterEmail", e.target.value)}
                    placeholder="name@example.com"
                  />
                </Field>
              </div>
            ) : (
              <Field label="Updated by">
                <input
                  required
                  maxLength={120}
                  value={data.submittedBy}
                  onChange={(e) => update("submittedBy", e.target.value)}
                />
              </Field>
            )}
            <Field
              label={
                existing ? "Revision note" : "Note to the reviewer · optional"
              }
            >
              <textarea
                required={!!existing}
                rows={2}
                maxLength={2000}
                placeholder={
                  existing
                    ? "Describe the changes or new supporting evidence."
                    : "Anything the reviewer should know?"
                }
                value={data.summary}
                onChange={(e) => update("summary", e.target.value)}
              />
            </Field>
          </section>
          <ErrorMessage error={error} />
        </div>
        <footer className="modal-footer">
          <span className="footer-hint">
            {existing
              ? "Findings remain open until a reviewer resolves them."
              : "Submissions enter the intake queue."}
          </span>
          <button
            className="button secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              if (confirm("Discard this unfinished submission?")) {
                clearDrafts(draftKey);
                onClose();
              }
            }}
          >
            Discard draft
          </button>
          <Submit busy={busy}>
            {existing ? "Save new version" : "Create submission"}
            <ArrowRight size={16} />
          </Submit>
        </footer>
      </form>
    </Modal>
  );
}

export function WaitingForm({ review, onAction, onClose }: ActionProps) {
  const draftKey = `waiting/${review.id}/`;
  const [owner, setOwner] = useDraftState(
    draftKey + "owner",
    review.nextOwner || review.submitter,
  );
  const [reason, setReason] = useDraftState(
    draftKey + "reason",
    review.waitingReason || "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title="Who are we waiting on?"
      description="Enter who needs to respond and what is needed."
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onAction({ type: "set_waiting", nextOwner: owner, reason });
            clearDrafts(draftKey);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-body">
          <Field label="Next action owner">
            <input
              required
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </Field>
          <Field label="What do they need to do?">
            <textarea
              required
              rows={3}
              placeholder="e.g. Supply the destination-page proof."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <ErrorMessage error={error} />
        </div>
        <footer className="modal-footer">
          <button
            className="button secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              clearDrafts(draftKey);
              onClose();
            }}
          >
            Discard draft
          </button>
          <Submit busy={busy}>Mark waiting</Submit>
        </footer>
      </form>
    </Modal>
  );
}

export function DecisionForm({
  review,
  onAction,
  onClose,
  reviewerName = REVIEWER,
}: ActionProps) {
  const rev = currentRevision(review),
    blockers = openBlockers(review),
    confirmed = review.confirmedRevisionId === rev.id;
  const [outcome, setOutcome] = useState<"approved" | "rejected">("approved");
  const draftKey = `decision/${review.id}/`;
  const [scope, setScope] = useDraftState(draftKey + "scope", rev.intendedUse);
  const [rationale, setRationale] = useDraftState(draftKey + "rationale", "");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setReviewed(false), [review.version]);
  const blocked = outcome === "approved" && (!confirmed || blockers.length > 0);
  return (
    <Modal
      title="Record your decision"
      description={`For ${review.reference}, version ${rev.number} only.`}
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onAction({
              type: "decide",
              outcome,
              scope,
              rationale,
              reviewed,
            });
            clearDrafts(draftKey);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-body">
          <div className="decision-package">
            <ShieldCheck size={25} />
            <div>
              <strong>{review.title}</strong>
              <span>
                {rev.components.filter((c) => c.role !== "excluded").length}{" "}
                files · Version {rev.number} · {reviewerName}
              </span>
            </div>
          </div>
          <Field label="Decision">
            <select
              value={outcome}
              onChange={(e) =>
                setOutcome(e.target.value as "approved" | "rejected")
              }
            >
              <option value="approved">Approve for stated use</option>
              <option value="rejected">Reject this version</option>
            </select>
          </Field>
          {blocked && (
            <div className="decision-blockers">
              <AlertCircle size={18} />
              <div>
                <strong>Not ready for approval</strong>
                {!confirmed && (
                  <p>Confirm the current package in intake first.</p>
                )}
                {blockers.map((f) => (
                  <p key={f.id}>
                    F{String(f.number).padStart(2, "0")} · {f.title}
                    {f.needsRecheck ? " (recheck needed)" : ""}
                  </p>
                ))}
              </div>
            </div>
          )}
          <Field
            label="Scope of this decision"
            hint="Identify the placement and intended use. This does not approve future edits."
          >
            <textarea
              required={outcome === "approved"}
              maxLength={3000}
              rows={3}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            />
          </Field>
          <Field
            label={
              outcome === "rejected"
                ? "Reason for rejection"
                : "Decision rationale"
            }
          >
            <textarea
              required
              rows={3}
              placeholder={
                outcome === "approved"
                  ? "Record the basis for your decision, including relevant evidence."
                  : "Explain why this version cannot be approved."
              }
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
          </Field>
          {outcome === "approved" && (
            <label className="check-line">
              <input
                type="checkbox"
                required
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              <span>
                I have reviewed this package and the applicable requirements.
              </span>
            </label>
          )}
          <ErrorMessage error={error} />
        </div>
        <footer className="modal-footer">
          <button
            className="button secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Back to review
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              if (confirm("Discard this unfinished decision?")) {
                clearDrafts(draftKey);
                onClose();
              }
            }}
          >
            Discard draft
          </button>
          <button
            className={`button ${outcome === "approved" ? "primary" : "danger"}`}
            type="submit"
            disabled={busy || blocked || (outcome === "approved" && !reviewed)}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}
            {outcome === "approved" ? "Record approval" : "Record rejection"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function draftText(
  review: ReviewCase,
  selected: string[],
  reviewerName: string,
) {
  const rev = currentRevision(review);
  const eligible = review.findings.filter(
    (f) =>
      f.audience === "submitter" &&
      selected.includes(f.id) &&
      (f.status === "open" || f.needsRecheck),
  );
  if (!eligible.length) return "";
  const group = (required: boolean) =>
    eligible
      .filter((f) => f.material === required)
      .map(
        (f) =>
          `• ${f.title}${f.location ? ` (${f.location})` : ""}\n${f.request}`,
      )
      .join("\n\n");
  return `Hi ${review.submitter},\n\nRegarding ${review.title} (${review.reference}, version ${rev.number}):${group(true) ? `\n\nRequired before approval\n${group(true)}` : ""}${group(false) ? `\n\nAdvice\n${group(false)}` : ""}\n\n${reviewerName}\nClearPath Marketing Compliance`;
}
export function DraftForm({
  review,
  onAction,
  onClose,
  reviewerName = REVIEWER,
  draftId,
}: ActionProps & { draftId?: string }) {
  const rev = currentRevision(review);
  const existing = review.drafts.find((d) => d.id === draftId);
  const decision = review.decisions.findLast(
    (d) => d.revisionId === rev.id && !d.withdrawn,
  );
  const historical =
    !!existing &&
    (existing.revisionId !== rev.id ||
      (!!existing.decisionId && existing.decisionId !== decision?.id));
  const draftKey = `reply/${review.id}/${rev.id}/${decision?.id || "review"}/${draftId || "new"}/`;
  const pending = review.findings.filter(
    (f) =>
      f.audience === "submitter" && (f.status === "open" || f.needsRecheck),
  );
  const [selected, setSelected] = useDraftState(
    draftKey + "selected",
    existing?.findingIds || pending.map((f) => f.id),
  );
  const [subject, setSubject] = useDraftState(
    draftKey + "subject",
    existing?.subject ||
      `${review.reference} · ${review.title} · Review feedback`,
  );
  const [body, setBody] = useDraftState(
    draftKey + "body",
    () =>
      existing?.body ||
      draftText(
        review,
        pending.map((f) => f.id),
        reviewerName,
      ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [reconciled, setReconciled] = useState(!historical);
  const [communicatesDecision, setCommunicatesDecision] = useDraftState(
    draftKey + "decision",
    !historical && !!decision && existing?.decisionId === decision.id,
  );
  async function run(action: ActionInput) {
    setBusy(true);
    setError("");
    try {
      await onAction(action);
      clearDrafts(draftKey);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        existing
          ? historical
            ? "Reuse earlier reply"
            : "Edit reply draft"
          : "Prepare a reply"
      }
      description={`For ${review.reference}, version ${rev.number}. Sharing publishes to the submission link; it does not send an email.`}
      onClose={onClose}
      busy={busy}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run({
            type: "save_draft",
            draftId: historical ? undefined : existing?.id,
            subject,
            body,
            findingIds: selected,
            ...(communicatesDecision && decision
              ? { decisionId: decision.id }
              : {}),
          });
        }}
      >
        <div className="modal-body">
          <div className="reply-recipient">
            <span>To</span>
            <strong>{review.submitter}</strong>
            <span>{review.submitterEmail || "Email not provided"}</span>
          </div>
          {historical && (
            <label className="check-line">
              <input
                type="checkbox"
                checked={reconciled}
                onChange={(e) => setReconciled(e.target.checked)}
              />
              <span>
                This text came from an earlier package or decision. I have
                checked and updated it for version {rev.number} and the current
                review. Saving creates a new draft.
              </span>
            </label>
          )}
          {pending.length > 0 && (
            <details className="draft-select" open>
              <summary>
                Submitter requests ·{" "}
                {
                  selected.filter((id) => pending.some((f) => f.id === id))
                    .length
                }{" "}
                selected
              </summary>
              {pending.map((f) => (
                <label className="check-line" key={f.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(f.id)}
                    onChange={() =>
                      setSelected((old) =>
                        old.includes(f.id)
                          ? old.filter((id) => id !== f.id)
                          : [...old, f.id],
                      )
                    }
                  />
                  <span>
                    {f.title} · {f.material ? "Required" : "Advice"}
                  </span>
                </label>
              ))}
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    !body ||
                    confirm(
                      "Replace the message with wording from the selected requests? Your edits will be replaced.",
                    )
                  )
                    setBody(draftText(review, selected, reviewerName));
                }}
              >
                Update message from requests
              </button>
            </details>
          )}
          {!pending.length && !existing && (
            <p className="small-muted">
              No submitter requests selected. Write a message or share the
              recorded decision below.
            </p>
          )}
          <Field label="Subject">
            <input
              required
              maxLength={300}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
          <Field label="Message">
            <textarea
              required
              className="draft-body"
              rows={10}
              maxLength={20000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <p className="small-muted">
            Only selected submitter requests and this message will be shared.
            Internal bases and notes are excluded. Check any wording you add.
          </p>
          {decision && (
            <div className="decision-package">
              <div>
                <strong>
                  Recorded{" "}
                  {decision.outcome === "approved" ? "approval" : "rejection"} ·
                  version {rev.number}
                </strong>
                <p>{decision.scope}</p>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={communicatesDecision}
                    onChange={(e) => setCommunicatesDecision(e.target.checked)}
                  />
                  <span>
                    This message communicates the recorded decision
                    <small>
                      Saving links this exact message version to the decision.
                      Copying it does not record communication.
                    </small>
                  </span>
                </label>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || !reconciled}
                  onClick={() =>
                    void run({
                      type: "publish_result",
                      decisionId: decision.id,
                      message: body,
                    })
                  }
                >
                  Share decision on submission link
                </button>
              </div>
            </div>
          )}
          {!review.submitterToken && (
            <p className="small-muted">
              Sharing creates a submission return link for this case. It does
              not send an email.
            </p>
          )}
          <ErrorMessage error={error} />
        </div>
        <footer className="modal-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy || !body}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `Subject: ${subject}\n\n${body}`,
                );
                setCopied(true);
              } catch {
                setError("Clipboard unavailable. Select the text to copy it.");
              }
            }}
          >
            {copied ? "Copied" : "Copy reply"}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy || !body}
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([`Subject: ${subject}\n\n${body}`], {
                  type: "text/plain",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `${review.reference}-reply.txt`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              if (confirm("Discard this unfinished reply?")) {
                clearDrafts(draftKey);
                onClose();
              }
            }}
          >
            Discard edits
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={
              busy ||
              !reconciled ||
              !body.trim() ||
              !subject.trim() ||
              !review.submitterToken
            }
            onClick={() =>
              void run({
                type: "publish_feedback",
                findingIds: selected.filter((id) =>
                  pending.some((f) => f.id === id),
                ),
                subject,
                body,
              })
            }
          >
            Share feedback on submission link
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={busy || !reconciled}
          >
            {busy ? "Saving…" : "Save draft"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
