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
  CheckCircle2,
  FileUp,
  FolderOpen,
  LoaderCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { api, ApiError, multipart } from "./api";
import { clearDrafts, useDraftState } from "./drafts";
import { usePackageDraft, type DraftChoice } from "./submitter-drafts";
import { bytes, dateTime, ErrorMessage, Modal } from "./components";
import {
  currentRevision,
  assetUrl,
  openBlockers,
  pendingResponses,
  requestSharingState,
  PRODUCT_LABELS,
  REVIEWER,
  ROLE_LABELS,
  type AssetRole,
  type CaseAction,
  type Offer,
  type Product,
  type ReviewCase,
  type RevisionInput,
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
  type Fields = {
    title: string;
    product: Product;
    submitter: string;
    submitterEmail: string;
    channel: string;
    launchDate: string;
    submittedBy: string;
    summary: string;
    offerId: string;
    intendedUse: string;
    copy: string;
    destinationUrl: string;
    advertisedOffer: string;
    applicabilityReason: string;
  };
  type LocalFile = { file: File; role: AssetRole; replaces?: string };
  const previous = existing && currentRevision(existing);
  const draftKey = `submission/${existing?.id || "new"}/`;
  const initial: Fields = {
    title: existing?.title || "",
    product: existing?.product || "personal_loan",
    submitter: existing?.submitter || "",
    submitterEmail: existing?.submitterEmail || "",
    channel: existing?.channel || "Paid social",
    launchDate: existing?.launchDate || "",
    submittedBy: existing ? REVIEWER : "",
    summary: "",
    offerId: previous?.offerId || "",
    intendedUse: previous?.intendedUse || "",
    copy: previous?.copy || "",
    destinationUrl: previous?.destinationUrl || "",
    advertisedOffer: previous?.advertisedOffer || "",
    applicabilityReason: previous?.applicabilityReason || "",
  };
  const draft = usePackageDraft(
    `clearpath-draft:${draftKey}fields`,
    previous?.id || "new",
    initial,
  );
  const data = draft.value;
  const setData = draft.setValue;
  const [materials, setMaterials] = useDraftState<{
    baseRevisionId: string;
    files: LocalFile[];
    retained: RevisionInput["retainedComponents"];
  }>(
    draftKey + "materials",
    {
      baseRevisionId: previous?.id || "new",
      files: [],
      retained:
        previous?.components.map(({ assetId, role }) => ({ assetId, role })) ||
        [],
    },
    true,
  );
  const responseAssets =
    existing?.assets.filter(
      (asset) =>
        !previous?.components.some(
          (component) => component.assetId === asset.id,
        ) &&
        existing.responses?.some((response) =>
          response.assetIds.includes(asset.id),
        ),
    ) || [];
  const files = materials.files;
  const retained = materials.retained;
  const setFiles = (
    update: LocalFile[] | ((old: LocalFile[]) => LocalFile[]),
  ) =>
    setMaterials((old) => ({
      ...old,
      files: typeof update === "function" ? update(old.files) : update,
    }));
  const setRetained = (
    update:
      | RevisionInput["retainedComponents"]
      | ((
          old: RevisionInput["retainedComponents"],
        ) => RevisionInput["retainedComponents"]),
  ) =>
    setMaterials((old) => ({
      ...old,
      retained: typeof update === "function" ? update(old.retained) : update,
    }));
  const contextChanged = Object.keys(initial).some(
    (field) =>
      draft.base[field as keyof Fields] !== initial[field as keyof Fields],
  );
  const needsReconciliation =
    draft.needsReconciliation ||
    contextChanged ||
    materials.baseRevisionId !== (previous?.id || "new");
  const orphanedReplacements = files.filter(
    (file) =>
      file.replaces &&
      !previous?.components.some(
        (component) => component.assetId === file.replaces,
      ),
  );
  const [choices, setChoices] = useState<
    Partial<Record<keyof Fields, DraftChoice>>
  >({});
  const [checkedLatest, setCheckedLatest] = useState(false);
  const expectedVersion = useRef(existing?.version);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const key = useRef({ signature: "", value: crypto.randomUUID() });
  const contextSignature = JSON.stringify(initial);
  useEffect(() => {
    setChoices({});
    setCheckedLatest(false);
  }, [previous?.id, contextSignature]);
  useEffect(() => {
    if (!needsReconciliation) expectedVersion.current = existing?.version;
  }, [existing?.version, needsReconciliation]);
  useEffect(() => {
    if (!draft.dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft.dirty]);
  const fieldLabels: Record<keyof Fields, string> = {
    title: "Title",
    product: "Product",
    submitter: "Submitter",
    submitterEmail: "Contact email",
    channel: "Placement",
    launchDate: "Target launch",
    submittedBy: "Updated by",
    summary: "Revision note",
    offerId: "Offer reference",
    intendedUse: "Intended use",
    copy: "Accompanying copy",
    destinationUrl: "Destination URL",
    advertisedOffer: "Advertised offer",
    applicabilityReason: "Reference applicability",
  };
  const fieldValue = (field: keyof Fields, value: string) =>
    field === "offerId"
      ? offers.find((offer) => offer.id === value)
        ? `${offers.find((offer) => offer.id === value)!.name} · ${offers.find((offer) => offer.id === value)!.version}`
        : value || "(not selected)"
      : value || "(empty)";
  const update = <K extends keyof Fields>(name: K, value: Fields[K]) =>
    setData((d) => ({ ...d, [name]: value }));
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
    if (needsReconciliation) {
      setError(
        "Review the latest package and reconcile this draft before saving.",
      );
      return;
    }
    if (orphanedReplacements.length) {
      setError(
        "A replacement refers to a file that is no longer current. Remove the upload or keep it as an additional file.",
      );
      return;
    }
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
            advertisedOffer: data.advertisedOffer,
            applicabilityReason: data.applicabilityReason,
            expectedVersion: expectedVersion.current!,
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
      draft.clear();
      clearDrafts(draftKey);
      onSaved(saved);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        e.details?.code === "version_conflict" &&
        existing &&
        onLatest
      ) {
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
          {needsReconciliation && (
            <section
              className="rw-warning"
              aria-label="Reconcile package draft"
            >
              <h3>
                {draft.legacy
                  ? "Review an older saved draft"
                  : `Review the latest package · version ${previous?.number || 1}`}
              </h3>
              <p>
                Your draft was based on earlier context. Untouched fields will
                use the latest values. Keep your actual edits where appropriate;
                your uploads stay here.
              </p>
              {draft.latestChanges.length > 0 && (
                <p>
                  Latest changes:{" "}
                  {draft.latestChanges
                    .map((field) => fieldLabels[field as keyof Fields])
                    .join(", ")}
                </p>
              )}
              {draft.conflicts.map((field) => (
                <div key={field} className="form-section">
                  <h4>{fieldLabels[field]}</h4>
                  <label className="check-line">
                    <input
                      type="radio"
                      name={`internal-reconcile-${field}`}
                      checked={choices[field] === "latest"}
                      onChange={() =>
                        setChoices((old) => ({ ...old, [field]: "latest" }))
                      }
                    />
                    <span>
                      Use latest {fieldLabels[field].toLowerCase()}
                      <p className="preserve-lines">
                        {fieldValue(field, initial[field])}
                      </p>
                    </span>
                  </label>
                  <label className="check-line">
                    <input
                      type="radio"
                      name={`internal-reconcile-${field}`}
                      checked={choices[field] === "draft"}
                      onChange={() =>
                        setChoices((old) => ({ ...old, [field]: "draft" }))
                      }
                    />
                    <span>
                      Keep my draft {fieldLabels[field].toLowerCase()}
                      <p className="preserve-lines">
                        {fieldValue(field, data[field])}
                      </p>
                    </span>
                  </label>
                </div>
              ))}
              <p>
                Latest files:{" "}
                {previous?.components
                  .map(
                    (component) =>
                      existing!.assets.find(
                        (asset) => asset.id === component.assetId,
                      )?.name,
                  )
                  .join(", ") || "Copy-only package"}
                .
              </p>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={checkedLatest}
                  onChange={(event) => setCheckedLatest(event.target.checked)}
                />
                <span>
                  I checked the latest package. Reset Keep, Remove, and role
                  choices to its current files so I can review those choices
                  again.
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
                  setMaterials((old) => ({
                    ...old,
                    baseRevisionId: previous?.id || "new",
                    retained: (previous?.components || [])
                      .filter(
                        (component) =>
                          !old.files.some(
                            (file) => file.replaces === component.assetId,
                          ),
                      )
                      .map(({ assetId, role }) => ({ assetId, role })),
                  }));
                  expectedVersion.current = existing?.version;
                  setError("");
                }}
              >
                Use latest package with reviewed edits
              </button>
            </section>
          )}
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
          <fieldset
            className="form-section"
            disabled={busy || needsReconciliation}
            style={{ border: 0, padding: 0, marginInline: 0, minWidth: 0 }}
          >
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
                    .filter(
                      (o) =>
                        o.product === data.product &&
                        (!o.withdrawnAt || o.id === data.offerId),
                    )
                    .map((o) => (
                      <option
                        key={o.id}
                        value={o.id}
                        disabled={!!o.withdrawnAt}
                      >
                        {o.name} · {o.version}
                        {o.withdrawnAt ? " · Withdrawn" : ""}
                      </option>
                    ))}
                </select>
                {offers.some((o) => o.id === data.offerId && o.withdrawnAt) && (
                  <small>
                    This package used a withdrawn reference. Select a current
                    reference before confirming intake; earlier versions keep
                    their original source.
                  </small>
                )}
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Placement">
                <select
                  value={data.channel}
                  onChange={(e) => update("channel", e.target.value)}
                >
                  {[
                    ...new Set([
                      data.channel,
                      "Paid social",
                      "Organic social",
                      "Landing page",
                      "Display advertising",
                      "Marketing email",
                      "Other",
                    ]),
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
              hint="Include placement, audience/geography, planned run dates, and relevant affiliate, targeting, or compensation context. Note what is still unknown."
            >
              <textarea
                rows={2}
                maxLength={3000}
                placeholder="Where and how will this material be used?"
                value={data.intendedUse}
                onChange={(e) => update("intendedUse", e.target.value)}
              />
            </Field>
          </fieldset>
          <fieldset
            className="form-section"
            disabled={busy || needsReconciliation}
            style={{ border: 0, padding: 0, marginInline: 0, minWidth: 0 }}
          >
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
                              : [
                                  ...old,
                                  { assetId: comp.assetId, role: comp.role },
                                ],
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
            {responseAssets.length > 0 && (
              <div className="retained-files">
                <h4>Files returned in responses</h4>
                <p>
                  Include a returned file only if it belongs in this package.
                  Select its role; saving creates a new version for intake.
                </p>
                {responseAssets.map((asset) => {
                  const component = retained.find(
                    (item) => item.assetId === asset.id,
                  );
                  const response = existing!.responses!.find((item) =>
                    item.assetIds.includes(asset.id),
                  )!;
                  return (
                    <div className="retain-row" key={asset.id}>
                      <label className="check-line">
                        <input
                          type="checkbox"
                          checked={!!component}
                          onChange={(event) =>
                            setRetained((old) =>
                              event.target.checked
                                ? [
                                    ...old,
                                    { assetId: asset.id, role: "evidence" },
                                  ]
                                : old.filter(
                                    (item) => item.assetId !== asset.id,
                                  ),
                            )
                          }
                        />
                        <span>
                          Include {asset.name} in new version
                          <small>Returned by {response.author}</small>
                        </span>
                      </label>
                      <a
                        className="text-button"
                        href={assetUrl(existing!.id, asset.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open file
                      </a>
                      <select
                        aria-label={`Role for returned ${asset.name}`}
                        disabled={!component}
                        value={component?.role || "evidence"}
                        onChange={(event) =>
                          setRetained((old) =>
                            old.map((item) =>
                              item.assetId === asset.id
                                ? {
                                    ...item,
                                    role: event.target.value as AssetRole,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {Object.entries(ROLE_LABELS).map(([role, label]) => (
                          <option key={role} value={role}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
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
                {files.map(({ file, role, replaces }, index) => (
                  <div className="upload-row" key={index}>
                    <FileUp size={18} />
                    <span className="upload-name">
                      {file.name}
                      <small>{bytes(file.size)}</small>
                      {replaces &&
                        !previous?.components.some(
                          (component) => component.assetId === replaces,
                        ) && (
                          <span className="rw-warning">
                            The original replacement target is no longer
                            current.
                            <button
                              type="button"
                              className="text-button"
                              onClick={() =>
                                setFiles((old) =>
                                  old.map((item, position) =>
                                    position === index
                                      ? { ...item, replaces: undefined }
                                      : item,
                                  ),
                                )
                              }
                            >
                              Keep as additional file
                            </button>
                          </span>
                        )}
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
          </fieldset>
          <fieldset
            className="form-section"
            disabled={busy || needsReconciliation}
            style={{ border: 0, padding: 0, marginInline: 0, minWidth: 0 }}
          >
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
              <Field
                label="Updated by"
                hint="Person recording this revision. The original submitter remains the case contact."
              >
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
          </fieldset>
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
                draft.clear();
                clearDrafts(draftKey);
                onClose();
              }
            }}
          >
            Discard draft
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={
              busy || needsReconciliation || orphanedReplacements.length > 0
            }
          >
            {busy && <LoaderCircle size={17} className="spin" />}
            {existing ? "Save new version" : "Create submission"}
            <ArrowRight size={16} />
          </button>
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
    responses = pendingResponses(review),
    confirmed = review.confirmedRevisionId === rev.id;
  const [outcome, setOutcome] = useState<"approved" | "rejected">("approved");
  const draftKey = `decision/${review.id}/`;
  const [scope, setScope] = useDraftState(draftKey + "scope", rev.intendedUse);
  const [rationale, setRationale] = useDraftState(draftKey + "rationale", "");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setReviewed(false), [review.version]);
  const blocked =
    outcome === "approved" &&
    (!confirmed || blockers.length > 0 || responses.length > 0);
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
                {responses.length > 0 && (
                  <>
                    <p>
                      Assess {responses.length} received response
                      {responses.length === 1 ? "" : "s"} before approval.
                    </p>
                    {responses.map((response) => (
                      <p key={response.id}>
                        {response.author} · {response.text}
                      </p>
                    ))}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        onClose();
                        window.location.hash = `review/${review.id}/responses`;
                      }}
                    >
                      Review received responses
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          <Field
            label="Scope of this decision"
            hint="Limit approval to the reviewed creative and destination. State placement, audience/geography, run dates, and any product/entity assumptions or exclusions. Flag unknowns; this does not approve future edits."
          >
            <textarea
              required={outcome === "approved"}
              maxLength={3000}
              rows={4}
              placeholder="For example: Northstar paid social for California adults, October 5–November 15; this version’s image and destination for ClearPath’s Standard personal loan only. Excludes other placements and later edits."
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
  offers,
  onAction,
  onClose,
  reviewerName = REVIEWER,
  draftId,
}: ActionProps & { draftId?: string; offers: Offer[] }) {
  const rev = currentRevision(review);
  const existing = review.drafts.find((d) => d.id === draftId);
  const decision = review.decisions.findLast(
    (d) => d.revisionId === rev.id && !d.withdrawn,
  );
  const unassessed =
    decision?.outcome === "approved" ? pendingResponses(review) : [];
  const withdrawnReference =
    decision?.outcome === "approved"
      ? offers.find(
          (offer) => offer.id === decision.offerId && offer.withdrawnAt,
        )
      : undefined;
  const historical =
    !!existing &&
    (existing.revisionId !== rev.id ||
      (!!existing.decisionId && existing.decisionId !== decision?.id));
  const draftKey = useRef(
    `reply/${review.id}/${rev.id}/${decision?.id || "review"}/${draftId || "new"}/`,
  ).current;
  const [draftContext, setDraftContext] = useDraftState(draftKey + "context", {
    revisionId: rev.id,
    decisionId: decision?.id || "",
  });
  const contextChanged =
    draftContext.revisionId !== rev.id ||
    draftContext.decisionId !== (decision?.id || "");
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
  const [waitAfterSharing, setWaitAfterSharing] = useDraftState(
    draftKey + "wait",
    false,
  );
  const [waitingOwner, setWaitingOwner] = useDraftState(
    draftKey + "waiting-owner",
    review.submitter,
  );
  const [waitingReason, setWaitingReason] = useDraftState(
    draftKey + "waiting-reason",
    "Response to the shared requests",
  );
  const [communicatesDecision, setCommunicatesDecision] = useDraftState(
    draftKey + "decision",
    !historical && !!decision && existing?.decisionId === decision.id,
  );
  async function run(action: ActionInput) {
    if (contextChanged) {
      setError(
        "The package or decision changed. Review and confirm the message against the current context before saving or sharing.",
      );
      return;
    }
    if (action.type === "publish_result" && unassessed.length) {
      setError(
        "Assess received responses before sharing approval. If they change the decision, withdraw approval and resume review.",
      );
      return;
    }
    if (action.type === "publish_result" && withdrawnReference) {
      setError(
        "Review a new revision with a current reference and record a new decision before sharing approval.",
      );
      return;
    }
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
          {contextChanged && (
            <div className="rw-warning">
              <p>
                The package or recorded decision changed while this message was
                open. Your text is retained. Check it against version{" "}
                {rev.number} and the current decision before using it.
              </p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setDraftContext({
                    revisionId: rev.id,
                    decisionId: decision?.id || "",
                  });
                  setCommunicatesDecision(false);
                  setError("");
                }}
              >
                I checked the message against the current context
              </button>
            </div>
          )}
          {unassessed.length > 0 && (
            <section
              className="rw-warning"
              aria-label="Responses need assessment"
            >
              <strong>New responses need review before sharing approval</strong>
              <p>
                {unassessed.length} response
                {unassessed.length === 1 ? " is" : "s are"} unassessed. Check
                whether the recorded decision still applies. If it changes,
                withdraw approval and resume review.
              </p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  onClose();
                  window.location.hash = `review/${review.id}/responses`;
                }}
              >
                Review received responses
              </button>
            </section>
          )}
          {withdrawnReference && decision && (
            <section
              className="rw-warning"
              aria-label="Withdrawn approval reference"
            >
              <strong>
                The reference supporting this approval was withdrawn
              </strong>
              <p>
                {withdrawnReference.name} · {withdrawnReference.version} ·
                withdrawn {dateTime(withdrawnReference.withdrawnAt!)}
              </p>
              <p>
                {withdrawnReference.withdrawalReason ||
                  "No withdrawal reason recorded."}
              </p>
              <p>
                This approval cannot be shared again. Add a revision with a
                current reference, complete review, and record a new decision.
                The earlier decision remains in the record. If it was already
                communicated and no longer applies, withdraw it from its record.
              </p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  onClose();
                  window.location.hash = `review/${review.id}/decision/${decision.id}`;
                }}
              >
                Open decision record
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  onClose();
                  window.location.hash = `review/${review.id}`;
                }}
              >
                Return to package
              </button>
            </section>
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
                    {requestSharingState(review, f) === "updated" && (
                      <small>Updated request not yet shared</small>
                    )}
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
          {!decision && pending.length > 0 && (
            <div className="decision-package">
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={waitAfterSharing}
                  onChange={(e) => setWaitAfterSharing(e.target.checked)}
                />
                <span>
                  After sharing, wait for a response
                  <small>
                    Sharing the feedback will also record who acts next. Saving
                    a draft does neither.
                  </small>
                </span>
              </label>
              {waitAfterSharing && (
                <div className="form-grid">
                  <Field label="Waiting on">
                    <input
                      value={waitingOwner}
                      maxLength={120}
                      onChange={(e) => setWaitingOwner(e.target.value)}
                    />
                  </Field>
                  <Field label="Reason for waiting">
                    <input
                      value={waitingReason}
                      maxLength={2000}
                      onChange={(e) => setWaitingReason(e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
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
                  disabled={
                    busy ||
                    !reconciled ||
                    !!withdrawnReference ||
                    unassessed.length > 0
                  }
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
              (!decision &&
                waitAfterSharing &&
                (!waitingOwner.trim() || !waitingReason.trim()))
            }
            onClick={() =>
              void run({
                type: "publish_feedback",
                ...(!decision && waitAfterSharing
                  ? {
                      waiting: {
                        nextOwner: waitingOwner,
                        reason: waitingReason,
                      },
                    }
                  : {}),
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
