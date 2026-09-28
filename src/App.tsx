import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileCheck2,
  FileText,
  FolderOpen,
  Inbox,
  LayoutList,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { api, ApiError, json } from "./api";
import {
  date,
  Empty,
  ErrorMessage,
  Modal,
  Status,
} from "./components";
import {
  DecisionForm,
  DraftForm,
  SubmissionForm,
  WaitingForm,
  type ActionInput,
} from "./forms";
import {
  currentRevision,
  openBlockers,
  pendingResponses,
  pendingDecisionHandoff,
  PRODUCT_LABELS,
  REVIEWER,
  type Offer,
  type ReviewCase,
} from "../shared/types";

import { useUnsavedWarning } from "./drafts";

import { ReviewWorkspace } from "./ReviewWorkspace";
import Offers from "./Offers";
import { CommunicationForm } from "./CommunicationForm";

type Dialog =
  | null
  | "new"
  | "revision"
  | "waiting"
  | "decision"
  | "draft"
  | "communication"
  | { draftId: string }
  | "samples"
  | "guide";
type Page = "queue" | "decisions";
const isClosed = (c: ReviewCase) =>
  c.status === "approved" ||
  c.status === "rejected" ||
  c.status === "cancelled";
export default function App() {
  useUnsavedWarning();
  const actorId = "maya";
  const [updatesAvailable, setUpdatesAvailable] = useState(false);
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
  const referencesOpen = hash === "#references";
  const page: Page = hash === "#decisions" ? "decisions" : "queue";
  const selected = cases.find((c) => c.id === selectedId);
  useEffect(() => {
    const listener = () => {
      if (saving) {
        window.location.hash = hash;
        return;
      }
      setHash(window.location.hash);
      setDialog(null);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, [saving, hash]);
  async function refresh() {
    setLoadError("");
    try {
      const [nextCases, nextOffers] = await Promise.all([
        api<ReviewCase[]>("/api/cases"),
        api<Offer[]>("/api/offers"),
      ]);
      setCases(nextCases);
      setOffers(nextOffers);
      setUpdatesAvailable(false);
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
    const poll = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const latest = await api<ReviewCase[]>("/api/cases");
        const signature = (list: ReviewCase[]) =>
          list
            .map((c) => `${c.id}:${c.version}`)
            .sort()
            .join("|");
        if (signature(latest) !== signature(cases)) setUpdatesAvailable(true);
      } catch {
        /* Keep the visible review; manual refresh reports failures. */
      }
    }, 30000);
    return () => clearInterval(poll);
  }, [cases]);
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void api<ReviewCase>(`/api/cases/${selectedId}`)
      .then((c) => {
        if (!cancelled) update(c);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);
  useEffect(() => {
    if (!toast || toast.error) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function update(c: ReviewCase) {
    setCases((old) =>
      [c, ...old.filter((o) => o.id !== c.id)].sort(
        (a, b) =>
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
        json({ ...input, actorId, expectedVersion: selected.version }),
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
      if (
        error instanceof ApiError &&
        error.details?.code === "reference_recheck_required"
      ) {
        // A reference can change without changing the case version.
        setOffers(await api<Offer[]>("/api/offers"));
      }
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.details?.code === "version_conflict"
      ) {
        update(await api<ReviewCase>(`/api/cases/${selected.id}`));
        throw new ApiError(
          "This case changed. The latest context is loaded and your input was kept. Review the changes before saving again.",
          409,
        );
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
  const activeCount = cases.filter(
    (c) =>
      !isClosed(c) || pendingDecisionHandoff(c) || pendingResponses(c).length,
  ).length;
  return (
    <div className={`app-shell ${selected ? "case-open" : ""}`}>
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
          <a
            className={page === "queue" && !referencesOpen ? "active" : ""}
            href="#queue"
          >
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
          <a className={referencesOpen ? "active" : ""} href="#references">
            <BookOpen size={19} />
            Offer references
          </a>
          <a href="/submit" target="_blank" rel="noreferrer">
            <Upload size={19} />
            Submission form
            <ArrowUpRight size={14} />
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
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            ClearPath Financial <ChevronRight size={13} />{" "}
            <span>Marketing compliance</span>
          </span>
          <div>
            {updatesAvailable && (
              <button
                className="button secondary"
                disabled={saving}
                onClick={() => void refresh()}
              >
                Updates available · load latest
              </button>
            )}
            <button
              className="icon-button"
              disabled={saving}
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
            <ReviewWorkspace
              key={selected.id}
              reviewerName={REVIEWER}
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
          ) : referencesOpen ? (
            <Offers
              offers={offers}
              actorId={actorId}
              onSaved={(offer) =>
                setOffers((old) => [
                  offer,
                  ...old.filter((o) => o.id !== offer.id),
                ])
              }
            />
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
      {dialog === "samples" && <Samples cases={cases} onClose={() => setDialog(null)} />}
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
              reviewerName={REVIEWER}
              onAction={action}
              onClose={() => setDialog(null)}
            />
          )}
          {(dialog === "draft" ||
            (dialog && typeof dialog === "object" && "draftId" in dialog)) && (
            <DraftForm
              key={
                typeof dialog === "object" && dialog && "draftId" in dialog
                  ? dialog.draftId
                  : "new"
              }
              draftId={
                typeof dialog === "object" && dialog && "draftId" in dialog
                  ? dialog.draftId
                  : undefined
              }
              reviewerName={REVIEWER}
              review={selected}
              offers={offers}
              onAction={action}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === "communication" && (
            <CommunicationForm
              review={selected}
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
  const days = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 86400000),
  );
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
  const active = cases.filter(
    (c) =>
      !isClosed(c) || pendingDecisionHandoff(c) || pendingResponses(c).length,
  );
  const records = cases;
  const rows = records
    .filter(
      (c) =>
        (filter === "all" ||
          (filter === "active"
            ? ["needs_intake", "in_review"].includes(c.status) ||
              pendingResponses(c).length > 0 ||
              !!pendingDecisionHandoff(c)
            : filter === "completed"
              ? isClosed(c) &&
                !pendingDecisionHandoff(c) &&
                !pendingResponses(c).length
              : c.status === filter)) &&
        (owner === "all" || c.owner === owner) &&
        `${c.title} ${c.reference} ${c.submitter} ${PRODUCT_LABELS[c.product]}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "oldest")
        return (
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
        );
      if (sort === "launch")
        return (
          (a.launchDate || "9999").localeCompare(b.launchDate || "9999") ||
          a.id.localeCompare(b.id)
        );
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
          <label>
            Reviewer{" "}
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="all">All reviewers</option>
              {[...new Set(cases.map((c) => c.owner))].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Sort{" "}
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="updated">Recently updated</option>
              <option value="oldest">Oldest received</option>
              <option value="launch">Requested launch</option>
            </select>
          </label>
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
                        {pendingResponses(c).length
                          ? `${pendingResponses(c).length} response${pendingResponses(c).length === 1 ? "" : "s"} to assess`
                          : pendingDecisionHandoff(c)
                            ? "Communicate recorded decision"
                            : isClosed(c)
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
                        {[
                          ...new Set([
                            c.owner,
                            ...(c.status === "waiting" ? [c.nextOwner] : []),
                            ...c.findings
                              .filter(
                                (f) => f.status === "open" || f.needsRecheck,
                              )
                              .map((f) => f.owner),
                          ]),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </td>
                    <td className="updated-cell">
                      {c.launchDate
                        ? `Launch ${date(c.launchDate)}`
                        : "No launch date"}
                      <span className="table-sub">
                        Received {age(c.createdAt)} · v
                        {currentRevision(c).number}
                      </span>
                      {c.status === "waiting" && (
                        <span className="table-sub">
                          Waiting{" "}
                          {age(
                            c.history.findLast((e) => e.type === "waiting")
                              ?.createdAt || c.updatedAt,
                          )}
                        </span>
                      )}
                      <span className="table-sub">
                        Updated {date(c.updatedAt)}
                      </span>
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

function Samples({ cases, onClose }: { cases: ReviewCase[]; onClose: () => void }) {
  const prepared = cases
    .filter((review) => review.notes.some((note) => note.text.startsWith("Sample scenario prepared:")))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
        {prepared.length > 0 && (
          <>
            <h3>Try a prepared case</h3>
            <p className="small-muted">
              Open either side of the same review. The submitter page contains
              shared feedback and ways to respond. Changes you make are saved.
            </p>
            <div className="sample-prepared">
              {prepared.map((review) => (
                <article key={review.id} aria-label={review.title}>
                  <strong>{review.title}</strong>
                  <small>{review.reference} · Version {currentRevision(review).number}</small>
                  <div>
                    <a href={`#review/${review.id}`} onClick={onClose}>
                      Review case <ArrowRight size={14} />
                    </a>
                    {review.submitterToken && (
                      <a
                        href={`/submit/${encodeURIComponent(review.submitterToken)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Submitter page <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <h3>Or start from the original files</h3>
          </>
        )}
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
            responsible. Choose which requests the submitter should see and
            share them on the submission link.
          </p>
        </div>
        <div>
          <span>03</span>
          <h3>Review revisions</h3>
          <p>
            Compare the updated material with the previous version. Resolve
            addressed findings and leave unanswered requests open. Inspect
            returned evidence before assessing the response; a reply alone
            does not resolve a finding.
          </p>
        </div>
        <div>
          <span>04</span>
          <h3>Record a decision</h3>
          <p>
            State the reviewed version, permitted use, and basis. Share the
            decision on the submission link, or record communication of its
            exact saved message outside this workspace. Saving a draft does
            not complete that handoff.
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
