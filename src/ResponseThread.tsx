import { FileText } from "lucide-react";
import { useState } from "react";
import {
  assetUrl,
  currentRevision,
  PARTICIPANTS,
  type ReviewCase,
  type SubmissionResponse,
} from "../shared/types";
import { dateTime, ErrorMessage } from "./components";
import type { ActionInput } from "./forms";

/** A response is evidence received, not a replacement advertising package. */
export function ResponseThread({
  review,
  responses,
  onEvidence,
  onAction,
  saving = false,
  reviewerName,
}: {
  review: ReviewCase;
  responses: SubmissionResponse[];
  onEvidence: (assetId: string) => void;
  onAction?: (action: ActionInput) => Promise<boolean>;
  saving?: boolean;
  reviewerName?: string;
}) {
  const [assessing, setAssessing] = useState("");
  const [note, setNote] = useState("");
  const [sharedMessage, setSharedMessage] = useState("");
  const [error, setError] = useState("");
  const canAssess = PARTICIPANTS.some(
    (p) => p.name === reviewerName && p.role === "reviewer",
  );
  return (
    <div className="rw-response-thread">
      {responses.map((response) => (
        <article className="rw-response" key={response.id}>
          <strong>
            {response.author} ·{" "}
            {response.audience === "internal"
              ? "Internal response"
              : "Submitter response"}
          </strong>
          <small>
            {dateTime(response.createdAt)} · received against version{" "}
            {review.revisions.find((r) => r.id === response.revisionId)
              ?.number || "?"}
          </small>
          <p className="preserve-lines">{response.text}</p>
          <p className="small-muted">
            {response.assessment
              ? `Reviewed by ${response.assessment.by} · ${dateTime(response.assessment.at)}`
              : "Response received · needs reviewer assessment"}
          </p>
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
          {response.sharedAcknowledgment && (
            <p className="small-muted">
              Shared acknowledgment: {response.sharedAcknowledgment.message}
            </p>
          )}
          {!response.assessment &&
            onAction &&
            canAssess &&
            (assessing === response.id ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  if (
                    await onAction({
                      type: "assess_response",
                      responseId: response.id,
                      note,
                      ...(sharedMessage.trim()
                        ? { sharedMessage: sharedMessage.trim() }
                        : {}),
                    })
                  ) {
                    setAssessing("");
                    setNote("");
                    setSharedMessage("");
                  } else
                    setError(
                      "Could not record assessment. Your notes are retained.",
                    );
                }}
              >
                <label className="field">
                  <span>Assessment note · internal, optional</span>
                  <textarea
                    rows={2}
                    maxLength={3000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                {response.audience === "submitter" && (
                  <label className="field">
                    <span>Acknowledgment to share · optional</span>
                    <textarea
                      rows={2}
                      maxLength={2000}
                      value={sharedMessage}
                      onChange={(e) => setSharedMessage(e.target.value)}
                      placeholder="Leave blank to keep this assessment internal."
                    />
                  </label>
                )}
                <p className="small-muted">
                  This records that you assessed the response. Resolve or
                  dismiss findings separately; any acknowledgment entered above
                  is shared with the submitter.
                </p>
                {review.decisions.some(
                  (decision) =>
                    decision.outcome === "approved" &&
                    !decision.withdrawn &&
                    decision.revisionId === currentRevision(review).id,
                ) && (
                  <p className="rw-warning">
                    An approval is already recorded. Check whether this response
                    changes its basis or scope. If it does, withdraw approval
                    from the decision record and resume review before sharing it
                    again.
                  </p>
                )}
                <ErrorMessage error={error} />
                <button className="button secondary" disabled={saving}>
                  Record response assessment
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={saving}
                  onClick={() => setAssessing("")}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="text-button"
                disabled={saving}
                onClick={() => {
                  setAssessing(response.id);
                  setNote("");
                  setSharedMessage("");
                }}
              >
                Mark response reviewed
              </button>
            ))}
          {response.assetIds.length > 0 && (
            <div
              className="rw-response-files"
              aria-label="Response attachments"
            >
              {response.assetIds.map((id) => {
                const asset = review.assets.find((a) => a.id === id);
                return (
                  <div key={id}>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onEvidence(id)}
                    >
                      <FileText size={14} />
                      Open {asset?.name || "attachment"} beside material
                    </button>
                    <a
                      className="text-button"
                      href={assetUrl(review.id, id, true)}
                    >
                      Download {asset?.name || "attachment"}
                    </a>
                  </div>
                );
              })}
              <small>
                Received as evidence. These files do not change the advertising
                package.
              </small>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
