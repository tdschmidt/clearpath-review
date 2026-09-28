import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  FilePlus2,
  FileText,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import { api, json, multipart } from "./api";
import { bytes, date, ErrorMessage } from "./components";
import {
  offerAssetUrl,
  PRODUCT_LABELS,
  type Offer,
  type OfferInput,
  type Product,
} from "../shared/types";
import "./offers.css";

type Props = {
  offers: Offer[];
  onSaved: (offer: Offer) => void;
  actorId?: string;
};
type FactDraft = {
  label: string;
  value: string;
  sourceFileIndex: string;
  page: string;
};
type Draft = {
  product: Product;
  name: string;
  version: string;
  validFrom: string;
  validTo: string;
  source: string;
  disclosure: string;
  facts: FactDraft[];
};
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "The offer reference could not be saved.";
function validity(offer: Offer) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return offer.withdrawnAt
    ? "Withdrawn"
    : offer.validTo < today
      ? "Past validity date"
      : offer.validFrom > today
        ? "Future validity"
        : "Within validity dates";
}

export default function Offers({ offers, onSaved, actorId }: Props) {
  const [selectedId, setSelectedId] = useState(offers[0]?.id || "");
  const [editing, setEditing] = useState<"new" | Offer | null>(null);
  const [fileId, setFileId] = useState("");
  const [page, setPage] = useState<number | undefined>(undefined);
  const [withdraw, setWithdraw] = useState(false),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const offer = offers.find((o) => o.id === selectedId) || offers[0];
  const asset =
    offer?.assets?.find((a) => a.id === fileId) || offer?.assets?.[0];
  useEffect(() => {
    setFileId("");
    setPage(undefined);
    setWithdraw(false);
    setReason("");
    setError("");
  }, [offer?.id]);
  function saved(next: Offer) {
    onSaved(next);
    setSelectedId(next.id);
    setEditing(null);
  }
  if (editing)
    return (
      <div className="offers-page">
        <OfferEditor
          previous={typeof editing === "object" ? editing : undefined}
          actorId={actorId}
          onSaved={saved}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  return (
    <div className="offers-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">REFERENCE MATERIAL</p>
          <h1>
            Offer references<span className="heading-dot">.</span>
          </h1>
          <p>
            Versioned product facts, with the source material that supports
            them.
          </p>
        </div>
        <button className="button primary" onClick={() => setEditing("new")}>
          <Plus size={17} />
          New reference
        </button>
      </div>
      <p className="offer-page-note">
        These are company-provided offer facts, not a complete regulatory
        checklist. Reviewers decide whether a reference applies to the submitted
        use.
      </p>
      <div className="offers-layout">
        <nav className="offer-list" aria-label="Offer references">
          {offers.map((item) => (
            <button
              key={item.id}
              className={item.id === offer?.id ? "selected" : ""}
              aria-current={item.id === offer?.id ? "true" : undefined}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="eyebrow">{PRODUCT_LABELS[item.product]}</span>
              <strong>{item.name}</strong>
              <span>{item.version}</span>
              <small>{validity(item)}</small>
            </button>
          ))}
          {offers.length === 0 && (
            <p>
              No offer references yet. Add the first reference with its source
              documents.
            </p>
          )}
        </nav>
        {offer && (
          <section className="offer-detail">
            <header className="offer-detail-header">
              <div>
                <p className="eyebrow">{PRODUCT_LABELS[offer.product]}</p>
                <h2>{offer.name}</h2>
                <p>
                  {offer.version} · {date(offer.validFrom)} –{" "}
                  {date(offer.validTo)}
                </p>
                <span
                  className={`offer-validity ${offer.withdrawnAt ? "withdrawn" : ""}`}
                >
                  {validity(offer)}
                </span>
              </div>
              <button
                className="button secondary"
                onClick={() => setEditing(offer)}
              >
                <FilePlus2 size={16} />
                Create new version
              </button>
            </header>
            {offer.withdrawnAt && (
              <div className="offer-warning">
                <strong>Withdrawn from further use</strong>
                <p>{offer.withdrawalReason}</p>
                <small>
                  Historical reviews preserve the reference version they used.
                </small>
              </div>
            )}
            {offer.supersedesId && (
              <p className="offer-version-link">
                Replaces{" "}
                <button
                  className="text-button"
                  onClick={() => setSelectedId(offer.supersedesId!)}
                >
                  {offers.find((o) => o.id === offer.supersedesId)?.version ||
                    "an earlier version"}
                </button>
                . Existing review records retain their earlier reference.
              </p>
            )}
            <div className="offer-evidence-grid">
              <div className="offer-facts">
                <h3>Source-backed facts</h3>
                <p className="offer-help">
                  Select a citation to open the source beside the fact.
                </p>
                {offer.facts.map((fact, index) => (
                  <article key={`${index}-${fact.label}`}>
                    <h4>{fact.label}</h4>
                    <p>{fact.value}</p>
                    {fact.citation ? (
                      <button
                        className="offer-citation"
                        onClick={() => {
                          setFileId(fact.citation!.assetId);
                          setPage(fact.citation!.page);
                        }}
                      >
                        <FileText size={14} />
                        {offer.assets?.find(
                          (a) => a.id === fact.citation!.assetId,
                        )?.name || "Source document"}
                        {fact.citation.page
                          ? ` · p. ${fact.citation.page}`
                          : ""}
                        <ArrowUpRight size={12} />
                      </button>
                    ) : (
                      <small>
                        See source context below; no individual file citation
                        recorded.
                      </small>
                    )}
                  </article>
                ))}
                <div className="offer-source-context">
                  <h3>Source and applicability</h3>
                  <p>{offer.source}</p>
                  {offer.disclosure && <p>{offer.disclosure}</p>}
                  {offer.createdBy && (
                    <small>
                      Recorded by {offer.createdBy}
                      {offer.createdAt ? ` · ${date(offer.createdAt)}` : ""}
                    </small>
                  )}
                </div>
              </div>
              <div className="offer-source-viewer">
                <div className="offer-source-tools">
                  <strong>Original source</strong>
                  {(offer.assets?.length || 0) > 0 && (
                    <select
                      aria-label="Offer source file"
                      value={asset?.id || ""}
                      onChange={(e) => {
                        setFileId(e.target.value);
                        setPage(undefined);
                      }}
                    >
                      {offer.assets?.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {asset ? (
                  <>
                    <div className="offer-source-preview">
                      {asset.mime === "application/pdf" ? (
                        <iframe
                          key={`${asset.id}-${page || 1}`}
                          src={`${offerAssetUrl(offer.id, asset.id)}${page ? `#page=${page}` : ""}`}
                          title={`${asset.name}${page ? `, page ${page}` : ""}`}
                        />
                      ) : ["image/png", "image/jpeg"].includes(asset.mime) ? (
                        <img
                          src={offerAssetUrl(offer.id, asset.id)}
                          alt={`Offer source: ${asset.name}`}
                        />
                      ) : (
                        <div className="offer-manual">
                          <BookOpen size={30} />
                          <h3>Inspect the original file</h3>
                          <p>This format is preserved for manual review.</p>
                        </div>
                      )}
                    </div>
                    <a
                      className="offer-source-download"
                      href={offerAssetUrl(offer.id, asset.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open original · {asset.name}
                      <ArrowUpRight size={14} />
                    </a>
                  </>
                ) : (
                  <div className="offer-manual">
                    <FileText size={30} />
                    <h3>No original file attached</h3>
                    <p>
                      This reference has recorded facts and source context.
                      Create a new version with the supporting documents to make
                      its basis inspectable here.
                    </p>
                  </div>
                )}
              </div>
            </div>
            {!offer.withdrawnAt && (
              <div className="offer-withdraw">
                <button
                  className="text-button"
                  onClick={() => setWithdraw((v) => !v)}
                >
                  {withdraw
                    ? "Keep reference available"
                    : "Withdraw this reference"}
                </button>
                {withdraw && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setError("");
                      try {
                        const next = await api<Offer>(
                          `/api/offers/${encodeURIComponent(offer.id)}/withdraw`,
                          json({ actorId, reason }),
                        );
                        onSaved(next);
                        setWithdraw(false);
                        setReason("");
                      } catch (e) {
                        setError(errorText(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <p>
                      Withdrawal prevents this reference from being selected for
                      new approval. Earlier records remain available.
                    </p>
                    <label className="field">
                      <span>Reason for withdrawal</span>
                      <textarea
                        required
                        rows={3}
                        maxLength={2000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <ErrorMessage error={error} />
                    <button
                      className="button danger"
                      disabled={busy || !reason.trim()}
                    >
                      {busy && <LoaderCircle className="spin" size={16} />}
                      Withdraw reference
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function OfferEditor({
  previous,
  actorId,
  onSaved,
  onCancel,
}: {
  previous?: Offer;
  actorId?: string;
  onSaved: (offer: Offer) => void;
  onCancel: () => void;
}) {
  const initial: Draft = {
    product: previous?.product || "personal_loan",
    name: previous?.name || "",
    version: "",
    validFrom: "",
    validTo: "",
    source: previous?.source || "",
    disclosure: previous?.disclosure || "",
    facts: previous?.facts.map((f) => ({
      label: f.label,
      value: f.value,
      sourceFileIndex: "",
      page: "",
    })) || [{ label: "", value: "", sourceFileIndex: "", page: "" }],
  };
  const storageKey = `clearpath:offer-draft:${previous?.id || "new"}`;
  const [data, setData] = useState<Draft>(() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (raw && typeof raw.name === "string" && Array.isArray(raw.facts))
        return {
          ...initial,
          ...raw,
          facts: raw.facts.map((fact: FactDraft) => ({
            ...fact,
            sourceFileIndex: "",
            page: "",
          })),
        };
    } catch {
      /* optional recovery */
    }
    return initial;
  });
  const [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const retry = useRef({ signature: "", key: crypto.randomUUID() });
  const dirty =
    JSON.stringify(data) !== JSON.stringify(initial) || files.length > 0;
  const set = <K extends keyof Draft>(name: K, value: Draft[K]) =>
    setData((old) => ({ ...old, [name]: value }));
  useEffect(() => {
    if (!dirty) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      /* storage optional */
    }
  }, [data, dirty, storageKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function cancel() {
    if (
      !dirty ||
      window.confirm(
        "Leave this reference without saving? Your text will be available when you reopen this form; files must be selected again.",
      )
    )
      onCancel();
  }
  function addFiles(incoming: File[]) {
    const next = [...files, ...incoming];
    if (
      next.length > 10 ||
      next.some((f) => f.size > 10 * 1024 * 1024) ||
      next.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024
    ) {
      setError("Add up to 10 source files, 10 MB each and 25 MB total.");
      return;
    }
    setFiles(next);
    setError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!files.length) {
      setError("Attach the source material behind this offer reference.");
      return;
    }
    if (data.validTo < data.validFrom) {
      setError("The end date must be on or after the start date.");
      return;
    }
    setBusy(true);
    try {
      const payload: OfferInput = {
        ...data,
        ...(previous ? { supersedesId: previous.id } : {}),
        ...(actorId ? { actorId } : {}),
        facts: data.facts.map((f) => ({
          label: f.label,
          value: f.value,
          ...(f.sourceFileIndex !== ""
            ? { sourceFileIndex: Number(f.sourceFileIndex) }
            : {}),
          ...(f.page ? { page: Number(f.page) } : {}),
        })),
      };
      const signature = JSON.stringify([
        payload,
        files.map((f) => [f.name, f.size, f.lastModified]),
      ]);
      if (retry.current.signature !== signature)
        retry.current = { signature, key: crypto.randomUUID() };
      const result = await api<Offer>(
        "/api/offers",
        multipart(payload, files, retry.current.key),
      );
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* optional */
      }
      onSaved(result);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="back-link" onClick={cancel}>
        <ArrowLeft size={15} />
        Offer references
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {previous
              ? `NEW VERSION OF ${previous.version}`
              : "REFERENCE MATERIAL"}
          </p>
          <h1>
            {previous
              ? "Create a new reference version"
              : "Add an offer reference"}
          </h1>
          <p>
            Record product facts and their supporting documents. Saved versions
            stay unchanged.
          </p>
        </div>
      </div>
      <form className="offer-editor" onSubmit={save}>
        <fieldset disabled={busy}>
          <div className="form-grid">
            <label className="field">
              <span>Reference name</span>
              <input
                required
                maxLength={200}
                value={data.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Personal loan / Standard"
              />
            </label>
            <label className="field">
              <span>Version</span>
              <input
                required
                maxLength={120}
                value={data.version}
                onChange={(e) => set("version", e.target.value)}
                placeholder="PL-2026.10 / v4"
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Product</span>
              <select
                value={data.product}
                onChange={(e) => set("product", e.target.value as Product)}
              >
                {Object.entries(PRODUCT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Valid from</span>
                <input
                  type="date"
                  required
                  value={data.validFrom}
                  onChange={(e) => set("validFrom", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Valid through</span>
                <input
                  type="date"
                  required
                  min={data.validFrom || undefined}
                  value={data.validTo}
                  onChange={(e) => set("validTo", e.target.value)}
                />
              </label>
            </div>
          </div>
          <label className="field">
            <span>Who supplied this reference?</span>
            <input
              required
              maxLength={2000}
              value={data.source}
              onChange={(e) => set("source", e.target.value)}
              placeholder="ClearPath Product team · approved term sheet, September 2026"
            />
            <small>
              Record the source, owner, or brief so the reviewer knows where
              these facts came from.
            </small>
          </label>
          <section className="offer-editor-section">
            <h2>Source material</h2>
            <p>
              {previous
                ? "Attach the supporting files for this new version. Earlier documents remain attached to the earlier reference."
                : "Attach the source documents or images that support these facts."}
            </p>
            <label className="field">
              <span>Source files</span>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []));
                  e.target.value = "";
                }}
              />
              <small>
                10 files · 10 MB each · 25 MB total. PDF, PNG, and JPEG are
                previewed.
              </small>
            </label>
            <div className="offer-upload-list">
              {files.map((file, index) => (
                <div key={index}>
                  <FileText size={17} />
                  <span>
                    {file.name}
                    <small>{bytes(file.size)}</small>
                  </span>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Remove source ${file.name}`}
                    onClick={() => {
                      setFiles((old) => old.filter((_, i) => i !== index));
                      set(
                        "facts",
                        data.facts.map((f) => ({
                          ...f,
                          sourceFileIndex:
                            f.sourceFileIndex === "" ||
                            Number(f.sourceFileIndex) === index
                              ? ""
                              : Number(f.sourceFileIndex) > index
                                ? String(Number(f.sourceFileIndex) - 1)
                                : f.sourceFileIndex,
                        })),
                      );
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section className="offer-editor-section">
            <div className="offer-facts-heading">
              <div>
                <h2>Facts to review against</h2>
                <p>
                  Keep each fact specific. Link it to its source; cite a page
                  for PDF material.
                </p>
              </div>
              <button
                className="button small secondary"
                type="button"
                onClick={() =>
                  set("facts", [
                    ...data.facts,
                    { label: "", value: "", sourceFileIndex: "", page: "" },
                  ])
                }
              >
                <Plus size={15} />
                Add fact
              </button>
            </div>
            {data.facts.map((fact, index) => (
              <div className="offer-fact-editor" key={index}>
                <div className="offer-fact-number">
                  Fact {index + 1}
                  {data.facts.length > 1 && (
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Remove fact ${index + 1}`}
                      onClick={() =>
                        set(
                          "facts",
                          data.facts.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Fact label</span>
                    <input
                      required
                      maxLength={200}
                      value={fact.label}
                      onChange={(e) =>
                        set(
                          "facts",
                          data.facts.map((f, i) =>
                            i === index ? { ...f, label: e.target.value } : f,
                          ),
                        )
                      }
                      placeholder="Origination fee"
                    />
                  </label>
                  <label className="field">
                    <span>Fact value</span>
                    <textarea
                      required
                      rows={2}
                      maxLength={3000}
                      value={fact.value}
                      onChange={(e) =>
                        set(
                          "facts",
                          data.facts.map((f, i) =>
                            i === index ? { ...f, value: e.target.value } : f,
                          ),
                        )
                      }
                      placeholder="5% of principal, deducted from proceeds"
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Source for this fact</span>
                    <select
                      required
                      value={fact.sourceFileIndex}
                      onChange={(e) =>
                        set(
                          "facts",
                          data.facts.map((f, i) =>
                            i === index
                              ? {
                                  ...f,
                                  sourceFileIndex: e.target.value,
                                  page: "",
                                }
                              : f,
                          ),
                        )
                      }
                    >
                      <option value="">Choose an attached source</option>
                      {files.map((file, i) => (
                        <option key={i} value={i}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Source page · optional</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      max={10000}
                      value={fact.page}
                      onChange={(e) =>
                        set(
                          "facts",
                          data.facts.map((f, i) =>
                            i === index ? { ...f, page: e.target.value } : f,
                          ),
                        )
                      }
                      placeholder="1"
                    />
                  </label>
                </div>
              </div>
            ))}
          </section>
          <label className="field">
            <span>Applicability and limitations</span>
            <textarea
              required
              rows={4}
              maxLength={5000}
              value={data.disclosure}
              onChange={(e) => set("disclosure", e.target.value)}
              placeholder="Which uses, conditions, and exceptions should a reviewer know about?"
            />
          </label>
        </fieldset>
        <ErrorMessage error={error} />
        <div className="offer-editor-footer">
          <p>
            Saving creates a reference version; it does not approve any
            advertising.
          </p>
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={cancel}
          >
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Plus size={16} />
            )}
            Save reference version
          </button>
        </div>
      </form>
    </>
  );
}
