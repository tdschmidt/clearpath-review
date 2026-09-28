import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  FileCheck2,
  FileText,
  FolderOpen,
  History,
  Inbox,
  LayoutList,
  LoaderCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { api, ApiError, json } from "./api";
import {
  AssetViewer,
  date,
  dateTime,
  Empty,
  ErrorMessage,
  initials,
  Modal,
  Status,
} from "./components";
import {
  DecisionForm,
  DispositionForm,
  DraftForm,
  Field,
  FindingForm,
  SubmissionForm,
  WaitingForm,
  type ActionInput,
} from "./forms";
import {
  assetUrl,
  currentRevision,
  openBlockers,
  PRODUCT_LABELS,
  REVIEWER,
  ROLE_LABELS,
  type Finding,
  type Offer,
  type PackageRevision,
  type ReviewCase,
} from "../shared/types";

import { useUnsavedWarning } from "./drafts";

type Dialog =
  | null
  | "new"
  | "revision"
  | "finding"
  | "waiting"
  | "decision"
  | "draft"
  | "samples"
  | "guide"
  | { finding: Finding; status: Finding["status"] };
type Page = "queue" | "decisions";
const isClosed = (c: ReviewCase) =>
  c.status === "approved" || c.status === "rejected" || c.status === "cancelled";
const findingNames = {
  correction: "Correction",
  evidence: "Evidence request",
  question: "Specialist question",
};

