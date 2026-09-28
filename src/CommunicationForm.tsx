import { useState } from "react";
import { Modal, ErrorMessage } from "./components";
import { Field, type ActionInput } from "./forms";
import type { ReviewCase } from "../shared/types";

export function CommunicationForm({
  review,
  onAction,
  onClose,
}: {
  review: ReviewCase;
  onAction: (action: ActionInput) => Promise<void>;
  onClose: () => void;
}) {
  const messages = [
    ...review.drafts.flatMap((d) => [
      ...(d.previousVersions || []).map((v) => ({
        id: d.id,
        version: v.version,
        label: `Earlier draft: ${v.subject} · revision ${review.revisions.find((r) => r.id === d.revisionId)?.number} · message version ${v.version}`,
        body: v.body,
        decisionId: v.decisionId,
      })),
      {
        id: d.id,
        version: d.version || 1,
        label: `Draft: ${d.subject} · revision ${review.revisions.find((r) => r.id === d.revisionId)?.number} · message version ${d.version || 1}`,
        body: d.body,
        decisionId: d.decisionId,
      },
    ]),
    ...(review.publishedFeedback || []).map((f) => ({
      id: f.id,
      version: 1,
      label: `Shared feedback: ${f.subject}`,
      body: f.body,
      decisionId: undefined,
    })),
    ...(review.publishedResults || []).map((r) => ({
      id: r.id,
      version: 1,
      label: `Shared result: ${r.outcome} · revision ${review.revisions.find((v) => v.id === r.revisionId)?.number}`,
      body: r.message,
      decisionId: r.decisionId,
    })),
  ];
  const keyFor = (message: { id: string; version: number }) =>
    `${message.id}:${message.version}`;
  const [messageKey, setMessageKey] = useState(
    messages.length ? keyFor(messages.at(-1)!) : "",
  );
  const [recipient, setRecipient] = useState(
    review.submitterEmail || review.submitter,
  );
  const [channel, setChannel] = useState("Email");
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const message = messages.find((m) => keyFor(m) === messageKey);
  return (
    <Modal
      title="Record outside communication"
      description="Record a message you already communicated outside this app. This does not send it or verify delivery."
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!message) return;
          setBusy(true);
          setError("");
          try {
            await onAction({
              type: "record_communication",
              messageId: message.id,
              messageVersion: message.version,
              recipient,
              channel,
              occurredAt: new Date(occurredAt).toISOString(),
              note,
            });
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-body">
          {!messages.length && (
            <p>
              Save a reply or share feedback first so this record can identify
              the exact message.
            </p>
          )}
          <Field label="Message">
            <select
              required
              value={messageKey}
              onChange={(e) => setMessageKey(e.target.value)}
            >
              {!message && (
                <option value="">Choose an exact message version</option>
              )}
              {messages.map((m) => (
                <option key={keyFor(m)} value={keyFor(m)}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          {message && (
            <p className="small-muted">
              {message.decisionId
                ? "This exact message is linked to a recorded decision. Recording its outside communication completes that handoff; delivery is not verified."
                : "This message is not linked to a decision. Recording it will not complete a pending decision handoff."}
            </p>
          )}
          {message && (
            <details>
              <summary>Message text</summary>
              <p className="preserve-lines">
                {message.body || "Decision scope and reviewed material."}
              </p>
            </details>
          )}
          <Field label="Recipient">
            <input
              required
              maxLength={200}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </Field>
          <div className="form-grid">
            <Field label="Channel">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                {["Email", "Phone", "Other"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="When communicated">
              <input
                type="datetime-local"
                required
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Record note · optional">
            <textarea
              maxLength={2000}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <ErrorMessage error={error} />
        </div>
        <footer className="modal-footer">
          <button
            type="button"
            disabled={busy}
            className="button secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy || !message}>
            Record communication
          </button>
        </footer>
      </form>
    </Modal>
  );
}
