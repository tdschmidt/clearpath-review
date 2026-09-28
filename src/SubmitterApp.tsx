import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  FileUp,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  X,
} from "lucide-react";
import { api, ApiError, multipart } from "./api";
import { usePackageDraft, type DraftChoice } from "./submitter-drafts";
import { bytes, date, dateTime, ErrorMessage } from "./components";
import {
  PRODUCT_LABELS,
  ROLE_LABELS,
  submitterAssetUrl,
  type AssetRole,
  type Product,
  type MaterialCitation,
  type SubmitterCase,
  type SubmitterReceipt,
} from "../shared/types";
import "./submitter.css";

type Upload = { file: File; role: AssetRole; replaces: string | null };
type SubmissionFields = {
  title: string;
  product: Product;
  submitter: string;
  submitterEmail: string;
  channel: string;
  launchDate: string;
  advertisedOffer: string;
  intendedUse: string;
  copy: string;
  destinationUrl: string;
  summary: string;
};
const blank: SubmissionFields = {
  title: "",
  product: "personal_loan",
  submitter: "",
  submitterEmail: "",
  channel: "Paid social",
  launchDate: "",
  advertisedOffer: "",
  intendedUse: "",
  copy: "",
  destinationUrl: "",
  summary: "",
};
const fieldNames: Record<keyof SubmissionFields, string> = {
  title: "Submission name",
  product: "Product",
  submitter: "Updated by",
  submitterEmail: "Contact email",
  channel: "Placement",
  launchDate: "Target launch date",
  advertisedOffer: "Advertised offer",
  intendedUse: "Intended use",
  copy: "Accompanying copy",
  destinationUrl: "Destination URL",
  summary: "Revision note",
};
const externalStatus = {
  received: "Received for review",
  feedback_shared: "Feedback available",
  approved: "Approved for the stated use",
  rejected: "This version was not approved",
  withdrawn: "Earlier approval withdrawn",
  cancelled: "Review closed",
};

