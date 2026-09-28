import { FileText } from "lucide-react";
import {
  assetUrl,
  type ReviewCase,
  type SubmissionResponse,
} from "../shared/types";
import { dateTime } from "./components";

/** A response is evidence received, not a replacement advertising package. */
export function ResponseThread({
  review,
  responses,
  onEvidence,
}: {
  review: ReviewCase;
  responses: SubmissionResponse[];
  onEvidence: (assetId: string) => void;
}) {
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
