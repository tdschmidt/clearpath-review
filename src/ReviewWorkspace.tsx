import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  FileText,
  History,
  LoaderCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import {
  AssetViewer,
  date,
  dateTime,
  Empty,
  ErrorMessage,
  Status,
} from "./components";
import { Field, type ActionInput } from "./forms";
import { clearDrafts, useDraftState } from "./drafts";
import {
  currentRevision,
  openBlockers,
  PRODUCT_LABELS,
  ROLE_LABELS,
  PARTICIPANTS,
  assetUrl,
  offerAssetUrl,
  type ReviewCase,
  type Offer,
  type Finding,
  type FindingInput,
  type MaterialCitation,
  type SourceCitation,
  type PackageRevision,
  type Decision,
  type Participant,
} from "../shared/types";
import "./reviewer.css";

export type ReviewDialog =
  | "revision"
  | "waiting"
  | "decision"
  | "draft"
  | "communication"
  | { draftId: string };
export interface ReviewWorkspaceProps {
  review: ReviewCase;
  offers: Offer[];
  saving: boolean;
  onDialog: (dialog: ReviewDialog) => void;
  onAction: (action: ActionInput) => Promise<boolean>;
  reviewerName?: string;
  participants?: Participant[];
}
type Location = {
  revisionId: string;
  assetId: string;
  page: number;
  zoom: number;
};
type Editor =
  | { mode: "new" }
  | { mode: "edit"; finding: Finding }
  | { mode: "disposition"; finding: Finding; status: Finding["status"] };
const names = {
  correction: "Correction",
  evidence: "Evidence request",
  question: "Specialist question",
};
const closed = (review: ReviewCase) =>
  ["approved", "rejected", "cancelled"].includes(review.status);
const revisionLocation = (rev: PackageRevision): Location => ({
  revisionId: rev.id,
  assetId:
    rev.components.find((c) => c.role === "creative")?.assetId ||
    rev.components.find((c) => c.role !== "excluded")?.assetId ||
    "",
  page: 1,
  zoom: 100,
});