function Field({
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
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Your work has not been cleared.";
}
function useTextDraft<T extends Record<string, string>>(
  key: string,
  initial: T,
) {
  const [recovered, setRecovered] = useState(false);
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      if (saved && typeof saved === "object") {
        const result = { ...initial };
        for (const field of Object.keys(initial))
          if (typeof saved[field] === "string")
            Object.assign(result, { [field]: saved[field] });
        return result;
      }
    } catch {
      /* Draft storage is optional. */
    }
    return initial;
  });
  const baseline = useRef(JSON.stringify(initial));
  const dirty = JSON.stringify(value) !== baseline.current;
  useEffect(() => {
    try {
      setRecovered(!!sessionStorage.getItem(key));
    } catch {
      /* unavailable */
    }
  }, [key]);
  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* unavailable */
    }
  }, [key, value, dirty]);
  function clear(next?: T) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* unavailable */
    }
    baseline.current = JSON.stringify(next || value);
    if (next) setValue(next);
    setRecovered(false);
  }
  return { value, setValue, dirty, recovered, clear };
}
function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
function validateUploads(files: Upload[]) {
  if (files.length > 10) return "You can add up to 10 new files at a time.";
  if (files.some(({ file }) => file.size > 10 * 1024 * 1024))
    return "Each file must be 10 MB or smaller.";
  if (files.reduce((n, { file }) => n + file.size, 0) > 25 * 1024 * 1024)
    return "Keep new files under 25 MB in total.";
  return "";
}
function UploadList({
  uploads,
  onChange,
  currentAssetIds,
}: {
  uploads: Upload[];
  onChange: (files: Upload[]) => void;
  currentAssetIds?: Set<string>;
}) {
  return (
    <div className="partner-upload-list">
      {uploads.map((entry, index) => (
        <div className="partner-upload-row" key={`${entry.file.name}-${index}`}>
          <FileText size={18} />
          <span className="partner-file-name">
            {entry.file.name}
            <small>
              {bytes(entry.file.size)}
              {entry.replaces ? " · Replacement" : ""}
            </small>
            {entry.replaces &&
              currentAssetIds &&
              !currentAssetIds.has(entry.replaces) && (
                <div className="partner-replacement-warning">
                  <p>
                    The file this upload replaced is no longer in the latest
                    package.
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      onChange(
                        uploads.map((file, i) =>
                          i === index ? { ...file, replaces: null } : file,
                        ),
                      )
                    }
                  >
                    Keep as an additional file
                  </button>
                </div>
              )}
          </span>
          <select
            aria-label={`Role for ${entry.file.name}`}
            value={entry.role}
            onChange={(e) =>
              onChange(
                uploads.map((f, i) =>
                  i === index ? { ...f, role: e.target.value as AssetRole } : f,
                ),
              )
            }
          >
            {(["creative", "destination", "evidence"] as AssetRole[]).map(
              (role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ),
            )}
          </select>
          <button
            className="icon-button"
            type="button"
            aria-label={`Remove upload ${entry.file.name}`}
            onClick={() => onChange(uploads.filter((_, i) => i !== index))}
          >
            <X size={17} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function SubmitterApp() {
  const [token, setToken] = useState(() =>
    decodeURIComponent(
      window.location.pathname.split("/").filter(Boolean)[1] || "",
    ),
  );
  const [submission, setSubmission] = useState<SubmitterCase | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionStarted, setRevisionStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    findingId: string;
    sequence: number;
  } | null>(null);
  async function refresh() {
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      setSubmission(
        await api<SubmitterCase>(
          `/api/submissions/${encodeURIComponent(token)}`,
        ),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (token) void refresh();
  }, [token]);
  function receive(result: SubmitterReceipt) {
    setSubmission(result.submission);
    setReceipt(true);
    setToken(result.token);
    window.history.replaceState(
      null,
      "",
      `/submit/${encodeURIComponent(result.token)}`,
    );
  }
  const returnLink = token
    ? `${window.location.origin}/submit/${encodeURIComponent(token)}`
    : "";
  return (
    <div className="partner-app">
      <header className="partner-header">
        <a className="partner-brand" href="/submit">
          <span className="partner-brand-mark">c</span>
          <span>
            clearpath<small>MARKETING SUBMISSIONS</small>
          </span>
        </a>
        <span>Material review</span>
      </header>
      <main className="partner-main">
        <p className="partner-demo-note">
          Fictional materials only. This take-home demo has no sign-in; use the
          submission link to return to your package.
        </p>
        {!token ? (
          <>
            <div className="partner-page-heading">
              <p className="eyebrow">NEW SUBMISSION</p>
              <h1>Submit material for review</h1>
              <p>
                Share the creative, the offer you are promoting, and where it
                will run. The ClearPath team will review the complete package.
              </p>
            </div>
            <PackageForm onCreated={receive} />
          </>
        ) : (
          <>
            {loading && !submission && (
              <div className="partner-state">
                <LoaderCircle className="spin" size={25} />
                Opening your submission…
              </div>
            )}
            <ErrorMessage error={error} />
            {error && (
              <button
                className="button secondary"
                onClick={() => void refresh()}
              >
                <RefreshCw size={16} />
                Try again
              </button>
            )}
            {submission && (
              <>
                {receipt &&
                  submission.status === "received" &&
                  submission.responses.length === 0 && (
                    <div className="partner-receipt" role="status">
                      <CheckCircle2 size={26} />
                      <div>
                        <h2>Received. Your material is waiting for review.</h2>
                        <p>
                          Reference {submission.reference}. Save the link below
                          to see feedback and send updates. Submitting material
                          does not approve it for use.
                        </p>
                      </div>
                    </div>
                  )}
                <div className="partner-page-heading partner-return-heading">
                  <div>
                    <p className="eyebrow">
                      {submission.reference}
                      {submission.revisions.length
                        ? ` · VERSION ${submission.revisions.at(-1)!.number}`
                        : ""}
                    </p>
                    <h1>{submission.title}</h1>
                    <span
                      className={`partner-status partner-status-${submission.status}`}
                    >
                      {externalStatus[submission.status]}
                    </span>
                  </div>
                  <button
                    className="button secondary"
                    disabled={loading}
                    onClick={() => void refresh()}
                  >
                    <RefreshCw size={16} className={loading ? "spin" : ""} />
                    Check for updates
                  </button>
                </div>
                <div className="partner-return-link">
                  <div>
                    <strong>Your return link</strong>
                    <p>
                      Anyone with this link can view this submission and send
                      updates. Keep it for this review.
                    </p>
                  </div>
                  <input
                    aria-label="Your return link"
                    readOnly
                    value={returnLink}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="button secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(returnLink);
                        setCopied(true);
                      } catch {
                        setError(
                          "Select the return link above and copy it manually.",
                        );
                      }
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
                {submission.status === "cancelled" && (
                  <section className="partner-card partner-alert">
                    <h2>This review is closed</h2>
                    <p>
                      {submission.cancellationReason ||
                        "The reviewer has closed this submission."}
                    </p>
                  </section>
                )}
                <PublishedResults submission={submission} token={token} />
                <CurrentRequests
                  submission={submission}
                  token={token}
                  onRespond={(findingId) =>
                    setReplyTarget((old) => ({
                      findingId,
                      sequence: (old?.sequence || 0) + 1,
                    }))
                  }
                />
                {submission.status === "received" &&
                  !submission.feedback.length && (
                    <section className="partner-card partner-next-step">
                      <MessageSquare size={23} />
                      <div>
                        <h2>
                          {submission.revisions.length
                            ? "The team has your package."
                            : "Your submission link is ready."}
                        </h2>
                        <p>
                          {submission.revisions.length
                            ? "No feedback has been shared yet."
                            : "No package or feedback has been shared on this page yet."}{" "}
                          Check this page for updates. Email notifications are
                          not enabled.
                        </p>
                      </div>
                    </section>
                  )}
                {submission.status !== "cancelled" && (
                  <section className="partner-card">
                    <div className="partner-section-heading">
                      <div>
                        <h2>Respond to the review</h2>
                        <p>
                          Send an answer or supporting evidence. Changed
                          advertising belongs in an updated package.
                        </p>
                      </div>
                    </div>
                    <ResponseForm
                      token={token}
                      submission={submission}
                      onSaved={setSubmission}
                      replyTarget={replyTarget}
                    />
                    {submission.revisions.length > 0 && (
                      <div className="partner-revision-action">
                        <div>
                          <strong>
                            Changing creative, copy, or intended use?
                          </strong>
                          <p>
                            A new version preserves the earlier package and goes
                            back for review.
                          </p>
                        </div>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => {
                            setRevisionStarted(true);
                            setRevisionOpen((v) => !v);
                          }}
                        >
                          {revisionOpen
                            ? "Hide updated package"
                            : "Submit updated package"}
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </section>
                )}
                {revisionStarted && (
                  <div hidden={!revisionOpen}>
                    <PackageForm
                      token={token}
                      existing={submission}
                      onLatest={setSubmission}
                      onRevised={(next) => {
                        setSubmission(next);
                        setRevisionOpen(false);
                        setRevisionStarted(false);
                        setReceipt(false);
                      }}
                    />
                  </div>
                )}
                <Feedback submission={submission} />
                <SubmissionHistory submission={submission} token={token} />
              </>
            )}
          </>
        )}
      </main>
      <footer className="partner-footer">
        ClearPath Financial · Marketing material review · Demonstration
      </footer>
    </div>
  );
}

function PackageForm({
  token,
  existing,
  onCreated,
  onRevised,
  onLatest,
}: {
  token?: string;
  existing?: SubmitterCase;
  onCreated?: (receipt: SubmitterReceipt) => void;
  onRevised?: (submission: SubmitterCase) => void;
  onLatest?: (submission: SubmitterCase) => void;
}) {
  const latest = existing?.revisions.at(-1);
  const initial: SubmissionFields =
    latest && existing
      ? {
          title: existing.title,
          product: latest.product,
          submitter: existing.submitter,
          submitterEmail: existing.submitterEmail,
          channel: latest.channel,
          launchDate: latest.launchDate,
          advertisedOffer: latest.advertisedOffer,
          intendedUse: latest.intendedUse,
          copy: latest.copy,
          destinationUrl: latest.destinationUrl,
          summary: "",
        }
      : blank;
  const draft = usePackageDraft(
    `clearpath:submit:${token || "new"}`,
    latest?.id || "new",
    initial,
  );
  const previous =
    existing?.revisions.find(
      (revision) => revision.id === draft.baseRevisionId,
    ) || latest;
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [retained, setRetained] = useState(
    previous?.components.map((c) => ({ assetId: c.assetId, role: c.role })) ||
      [],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [choices, setChoices] = useState<
    Partial<Record<keyof SubmissionFields, DraftChoice>>
  >({});
  const [checkedLatest, setCheckedLatest] = useState(false);
  const expectedVersion = useRef(existing?.version);
  const retry = useRef({ signature: "", key: crypto.randomUUID() });
  const fileInput = useRef<HTMLInputElement>(null);
  const structureChanged =
    JSON.stringify(retained) !==
    JSON.stringify(
      previous?.components.map(({ assetId, role }) => ({ assetId, role })) ||
        [],
    );
  const orphanedReplacements = uploads.filter(
    (upload) =>
      upload.replaces &&
      !previous?.components.some(
        (component) => component.assetId === upload.replaces,
      ),
  );
  useLeaveWarning(draft.dirty || uploads.length > 0 || structureChanged);
  useEffect(() => {
    setChoices({});
    setCheckedLatest(false);
  }, [latest?.id]);
  useEffect(() => {
    if (!draft.needsReconciliation) expectedVersion.current = existing?.version;
  }, [existing?.version, draft.needsReconciliation]);
  const set = <K extends keyof SubmissionFields>(
    key: K,
    value: SubmissionFields[K],
  ) => draft.setValue((old) => ({ ...old, [key]: value }));
  function addFiles(
    files: File[],
    replaces: string | null = null,
    role: AssetRole = "creative",
  ) {
    const next = [
      ...uploads.filter((f) => !replaces || f.replaces !== replaces),
      ...files.map((file) => ({ file, role, replaces })),
    ];
    const problem = validateUploads(next);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setUploads(next);
    if (replaces)
      setRetained((old) => old.filter((c) => c.assetId !== replaces));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setConflict(false);
    if (draft.needsReconciliation) {
      setError(
        "Reconcile your draft with the latest package before submitting.",
      );
      return;
    }
    if (orphanedReplacements.length) {
      setError(
        "A replacement refers to an earlier package. Remove it or explicitly keep it as an additional file.",
      );
      return;
    }
    if (
      !draft.value.copy.trim() &&
      !uploads.some((f) => f.role === "creative") &&
      !retained.some((c) => c.role === "creative")
    ) {
      setError(
        "Include the creative file or paste the advertising copy to be reviewed.",
      );
      return;
    }
    setBusy(true);
    try {
      const { title, submitterEmail, submitter, ...context } = draft.value;
      const payload = existing
        ? {
            ...context,
            submittedBy: submitter,
            retainedComponents: retained,
            fileRoles: uploads.map((f) => f.role),
            replacements: uploads.map((f) => f.replaces),
            expectedVersion: expectedVersion.current,
          }
        : {
            ...draft.value,
            submittedBy: submitter,
            fileRoles: uploads.map((f) => f.role),
          };
      const signature = JSON.stringify([
        payload,
        uploads.map((f) => [f.file.name, f.file.size, f.file.lastModified]),
      ]);
      if (retry.current.signature !== signature)
        retry.current = { signature, key: crypto.randomUUID() };
      if (existing && token) {
        const next = await api<SubmitterCase>(
          `/api/submissions/${encodeURIComponent(token)}/revisions`,
          multipart(
            payload,
            uploads.map((f) => f.file),
            retry.current.key,
          ),
        );
        draft.clear();
        setUploads([]);
        expectedVersion.current = next.version;
        onRevised?.(next);
      } else {
        const receipt = await api<SubmitterReceipt>(
          "/api/submissions",
          multipart(
            payload,
            uploads.map((f) => f.file),
            retry.current.key,
          ),
        );
        draft.clear();
        setUploads([]);
        onCreated?.(receipt);
      }
    } catch (e) {
      setError(message(e));
      setConflict(e instanceof ApiError && e.status === 409);
      if (e instanceof ApiError && e.status === 409 && token) {
        try {
          onLatest?.(
            await api<SubmitterCase>(
              `/api/submissions/${encodeURIComponent(token)}`,
            ),
          );
        } catch {
          /* Preserve all local input if refreshing also fails. */
        }
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="partner-card partner-package-form" onSubmit={submit}>
      {existing && (
        <div className="partner-section-heading">
          <div>
            <p className="eyebrow">BASED ON VERSION {previous?.number}</p>
            <h2>Updated package</h2>
            <p>
              Keep unchanged files, replace a specific file, or remove material
              that is no longer part of the campaign.
            </p>
          </div>
        </div>
      )}
      {draft.recovered && (
        <p className="partner-draft-note">
          Your unfinished text was restored in this browser tab. Reselect any
          files before submitting.
        </p>
      )}
      {draft.needsReconciliation && (
        <section
          className="partner-reconciliation"
          aria-labelledby="draft-reconciliation-heading"
        >
          <h3 id="draft-reconciliation-heading">
            {draft.legacy
              ? "Review an older saved draft"
              : `The package has changed to version ${latest?.number}`}
          </h3>
          <p>
            {draft.legacy
              ? "This older draft has no recorded base version. Choose which saved text to carry forward; nothing will be applied silently."
              : "Your draft is still based on the earlier package. Fields you did not edit will use the latest values. Your new uploads remain here."}
          </p>
          {draft.latestChanges.length > 0 && (
            <p className="partner-reconciliation-changes">
              Latest changes:{" "}
              {draft.latestChanges
                .map((field) => fieldNames[field as keyof SubmissionFields])
                .join(", ")}
            </p>
          )}
          {draft.conflicts.map((field) => (
            <div className="partner-draft-conflict" key={field}>
              <h4>{fieldNames[field]}</h4>
              <div>
                <label>
                  <input
                    type="radio"
                    name={`reconcile-${field}`}
                    checked={choices[field] === "latest"}
                    onChange={() =>
                      setChoices((old) => ({ ...old, [field]: "latest" }))
                    }
                  />
                  <span>
                    Use latest package<pre>{initial[field] || "(empty)"}</pre>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name={`reconcile-${field}`}
                    checked={choices[field] === "draft"}
                    onChange={() =>
                      setChoices((old) => ({ ...old, [field]: "draft" }))
                    }
                  />
                  <span>
                    Keep my draft edit
                    <pre>{draft.value[field] || "(empty)"}</pre>
                  </span>
                </label>
              </div>
            </div>
          ))}
          {latest && (
            <div className="partner-reconciliation-files">
              <strong>Latest package · version {latest.number}</strong>
              {latest.components.map((component) => {
                const asset = existing?.assets.find(
                  (item) => item.id === component.assetId,
                );
                return (
                  <a
                    key={component.assetId}
                    href={submitterAssetUrl(token!, component.assetId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={14} />
                    {asset?.name} · {ROLE_LABELS[component.role]}
                  </a>
                );
              })}
              {!latest.components.length && (
                <p>Copy-only package. Review the latest text changes above.</p>
              )}
            </div>
          )}
          <label className="check-line">
            <input
              type="checkbox"
              checked={checkedLatest}
              onChange={(event) => setCheckedLatest(event.target.checked)}
            />
            <span>
              I have checked the latest package. I will recheck Keep, Replace,
              and Remove choices before submitting.
            </span>
          </label>
          <button
            type="button"
            className="button primary"
            disabled={
              busy ||
              !checkedLatest ||
              draft.conflicts.some((field) => !choices[field])
            }
            onClick={() => {
              if (!draft.reconcile(choices)) return;
              setRetained(
                latest?.components
                  .filter(
                    (component) =>
                      !uploads.some(
                        (upload) => upload.replaces === component.assetId,
                      ),
                  )
                  .map(({ assetId, role }) => ({ assetId, role })) || [],
              );
              expectedVersion.current = existing?.version;
              setConflict(false);
              setError("");
            }}
          >
            Use latest package with reviewed edits
          </button>
        </section>
      )}
      <fieldset disabled={busy || draft.needsReconciliation}>
        <legend>1. Campaign context</legend>
        {!existing && (
          <Field label="Campaign or submission name">
            <input
              required
              maxLength={200}
              value={draft.value.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="October personal loan campaign"
            />
          </Field>
        )}
        <div className="form-grid">
          <Field label="Product">
            <select
              value={draft.value.product}
              onChange={(e) => set("product", e.target.value as Product)}
            >
              {Object.entries(PRODUCT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Placement">
            <select
              value={draft.value.channel}
              onChange={(e) => set("channel", e.target.value)}
            >
              {[
                "Paid social",
                "Organic social",
                "Landing page",
                "Display advertising",
                "Marketing email",
                "Other",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Which offer are you promoting?"
          hint="Use the name or description you were given. The reviewer will identify the applicable offer reference."
        >
          <textarea
            rows={2}
            maxLength={3000}
            value={draft.value.advertisedOffer}
            onChange={(e) => set("advertisedOffer", e.target.value)}
            placeholder="For example, the standard personal loan offer from our September brief."
          />
        </Field>
        <Field
          label="Where and how will the material be used?"
          hint="Include the audience, locations, affiliate relationship, and any targeting or compensation details that matter. Say what is still unknown."
        >
          <textarea
            required
            rows={3}
            maxLength={3000}
            value={draft.value.intendedUse}
            onChange={(e) => set("intendedUse", e.target.value)}
          />
        </Field>
        <Field label="Target launch date · optional">
          <input
            type="date"
            value={draft.value.launchDate}
            onChange={(e) => set("launchDate", e.target.value)}
          />
        </Field>
      </fieldset>
      <fieldset disabled={busy || draft.needsReconciliation}>
        <legend>2. Material to review</legend>
        {previous && token && (
          <div className="partner-retained">
            {previous.components.map((component) => {
              const asset = existing!.assets.find(
                (a) => a.id === component.assetId,
              )!;
              const kept = retained.find((c) => c.assetId === asset.id),
                replacement = uploads.find((f) => f.replaces === asset.id);
              return (
                <div
                  className={`partner-retained-row ${!kept ? "is-removed" : ""}`}
                  key={asset.id}
                >
                  <div>
                    <a
                      href={submitterAssetUrl(token, asset.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={17} />
                      {asset.name}
                    </a>
                    <small>
                      {replacement
                        ? `Replaced by ${replacement.file.name}`
                        : kept
                          ? "Kept in updated package"
                          : "Removed from updated package"}
                    </small>
                  </div>
                  {kept && (
                    <select
                      aria-label={`Role for retained ${asset.name}`}
                      value={kept.role}
                      onChange={(e) =>
                        setRetained((old) =>
                          old.map((c) =>
                            c.assetId === asset.id
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
                  )}
                  <div className="partner-file-actions">
                    <label className="button small secondary">
                      Replace
                      <input
                        type="file"
                        className="partner-file-input"
                        aria-label={`Replace ${asset.name}`}
                        onChange={(e) => {
                          addFiles(
                            Array.from(e.target.files || []),
                            asset.id,
                            component.role,
                          );
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        setUploads((old) =>
                          old.filter((f) => f.replaces !== asset.id),
                        );
                        setRetained((old) =>
                          kept
                            ? old.filter((c) => c.assetId !== asset.id)
                            : [
                                ...old,
                                { assetId: asset.id, role: component.role },
                              ],
                        );
                      }}
                    >
                      {kept ? "Remove" : "Keep original"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="partner-upload-zone">
          <FileUp size={25} />
          <div>
            <button
              className="text-button"
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              Choose files
            </button>
            <p>
              Upload the creative and any destination screenshots, PDFs, or
              supporting evidence.
            </p>
            <small>
              10 new files · 10 MB each · 25 MB total. PNG, JPEG and PDF can be
              previewed; other files need manual inspection.
            </small>
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </div>
        <UploadList
          uploads={uploads}
          onChange={setUploads}
          currentAssetIds={
            new Set(
              previous?.components.map((component) => component.assetId) || [],
            )
          }
        />
        <Field label="Accompanying advertising copy · optional">
          <textarea
            rows={4}
            maxLength={60000}
            value={draft.value.copy}
            onChange={(e) => set("copy", e.target.value)}
            placeholder="Caption, email subject line, or other copy that appears with the creative."
          />
        </Field>
        <Field
          label="Destination URL · optional"
          hint="A URL may change. Include a screenshot or PDF of the page when the destination is part of the review."
        >
          <input
            type="url"
            maxLength={2000}
            value={draft.value.destinationUrl}
            onChange={(e) => set("destinationUrl", e.target.value)}
            placeholder="https://…"
          />
        </Field>
      </fieldset>
      <fieldset disabled={busy || draft.needsReconciliation}>
        <legend>3. Your details</legend>
        <div className="form-grid">
          <Field label={existing ? "Updated by" : "Your name or team"}>
            <input
              required
              maxLength={120}
              value={draft.value.submitter}
              onChange={(e) => set("submitter", e.target.value)}
            />
          </Field>
          {!existing && (
            <Field label="Contact email · optional">
              <input
                type="email"
                maxLength={254}
                value={draft.value.submitterEmail}
                onChange={(e) => set("submitterEmail", e.target.value)}
              />
            </Field>
          )}
        </div>
        <Field
          label={existing ? "What changed?" : "Note to the reviewer · optional"}
        >
          <textarea
            required={!!existing}
            rows={3}
            maxLength={2000}
            value={draft.value.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </Field>
      </fieldset>
      <ErrorMessage error={error} />
      {conflict && (
        <p className="partner-draft-note">
          Review activity changed while you were working. Your text and selected
          files remain here.{" "}
          {draft.needsReconciliation
            ? "Reconcile the package above before submitting."
            : "The package itself is unchanged; check your work and submit again."}
        </p>
      )}
      <div className="partner-form-footer">
        <p>
          {existing
            ? "A new version requires a new review. Earlier decisions do not carry forward."
            : "The review team will confirm the package and return any questions here."}
        </p>
        <button
          className="button primary"
          type="submit"
          disabled={
            busy || draft.needsReconciliation || orphanedReplacements.length > 0
          }
        >
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <ArrowRight size={17} />
          )}
          {existing ? "Submit new version" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}

function CitedMaterial({
  citations,
  submission,
  token,
}: {
  citations?: MaterialCitation[];
  submission: SubmitterCase;
  token: string;
}) {
  if (!citations?.length) return null;
  return (
    <div className="partner-request-citations" aria-label="Cited material">
      {citations.map((citation, index) => {
        const asset = submission.assets.find(
          (item) => item.id === citation.assetId,
        );
        const revision = submission.revisions.find(
          (item) => item.id === citation.revisionId,
        );
        if (!asset || !revision) return null;
        return (
          <div key={`${citation.assetId}-${citation.page || 0}-${index}`}>
            <a
              href={`${submitterAssetUrl(token, asset.id)}${citation.page ? `#page=${citation.page}` : ""}`}
              target="_blank"
              rel="noreferrer"
            >
              <FileText size={15} />
              {asset.name} · version {revision.number}
              {citation.page ? ` · page ${citation.page}` : ""}
            </a>
            {citation.note && <small>{citation.note}</small>}
          </div>
        );
      })}
    </div>
  );
}

function CurrentRequests({
  submission,
  token,
  onRespond,
}: {
  submission: SubmitterCase;
  token: string;
  onRespond: (findingId: string) => void;
}) {
  const requests = submission.sharedRequests || [];
  const latestMessage = submission.feedback.at(-1);
  if (!requests.length && !latestMessage) return null;
  const current = submission.revisions.at(-1);
  const currentResult = submission.results.findLast(
    (result) => result.revisionId === current?.id,
  );
  const order = {
    open: 0,
    response_received: 1,
    accepted: 2,
    no_longer_required: 2,
  };
  const sorted = [...requests].sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      Number(b.material) - Number(a.material) ||
      a.number - b.number,
  );
  return (
    <section
      className="partner-card partner-current-requests"
      aria-labelledby="current-requests-heading"
    >
      <div className="partner-section-heading">
        <div>
          <h2 id="current-requests-heading">
            {requests.length
              ? "Requests from the reviewer"
              : "Latest message from the reviewer"}
          </h2>
          <p>
            All requests shared in this review, with their latest shared
            updates. Sending a response does not resolve a request.
          </p>
        </div>
      </div>
      {latestMessage && (
        <div className="partner-latest-message">
          <strong>{latestMessage.subject}</strong>
          <small>
            Shared {dateTime(latestMessage.createdAt)} · version{" "}
            {submission.revisions.find(
              (revision) => revision.id === latestMessage.revisionId,
            )?.number || "not yet shared"}
          </small>
          <p className="partner-message">{latestMessage.body}</p>
        </div>
      )}
      {currentResult && (
        <p className="partner-draft-note">
          Refer to the decision above for permission to use this version. These
          are the reviewer’s latest shared request updates.
        </p>
      )}
      <div className="partner-request-list">
        {sorted.map((request) => {
          const label = `F${String(request.number).padStart(2, "0")}`;
          const origin = submission.revisions.find(
            (revision) => revision.id === request.revisionId,
          );
          const statusRevision = submission.revisions.find(
            (revision) => revision.id === request.statusRevisionId,
          );
          const status =
            request.status === "accepted"
              ? "Accepted by reviewer"
              : request.status === "no_longer_required"
                ? "No longer required"
                : request.status === "response_received"
                  ? "Response received · awaiting reviewer assessment"
                  : request.material
                    ? "Action requested"
                    : "Advice available";
          return (
            <article
              key={request.findingId}
              aria-label={`${label}: ${request.title}`}
              className={`partner-request partner-request-${request.status}`}
            >
              <div className="partner-request-meta">
                <span
                  className={`partner-tag ${request.material ? "required" : ""}`}
                >
                  {request.material ? "Required change or evidence" : "Advice"}
                </span>
                <small>
                  {label} · shared {date(request.sharedAt)}
                  {origin ? ` · version ${origin.number}` : ""}
                </small>
              </div>
              <h3>{request.title}</h3>
              {request.location && (
                <p className="partner-request-location">{request.location}</p>
              )}
              <p className="partner-message">{request.request}</p>
              <CitedMaterial
                citations={request.citations}
                submission={submission}
                token={token}
              />
              <div className="partner-request-footer">
                <div>
                  <strong>
                    {status}
                    {(request.status === "accepted" ||
                      request.status === "no_longer_required") &&
                    statusRevision
                      ? ` · version ${statusRevision.number}`
                      : ""}
                  </strong>
                  {request.pendingResponseCount > 1 && (
                    <small>
                      {request.pendingResponseCount} responses awaiting
                      assessment
                    </small>
                  )}
                  {request.statusRevisionId &&
                    request.statusRevisionId !== current?.id &&
                    request.status !== "accepted" &&
                    request.status !== "no_longer_required" && (
                      <small>
                        The earlier request update covered version{" "}
                        {statusRevision?.number || "previous"}. Version{" "}
                        {current?.number} still needs assessment.
                      </small>
                    )}
                  {!request.statusRevisionId &&
                    origin &&
                    origin.id !== current?.id && (
                      <small>
                        Originally shared for version {origin.number}. No
                        acceptance has been shared for version {current?.number}
                        .
                      </small>
                    )}
                </div>
                {submission.status !== "cancelled" && (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => onRespond(request.findingId)}
                  >
                    <MessageSquare size={15} />
                    Respond to {label}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Feedback({ submission }: { submission: SubmitterCase }) {
  const current = submission.revisions.at(-1);
  const currentResult = submission.results.findLast(
    (result) => result.revisionId === current?.id,
  );
  if (!submission.feedback.length) return null;
  return (
    <details className="partner-card partner-feedback-history">
      <summary>
        Feedback history · {submission.feedback.length} shared{" "}
        {submission.feedback.length === 1 ? "message" : "messages"}
      </summary>
      <p>
        Messages as originally shared. Current request updates appear above.
      </p>
      {[...submission.feedback].reverse().map((feedback, index) => (
        <section className="partner-card" key={feedback.id}>
          <div className="partner-section-heading">
            <div>
              <p className="eyebrow">
                SHARED {dateTime(feedback.createdAt)} · VERSION{" "}
                {
                  submission.revisions.find((r) => r.id === feedback.revisionId)
                    ?.number
                }
              </p>
              <h2>{feedback.subject || "Feedback from ClearPath"}</h2>
            </div>
            {index === 0 && (
              <span className="partner-tag">Latest feedback</span>
            )}
          </div>
          {feedback.revisionId !== current?.id && (
            <p className="partner-draft-note">
              This feedback refers to an earlier package.{" "}
              {currentResult
                ? "It is retained as history; refer to the current decision above."
                : "Your updated version still needs the reviewer's assessment."}
            </p>
          )}
          {feedback.body && <p className="partner-message">{feedback.body}</p>}
          {feedback.findings.length > 0 && (
            <div className="partner-feedback-items">
              {feedback.findings.map((finding) => (
                <article key={finding.id}>
                  <div>
                    <span
                      className={`partner-tag ${finding.material ? "required" : ""}`}
                    >
                      {finding.material
                        ? "Required change or evidence"
                        : "Advice"}
                    </span>
                    <small>F{String(finding.number).padStart(2, "0")}</small>
                  </div>
                  <h3>{finding.title}</h3>
                  {finding.location && <small>{finding.location}</small>}
                  <p>{finding.request}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      ))}
    </details>
  );
}
function PublishedResults({
  submission,
  token,
}: {
  submission: SubmitterCase;
  token: string;
}) {
  const current = submission.revisions.at(-1);
  return (
    <>
      {[...submission.results].reverse().map((result) => (
        <section
          className={`partner-card partner-result ${result.withdrawn ? "withdrawn" : ""}`}
          key={result.id}
        >
          <p className="eyebrow">
            DECISION FOR VERSION{" "}
            {
              submission.revisions.find((r) => r.id === result.revisionId)
                ?.number
            }{" "}
            · {dateTime(result.createdAt)}
          </p>
          <h2>
            {result.withdrawn
              ? "This approval has been withdrawn"
              : result.outcome === "approved"
                ? "Approved for the stated use"
                : "This version was not approved"}
          </h2>
          {result.withdrawn && <p>{result.withdrawn.reason}</p>}
          {result.revisionId !== current?.id && (
            <p className="partner-draft-note">
              Historical decision. It does not cover your current version.
            </p>
          )}
          <h3>
            {result.withdrawn ? "Earlier reviewed scope" : "Reviewed scope"}
          </h3>
          <p className="partner-message">
            {result.scope || "See the reviewer's message below."}
          </p>
          {result.message &&
            (result.withdrawn ? (
              <details>
                <summary>Earlier decision message · withdrawn</summary>
                <p className="partner-message">{result.message}</p>
              </details>
            ) : (
              <p className="partner-message">{result.message}</p>
            ))}
          <div className="partner-file-links">
            {result.assetIds.map((id) => (
              <a href={submitterAssetUrl(token, id, true)} key={id}>
                <Download size={15} />
                {submission.assets.find((a) => a.id === id)?.name ||
                  "Reviewed file"}
              </a>
            ))}
          </div>
          {result.copy && (
            <details>
              <summary>Copy covered by this decision</summary>
              <p className="partner-message">{result.copy}</p>
            </details>
          )}
          {result.destinationUrl && (
            <p className="partner-source-url">
              Destination: {result.destinationUrl}
            </p>
          )}
        </section>
      ))}
    </>
  );
}
function ResponseForm({
  token,
  submission,
  onSaved,
  replyTarget,
}: {
  token: string;
  submission: SubmitterCase;
  onSaved: (submission: SubmitterCase) => void;
  replyTarget: { findingId: string; sequence: number } | null;
}) {
  const draft = useTextDraft(`clearpath:response:${token}`, {
    text: "",
    submittedBy: submission.submitter,
  });
  const [files, setFiles] = useState<Upload[]>([]),
    [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  const retry = useRef({ signature: "", key: crypto.randomUUID() });
  const textArea = useRef<HTMLTextAreaElement>(null);
  const requests = submission.sharedRequests || [];
  useEffect(() => {
    if (!replyTarget) return;
    setSelected((old) =>
      old.includes(replyTarget.findingId)
        ? old
        : [...old, replyTarget.findingId],
    );
    setSuccess(false);
    textArea.current?.focus();
    textArea.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [replyTarget]);
  useLeaveWarning(draft.dirty || files.length > 0);
  return (
    <form
      className="partner-response-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setSuccess(false);
        try {
          const payload = {
            expectedVersion: submission.version,
            submittedBy: draft.value.submittedBy,
            text: draft.value.text,
            findingIds: selected,
          };
          const signature = JSON.stringify([
            payload,
            files.map((f) => [f.file.name, f.file.size, f.file.lastModified]),
          ]);
          if (retry.current.signature !== signature)
            retry.current = { signature, key: crypto.randomUUID() };
          const next = await api<SubmitterCase>(
            `/api/submissions/${encodeURIComponent(token)}/responses`,
            multipart(
              payload,
              files.map((f) => f.file),
              retry.current.key,
            ),
          );
          draft.clear({ text: "", submittedBy: draft.value.submittedBy });
          setFiles([]);
          setSelected([]);
          setSuccess(true);
          onSaved(next);
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <Field label="Your response">
          <textarea
            ref={textArea}
            required
            rows={3}
            maxLength={5000}
            value={draft.value.text}
            onChange={(e) => {
              draft.setValue((old) => ({ ...old, text: e.target.value }));
              setSuccess(false);
            }}
            placeholder="Answer a question or explain the evidence you are providing."
          />
        </Field>
        {requests.length > 0 && (
          <details className="partner-response-selection">
            <summary>
              Link this response to feedback · {selected.length} selected
            </summary>
            {requests.map((f) => (
              <label className="check-line" key={f.findingId}>
                <input
                  type="checkbox"
                  checked={selected.includes(f.findingId)}
                  onChange={() =>
                    setSelected((old) =>
                      old.includes(f.findingId)
                        ? old.filter((id) => id !== f.findingId)
                        : [...old, f.findingId],
                    )
                  }
                />
                <span>
                  F{String(f.number).padStart(2, "0")} · {f.title}
                </span>
              </label>
            ))}
          </details>
        )}
        {selected.length > 0 && (
          <p className="partner-selected-requests">
            Replying to{" "}
            {requests
              .filter((request) => selected.includes(request.findingId))
              .map(
                (request) =>
                  `F${String(request.number).padStart(2, "0")} · ${request.title}`,
              )
              .join("; ")}
            . Use “Link this response to feedback” to change the selection.
          </p>
        )}
        <div className="form-grid">
          <Field label="Responding as">
            <input
              required
              maxLength={120}
              value={draft.value.submittedBy}
              onChange={(e) =>
                draft.setValue((old) => ({
                  ...old,
                  submittedBy: e.target.value,
                }))
              }
            />
          </Field>
          <Field label="Supporting evidence · optional">
            <input
              type="file"
              multiple
              onChange={(e) => {
                const next = [
                  ...files,
                  ...Array.from(e.target.files || []).map((file) => ({
                    file,
                    role: "evidence" as const,
                    replaces: null,
                  })),
                ];
                const problem = validateUploads(next);
                if (problem) setError(problem);
                else {
                  setFiles(next);
                  setError("");
                }
                e.target.value = "";
              }}
            />
          </Field>
        </div>
        <div className="partner-response-files">
          {files.map((entry, index) => (
            <span key={index}>
              {entry.file.name}
              <button
                className="icon-button"
                type="button"
                aria-label={`Remove evidence ${entry.file.name}`}
                onClick={() =>
                  setFiles((old) => old.filter((_, i) => i !== index))
                }
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      </fieldset>
      <ErrorMessage error={error} />
      {success && (
        <p className="partner-success" role="status">
          <CheckCircle2 size={16} />
          Response received. The reviewer will assess it; findings are not
          automatically resolved.
        </p>
      )}
      <button
        className="button primary"
        type="submit"
        disabled={busy || !draft.value.text.trim()}
      >
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <MessageSquare size={16} />
        )}
        Send response to review
      </button>
    </form>
  );
}
function SubmissionHistory({
  submission,
  token,
}: {
  submission: SubmitterCase;
  token: string;
}) {
  return (
    <section className="partner-card">
      <div className="partner-section-heading">
        <div>
          <h2>Your package and responses</h2>
          <p>
            Original files remain attached to the version that included them.
          </p>
        </div>
      </div>
      {!submission.revisions.length && (
        <p className="partner-history-empty">
          No package files have been shared here yet. You can send a response to
          the review team above.
        </p>
      )}
      {[...submission.revisions].reverse().map((revision, index) => (
        <details
          className="partner-history-item"
          key={revision.id}
          open={index === 0}
        >
          <summary>
            Version {revision.number}
            {index === 0 ? " · Current package" : ""}
            <span>{date(revision.createdAt)}</span>
          </summary>
          <p className="partner-message">
            {revision.summary || "Initial submission"}
          </p>
          <dl>
            <dt>Product / placement</dt>
            <dd>
              {PRODUCT_LABELS[revision.product]} · {revision.channel}
            </dd>
            <dt>Intended use</dt>
            <dd>{revision.intendedUse || "Not provided"}</dd>
            <dt>Advertised offer</dt>
            <dd>{revision.advertisedOffer || "Not described"}</dd>
            {revision.launchDate && (
              <>
                <dt>Target launch</dt>
                <dd>{date(revision.launchDate)}</dd>
              </>
            )}
          </dl>
          <div className="partner-file-links">
            {revision.components.map((c) => (
              <a
                href={submitterAssetUrl(token, c.assetId)}
                key={c.assetId}
                target="_blank"
                rel="noreferrer"
              >
                <FileText size={15} />
                {submission.assets.find((a) => a.id === c.assetId)?.name} ·{" "}
                {ROLE_LABELS[c.role]}
              </a>
            ))}
          </div>
          {revision.copy && (
            <>
              <h3>Accompanying copy</h3>
              <p className="partner-message">{revision.copy}</p>
            </>
          )}
          {revision.destinationUrl && (
            <p className="partner-source-url">
              Destination: {revision.destinationUrl}
            </p>
          )}
        </details>
      ))}
      {submission.responses.length > 0 && (
        <div className="partner-responses">
          <h3>Responses shared in this review</h3>
          {[...submission.responses].reverse().map((response) => (
            <article key={response.id}>
              <strong>
                {response.author}
                <small>{dateTime(response.createdAt)}</small>
              </strong>
              <p className="partner-message">{response.text}</p>
              {response.findingIds.length > 0 && (
                <small>
                  Linked to{" "}
                  {response.findingIds
                    .map((id) => {
                      const request = submission.sharedRequests?.find(
                        (item) => item.findingId === id,
                      );
                      return request
                        ? `F${String(request.number).padStart(2, "0")} · ${request.title}`
                        : "a shared request";
                    })
                    .join("; ")}
                </small>
              )}
              <div className="partner-file-links">
                {response.assetIds.map((id) => (
                  <a href={submitterAssetUrl(token, id, true)} key={id}>
                    <Download size={14} />
                    {submission.assets.find((a) => a.id === id)?.name ||
                      "Supporting file"}
                  </a>
                ))}
              </div>
              {response.sharedAcknowledgment && (
                <div className="partner-reviewer-acknowledgment">
                  <strong>
                    Message from the reviewer{" "}
                    <small>{dateTime(response.sharedAcknowledgment.at)}</small>
                  </strong>
                  <p className="partner-message">
                    {response.sharedAcknowledgment.message}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
