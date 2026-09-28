import { useState } from "react";
import {
  currentRevision,
  type Finding,
  type ReviewCase,
} from "../shared/types";
import { type ActionInput } from "./forms";
import { ErrorMessage } from "./components";
import { clearDrafts, useDraftState } from "./drafts";
import { ResponseThread } from "./ResponseThread";

export function currentFindingAsset(review: ReviewCase, finding: Finding) {
  let assetId = finding.citations?.[0]?.assetId || finding.assetId;
  const originalRevision =
    finding.citations?.[0]?.revisionId || finding.revisionId;
  const start = review.revisions.findIndex((r) => r.id === originalRevision);
  for (const revision of review.revisions.slice(Math.max(0, start + 1))) {
    const replacement = revision.components.find(
      (c) => c.replacesAssetId === assetId,
    );
    if (replacement) assetId = replacement.assetId;
  }
  return currentRevision(review).components.find(
    (c) => c.assetId === assetId && c.role !== "excluded",
  );
}

export function FindingReview({
  review,
  finding,
  saving,
  reviewerName,
  onAction,
  onEvidence,
  onOriginal,
  onCurrent,
  onDisposition,
  onClose,
}: {
  review: ReviewCase;
  finding: Finding;
  saving: boolean;
  reviewerName: string;
  onAction: (action: ActionInput) => Promise<boolean>;
  onEvidence: (assetId: string) => void;
  onOriginal: () => void;
  onCurrent: () => void;
  onDisposition: (status: Finding["status"]) => void;
  onClose: () => void;
}) {
  const rev = currentRevision(review);
  const responses = (review.responses || []).filter((r) =>
    r.findingIds.includes(finding.id),
  );
  const key = `finding-answer/${review.id}/${finding.id}/${reviewerName}`;
  const [answer, setAnswer] = useDraftState(key, "");
  const [error, setError] = useState("");
  const isClosed = ["approved", "rejected", "cancelled"].includes(
    review.status,
  );
  const original = finding.citations?.[0];
  const originalRevision = review.revisions.find(
    (r) => r.id === (original?.revisionId || finding.revisionId),
  );
  return (
    <section
      className="panel rw-assessment"
      id="finding-assessment"
      tabIndex={-1}
    >
      <header className="panel-header">
        <div>
          <h2>
            Assess F{finding.number} · {finding.title}
          </h2>
          <p>
            Current package: version {rev.number}. An answer does not resolve
            the finding.
          </p>
        </div>
        <button type="button" className="text-button" onClick={onClose}>
          Close assessment
        </button>
      </header>
      <div className="rw-assessment-body">
        <div className="rw-request">
          <strong>
            Original concern · version {originalRevision?.number || "?"}
          </strong>
          <p>{finding.detail}</p>
          <strong>Requested action</strong>
          <p>{finding.request}</p>
        </div>
        <div className="rw-finding-buttons">
          <button
            type="button"
            className="button secondary"
            onClick={onOriginal}
          >
            Compare original material
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={onCurrent}
          >
            Show current material
          </button>
        </div>
        {!currentFindingAsset(review, finding) && finding.assetId && (
          <p className="rw-warning">
            The original attachment has no retained file or explicit replacement
            in this package. Check the current material before deciding whether
            the concern still applies.
          </p>
        )}
        {originalRevision && originalRevision.copy !== rev.copy && (
          <details>
            <summary>Accompanying copy changed</summary>
            <strong>Original copy · v{originalRevision.number}</strong>
            <p className="preserve-lines">{originalRevision.copy || "None"}</p>
            <strong>Current copy · v{rev.number}</strong>
            <p className="preserve-lines">{rev.copy || "None"}</p>
          </details>
        )}
        <h3>Answers and evidence</h3>
        {responses.length ? (
          <ResponseThread
            review={review}
            responses={responses}
            onEvidence={onEvidence}
            onAction={onAction}
            saving={saving}
            reviewerName={reviewerName}
          />
        ) : (
          <p className="small-muted">
            No response is linked to this finding yet.
          </p>
        )}
        {!isClosed && (
          <details>
            <summary>Add an internal answer</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                if (
                  await onAction({
                    type: "add_response",
                    findingIds: [finding.id],
                    text: answer,
                  })
                ) {
                  setAnswer("");
                  clearDrafts(key);
                } else
                  setError("The answer was not saved. Your text is retained.");
              }}
            >
              <label className="field">
                <span>Answer as {reviewerName}</span>
                <textarea
                  required
                  rows={3}
                  maxLength={5000}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </label>
              <ErrorMessage error={error} />
              <button className="button secondary" disabled={saving}>
                Save internal answer
              </button>
            </form>
          </details>
        )}
        {!isClosed && (
          <div className="rw-finding-buttons">
            <button
              type="button"
              className="button secondary"
              disabled={saving}
              onClick={() => onDisposition("resolved")}
            >
              Resolve finding
            </button>
            <button
              type="button"
              className="text-button"
              disabled={saving}
              onClick={() => onDisposition("dismissed")}
            >
              Dismiss finding
            </button>
            <button
              type="button"
              className="text-button"
              disabled={saving}
              onClick={onClose}
            >
              Return without changing status
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