export default function App() {
  useUnsavedWarning();
  const [cases, setCases] = useState<ReviewCase[]>([]),
    [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [saving, setSaving] = useState(false);
  const [hash, setHash] = useState(window.location.hash),
    [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const selectedId = hash.startsWith("#review/")
    ? hash.slice(8).split("/")[0]
    : null;
  const page: Page = hash === "#decisions" ? "decisions" : "queue";
  const selected = cases.find((c) => c.id === selectedId);
  useEffect(() => {
    const listener = () => {
      setHash(window.location.hash);
      setDialog(null);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  async function refresh() {
    setLoadError("");
    try {
      const [nextCases, nextOffers] = await Promise.all([
        api<ReviewCase[]>("/api/cases"),
        api<Offer[]>("/api/offers"),
      ]);
      setCases(nextCases);
      setOffers(nextOffers);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (!toast || toast.error) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function update(c: ReviewCase) {
    setCases((old) =>
      [c, ...old.filter((o) => o.id !== c.id)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
      ),
    );
  }
  function saved(c: ReviewCase) {
    update(c);
    setDialog(null);
    window.location.hash = `review/${c.id}`;
    setToast({ text: "Package saved. Ready for intake review." });
  }
  async function action(input: ActionInput) {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await api<ReviewCase>(
        `/api/cases/${selected.id}/actions`,
        json({ ...input, expectedVersion: selected.version }),
      );
      update(result);
      setToast({
        text:
          input.type === "decide"
            ? "Your decision has been recorded."
            : input.type === "save_draft"
              ? "Reply saved as a draft. Nothing was sent."
              : "Review updated.",
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.details?.code === "version_conflict") {
        update(await api<ReviewCase>(`/api/cases/${selected.id}`));
        throw new ApiError("This case changed. The latest context is loaded and your input was kept. Review the changes before saving again.", 409);
      }
      throw error;
    } finally {
      setSaving(false);
    }
  }
  function quickAction(input: ActionInput) {
    return action(input)
      .then(() => true)
      .catch((e) => {
        setToast({ text: e.message, error: true });
        return false;
      });
  }
  const activeCount = cases.filter((c) => !isClosed(c)).length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#queue">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span>
            clearpath<span className="brand-sub">REVIEW WORKSPACE</span>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav">
          <a className={page === "queue" ? "active" : ""} href="#queue">
            <Inbox size={19} />
            Review queue<span className="nav-count">{activeCount}</span>
          </a>
          <a
            className={page === "decisions" && !selected ? "active" : ""}
            href="#decisions"
          >
            <FileCheck2 size={19} />
            Decision record
          </a>
        </nav>
        <div className="sidebar-bottom">
          <button className="sample-nav" onClick={() => setDialog("guide")}>
            <BookOpen size={20} />
            Review guide
            <ArrowUpRight size={15} />
          </button>
          <button className="sample-nav" onClick={() => setDialog("samples")}>
            <FolderOpen size={17} />
            Sample materials
            <ArrowUpRight size={14} />
          </button>
          <div className="reviewer">
            <span className="avatar">MC</span>
            <div>
              <strong>{REVIEWER}</strong>
              <small>Compliance reviewer · demo</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            ClearPath Financial <ChevronRight size={13} />{" "}
            <span>Marketing compliance</span>
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              onClick={() => void refresh()}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        <main>
          {loadError && (
            <div className="load-error">
              <ErrorMessage error={loadError} />
              <button
                className="button secondary"
                onClick={() => void refresh()}
              >
                Try again
              </button>
            </div>
          )}
          {loading ? (
            <div className="page-loading">
              <LoaderCircle className="spin" size={24} />
              Loading submissions…
            </div>
          ) : selected ? (
            <CaseWorkspace
              review={selected}
              offers={offers}
              saving={saving}
              onDialog={setDialog}
              onAction={quickAction}
            />
          ) : selectedId ? (
            <Empty
              title="This review isn't available"
              icon={<FolderOpen size={32} />}
            >
              Return to the <a href="#queue">review queue</a> or refresh the
              workspace.
            </Empty>
          ) : (
            <Queue
              cases={cases}
              page={page}
              onNew={() => setDialog("new")}
              onSamples={() => setDialog("samples")}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>ClearPath Review</span>
          <span>Fictional company · Demonstration workspace</span>
        </footer>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.text}</span>
          {toast.error && (
            <button
              onClick={() => {
                void refresh();
                setToast(null);
              }}
            >
              Reload
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {dialog === "new" && (
        <SubmissionForm
          offers={offers}
          onSaved={saved}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "samples" && <Samples onClose={() => setDialog(null)} />}
      {dialog === "guide" && <Guide onClose={() => setDialog(null)} />}
      {selected && (
        <>
          {dialog === "revision" && (
            <SubmissionForm
              offers={offers}
              existing={selected}
              onLatest={update}
              onSaved={saved}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === "finding" && (
            <FindingForm
              review={selected}
              onAction={action}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === "waiting" && (
            <WaitingForm
              review={selected}
              onAction={action}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === "decision" && (
            <DecisionForm
              review={selected}
              onAction={action}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === "draft" && (
            <DraftForm
              review={selected}
              onAction={action}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog && typeof dialog === "object" && (
            <DispositionForm
              review={selected}
              finding={dialog.finding}
              status={dialog.status}
              onAction={action}
              onClose={() => setDialog(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function age(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86400000));
  return days ? `${days}d ago` : "today";
}

function Queue({
  cases,
  page,
  onNew,
  onSamples,
}: {
  cases: ReviewCase[];
  page: Page;
  onNew: () => void;
  onSamples: () => void;
}) {
  const [filter, setFilter] = useState("active"),
    [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [sort, setSort] = useState("updated");
  useEffect(() => {
    setFilter("active");
    setSearch("");
  }, [page]);
  const active = cases.filter((c) => !isClosed(c));
  const records = cases;
  const rows = records.filter(
    (c) =>
      (filter === "all" ||
        (filter === "active" ? ["needs_intake", "in_review"].includes(c.status) : filter === "completed" ? isClosed(c) : c.status === filter)) &&
      (owner === "all" || c.owner === owner) &&
      `${c.title} ${c.reference} ${c.submitter} ${PRODUCT_LABELS[c.product]}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  ).sort((a, b) => {
    if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    if (sort === "launch") return (a.launchDate || "9999").localeCompare(b.launchDate || "9999") || a.id.localeCompare(b.id);
    return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
  });
  const filters = [
    ["active", "To review"],
    ["waiting", "Waiting"],
    ["completed", "Completed"],
    ["all", "All submissions"],
  ];
  if (page === "decisions")
    return <DecisionRecord cases={cases} onNew={onNew} />;
  return (
    <div className="queue-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MARKETING COMPLIANCE</p>
          <h1>Review queue</h1>
        </div>
        <div className="heading-actions">
          <button className="button secondary" onClick={onSamples}>
            <FolderOpen size={17} />
            Sample files
          </button>
          <button className="button primary" onClick={onNew}>
            <Plus size={18} />
            New submission
          </button>
        </div>
      </div>
      {page === "queue" && (
        <div className="queue-overview">
          <div className="overview-intro">
            <span className="overview-icon">
              <LayoutList size={21} />
            </span>
            <div>
              <strong>Review status</strong>
            </div>
          </div>
          <div className="overview-stat">
            <strong>{active.length.toString().padStart(2, "0")}</strong>
            <span>Active reviews</span>
          </div>
          <div className="overview-stat">
            <strong>
              {cases
                .filter((c) => c.status === "waiting")
                .length.toString()
                .padStart(2, "0")}
            </strong>
            <span>Waiting on others</span>
          </div>
          <div className="overview-stat">
            <strong>
              {cases
                .filter((c) => c.status === "needs_intake")
                .length.toString()
                .padStart(2, "0")}
            </strong>
            <span>Needs intake</span>
          </div>
        </div>
      )}
      <section className="queue-card">
        <div className="queue-controls">
          <div className="filter-tabs">
            {filters.map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "selected" : ""}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
                {key === "all" && <span>{records.length}</span>}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search submissions"
              placeholder="Search submissions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="queue-sorting">
          <label>Reviewer <select value={owner} onChange={e => setOwner(e.target.value)}><option value="all">All reviewers</option>{[...new Set(cases.map(c => c.owner))].map(name => <option key={name}>{name}</option>)}</select></label>
          <label>Sort <select value={sort} onChange={e => setSort(e.target.value)}><option value="updated">Recently updated</option><option value="oldest">Oldest received</option><option value="launch">Requested launch</option></select></label>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table className="review-table">
              <thead>
                <tr>
                  <th>Submission</th>
                  <th>Product / placement</th>
                  <th>Status</th>
                  <th>Next action</th>
                  <th>Timing</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => {
                      window.location.hash = `review/${c.id}`;
                    }}
                  >
                    <td>
                      <div className="submission-cell">
                        <span className={`product-symbol product-${c.product}`}>
                          {c.product === "credit_card" ? (
                            <CreditCard size={23} />
                          ) : c.product === "mortgage" ? (
                            <ShieldCheck size={23} />
                          ) : (
                            <span className="loan-glyph">↗</span>
                          )}
                        </span>
                        <div>
                          <a
                            href={`#review/${c.id}`}
                            className="submission-title"
                          >
                            {c.title}
                          </a>
                          <span className="table-sub">
                            {c.reference}
                            <i />
                            {c.submitter}
                            {c.example && (
                              <span className="example-tag">Example</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span>{PRODUCT_LABELS[c.product]}</span>
                      <span className="table-sub">{c.channel}</span>
                    </td>
                    <td>
                      <Status value={c.status} />
                    </td>
                    <td>
                      <span className="next-action">
                        {isClosed(c)
                          ? "Decision recorded"
                          : c.status === "needs_intake"
                            ? "Confirm submitted package"
                            : c.status === "waiting"
                              ? c.waitingReason
                              : openBlockers(c).length
                                ? `${openBlockers(c).length} findings to address`
                                : "Review current package"}
                      </span>
                      <span className="table-sub">
                        {[...new Set([c.owner, ...(c.status === "waiting" ? [c.nextOwner] : []), ...c.findings.filter(f => f.status === "open" || f.needsRecheck).map(f => f.owner)])].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="updated-cell">
                      {c.launchDate ? `Launch ${date(c.launchDate)}` : "No launch date"}
                      <span className="table-sub">Received {age(c.createdAt)} · v{currentRevision(c).number}</span>
                      {c.status === "waiting" && <span className="table-sub">Waiting {age(c.history.findLast(e => e.type === "waiting")?.createdAt || c.updatedAt)}</span>}
                      <span className="table-sub">Updated {date(c.updatedAt)}</span>
                    </td>
                    <td>
                      <ChevronRight size={18} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Inbox size={28} />}
            title={search ? "No matching submissions" : "Nothing in this view"}
          >
            {search
              ? "Try a different name, product, or reference."
              : "Create a submission or choose another filter."}
          </Empty>
        )}
        <div className="table-footer">
          <span>
            {rows.length} {rows.length === 1 ? "submission" : "submissions"}
          </span>
        </div>
      </section>
      <div className="queue-footnote">
        <span className="small-circle">
          <BookOpen size={16} />
        </span>
        <p>
          Sample cases include prewritten findings. New submissions start
          without findings.
        </p>
        <button className="text-button" onClick={onSamples}>
          View sample files <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

function DecisionRecord({
  cases,
  onNew,
}: {
  cases: ReviewCase[];
  onNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const records = cases
    .flatMap((review) =>
      review.decisions.map((decision) => ({ review, decision })),
    )
    .filter(
      ({ review, decision }) =>
        (filter === "all" || decision.outcome === filter) &&
        `${review.title} ${review.reference} ${decision.scope}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.decision.createdAt.localeCompare(a.decision.createdAt));
  return (
    <div className="queue-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MARKETING COMPLIANCE</p>
          <h1>Decision record</h1>
          <p>Approvals and rejections by version.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={17} />
          New submission
        </button>
      </div>
      <section className="queue-card">
        <div className="queue-controls">
          <div className="filter-tabs">
            {["all", "approved", "rejected"].map((f) => (
              <button
                key={f}
                className={filter === f ? "selected" : ""}
                onClick={() => setFilter(f)}
              >
                {f === "all"
                  ? "All decisions"
                  : f === "approved"
                    ? "Approved"
                    : "Rejected"}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search decisions"
              placeholder="Search decisions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {records.length ? (
          <div className="table-scroll">
            <table className="review-table">
              <thead>
                <tr>
                  <th>Reviewed material</th>
                  <th>Decision</th>
                  <th>Approved / rejected use</th>
                  <th>Reviewer</th>
                  <th>Recorded</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {records.map(({ review, decision }) => (
                  <tr
                    key={decision.id}
                    onClick={() => {
                      window.location.hash = `review/${review.id}/decision/${decision.id}`;
                    }}
                  >
                    <td>
                      <a
                        className="submission-title"
                        href={`#review/${review.id}/decision/${decision.id}`}
                      >
                        {review.title}
                      </a>
                      <span className="table-sub">
                        {review.reference} · Version{" "}
                        {
                          review.revisions.find(
                            (r) => r.id === decision.revisionId,
                          )?.number
                        }
                        {decision.revisionId !== currentRevision(review).id
                          ? " · Earlier version"
                          : ""}
                      </span>
                    </td>
                    <td>
                      <Status value={decision.outcome} />
                    </td>
                    <td>
                      <span className="next-action" title={decision.scope}>
                        {decision.scope || "See rejection rationale"}
                      </span>
                    </td>
                    <td>{decision.reviewer}</td>
                    <td>{date(decision.createdAt)}</td>
                    <td>
                      <ChevronRight size={17} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<FileCheck2 size={28} />}
            title="No decisions in this view"
          >
            Record a decision from a submission. Earlier decisions remain here
            after revisions.
          </Empty>
        )}
        <div className="table-footer">
          <span>{records.length} decisions</span>
        </div>
      </section>
    </div>
  );
}

function CaseWorkspace({
  review,
  offers,
  saving,
  onDialog,
  onAction,
}: {
  review: ReviewCase;
  offers: Offer[];
  saving: boolean;
  onDialog: (d: Dialog) => void;
  onAction: (a: ActionInput) => Promise<boolean>;
}) {
  const [tab, setTab] = useState("review"),
    [sideTab, setSideTab] = useState("findings"),
    [assetId, setAssetId] = useState(""),
    [showClosed, setShowClosed] = useState(false),
    [note, setNote] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  async function downloadRecord() {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch(`/api/cases/${review.id}/export`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error ||
            "The review record could not be downloaded. Please try again.",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${review.reference}-review-record.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "The download failed. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  }
  const rev = currentRevision(review),
    offer = offers.find((o) => o.id === rev.offerId);
  const primary = rev.components.filter((c) => c.role !== "excluded");
  const selectedAsset = primary.some((c) => c.assetId === assetId)
    ? assetId
    : primary[0]?.assetId;
  const visibleFindings = review.findings.filter(
    (f) => showClosed || f.status === "open" || f.needsRecheck,
  );
  const pending = review.findings.filter(
    (f) => f.status === "open" || f.needsRecheck,
  ).length;
  const currentDecision = review.decisions.findLast(
    (d) => d.revisionId === rev.id,
  );
  useEffect(() => {
    setTab(window.location.hash.endsWith("/activity") ? "activity" : "review");
    setSideTab("findings");
    setAssetId("");
    setNote("");
    setShowClosed(false);
  }, [review.id]);
  return (
    <div className="case-page">
      <a className="back-link" href="#queue">
        <ArrowLeft size={15} />
        Review queue<span>/</span>
        <span>{review.reference}</span>
      </a>
      <div className="case-heading">
        <div>
          <div className="case-eyebrow">
            <span>{PRODUCT_LABELS[review.product]}</span>
            <span>·</span>
            <span>{review.channel}</span>
            {review.example && (
              <span className="example-tag">Worked example</span>
            )}
          </div>
          <h1>{review.title}</h1>
          <div className="case-subtitle">
            <Status value={review.status} />
            <span>Submitted by {review.submitter}</span>
            <span>·</span>
            <span>
              {review.launchDate
                ? `Target launch ${date(`${review.launchDate}T12:00:00`)}`
                : "Launch date not provided"}
            </span>
          </div>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            onClick={() => onDialog("revision")}
          >
            <Upload size={16} />
            Add revision
          </button>
          {!isClosed(review) && (
            <button
              className="button primary"
              onClick={() => onDialog("decision")}
            >
              <ShieldCheck size={17} />
              Record decision
            </button>
          )}
        </div>
      </div>
      {review.status === "needs_intake" && (
        <div className="intake-banner">
          <span className="intake-icon">
            <Inbox size={22} />
          </span>
          <div>
            <strong>Confirm the package before starting review.</strong>
            <p>
              Check the included files, selected offer, and intended use.
              Missing context can be supplied with an updated package.
            </p>
          </div>
          <button
            className="button primary"
            disabled={saving}
            onClick={() => onAction({ type: "confirm_intake" })}
          >
            <Check size={16} />
            Confirm package
          </button>
        </div>
      )}
      {currentDecision && (
        <div
          className={`decision-banner ${currentDecision.outcome === "rejected" ? "rejected" : ""}`}
        >
          <ShieldCheck size={23} />
          <div>
            <strong>
              {currentDecision.outcome === "approved"
                ? "Approved for the stated use"
                : "This version was rejected"}{" "}
              · Version {rev.number}
            </strong>
            <p>{currentDecision.scope}</p>
            <small>
              {currentDecision.reviewer} · {dateTime(currentDecision.createdAt)}
            </small>
          </div>
          <button
            className="button secondary"
            onClick={() => onDialog("draft")}
          >
            Prepare decision reply
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="case-workflow">
        <div>
          <span className="avatar tiny">MC</span>
          <span>
            <small>REVIEW OWNER</small>
            {review.owner}
          </span>
        </div>
        <div>
          <Clock3 size={18} />
          <span>
            <small>NEXT STEP</small>
            {review.status === "waiting" ? (
              <>
                {review.waitingReason}
                <em> · {review.nextOwner}</em>
              </>
            ) : isClosed(review) ? (
              "Decision recorded; reply can be prepared"
            ) : review.status === "needs_intake" ? (
              "Confirm material and context"
            ) : (
              "Review current material and findings"
            )}
          </span>
        </div>
        {!isClosed(review) && (
          <button
            className="text-button"
            disabled={saving}
            onClick={() =>
              review.status === "waiting"
                ? onAction({ type: "resume" })
                : onDialog("waiting")
            }
          >
            {review.status === "waiting" ? "Resume review" : "Mark waiting"}
            <ArrowRight size={14} />
          </button>
        )}
      </div>
      <div className="case-tabs">
        {[
          ["review", "Review", null],
          ["versions", "Versions", review.revisions.length],
          ["activity", "Activity & notes", null],
          ["drafts", "Reply drafts", review.drafts.length],
        ].map(([key, label, count]) => (
          <button
            key={String(key)}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(String(key))}
          >
            {label}
            {count !== null && <span>{count}</span>}
          </button>
        ))}
        {saving && (
          <span className="save-status" role="status">
            <LoaderCircle size={13} className="spin" />
            Saving…
          </span>
        )}
      </div>
      {tab === "review" && (
        <div className="review-layout">
          <section className="material-panel">
            <header className="panel-header">
              <div>
                <h2>
                  Current package{" "}
                  <span className="version-badge">v{rev.number}</span>
                </h2>
                <p>{rev.summary || "Material submitted for review"}</p>
              </div>
              <span className="muted">{primary.length} files</span>
            </header>
            {primary.length > 0 && (
              <div className="asset-tabs">
                {primary.map((c) => {
                  const asset = review.assets.find((a) => a.id === c.assetId)!;
                  return (
                    <button
                      key={c.assetId}
                      className={selectedAsset === c.assetId ? "selected" : ""}
                      onClick={() => setAssetId(c.assetId)}
                    >
                      <FileText size={15} />
                      <span>
                        {asset.name}
                        <small>{ROLE_LABELS[c.role]}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <AssetViewer
              caseId={review.id}
              asset={review.assets.find((a) => a.id === selectedAsset)}
            />
            <div className="copy-section">
              <h3>Accompanying copy</h3>
              {rev.copy ? (
                <p className="preserve-lines">{rev.copy}</p>
              ) : (
                <p className="muted">No accompanying copy supplied.</p>
              )}
            </div>
            <div className="destination-section">
              <span>
                <ArrowUpRight size={17} />
                <strong>Destination</strong>
              </span>
              {rev.destinationUrl ? (
                <a href={rev.destinationUrl} target="_blank" rel="noreferrer">
                  {rev.destinationUrl}
                  <ArrowUpRight size={14} />
                </a>
              ) : (
                <p className="muted">No destination URL supplied.</p>
              )}
              <small>
                A live link may change. Review the supplied destination
                rendition when required.
              </small>
            </div>
            {rev.components.some((c) => c.role === "excluded") && (
              <details className="excluded-files">
                <summary>Material not included in this review</summary>
                {rev.components
                  .filter((c) => c.role === "excluded")
                  .map((c) => (
                    <a
                      key={c.assetId}
                      href={assetUrl(review.id, c.assetId, true)}
                    >
                      {review.assets.find((a) => a.id === c.assetId)?.name}
                      <ArrowDownToLine size={14} />
                    </a>
                  ))}
              </details>
            )}
          </section>
          <aside className="review-side">
            <div className="side-tabs">
              <button
                className={sideTab === "findings" ? "active" : ""}
                onClick={() => setSideTab("findings")}
              >
                Findings <span>{pending}</span>
              </button>
              <button
                className={sideTab === "context" ? "active" : ""}
                onClick={() => setSideTab("context")}
              >
                Offer & context
              </button>
            </div>
            {sideTab === "findings" ? (
              <>
                <div className="findings-heading">
                  <div>
                    <h2>Reviewer findings</h2>
                    <p>Observations, evidence, and next steps.</p>
                  </div>
                  {!isClosed(review) && (
                    <button
                      className="button small secondary"
                      onClick={() => onDialog("finding")}
                    >
                      <Plus size={15} />
                      Add
                    </button>
                  )}
                </div>
                {visibleFindings.length ? (
                  <div className="findings-list">
                    {visibleFindings.map((f) => (
                      <article
                        className={`finding-card ${f.status !== "open" && !f.needsRecheck ? "finding-closed" : ""}`}
                        key={f.id}
                      >
                        <div className="finding-top">
                          <span className={`finding-kind kind-${f.kind}`}>
                            {f.kind === "evidence" ? (
                              <FolderOpen size={13} />
                            ) : f.kind === "question" ? (
                              <CircleHelp size={13} />
                            ) : (
                              <MessageSquare size={13} />
                            )}
                            {findingNames[f.kind]}
                          </span>
                          <span className="finding-number">
                            F{String(f.number).padStart(2, "0")}
                          </span>
                        </div>
                        <h3>{f.title}</h3>
                        {f.needsRecheck && (
                          <div className="recheck-label">
                            <RefreshCw size={12} />
                            Recheck against version {rev.number}
                          </div>
                        )}
                        <p>{f.detail}</p>
                        {(f.assetId || f.location) && (
                          <button
                            className="finding-location"
                            onClick={() => {
                              if (primary.some((c) => c.assetId === f.assetId))
                                setAssetId(f.assetId);
                              else setTab("versions");
                            }}
                          >
                            <FileText size={13} />
                            {f.location ||
                              review.assets.find((a) => a.id === f.assetId)
                                ?.name ||
                              "Package"}
                            <ArrowUpRight size={12} />
                          </button>
                        )}
                        <div className="finding-request">
                          <span>REQUESTED ACTION</span>
                          <p>{f.request}</p>
                        </div>
                        <div className="finding-owner">
                          <span className="avatar micro">
                            {initials(f.owner)}
                          </span>
                          {f.owner}
                          {f.material && <small>Required for approval</small>}
                        </div>
                        {f.disposition && (
                          <div className="finding-disposition">
                            <CheckCircle2 size={14} />
                            <span>
                              {f.status === "resolved"
                                ? "Resolved"
                                : f.status === "dismissed"
                                  ? "Dismissed"
                                  : "Reopened"}
                              : {f.disposition.reason}
                            </span>
                          </div>
                        )}
                        {!isClosed(review) && (
                          <div className="finding-actions">
                            {f.status === "open" || f.needsRecheck ? (
                              <>
                                <button
                                  onClick={() =>
                                    onDialog({ finding: f, status: "resolved" })
                                  }
                                >
                                  <Check size={14} />
                                  Resolve
                                </button>
                                <button
                                  onClick={() =>
                                    onDialog({
                                      finding: f,
                                      status: "dismissed",
                                    })
                                  }
                                >
                                  Dismiss with reason
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() =>
                                  onDialog({ finding: f, status: "open" })
                                }
                              >
                                <RefreshCw size={13} />
                                Reopen
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={<MessageSquare size={25} />}
                    title="No open reviewer findings"
                  >
                    Review the files and copy. Add any issues or requests for
                    missing evidence.
                  </Empty>
                )}
                {review.findings.some((f) => f.status !== "open") && (
                  <button
                    className="closed-toggle"
                    onClick={() => setShowClosed((v) => !v)}
                  >
                    {showClosed
                      ? "Hide addressed findings"
                      : "Show addressed findings"}
                    <ChevronDown size={14} />
                  </button>
                )}
                <div className="findings-footer">
                  <button
                    className="button primary full"
                    onClick={() => onDialog("draft")}
                  >
                    <MessageSquare size={16} />
                    Prepare feedback
                    <ArrowRight size={16} />
                  </button>
                  <p>Internal notes are excluded from the reply.</p>
                </div>
              </>
            ) : (
              <div className="context-panel">
                <h2>Review context</h2>
                <dl>
                  <dt>Product</dt>
                  <dd>{PRODUCT_LABELS[review.product]}</dd>
                  <dt>Intended use</dt>
                  <dd>{rev.intendedUse || "Not provided"}</dd>
                  <dt>Submitted by</dt>
                  <dd>
                    {review.submitter}
                    <small>{review.submitterEmail}</small>
                  </dd>
                  <dt>Placement</dt>
                  <dd>{review.channel}</dd>
                </dl>
                <div className="offer-reference">
                  <span className="eyebrow">OFFER REFERENCE</span>
                  <h3>{offer?.name || "No offer selected"}</h3>
                  {offer ? (
                    <>
                      <span className="offer-version">{offer.version}</span>
                      <dl>
                        {offer.facts.map((f) => (
                          <div key={f.label}>
                            <dt>{f.label}</dt>
                            <dd>{f.value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="context-callout">{offer.disclosure}</div>
                      <p className="small-muted">
                        Valid {date(offer.validFrom)} – {date(offer.validTo)}
                        <br />
                        {offer.source}
                      </p>
                    </>
                  ) : (
                    <p className="muted">
                      Request the applicable offer details before completing
                      intake.
                    </p>
                  )}
                </div>
                <div className="manual-guide">
                  <h3>Review prompts</h3>
                  <ul>
                    <li>
                      Do the claims match the applicable offer and supporting
                      evidence?
                    </li>
                    <li>
                      Have you inspected the actual rendition and relevant
                      destination?
                    </li>
                    <li>
                      Have the product-specific requirements and unresolved
                      concerns been addressed?
                    </li>
                  </ul>
                  <small>
                    Apply the requirements for this product and placement.
                  </small>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
      {tab === "versions" && <VersionHistory review={review} offers={offers} />}
      {tab === "activity" && (
        <div className="activity-layout">
          <section className="panel">
            <header className="panel-header">
              <div>
                <h2>Review history</h2>
                <p>
                  {review.history.length} events · Originals, findings, and
                  decisions.
                </p>
              </div>
              <button
                className="button secondary"
                disabled={exporting}
                onClick={downloadRecord}
              >
                {exporting ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <ArrowDownToLine size={16} />
                )}
                Download record
              </button>
            </header>
            <div className="record-download-note">
              Internal review record. Includes reviewer reasoning; excludes
              internal notes and reply drafts.
              <ErrorMessage error={exportError} />
            </div>
            <div className="timeline">
              {[...review.history].reverse().map((event) => (
                <div className="timeline-item" key={event.id}>
                  <span className="timeline-dot">
                    <History size={14} />
                  </span>
                  <div>
                    <strong>{event.text}</strong>
                    <span>
                      {event.actor} · {dateTime(event.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {review.decisions.length > 0 && (
              <div className="recorded-decisions">
                <h3>Recorded decisions</h3>
                {review.decisions.map((d) => (
                  <div key={d.id}>
                    <span className="eyebrow">
                      {d.outcome} · VERSION{" "}
                      {
                        review.revisions.find((r) => r.id === d.revisionId)
                          ?.number
                      }
                    </span>
                    <strong>{d.scope}</strong>
                    <p>{d.rationale}</p>
                    <small>
                      {d.reviewer} · {dateTime(d.createdAt)}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="panel notes-panel">
            <header className="panel-header">
              <div>
                <h2>Internal notes</h2>
                <p>Never included in prepared replies.</p>
              </div>
              <MessageSquare size={20} />
            </header>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await onAction({ type: "add_note", text: note }))
                  setNote("");
              }}
            >
              <Field label="Add a note">
                <textarea
                  rows={4}
                  required
                  placeholder="Context for the internal team…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <button
                className="button secondary"
                disabled={saving || !note.trim()}
                type="submit"
              >
                <Plus size={15} />
                Save note
              </button>
            </form>
            <div className="notes-list">
              {[...review.notes].reverse().map((n) => (
                <div key={n.id}>
                  <strong>
                    {n.author}
                    <span>{date(n.createdAt)}</span>
                  </strong>
                  <p className="preserve-lines">{n.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {tab === "drafts" && (
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>Prepared replies</h2>
              <p>
                Saved for copying into your email client. Nothing has been sent.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => onDialog("draft")}
            >
              <Plus size={16} />
              Prepare reply
            </button>
          </header>
          {review.drafts.length ? (
            <div className="draft-list">
              {[...review.drafts].reverse().map((d) => (
                <article key={d.id}>
                  <div>
                    <span className="prepared-badge">Prepared</span>
                    <small>
                      {dateTime(d.createdAt)} · v
                      {
                        review.revisions.find((r) => r.id === d.revisionId)
                          ?.number
                      }
                    </small>
                  </div>
                  <h3>{d.subject}</h3>
                  <pre>{d.body}</pre>
                  <button
                    className="text-button"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([`Subject: ${d.subject}\n\n${d.body}`], {
                          type: "text/plain",
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${review.reference}-draft.txt`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    <ArrowDownToLine size={15} />
                    Download reply
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <Empty icon={<MessageSquare size={28} />} title="No reply drafts">
              Prepare a reply from selected findings or the current decision.
            </Empty>
          )}
        </section>
      )}
    </div>
  );
}

function VersionPanel({
  review,
  rev,
  label,
  offers,
}: {
  review: ReviewCase;
  rev: PackageRevision;
  label: string;
  offers: Offer[];
}) {
  const [chosen, setChosen] = useState("");
  const offer = offers.find((o) => o.id === rev.offerId);
  const components = rev.components.filter((c) => c.role !== "excluded");
  const id = components.some((c) => c.assetId === chosen)
    ? chosen
    : components[0]?.assetId;
  return (
    <section className="panel version-panel">
      <header className="panel-header">
        <div>
          <span className="eyebrow">{label}</span>
          <h2>Version {rev.number}</h2>
          <p>
            {dateTime(rev.createdAt)} · {rev.submittedBy}
          </p>
        </div>
      </header>
      {components.length > 0 && (
        <select
          className="version-file-select"
          aria-label={`${label} file`}
          value={id}
          onChange={(e) => setChosen(e.target.value)}
        >
          {components.map((c) => (
            <option key={c.assetId} value={c.assetId}>
              {review.assets.find((a) => a.id === c.assetId)?.name} ·{" "}
              {ROLE_LABELS[c.role]}
            </option>
          ))}
        </select>
      )}
      <AssetViewer
        compact
        caseId={review.id}
        asset={review.assets.find((a) => a.id === id)}
      />
      <div className="version-copy">
        <h3>Offer reference</h3>
        <p>
          {offer
            ? `${offer.name} · ${offer.version}`
            : rev.offerId || "Not supplied."}
        </p>
        <h3>Destination URL</h3>
        <p className="preserve-lines">
          {rev.destinationUrl || "Not supplied."}
        </p>
        <h3>Accompanying copy</h3>
        <p className="preserve-lines">{rev.copy || "No copy supplied."}</p>
        <h3>Intended use</h3>
        <p>{rev.intendedUse || "Not supplied."}</p>
        <h3>Revision note</h3>
        <p>{rev.summary || "No note supplied."}</p>
      </div>
    </section>
  );
}
function VersionHistory({
  review,
  offers,
}: {
  review: ReviewCase;
  offers: Offer[];
}) {
  const current = currentRevision(review);
  const [previousId, setPreviousId] = useState(
    review.revisions.at(-2)?.id || current.id,
  );
  const previous =
    review.revisions.find((r) => r.id === previousId) || review.revisions[0];
  const added = current.components.filter(
    (c) => !previous.components.some((p) => p.assetId === c.assetId),
  );
  const removed = previous.components.filter(
    (c) => !current.components.some((p) => p.assetId === c.assetId),
  );
  return (
    <div className="versions-view">
      <div className="version-controls">
        <div>
          <h2>Compare versions</h2>
          <p>Review all changes. A new version does not resolve a finding.</p>
        </div>
        <label>
          Compare with{" "}
          <select
            value={previous.id}
            onChange={(e) => setPreviousId(e.target.value)}
          >
            {review.revisions.map((r) => (
              <option value={r.id} key={r.id}>
                Version {r.number}
                {r.id === current.id ? " (current)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="change-summary">
        <span>
          <Plus size={14} />
          {added.length} files added
        </span>
        <span>{removed.length} removed</span>
        <span>
          {current.copy !== previous.copy
            ? "Accompanying copy changed"
            : "Accompanying copy unchanged"}
        </span>
        <span>
          {current.offerId !== previous.offerId ||
          current.intendedUse !== previous.intendedUse ||
          current.destinationUrl !== previous.destinationUrl
            ? "Review context changed"
            : "Review context unchanged"}
        </span>
      </div>
      <div className="version-comparison">
        <VersionPanel
          review={review}
          rev={previous}
          offers={offers}
          label="Earlier package"
        />
        <VersionPanel
          review={review}
          rev={current}
          offers={offers}
          label="Current package"
        />
      </div>
    </div>
  );
}

function Samples({ onClose }: { onClose: () => void }) {
  const links = [
    [
      "Initial social ad",
      "/fixtures/loan/v1/social-ad.png",
      "A fee claim to compare with the offer reference.",
    ],
    [
      "Revised social ad",
      "/fixtures/loan/v2/social-ad.png",
      "Corrects the fee language. The destination is still outstanding.",
    ],
    [
      "Destination proof",
      "/fixtures/loan/v3/destination.pdf",
      "Two-page rendition to complete the review package.",
    ],
    [
      "Personal-loan offer reference",
      "/fixtures/offers/personal-loan.pdf",
      "Fictional source facts for the worked example.",
    ],
    [
      "Credit card creative",
      "/fixtures/card/social-ad.png",
      "Credit card social image.",
    ],
    [
      "Mortgage creative",
      "/fixtures/mortgage/social-ad.jpg",
      "A prequalification campaign waiting on its destination.",
    ],
  ];
  return (
    <Modal
      title="Sample files"
      description="Fictional creative, revisions, and offer references."
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        <div className="sample-story">
          <span className="sample-step">01</span>
          <p>
            <strong>Start with the personal-loan example.</strong> Review the
            fee claim against the offer facts. Prepare feedback on the two
            authored findings.
          </p>
          <span className="sample-step">02</span>
          <p>
            <strong>Add the revised social ad.</strong> Replace the original
            image and keep the offer reference. Resolve the fee finding; keep
            the missing destination open.
          </p>
          <span className="sample-step">03</span>
          <p>
            <strong>Add the destination proof.</strong> Inspect the full
            package, reconcile remaining findings, and record a decision for its
            stated use.
          </p>
        </div>
        <div className="sample-downloads">
          {links.map(([title, href, description]) => (
            <a key={href} href={href} download>
              <span className="download-icon">
                <FileText size={20} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <ArrowDownToLine size={18} />
            </a>
          ))}
        </div>
        <p className="small-muted">
          Sample cases include prewritten findings. Uploading these files
          yourself creates a fresh case with no findings. The materials are
          illustrative, not approved advertising.
        </p>
      </div>
      <footer className="modal-footer">
        <button className="button primary" onClick={onClose}>
          Back to workspace
          <ArrowRight size={16} />
        </button>
      </footer>
    </Modal>
  );
}
function Guide({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Review steps" onClose={onClose}>
      <div className="modal-body guide-body">
        <div>
          <span>01</span>
          <h3>Confirm the package</h3>
          <p>
            Check the creative, copy, destination, and offer reference. Request
            any missing material or context.
          </p>
        </div>
        <div>
          <span>02</span>
          <h3>Add findings</h3>
          <p>
            Record the issue, supporting evidence, requested change, and person
            responsible.
          </p>
        </div>
        <div>
          <span>03</span>
          <h3>Review revisions</h3>
          <p>
            Compare the updated material with the previous version. Resolve
            addressed findings and leave unanswered requests open.
          </p>
        </div>
        <div>
          <span>04</span>
          <h3>Record a decision</h3>
          <p>
            State the version, approved use, and basis for the decision. Prepare
            a reply to send through your email client.
          </p>
        </div>
      </div>
      <footer className="modal-footer">
        <button className="button primary" onClick={onClose}>
          Got it
          <Check size={16} />
        </button>
      </footer>
    </Modal>
  );
}