export function ReviewWorkspace({
  review,
  offers,
  saving,
  onDialog,
  onAction,
  reviewerName,
  participants = PARTICIPANTS,
}: ReviewWorkspaceProps) {
  const rev = currentRevision(review);
  const [tab, setTab] = useState("review");
  const [location, setLocation] = useState<Location>(() =>
    revisionLocation(rev),
  );
  const [source, setSource] = useState<SourceCitation | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [decisionId, setDecisionId] = useState("");
  const [offerId, setOfferId] = useState(rev.offerId);
  const [applicability, setApplicability] = useDraftState(
    `review/${review.id}/applicability`,
    rev.applicabilityReason || "",
  );
  const [intakeError, setIntakeError] = useState("");
  const [copied, setCopied] = useState(false);
  const selectedRev =
    review.revisions.find((r) => r.id === location.revisionId) || rev;
  const offer = offers.find(
    (o) =>
      o.id === (review.confirmedRevisionId === rev.id ? rev.offerId : offerId),
  );
  const selectedSourceOffer = offers.find((o) => o.id === source?.offerId);
  const sourceAsset = selectedSourceOffer?.assets?.find(
    (a) => a.id === source?.assetId,
  );
  const findings = review.findings.filter(
    (f) => showClosed || f.status === "open" || f.needsRecheck,
  );
  const pending = review.findings.filter(
    (f) => f.status === "open" || f.needsRecheck,
  );
  const rechecks = review.findings.filter((f) => f.needsRecheck);
  const blockers = openBlockers(review);
  const currentDecision = review.decisions.findLast(
    (d) => d.revisionId === rev.id && !d.withdrawn,
  );
  const selectedDecision = review.decisions.find((d) => d.id === decisionId);
  const missing = [
    !offer && "Select the applicable offer reference",
    !rev.intendedUse.trim() && "Supply the intended use",
    !rev.copy.trim() &&
      !rev.components.some((c) => c.role !== "excluded") &&
      "Supply creative or accompanying copy",
  ].filter(Boolean) as string[];
  const launch = rev.launchDate ?? review.launchDate;
  const dateMismatch = Boolean(
    offer && launch && (launch < offer.validFrom || launch > offer.validTo),
  );
  const withdrawnOffer = Boolean(offer?.withdrawnAt);
  const eligibleOffers = offers.filter(
    (o) => o.product === (rev.product || review.product) && !o.withdrawnAt,
  );
  const needIntake = review.confirmedRevisionId !== rev.id && !closed(review);
  const unshared = pending.filter(
    (f) =>
      f.audience === "submitter" &&
      !(review.publishedFeedback || []).some(
        (p) =>
          p.revisionId === rev.id &&
          p.findings.some(
            (shared) =>
              shared.id === f.id &&
              shared.request === f.request &&
              shared.title === f.title,
          ),
      ),
  );

  useEffect(() => {
    setLocation(revisionLocation(rev));
    setOfferId(rev.offerId);
    setSource(null);
  }, [review.id, rev.id]);
  useEffect(() => {
    const fromHash = () => {
      const path = window.location.hash.split("/");
      if (path[2] === "decision" && path[3]) {
        setDecisionId(path[3]);
        setTab("decision");
      } else if (path[2] === "activity") setTab("activity");
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [review.id]);
  function jump(citation: MaterialCitation) {
    setTab("review");
    setLocation({
      revisionId: citation.revisionId,
      assetId: citation.assetId,
      page: citation.page || 1,
      zoom: 100,
    });
  }
  function showDecision(decision: Decision) {
    setDecisionId(decision.id);
    setTab("decision");
    window.location.hash = `review/${review.id}/decision/${decision.id}`;
  }
  async function confirmIntake(event: FormEvent) {
    event.preventDefault();
    setIntakeError("");
    if (
      missing.length ||
      withdrawnOffer ||
      (dateMismatch && !applicability.trim())
    ) {
      setIntakeError("Complete the intake requirements shown above.");
      return;
    }
    if (
      await onAction({
        type: "confirm_intake",
        offerId,
        applicabilityReason: applicability,
      })
    )
      clearDrafts(`review/${review.id}/applicability`);
    else
      setIntakeError(
        "The package could not be confirmed. Check the latest context and try again.",
      );
  }
  const next = needIntake
    ? {
        title: missing.length ? "Complete intake" : "Confirm this package",
        text: missing.length
          ? missing.join(" · ")
          : "Check the material, offer reference, and intended use below.",
      }
    : rechecks.length
      ? {
          title: "Recheck the revision",
          text: `${rechecks.length} finding${rechecks.length === 1 ? " needs" : "s need"} another look against version ${rev.number}.`,
        }
      : currentDecision
        ? {
            title: "Decision recorded",
            text: `Version ${rev.number} · ${currentDecision.outcome}. Share the result with the submitter when ready.`,
          }
        : review.status === "cancelled"
          ? {
              title: "Review cancelled",
              text:
                review.cancelled?.reason || "No further review is scheduled.",
            }
          : review.status === "waiting"
            ? {
                title: `Waiting on ${review.nextOwner}`,
                text: review.waitingReason,
              }
            : unshared.length
              ? {
                  title: "Prepare feedback",
                  text: `${unshared.length} submitter request${unshared.length === 1 ? " has" : "s have"} not been shared for this version.`,
                }
              : blockers.length
                ? {
                    title: "Review open findings",
                    text: `${blockers.length} required finding${blockers.length === 1 ? " remains" : "s remain"}. ${[...new Set(blockers.map((f) => f.owner))].join(", ")}`,
                  }
                : {
                    title: "Review material and record a decision",
                    text: "No recorded findings block a decision. Inspect the complete package and its supporting context.",
                  };

  return (
    <div className="review-workspace">
      <header className="rw-heading">
        <a href="#queue" className="back-link">
          <ArrowLeft size={16} /> Review queue
        </a>
        <div className="rw-title-line">
          <div>
            <p className="eyebrow">
              {review.reference} ·{" "}
              {PRODUCT_LABELS[rev.product || review.product]}
              {review.example ? " · Example" : ""}
            </p>
            <h1>{review.title}</h1>
            <p className="rw-subtitle">
              <Status value={review.status} />
              <span>Version {rev.number}</span>
              <span>Reviewing as {reviewerName || "Maya Chen"}</span>
              <span>{rev.channel || review.channel}</span>
              <span>
                {launch
                  ? `Target launch ${date(launch)}`
                  : "No target launch supplied"}
              </span>
            </p>
          </div>
          <div className="rw-heading-actions">
            <button
              className="button secondary"
              onClick={() => onDialog("revision")}
              disabled={saving || review.status === "cancelled"}
            >
              <Upload size={16} /> Add revision
            </button>
            {!closed(review) && (
              <button
                className={`button ${!needIntake && !blockers.length ? "primary" : "secondary"}`}
                onClick={() => onDialog("decision")}
                disabled={saving}
              >
                Record decision
              </button>
            )}
          </div>
        </div>
        <div className="rw-next">
          <div>
            <strong>{next.title}</strong>
            <p>{next.text}</p>
          </div>
          {rechecks.length > 0 && (
            <button
              className="button secondary"
              onClick={() => setTab("versions")}
            >
              Compare revision <ArrowRight size={15} />
            </button>
          )}
          {!needIntake &&
            !closed(review) &&
            !rechecks.length &&
            unshared.length > 0 && (
              <button
                className="button primary"
                onClick={() => onDialog("draft")}
              >
                Prepare feedback
              </button>
            )}
          {currentDecision && (
            <button
              className="button secondary"
              onClick={() => showDecision(currentDecision)}
            >
              View decision
            </button>
          )}
          {!closed(review) && (
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
            </button>
          )}
        </div>
      </header>
      <nav
        className="rw-tabs"
        role="tablist"
        aria-label="Case views"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              '[role="tab"]',
            ),
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    buttons.length) %
                  buttons.length;
          event.preventDefault();
          buttons[next]?.focus();
          buttons[next]?.click();
        }}
      >
        {[
          ["review", "Review"],
          ["versions", `Versions (${review.revisions.length})`],
          ["activity", "History & notes"],
          ["drafts", "Feedback & replies"],
          ["details", "Case details"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={
              tab === id || (tab === "decision" && id === "activity")
            }
            tabIndex={
              tab === id || (tab === "decision" && id === "activity") ? 0 : -1
            }
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        {saving && (
          <span role="status">
            <LoaderCircle size={14} className="spin" /> Saving…
          </span>
        )}
      </nav>
      {tab === "review" && (
        <>
          {needIntake && (
            <form className="rw-intake" onSubmit={confirmIntake}>
              <div>
                <h2>Intake · version {rev.number}</h2>
                {missing.length > 0 && (
                  <ul className="rw-missing">
                    {missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                <div className="form-grid">
                  <Field label="Applicable offer reference">
                    <select
                      value={offerId}
                      onChange={(e) => setOfferId(e.target.value)}
                    >
                      <option value="">Choose a reference</option>
                      {eligibleOffers.map((o) => (
                        <option value={o.id} key={o.id}>
                          {o.name} · {o.version}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div>
                    <p className="small-muted">
                      Submitted offer: {rev.advertisedOffer || "Not supplied"}
                    </p>
                    <a href="#references" className="text-button">
                      Manage offer references <ArrowRight size={14} />
                    </a>
                  </div>
                </div>
                {(dateMismatch || withdrawnOffer) && (
                  <div className="rw-warning">
                    {withdrawnOffer
                      ? "This reference was withdrawn. Select a current reference."
                      : `Target launch ${date(launch)} falls outside this reference’s validity (${date(offer!.validFrom)}–${date(offer!.validTo)}). Explain applicability or obtain an updated reference.`}
                  </div>
                )}
                {dateMismatch && !withdrawnOffer && (
                  <Field label="Why this reference applies">
                    <textarea
                      required
                      value={applicability}
                      onChange={(e) => setApplicability(e.target.value)}
                      rows={2}
                    />
                  </Field>
                )}
                <ErrorMessage error={intakeError} />
              </div>
              <div className="rw-intake-actions">
                <button
                  className="button primary"
                  disabled={saving || missing.length > 0 || withdrawnOffer}
                  type="submit"
                >
                  <Check size={16} /> Confirm package
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setEditor({ mode: "new" })}
                >
                  Request missing context
                </button>
              </div>
            </form>
          )}
          <div className={`rw-grid ${source ? "with-source" : ""}`}>
            <section className="rw-material panel">
              <header className="panel-header">
                <div>
                  <h2>Submitted material</h2>
                  <p>
                    {selectedRev.id !== rev.id
                      ? `Viewing earlier version ${selectedRev.number}; the current review is version ${rev.number}.`
                      : `Current package · version ${rev.number}`}
                  </p>
                </div>
                <select
                  aria-label="Material version"
                  value={selectedRev.id}
                  onChange={(e) =>
                    setLocation(
                      revisionLocation(
                        review.revisions.find((r) => r.id === e.target.value)!,
                      ),
                    )
                  }
                >
                  {review.revisions.map((r) => (
                    <option key={r.id} value={r.id}>
                      Version {r.number}
                      {r.id === rev.id ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </header>
              <PackageMaterial
                review={review}
                revision={selectedRev}
                location={location}
                onLocation={setLocation}
              />
            </section>
            {source && (
              <section className="rw-source panel">
                <header className="panel-header">
                  <div>
                    <h2>Source</h2>
                    <p>
                      {selectedSourceOffer?.name} ·{" "}
                      {selectedSourceOffer?.version}
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => setSource(null)}
                    aria-label="Close source"
                  >
                    <X size={17} />
                  </button>
                </header>
                {sourceAsset ? (
                  <AssetViewer
                    caseId={review.id}
                    asset={sourceAsset}
                    page={source.page || 1}
                    onPageChange={(page) => setSource({ ...source, page })}
                    sourceUrl={offerAssetUrl(source.offerId, source.assetId)}
                    downloadUrl={offerAssetUrl(
                      source.offerId,
                      source.assetId,
                      true,
                    )}
                  />
                ) : (
                  <Empty title="Source unavailable">
                    This older reference does not have a preserved file. Its
                    recorded facts remain visible.
                  </Empty>
                )}
                {source.note && <p className="rw-source-note">{source.note}</p>}
              </section>
            )}
            <aside className="rw-working">
              <OfferFacts
                offer={offer}
                intendedUse={rev.intendedUse}
                onSource={setSource}
              />
              {editor ? (
                <FindingEditor
                  key={
                    editor.mode === "new"
                      ? "new"
                      : `${editor.mode}/${editor.finding.id}`
                  }
                  review={review}
                  editor={editor}
                  location={location}
                  source={source}
                  saving={saving}
                  onAction={onAction}
                  onClose={() => setEditor(null)}
                />
              ) : (
                <section className="panel rw-findings">
                  <header className="panel-header">
                    <div>
                      <h2>Findings · {pending.length} open</h2>
                    </div>
                    {!closed(review) && (
                      <button
                        className="button small secondary"
                        onClick={() => setEditor({ mode: "new" })}
                      >
                        <Plus size={15} /> Add finding
                      </button>
                    )}
                  </header>
                  {findings.length ? (
                    <div className="rw-finding-list">
                      {findings.map((f) => (
                        <FindingCard
                          key={f.id}
                          finding={f}
                          currentNumber={rev.number}
                          review={review}
                          onJump={jump}
                          onSource={setSource}
                          onEdit={() => setEditor({ mode: "edit", finding: f })}
                          onDisposition={(status) =>
                            setEditor({
                              mode: "disposition",
                              finding: f,
                              status,
                            })
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty title="No open findings">
                      Review the complete material and record any concerns or
                      requests for evidence.
                    </Empty>
                  )}
                  {review.findings.some((f) => f.status !== "open") && (
                    <button
                      className="text-button rw-show-addressed"
                      onClick={() => setShowClosed(!showClosed)}
                    >
                      {showClosed ? "Hide" : "Show"} addressed findings
                    </button>
                  )}
                  {pending.length > 0 && (
                    <footer className="rw-panel-footer">
                      <button
                        className="button secondary full"
                        onClick={() => onDialog("draft")}
                      >
                        Prepare feedback <ArrowRight size={15} />
                      </button>
                    </footer>
                  )}
                </section>
              )}
              <div className="rw-context-summary">
                <strong>Submitted by {review.submitter}</strong>
                <span>{review.submitterEmail}</span>
                <span>
                  Received {dateTime(rev.createdAt)} · uploaded by{" "}
                  {rev.submittedBy}
                </span>
              </div>
            </aside>
          </div>
        </>
      )}
      {tab === "versions" && (
        <VersionComparison
          review={review}
          offers={offers}
          onFinding={(finding) => {
            setTab("review");
            setEditor({ mode: "disposition", finding, status: "resolved" });
            jump(
              finding.citations?.[0] || {
                revisionId: finding.revisionId,
                assetId: finding.assetId,
              },
            );
          }}
        />
      )}
      {tab === "decision" && selectedDecision && (
        <DecisionView
          review={review}
          decision={selectedDecision}
          saving={saving}
          onAction={onAction}
          onReply={() => onDialog("draft")}
          offers={offers}
        />
      )}
      {tab === "activity" && (
        <Activity
          review={review}
          onAction={onAction}
          saving={saving}
          onDecision={showDecision}
        />
      )}
      {tab === "drafts" && <ReplyHistory review={review} onDialog={onDialog} />}
      {tab === "details" && (
        <CaseDetails
          review={review}
          participants={participants}
          reviewerName={reviewerName}
          saving={saving}
          onAction={onAction}
          copied={copied}
          onCopied={() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        />
      )}
    </div>
  );
}

function PackageMaterial({
  review,
  revision,
  location,
  onLocation,
  compact = false,
}: {
  review: ReviewCase;
  revision: PackageRevision;
  location: Location;
  onLocation: (value: Location) => void;
  compact?: boolean;
}) {
  const components = revision.components.filter((c) => c.role !== "excluded");
  const selected =
    components.find((c) => c.assetId === location.assetId) || components[0];
  const asset = review.assets.find((a) => a.id === selected?.assetId);
  return (
    <>
      {components.length > 0 && (
        <div className="rw-file-picker">
          <label>
            File
            <select
              value={selected?.assetId || ""}
              onChange={(e) =>
                onLocation({
                  ...location,
                  revisionId: revision.id,
                  assetId: e.target.value,
                  page: 1,
                  zoom: 100,
                })
              }
            >
              {components.map((c) => (
                <option key={c.assetId} value={c.assetId}>
                  {review.assets.find((a) => a.id === c.assetId)?.name} ·{" "}
                  {ROLE_LABELS[c.role]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <AssetViewer
        caseId={review.id}
        asset={asset}
        compact={compact}
        page={location.page}
        onPageChange={(page) => onLocation({ ...location, page })}
        zoom={location.zoom}
        onZoomChange={(zoom) => onLocation({ ...location, zoom })}
      />
      <div className="rw-material-context">
        <h3>Accompanying copy</h3>
        <p className="preserve-lines">
          {revision.copy || "No accompanying copy supplied."}
        </p>
        <h3>Destination</h3>
        {revision.destinationUrl ? (
          <a href={revision.destinationUrl} target="_blank" rel="noreferrer">
            {revision.destinationUrl}
          </a>
        ) : (
          <p>No destination URL supplied.</p>
        )}
        <small>
          A live destination may change. Inspect the supplied rendition where
          relevant.
        </small>
        {revision.components.some((c) => c.role === "excluded") && (
          <details>
            <summary>Not included in this review</summary>
            {revision.components
              .filter((c) => c.role === "excluded")
              .map((c) => (
                <a key={c.assetId} href={assetUrl(review.id, c.assetId, true)}>
                  {review.assets.find((a) => a.id === c.assetId)?.name}
                </a>
              ))}
          </details>
        )}
      </div>
    </>
  );
}

function OfferFacts({
  offer,
  intendedUse,
  onSource,
}: {
  offer?: Offer;
  intendedUse: string;
  onSource: (source: SourceCitation) => void;
}) {
  return (
    <section className="panel rw-facts">
      <header className="panel-header">
        <div>
          <h2>Offer & intended use</h2>
          <p>
            {offer
              ? `${offer.name} · ${offer.version}`
              : "No reference selected"}
          </p>
        </div>
      </header>
      <div className="rw-facts-body">
        <p className="rw-intended">
          <strong>Intended use</strong>
          {intendedUse || "Not supplied"}
        </p>
        {offer && (
          <>
            <dl>
              {offer.facts.map((fact, i) => (
                <div key={i}>
                  <dt>{fact.label}</dt>
                  <dd>
                    {fact.value}
                    {fact.citation && (
                      <button
                        className="text-button"
                        onClick={() => onSource(fact.citation!)}
                      >
                        <FileText size={13} /> Source
                        {fact.citation.page
                          ? ` · p. ${fact.citation.page}`
                          : ""}
                      </button>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="small-muted">
              Valid {date(offer.validFrom)}–{date(offer.validTo)} ·{" "}
              {offer.source}
            </p>
            {offer.withdrawnAt && (
              <p className="rw-warning">
                Withdrawn {date(offer.withdrawnAt)}: {offer.withdrawalReason}
              </p>
            )}
            {offer.assets?.map((asset) => (
              <button
                key={asset.id}
                className="text-button rw-source-link"
                onClick={() =>
                  onSource({ offerId: offer.id, assetId: asset.id, page: 1 })
                }
              >
                <FileText size={14} /> {asset.name}
              </button>
            ))}
            {offer.disclosure && (
              <details>
                <summary>Recorded disclosure</summary>
                <p className="preserve-lines">{offer.disclosure}</p>
              </details>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function FindingCard({
  finding: f,
  currentNumber,
  review,
  onJump,
  onSource,
  onEdit,
  onDisposition,
}: {
  finding: Finding;
  currentNumber: number;
  review: ReviewCase;
  onJump: (citation: MaterialCitation) => void;
  onSource: (citation: SourceCitation) => void;
  onEdit?: () => void;
  onDisposition?: (status: Finding["status"]) => void;
}) {
  const citations = f.citations?.length
    ? f.citations
    : f.assetId
      ? [{ revisionId: f.revisionId, assetId: f.assetId, note: f.location }]
      : [];
  return (
    <article
      className={`rw-finding ${f.status !== "open" && !f.needsRecheck ? "addressed" : ""}`}
    >
      <div className="rw-finding-labels">
        <span>
          F{String(f.number).padStart(2, "0")} · {names[f.kind]}
        </span>
        <span>{f.audience === "submitter" ? "Submitter" : "Internal"}</span>
      </div>
      <h3>{f.title}</h3>
      {f.needsRecheck && (
        <p className="rw-warning">Recheck against version {currentNumber}</p>
      )}
      <p className="preserve-lines">{f.detail}</p>
      <div className="rw-citations">
        {citations.map((citation, i) => (
          <button
            key={i}
            className="text-button"
            onClick={() => onJump(citation)}
          >
            <FileText size={14} />v
            {review.revisions.find((r) => r.id === citation.revisionId)
              ?.number || "?"}{" "}
            ·{" "}
            {review.assets.find((a) => a.id === citation.assetId)?.name ||
              "Material"}
            {citation.page ? ` · p. ${citation.page}` : ""}
            {citation.note ? ` · ${citation.note}` : ""}
          </button>
        ))}
        {f.sourceCitations?.map((citation, i) => (
          <button
            key={`source-${i}`}
            className="text-button"
            onClick={() => onSource(citation)}
          >
            <FileText size={14} />
            Supporting source{citation.page ? ` · p. ${citation.page}` : ""}
          </button>
        ))}
      </div>
      <div className="rw-request">
        <strong>Requested action</strong>
        <p className="preserve-lines">{f.request}</p>
      </div>
      <div className="rw-finding-owner">
        <span>{f.owner}</span>
        <strong>{f.material ? "Required before approval" : "Advice"}</strong>
      </div>
      {f.disposition && (
        <p className="rw-disposition">
          <strong>
            {f.status === "open"
              ? "Reopened"
              : f.status === "resolved"
                ? "Resolved"
                : "Dismissed"}
            :
          </strong>{" "}
          {f.disposition.reason}
        </p>
      )}
      {!closed(review) && onDisposition && (
        <div className="rw-finding-buttons">
          {f.status === "open" || f.needsRecheck ? (
            <>
              <button
                className="text-button"
                onClick={() => onDisposition("resolved")}
              >
                <Check size={14} /> Resolve
              </button>
              <button
                className="text-button"
                onClick={() => onDisposition("dismissed")}
              >
                Dismiss
              </button>
              {f.status === "open" && onEdit && (
                <button className="text-button" onClick={onEdit}>
                  Edit / reassign
                </button>
              )}
            </>
          ) : (
            <button
              className="text-button"
              onClick={() => onDisposition("open")}
            >
              <RefreshCw size={14} /> Reopen
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function FindingEditor({
  review,
  editor,
  location,
  source,
  saving,
  onAction,
  onClose,
}: {
  review: ReviewCase;
  editor: Editor;
  location: Location;
  source: SourceCitation | null;
  saving: boolean;
  onAction: ReviewWorkspaceProps["onAction"];
  onClose: () => void;
}) {
  const rev = currentRevision(review);
  const finding = editor.mode !== "new" ? editor.finding : null;
  const key = `review/${review.id}/${editor.mode}/${finding?.id || "new"}`;
  const initial: FindingInput = finding
    ? {
        kind: finding.kind,
        title: finding.title,
        detail: finding.detail,
        request: finding.request,
        location: finding.location,
        assetId: finding.assetId,
        owner: finding.owner,
        material: finding.material,
        audience: finding.audience || "internal",
        citations: finding.citations?.length
          ? finding.citations
          : finding.assetId
            ? [
                {
                  revisionId: finding.revisionId,
                  assetId: finding.assetId,
                  note: finding.location,
                },
              ]
            : [],
        sourceCitations: finding.sourceCitations || [],
      }
    : {
        kind: "correction",
        title: "",
        detail: "",
        request: "",
        location: "",
        assetId: location.assetId,
        owner: review.submitter,
        material: true,
        audience: "internal",
        citations: location.assetId
          ? [
              {
                revisionId: location.revisionId,
                assetId: location.assetId,
                page:
                  review.assets.find((a) => a.id === location.assetId)?.mime ===
                  "application/pdf"
                    ? location.page
                    : undefined,
              },
            ]
          : [],
        sourceCitations: [],
      };
  const [data, setData] = useDraftState(key, initial);
  const [reason, setReason] = useDraftState(`${key}/reason`, "");
  const [error, setError] = useState("");
  const [baseline, setBaseline] = useState(review.version);
  const changed = baseline !== review.version;
  const set = <K extends keyof FindingInput>(
    field: K,
    value: FindingInput[K],
  ) => setData((previous) => ({ ...previous, [field]: value }));
  const materialRevision =
    review.revisions.find(
      (r) => r.id === (data.citations?.[0]?.revisionId || location.revisionId),
    ) || rev;
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (changed) {
      setError(
        "The review changed while this draft was open. Check the latest material and confirm the context below before saving.",
      );
      return;
    }
    const action: ActionInput =
      editor.mode === "disposition"
        ? {
            type: "disposition",
            findingId: editor.finding.id,
            status: editor.status,
            reason,
          }
        : editor.mode === "edit"
          ? {
              type: "edit_finding",
              findingId: editor.finding.id,
              finding: data,
            }
          : { type: "add_finding", finding: data };
    if (await onAction(action)) {
      clearDrafts(key);
      onClose();
    } else
      setError(
        "Your draft is retained. Check the latest review context before trying again.",
      );
  }
  return (
    <section className="panel rw-editor">
      <header className="panel-header">
        <div>
          <h2>
            {editor.mode === "new"
              ? "Add finding"
              : editor.mode === "edit"
                ? `Edit F${finding!.number}`
                : `${editor.status === "open" ? "Reopen" : editor.status === "resolved" ? "Resolve" : "Dismiss"} F${finding!.number}`}
          </h2>
          <p>Current review · version {rev.number}</p>
        </div>
        <button
          className="icon-button"
          aria-label="Close editor and keep draft"
          disabled={saving}
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </header>
      <form onSubmit={save}>
        <fieldset disabled={saving} className="rw-editor-fields">
          {editor.mode === "disposition" ? (
            <>
              <h3>{finding!.title}</h3>
              <p className="preserve-lines">{finding!.detail}</p>
              <div className="rw-request">
                <strong>Requested action</strong>
                <p>{finding!.request}</p>
              </div>
              <Field
                label={
                  editor.status === "resolved"
                    ? "What evidence addresses this finding?"
                    : editor.status === "dismissed"
                      ? "Why does this finding not apply?"
                      : "Why does it need another review?"
                }
              >
                <textarea
                  required
                  autoFocus
                  minLength={1}
                  rows={5}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <p className="small-muted">
                The disposition will reference current version {rev.number}.
                Inspect the material and sources beside this editor.
              </p>
            </>
          ) : (
            <>
              <div className="form-grid">
                <Field label="Type">
                  <select
                    value={data.kind}
                    onChange={(e) =>
                      set("kind", e.target.value as FindingInput["kind"])
                    }
                  >
                    <option value="correction">Correction</option>
                    <option value="evidence">Evidence request</option>
                    <option value="question">Specialist question</option>
                  </select>
                </Field>
                <Field label="Audience">
                  <select
                    value={data.audience || "internal"}
                    onChange={(e) => {
                      const audience = e.target.value as
                        "internal" | "submitter";
                      setData((old) => ({
                        ...old,
                        audience,
                        owner:
                          audience === "submitter"
                            ? review.submitter
                            : old.owner === review.submitter
                              ? review.owner
                              : old.owner,
                      }));
                    }}
                  >
                    <option value="internal">Internal</option>
                    <option value="submitter">Submitter</option>
                  </select>
                </Field>
              </div>
              <Field label="Finding">
                <input
                  required
                  autoFocus
                  maxLength={180}
                  value={data.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </Field>
              <Field label="Related material">
                <select
                  value={data.assetId}
                  onChange={(e) => {
                    const assetId = e.target.value;
                    setData((old) => ({
                      ...old,
                      assetId,
                      citations: assetId
                        ? [
                            {
                              revisionId: materialRevision.id,
                              assetId,
                              page:
                                review.assets.find((a) => a.id === assetId)
                                  ?.mime === "application/pdf"
                                  ? 1
                                  : undefined,
                            },
                          ]
                        : [],
                    }));
                  }}
                >
                  <option value="">Whole package / accompanying copy</option>
                  {materialRevision.components
                    .filter((c) => c.role !== "excluded")
                    .map((c) => (
                      <option value={c.assetId} key={c.assetId}>
                        v{materialRevision.number} ·{" "}
                        {review.assets.find((a) => a.id === c.assetId)?.name}
                      </option>
                    ))}
                </select>
              </Field>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setData((old) => ({
                    ...old,
                    assetId: location.assetId,
                    citations: location.assetId
                      ? [
                          {
                            revisionId: location.revisionId,
                            assetId: location.assetId,
                            page:
                              review.assets.find(
                                (a) => a.id === location.assetId,
                              )?.mime === "application/pdf"
                                ? location.page
                                : undefined,
                          },
                        ]
                      : [],
                  }))
                }
              >
                Use the file and page currently shown
              </button>
              <Field label="Location note · optional">
                <input
                  value={data.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Headline, fee disclosure…"
                />
              </Field>
              {data.citations?.[0]?.page && (
                <p className="small-muted">
                  Cited PDF page {data.citations[0].page} · version{" "}
                  {materialRevision.number}
                </p>
              )}
              <Field label="Observation and supporting basis · internal">
                <textarea
                  required
                  maxLength={4000}
                  rows={4}
                  value={data.detail}
                  onChange={(e) => set("detail", e.target.value)}
                />
              </Field>
              {source && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    set("sourceCitations", [
                      ...(data.sourceCitations || []).filter(
                        (c) =>
                          !(
                            c.offerId === source.offerId &&
                            c.assetId === source.assetId &&
                            c.page === source.page
                          ),
                      ),
                      source,
                    ])
                  }
                >
                  <Plus size={14} /> Attach the source page currently shown
                </button>
              )}
              {data.sourceCitations?.map((citation, i) => (
                <div className="rw-citation-chip" key={i}>
                  Source{citation.page ? ` · page ${citation.page}` : ""}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove source ${i + 1}`}
                    onClick={() =>
                      set(
                        "sourceCitations",
                        data.sourceCitations!.filter((_, index) => index !== i),
                      )
                    }
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <Field
                label={`Requested action${data.audience === "submitter" ? " · can be shared with submitter" : " · internal"}`}
              >
                <textarea
                  required
                  maxLength={3000}
                  rows={3}
                  value={data.request}
                  onChange={(e) => set("request", e.target.value)}
                />
              </Field>
              <Field label="Owner">
                <input
                  list="review-owner-options"
                  required
                  value={data.owner}
                  onChange={(e) => set("owner", e.target.value)}
                />
                <datalist id="review-owner-options">
                  <option value={review.submitter} />
                  {PARTICIPANTS.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </Field>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={data.material}
                  onChange={(e) => set("material", e.target.checked)}
                />
                <span>
                  Required before approval
                  <small>Leave unchecked for advice.</small>
                </span>
              </label>
            </>
          )}
          {changed && (
            <div className="rw-warning">
              The review has changed. Your draft has been kept.
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setBaseline(review.version);
                  setError("");
                }}
              >
                I checked the latest context
              </button>
            </div>
          )}
          <ErrorMessage error={error} />
        </fieldset>
        <footer className="rw-editor-footer">
          <button
            className="button primary"
            type="submit"
            disabled={saving || changed}
          >
            {saving
              ? "Saving…"
              : editor.mode === "new"
                ? "Add finding"
                : "Save"}
          </button>
          <button
            className="text-button"
            type="button"
            disabled={saving}
            onClick={onClose}
          >
            Keep draft
          </button>
          <button
            className="text-button"
            type="button"
            disabled={saving}
            onClick={() => {
              if (window.confirm("Discard this unfinished draft?")) {
                clearDrafts(key);
                onClose();
              }
            }}
          >
            Discard
          </button>
        </footer>
      </form>
    </section>
  );
}

function VersionComparison({
  review,
  offers,
  onFinding,
}: {
  review: ReviewCase;
  offers: Offer[];
  onFinding: (finding: Finding) => void;
}) {
  const current = currentRevision(review);
  const earlier = review.revisions.filter((r) => r.id !== current.id);
  const [previousId, setPreviousId] = useState(
    earlier.at(-1)?.id || current.id,
  );
  const previous =
    earlier.find((r) => r.id === previousId) || earlier.at(-1) || current;
  const [left, setLeft] = useState(() => revisionLocation(previous));
  const [right, setRight] = useState(() => revisionLocation(current));
  const changes = useMemo(() => {
    const list: {
      key: string;
      text: string;
      oldId?: string;
      newId?: string;
    }[] = [];
    const assetName = (id: string) =>
      review.assets.find((a) => a.id === id)?.name || "File";
    for (const component of current.components) {
      const old = previous.components.find(
        (c) => c.assetId === component.assetId,
      );
      const replacement =
        component.replacesAssetId &&
        previous.components.find(
          (c) => c.assetId === component.replacesAssetId,
        );
      if (replacement)
        list.push({
          key: component.assetId,
          text: `Replaced ${assetName(replacement.assetId)} with ${assetName(component.assetId)}`,
          oldId: replacement.assetId,
          newId: component.assetId,
        });
      else if (!old)
        list.push({
          key: component.assetId,
          text: `Added ${assetName(component.assetId)} · ${ROLE_LABELS[component.role]}`,
          newId: component.assetId,
        });
      else if (old.role !== component.role)
        list.push({
          key: component.assetId,
          text: `${assetName(component.assetId)}: ${ROLE_LABELS[old.role]} → ${ROLE_LABELS[component.role]}`,
          oldId: old.assetId,
          newId: component.assetId,
        });
    }
    for (const component of previous.components)
      if (
        !current.components.some(
          (c) =>
            c.assetId === component.assetId ||
            c.replacesAssetId === component.assetId,
        )
      )
        list.push({
          key: `removed-${component.assetId}`,
          text: `Removed from current package: ${assetName(component.assetId)}`,
          oldId: component.assetId,
        });
    const contextual: [string, string | undefined, string | undefined][] = [
      ["Accompanying copy", previous.copy, current.copy],
      ["Intended use", previous.intendedUse, current.intendedUse],
      ["Destination", previous.destinationUrl, current.destinationUrl],
      ["Offer reference", previous.offerId, current.offerId],
      [
        "Product",
        previous.product || review.product,
        current.product || review.product,
      ],
      [
        "Placement",
        previous.channel || review.channel,
        current.channel || review.channel,
      ],
      [
        "Target launch",
        previous.launchDate || review.launchDate,
        current.launchDate || review.launchDate,
      ],
    ];
    for (const [label, oldValue, newValue] of contextual)
      if (oldValue !== newValue)
        list.push({ key: label, text: `${label} changed` });
    return list;
  }, [previous, current, review.assets]);
  useEffect(() => {
    const first = changes.find((change) => change.oldId && change.newId);
    setLeft({
      ...revisionLocation(previous),
      ...(first?.oldId ? { assetId: first.oldId } : {}),
    });
    setRight({
      ...revisionLocation(current),
      ...(first?.newId ? { assetId: first.newId } : {}),
    });
  }, [previous.id, current.id]);
  if (!earlier.length)
    return (
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Version 1</h2>
            <p>No earlier version to compare.</p>
          </div>
        </header>
        <PackageMaterial
          review={review}
          revision={current}
          location={right}
          onLocation={setRight}
        />
      </section>
    );
  return (
    <div className="rw-comparison">
      <div className="rw-comparison-heading">
        <div>
          <h2>Compare versions</h2>
          <p>A new version does not resolve a finding.</p>
        </div>
        <label>
          Earlier version
          <select
            value={previous.id}
            onChange={(e) => setPreviousId(e.target.value)}
          >
            {earlier.map((r) => (
              <option key={r.id} value={r.id}>
                Version {r.number}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section className="rw-change-list">
        <h3>Changes in version {current.number}</h3>
        {changes.length ? (
          <ul>
            {changes.map((change) => (
              <li key={change.key}>
                {change.oldId || change.newId ? (
                  <button
                    className="text-button"
                    onClick={() => {
                      if (change.oldId)
                        setLeft({
                          ...left,
                          assetId: change.oldId,
                          page: 1,
                          zoom: 100,
                        });
                      if (change.newId)
                        setRight({
                          ...right,
                          assetId: change.newId,
                          page: 1,
                          zoom: 100,
                        });
                    }}
                  >
                    {change.text}
                  </button>
                ) : (
                  change.text
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No file or recorded context changes.</p>
        )}
        <p className="small-muted">
          Explicit replacements and retained files are paired. Choose files
          manually where no replacement was recorded.
        </p>
      </section>
      <div className="rw-compare-grid">
        {[
          {
            revision: previous,
            location: left,
            setLocation: setLeft,
            label: "Earlier",
          },
          {
            revision: current,
            location: right,
            setLocation: setRight,
            label: "Current",
          },
        ].map(({ revision, location: loc, setLocation, label }) => (
          <section key={label} className="panel">
            <header className="panel-header">
              <div>
                <h2>
                  {label} · version {revision.number}
                </h2>
                <p>
                  {dateTime(revision.createdAt)} · {revision.submittedBy}
                </p>
              </div>
            </header>
            <PackageMaterial
              review={review}
              revision={revision}
              location={loc}
              onLocation={(value) => {
                setLocation(value);
                if (value.assetId !== loc.assetId) {
                  const counterpart =
                    label === "Earlier"
                      ? current.components.find(
                          (c) =>
                            c.assetId === value.assetId ||
                            c.replacesAssetId === value.assetId,
                        )?.assetId
                      : previous.components.find(
                          (c) =>
                            c.assetId ===
                            (current.components.find(
                              (c) => c.assetId === value.assetId,
                            )?.replacesAssetId || value.assetId),
                        )?.assetId;
                  if (counterpart)
                    (label === "Earlier" ? setRight : setLeft)((old) => ({
                      ...old,
                      assetId: counterpart,
                      page: 1,
                      zoom: 100,
                    }));
                }
              }}
              compact
            />
            <div className="rw-material-context">
              <h3>Review context</h3>
              <p>
                {offers.find((o) => o.id === revision.offerId)?.name ||
                  "No offer reference"}
              </p>
              <p>{revision.intendedUse || "No intended use supplied"}</p>
              <p>
                {revision.channel || review.channel} ·{" "}
                {revision.launchDate || review.launchDate
                  ? date(revision.launchDate || review.launchDate)
                  : "No launch date"}
              </p>
              <h3>Revision note</h3>
              <p>{revision.summary || "No note supplied"}</p>
            </div>
          </section>
        ))}
      </div>
      <section className="panel rw-comparison-findings">
        <header className="panel-header">
          <h2>Findings to review</h2>
        </header>
        {review.findings
          .filter((f) => f.status === "open" || f.needsRecheck)
          .map((f) => (
            <div className="rw-comparison-finding" key={f.id}>
              <div>
                <strong>
                  F{f.number} · {f.title}
                </strong>
                <p>{f.request}</p>
                <span>
                  {f.needsRecheck ? "Recheck required" : "Open"} · {f.owner}
                </span>
              </div>
              <button className="button secondary" onClick={() => onFinding(f)}>
                Review finding <ArrowRight size={14} />
              </button>
            </div>
          ))}
      </section>
    </div>
  );
}

function DecisionView({
  review,
  decision,
  saving,
  onAction,
  onReply,
  offers,
}: {
  review: ReviewCase;
  decision: Decision;
  saving: boolean;
  onAction: ReviewWorkspaceProps["onAction"];
  onReply: () => void;
  offers: Offer[];
}) {
  const revision = review.revisions.find((r) => r.id === decision.revisionId)!;
  const [location, setLocation] = useState(() => revisionLocation(revision));
  const [reason, setReason] = useDraftState(
    `review/${review.id}/withdraw/${decision.id}`,
    "",
  );
  const [error, setError] = useState("");
  const [sourceCitation, setSourceCitation] = useState<SourceCitation | null>(
    null,
  );
  const sourceOffer =
    sourceCitation?.offerId === decision.offerSnapshot?.id
      ? decision.offerSnapshot
      : offers.find((o) => o.id === sourceCitation?.offerId);
  const sourceAsset = sourceOffer?.assets?.find(
    (a) => a.id === sourceCitation?.assetId,
  );
  useEffect(() => setLocation(revisionLocation(revision)), [decision.id]);
  const displayedRevision =
    review.revisions.find((r) => r.id === location.revisionId) || revision;
  const isCurrent = currentRevision(review).id === decision.revisionId;
  return (
    <div className="rw-decision-record">
      <section
        className={`rw-record-heading ${decision.withdrawn ? "withdrawn" : ""}`}
      >
        <div>
          <p className="eyebrow">
            RECORDED DECISION · VERSION {revision.number}
            {!isCurrent ? " · HISTORICAL" : ""}
          </p>
          <h2>
            {decision.withdrawn
              ? "Approval withdrawn"
              : decision.outcome === "approved"
                ? "Approved for the stated use"
                : "Rejected"}
          </h2>
          <p>{decision.scope}</p>
          <small>
            {decision.reviewer} · {dateTime(decision.createdAt)}
          </small>
        </div>
        {isCurrent && !decision.withdrawn && (
          <button className="button secondary" onClick={onReply}>
            Prepare result
          </button>
        )}
      </section>
      {decision.withdrawn && (
        <div className="rw-warning">
          <strong>
            Withdrawn {dateTime(decision.withdrawn.at)} by{" "}
            {decision.withdrawn.by}
          </strong>
          <p>{decision.withdrawn.reason}</p>
        </div>
      )}
      <div className="rw-grid">
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>
                {displayedRevision.id === revision.id
                  ? "Reviewed package"
                  : "Cited material"}{" "}
                · version {displayedRevision.number}
              </h2>
              {displayedRevision.id !== revision.id && (
                <button
                  className="text-button"
                  onClick={() => setLocation(revisionLocation(revision))}
                >
                  Return to approved package
                </button>
              )}
            </div>
          </header>
          <PackageMaterial
            review={review}
            revision={displayedRevision}
            location={location}
            onLocation={setLocation}
          />
        </section>
        <aside className="rw-working">
          <section className="panel rw-record-basis">
            <h3>Recorded rationale</h3>
            <p className="preserve-lines">
              {decision.rationale ||
                "This older record has no recorded rationale."}
            </p>
          </section>
          <OfferFacts
            offer={decision.offerSnapshot}
            intendedUse={revision.intendedUse}
            onSource={setSourceCitation}
          />
          {sourceCitation && sourceAsset && (
            <section className="panel">
              <header className="panel-header">
                <div>
                  <h2>Recorded source</h2>
                  <p>
                    {sourceOffer?.name} · {sourceOffer?.version}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Close recorded source"
                  onClick={() => setSourceCitation(null)}
                >
                  <X size={16} />
                </button>
              </header>
              <AssetViewer
                caseId={review.id}
                asset={sourceAsset}
                page={sourceCitation.page || 1}
                onPageChange={(page) =>
                  setSourceCitation({ ...sourceCitation, page })
                }
                sourceUrl={offerAssetUrl(
                  sourceCitation.offerId,
                  sourceCitation.assetId,
                )}
                downloadUrl={offerAssetUrl(
                  sourceCitation.offerId,
                  sourceCitation.assetId,
                  true,
                )}
              />
            </section>
          )}
          <section className="panel rw-findings">
            <header className="panel-header">
              <h2>Findings at the time of decision</h2>
            </header>
            {decision.findingSnapshot ? (
              decision.findingSnapshot.length ? (
                decision.findingSnapshot.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    currentNumber={revision.number}
                    review={{ ...review, status: "approved" }}
                    onJump={(citation) =>
                      setLocation({
                        ...citation,
                        page: citation.page || 1,
                        zoom: 100,
                      })
                    }
                    onSource={setSourceCitation}
                  />
                ))
              ) : (
                <p className="rw-no-record">No findings were recorded.</p>
              )
            ) : (
              <p className="rw-no-record">
                This older decision has no finding snapshot. Current findings
                are not substituted.
              </p>
            )}
          </section>
        </aside>
      </div>
      {decision.outcome === "approved" && !decision.withdrawn && (
        <details className="panel rw-withdraw">
          <summary>Withdraw this approval</summary>
          <p>
            This preserves the original decision. It does not confirm that
            published marketing was taken down.
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await onAction({
                  type: "withdraw_approval",
                  decisionId: decision.id,
                  reason,
                })
              ) {
                clearDrafts(`review/${review.id}/withdraw/${decision.id}`);
                setReason("");
                setError("");
              } else
                setError("Withdrawal was not saved. Your reason is retained.");
            }}
          >
            <Field label="Reason">
              <textarea
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
              />
            </Field>
            <ErrorMessage error={error} />
            <button className="button secondary" disabled={saving}>
              Withdraw approval
            </button>
          </form>
        </details>
      )}
    </div>
  );
}

function Activity({
  review,
  onAction,
  saving,
  onDecision,
}: {
  review: ReviewCase;
  onAction: ReviewWorkspaceProps["onAction"];
  saving: boolean;
  onDecision: (decision: Decision) => void;
}) {
  const [note, setNote] = useDraftState(`review/${review.id}/note`, "");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setExporting(true);
    setError("");
    try {
      const response = await fetch(`/api/cases/${review.id}/export`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Download failed");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${review.reference}-review-record.zip`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="rw-activity-grid">
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Review history</h2>
            <p>Full dates and recorded actors</p>
          </div>
          <button
            className="button secondary"
            disabled={exporting}
            onClick={download}
          >
            <ArrowDownToLine size={15} />{" "}
            {exporting ? "Downloading…" : "Download internal record"}
          </button>
        </header>
        <p className="rw-export-note">
          Includes internal reasoning and all preserved originals. Not a
          submitter-facing packet.
        </p>
        <ErrorMessage error={error} />
        {review.decisions.length > 0 && (
          <section className="rw-decision-list">
            <h3>Decisions</h3>
            {[...review.decisions].reverse().map((decision) => (
              <button
                className="rw-decision-link"
                key={decision.id}
                onClick={() => onDecision(decision)}
              >
                <span>
                  <strong>
                    {decision.withdrawn
                      ? "Withdrawn approval"
                      : decision.outcome}{" "}
                    · version{" "}
                    {
                      review.revisions.find((r) => r.id === decision.revisionId)
                        ?.number
                    }
                  </strong>
                  <span>{decision.scope}</span>
                  <small>
                    {decision.reviewer} · {dateTime(decision.createdAt)}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </section>
        )}
        <ol className="rw-timeline">
          {[...review.history].reverse().map((event) => (
            <li key={event.id}>
              <History size={15} />
              <div>
                <strong>{event.text}</strong>
                <span>
                  {event.actor} · {dateTime(event.createdAt)} · v
                  {review.revisions.find((r) => r.id === event.revisionId)
                    ?.number || "—"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="panel rw-notes">
        <header className="panel-header">
          <h2>Internal notes</h2>
        </header>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onAction({ type: "add_note", text: note })) {
              clearDrafts(`review/${review.id}/note`);
              setNote("");
            }
          }}
        >
          <Field label="Note">
            <textarea
              required
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <button
            className="button secondary"
            disabled={saving || !note.trim()}
          >
            Save note
          </button>
        </form>
        {[...review.notes].reverse().map((entry) => (
          <article key={entry.id}>
            <strong>{entry.author}</strong>
            <small>{dateTime(entry.createdAt)}</small>
            <p className="preserve-lines">{entry.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function ReplyHistory({
  review,
  onDialog,
}: {
  review: ReviewCase;
  onDialog: (dialog: ReviewDialog) => void;
}) {
  const rev = currentRevision(review);
  return (
    <div className="rw-replies">
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Reply drafts</h2>
            <p>Saving or copying does not record delivery.</p>
          </div>
          <button className="button primary" onClick={() => onDialog("draft")}>
            <Plus size={15} /> Prepare reply
          </button>
        </header>
        {review.drafts.length ? (
          [...review.drafts].reverse().map((draft) => (
            <article className="rw-draft" key={draft.id}>
              <div className="rw-draft-title">
                <div>
                  <span className="prepared-badge">
                    {draft.revisionId === rev.id ? "Prepared" : "Historical"}
                  </span>
                  <small>
                    v
                    {
                      review.revisions.find((r) => r.id === draft.revisionId)
                        ?.number
                    }{" "}
                    · {dateTime(draft.updatedAt || draft.createdAt)}
                  </small>
                  <h3>{draft.subject}</h3>
                </div>
                <button
                  className="button secondary"
                  onClick={() => onDialog({ draftId: draft.id })}
                >
                  {draft.revisionId === rev.id
                    ? "Open draft"
                    : "View / reuse draft"}
                </button>
              </div>
              <p className="preserve-lines">{draft.body}</p>
            </article>
          ))
        ) : (
          <Empty title="No reply drafts">
            Prepare a message from selected findings or the recorded decision.
          </Empty>
        )}
      </section>
      <section className="panel">
        <header className="panel-header">
          <h2>Shared feedback & responses</h2>
        </header>
        {!review.publishedFeedback?.length &&
          !review.publishedResults?.length &&
          !review.responses?.length && (
            <p className="rw-no-record">
              No feedback or result has been shared through the submission page.
            </p>
          )}
        {[...(review.publishedFeedback || [])].reverse().map((feedback) => (
          <article className="rw-draft" key={feedback.id}>
            <span className="prepared-badge">Shared with submitter</span>
            <small>
              v
              {
                review.revisions.find((r) => r.id === feedback.revisionId)
                  ?.number
              }{" "}
              · {dateTime(feedback.createdAt)}
            </small>
            <h3>{feedback.subject}</h3>
            <p className="preserve-lines">{feedback.body}</p>
            <ul>
              {feedback.findings.map((f) => (
                <li key={f.id}>
                  F{f.number} · {f.title} · {f.material ? "Required" : "Advice"}
                </li>
              ))}
            </ul>
          </article>
        ))}
        {[...(review.publishedResults || [])].reverse().map((result) => (
          <article className="rw-draft" key={result.id}>
            <strong>
              {result.withdrawn
                ? "Withdrawn result"
                : `Shared result · ${result.outcome}`}
            </strong>
            <small>
              v
              {review.revisions.find((r) => r.id === result.revisionId)?.number}{" "}
              · {dateTime(result.createdAt)}
            </small>
            <p>{result.scope}</p>
            <p className="preserve-lines">{result.message}</p>
          </article>
        ))}
        {[...(review.responses || [])].reverse().map((response) => (
          <article className="rw-draft" key={response.id}>
            <strong>
              {response.author} ·{" "}
              {response.audience === "internal"
                ? "Internal response"
                : "Submitter response"}
            </strong>
            <small>{dateTime(response.createdAt)}</small>
            <p className="preserve-lines">{response.text}</p>
            {response.findingIds.length > 0 && (
              <p className="small-muted">
                Responds to{" "}
                {response.findingIds
                  .map(
                    (id) =>
                      `F${review.findings.find((f) => f.id === id)?.number || "?"}`,
                  )
                  .join(", ")}
                . Findings require reviewer disposition.
              </p>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <header className="panel-header">
          <h2>Recorded external communication</h2>
          <button
            className="button secondary"
            onClick={() => onDialog("communication")}
          >
            Record communication
          </button>
        </header>
        {review.communications?.length ? (
          [...review.communications].reverse().map((record) => (
            <article className="rw-draft" key={record.id}>
              <strong>
                {record.recipient} · {record.channel}
              </strong>
              <small>
                {dateTime(record.occurredAt)} · recorded by {record.actor}
              </small>
              <p>{record.note || "No additional note"}</p>
            </article>
          ))
        ) : (
          <p className="rw-no-record">
            No external communication has been recorded. A manual record is not
            delivery confirmation.
          </p>
        )}
      </section>
    </div>
  );
}

function CaseDetails({
  review,
  participants,
  reviewerName,
  saving,
  onAction,
  copied,
  onCopied,
}: {
  review: ReviewCase;
  participants: Participant[];
  reviewerName?: string;
  saving: boolean;
  onAction: ReviewWorkspaceProps["onAction"];
  copied: boolean;
  onCopied: () => void;
}) {
  const [contact, setContact] = useDraftState(`review/${review.id}/contact`, {
    title: review.title,
    submitter: review.submitter,
    submitterEmail: review.submitterEmail,
    reason: "",
  });
  const [cancelReason, setCancelReason] = useDraftState(
    `review/${review.id}/cancel`,
    "",
  );
  const [response, setResponse] = useDraftState(
    `review/${review.id}/response`,
    { text: "", findingIds: [] as string[] },
  );
  const [error, setError] = useState("");
  const link = review.submitterToken
    ? `${window.location.origin}/submit/${review.submitterToken}`
    : "";
  return (
    <div className="rw-details-grid">
      <section className="panel rw-details-panel">
        <h2>People & submission link</h2>
        <Field label="Accountable reviewer">
          <select
            disabled={saving || closed(review)}
            value={participants.find((p) => p.name === review.owner)?.id || ""}
            onChange={(event) =>
              onAction({ type: "assign_owner", ownerId: event.target.value })
            }
          >
            {!participants.some((p) => p.name === review.owner) && (
              <option value="">{review.owner}</option>
            )}
            {participants
              .filter((p) => p.role === "reviewer")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <p className="small-muted">
          Current demo identity: {reviewerName || "Maya Chen"}. Names identify
          simulated participants.
        </p>
        <h3>Submitter return link</h3>
        <p>
          The submitter sees only their material and deliberately shared
          feedback.
        </p>
        {link ? (
          <>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="rw-return-link"
            >
              Open submission page <ArrowRight size={14} />
            </a>
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  onCopied();
                } catch {
                  setError(
                    "Copy is unavailable. Open the submission page and copy its address.",
                  );
                }
              }}
            >
              <Copy size={15} />
              {copied ? "Copied" : "Copy return link"}
            </button>
            <button
              className="text-button"
              disabled={saving}
              onClick={() => {
                if (
                  window.confirm(
                    "Replace this return link? The previous link will stop working.",
                  )
                )
                  void onAction({ type: "rotate_submitter_link" });
              }}
            >
              Replace link
            </button>
          </>
        ) : (
          <button
            className="button secondary"
            disabled={saving}
            onClick={() => onAction({ type: "create_submitter_link" })}
          >
            Create return link
          </button>
        )}
        <ErrorMessage error={error} />
      </section>
      <section className="panel rw-details-panel">
        <h2>Correct title or contact details</h2>
        <p>
          Changes are recorded. Product, placement, launch, and intended use
          belong in a revision.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onAction({ type: "correct_contact", ...contact }))
              clearDrafts(`review/${review.id}/contact`);
          }}
        >
          <Field label="Title">
            <input
              required
              value={contact.title}
              onChange={(e) =>
                setContact((old) => ({ ...old, title: e.target.value }))
              }
            />
          </Field>
          <Field label="Submitter">
            <input
              required
              value={contact.submitter}
              onChange={(e) =>
                setContact((old) => ({ ...old, submitter: e.target.value }))
              }
            />
          </Field>
          <Field label="Email">
            <input
              required
              type="email"
              value={contact.submitterEmail}
              onChange={(e) =>
                setContact((old) => ({
                  ...old,
                  submitterEmail: e.target.value,
                }))
              }
            />
          </Field>
          <Field label="Reason for correction">
            <textarea
              required
              value={contact.reason}
              onChange={(e) =>
                setContact((old) => ({ ...old, reason: e.target.value }))
              }
              rows={2}
            />
          </Field>
          <button className="button secondary" disabled={saving}>
            Save correction
          </button>
        </form>
      </section>
      <section className="panel rw-details-panel">
        <h2>Internal specialist response</h2>
        <p>
          Record an answer to internal requests. The reviewer still resolves
          each finding.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onAction({ type: "add_response", ...response })) {
              clearDrafts(`review/${review.id}/response`);
              setResponse({ text: "", findingIds: [] });
            }
          }}
        >
          {review.findings
            .filter(
              (f) =>
                f.audience !== "submitter" &&
                (f.status === "open" || f.needsRecheck),
            )
            .map((f) => (
              <label className="check-line" key={f.id}>
                <input
                  type="checkbox"
                  checked={response.findingIds.includes(f.id)}
                  onChange={(e) =>
                    setResponse((old) => ({
                      ...old,
                      findingIds: e.target.checked
                        ? [...old.findingIds, f.id]
                        : old.findingIds.filter((id) => id !== f.id),
                    }))
                  }
                />
                <span>
                  F{f.number} · {f.title}
                </span>
              </label>
            ))}
          <Field label="Response">
            <textarea
              required
              rows={4}
              value={response.text}
              onChange={(e) =>
                setResponse((old) => ({ ...old, text: e.target.value }))
              }
            />
          </Field>
          <button
            className="button secondary"
            disabled={saving || closed(review)}
          >
            Record internal response
          </button>
        </form>
      </section>
      <section className="panel rw-details-panel">
        <h2>Cancel review</h2>
        {review.cancelled ? (
          <p>
            {review.cancelled.reason} · {dateTime(review.cancelled.at)}
          </p>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (await onAction({ type: "cancel", reason: cancelReason })) {
                clearDrafts(`review/${review.id}/cancel`);
                setCancelReason("");
              }
            }}
          >
            <p>
              Preserves the package and history. If an approval is no longer
              valid, withdraw it from its decision record first.
            </p>
            <Field label="Reason">
              <textarea
                required
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </Field>
            <button
              className="button secondary"
              disabled={saving || review.status === "approved"}
            >
              Cancel review
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
