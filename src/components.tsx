import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
  Minus,
  Plus,
  X,
  Maximize2,
  AlertCircle,
} from "lucide-react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  TextLayer as PDFTextLayer,
} from "pdfjs-dist";
import "./reviewer.css";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  assetUrl,
  STATUS_LABELS,
  type Asset,
  type CaseStatus,
} from "../shared/types";

export const date = (s: string) =>
  new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s,
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const dateTime = (s: string) =>
  new Date(s).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export const initials = (s: string) =>
  s
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
export const bytes = (n: number) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;

export function Status({ value }: { value: CaseStatus }) {
  return (
    <span className={`status status-${value}`}>
      <i />
      {STATUS_LABELS[value]}
    </span>
  );
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <div className="error-message" role="alert">
      <AlertCircle size={17} />
      <span>{error}</span>
    </div>
  ) : null;
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-icon">{icon}</span>}
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={box}
        tabIndex={-1}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) closeRef.current();
          if (e.key === "Tab") {
            const targets = Array.from(
              box.current!.querySelectorAll<HTMLElement>(
                'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
              ),
            ).filter((el) => el.getClientRects().length > 0);
            const first = targets[0],
              last = targets.at(-1);
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === box.current)
            ) {
              e.preventDefault();
              last?.focus();
            } else if (
              !e.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === box.current)
            ) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="modal-header">
          <div>
            <h2 id={id}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function PdfPage({
  url,
  page,
  onCount,
}: {
  url: string;
  page: number;
  onCount: (count: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const textContainer = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Keep the same document open while changing pages. The original remains available
  // even when a PDF cannot be rendered or has no embedded text.
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    setDocument(null);
    setLoading(true);
    setError("");
    void import("pdfjs-dist")
      .then(({ GlobalWorkerOptions, getDocument }) => {
        if (cancelled) return;
        GlobalWorkerOptions.workerSrc = workerUrl;
        task = getDocument(url);
        return task.promise;
      })
      .then((pdf) => {
        if (!cancelled && pdf) {
          onCount(pdf.numPages);
          setDocument(pdf);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "This PDF could not be previewed. Download the original to inspect it.",
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url, onCount]);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let render: { cancel: () => void; promise: Promise<unknown> } | undefined;
    let textLayer: PDFTextLayer | undefined;
    let resize: ResizeObserver | undefined;
    setLoading(true);
    setError("");
    void document
      .getPage(Math.min(Math.max(1, page), document.numPages))
      .then(async (pdfPage) => {
        if (
          cancelled ||
          !canvas.current ||
          !textContainer.current ||
          !sheet.current
        )
          return;
        const viewport = pdfPage.getViewport({ scale: 1.6 });
        const target = canvas.current;
        target.width = viewport.width;
        target.height = viewport.height;
        render = pdfPage.render({ canvas: target, viewport });
        await render.promise;
        if (cancelled || !textContainer.current || !sheet.current) return;
        const container = textContainer.current;
        container.replaceChildren();
        container.style.setProperty("--total-scale-factor", "1.6");
        const scaleText = () => {
          if (sheet.current)
            container.style.transform = `scale(${sheet.current.clientWidth / viewport.width})`;
        };
        scaleText();
        resize = new ResizeObserver(scaleText);
        resize.observe(sheet.current);
        const { TextLayer } = await import("pdfjs-dist");
        if (cancelled) return;
        textLayer = new TextLayer({
          textContentSource: pdfPage.streamTextContent(),
          container,
          viewport,
        });
        await textLayer.render();
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "This page could not be previewed. Download the original to inspect it.",
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      render?.cancel();
      textLayer?.cancel();
      resize?.disconnect();
      textContainer.current?.replaceChildren();
    };
  }, [document, page]);
  return (
    <>
      <ErrorMessage error={error} />
      {loading && (
        <div className="preview-loading" role="status">
          <LoaderCircle className="spin" size={22} /> Loading page…
        </div>
      )}
      <div
        className="pdf-sheet"
        ref={sheet}
        style={{
          display: error ? "none" : "block",
          opacity: loading ? 0.3 : 1,
        }}
      >
        <canvas ref={canvas} className="pdf-canvas" aria-hidden="true" />
        <div
          ref={textContainer}
          className="pdf-text-layer"
          aria-label={`PDF page ${page}`}
        />
      </div>
    </>
  );
}
export function AssetViewer({
  caseId,
  asset,
  compact = false,
  page: selectedPage,
  onPageChange,
  zoom: selectedZoom,
  onZoomChange,
  sourceUrl,
  downloadUrl,
}: {
  caseId: string;
  asset?: Asset;
  compact?: boolean;
  page?: number;
  onPageChange?: (page: number) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  sourceUrl?: string;
  downloadUrl?: string;
}) {
  const [localPage, setLocalPage] = useState(1);
  const page = selectedPage ?? localPage;
  const setPage = (value: number) => {
    setLocalPage(value);
    onPageChange?.(value);
  };
  const [count, setCount] = useState(1);
  const [localZoom, setLocalZoom] = useState(100);
  const zoom = selectedZoom ?? localZoom;
  const setZoom = (value: number) => {
    setLocalZoom(value);
    onZoomChange?.(value);
  };
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setLocalPage(1);
    setCount(1);
    setLocalZoom(100);
    setFailed(false);
  }, [asset?.id]);
  if (!asset)
    return (
      <Empty
        icon={<FileText size={30} />}
        title="Copy is the submitted creative"
      >
        Review the accompanying copy and offer context below. Add a rendition if
        presentation needs review.
      </Empty>
    );
  const url = sourceUrl || assetUrl(caseId, asset.id);
  const image = ["image/png", "image/jpeg"].includes(asset.mime);
  const pdf = asset.mime === "application/pdf";
  return (
    <div className={`asset-viewer ${compact ? "compact" : ""}`}>
      <div className="viewer-toolbar">
        <span className="file-detail">
          {pdf ? <FileText size={15} /> : <Maximize2 size={15} />}
          {pdf ? `Page ${Math.min(page, count)} of ${count}` : "Original file"}
        </span>
        <div className="viewer-tools">
          {pdf && (
            <>
              <button
                className="icon-button"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Next page"
                disabled={page >= count}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
          <button
            className="icon-button"
            aria-label="Zoom out"
            disabled={zoom <= 50}
            onClick={() => setZoom(zoom - 25)}
          >
            <Minus size={15} />
          </button>
          <span className="zoom-value">{zoom}%</span>
          <button
            className="icon-button"
            aria-label="Zoom in"
            disabled={zoom >= 200}
            onClick={() => setZoom(zoom + 25)}
          >
            <Plus size={15} />
          </button>
          <a
            className="icon-button"
            href={downloadUrl || assetUrl(caseId, asset.id, true)}
            aria-label={`Download ${asset.name}`}
          >
            <ArrowDownToLine size={16} />
          </a>
        </div>
      </div>
      <div className="viewer-stage">
        <div className="viewer-paper" style={{ width: `${zoom}%` }}>
          {image && !failed ? (
            <img
              src={url}
              alt={`Submitted creative: ${asset.name}`}
              onError={() => setFailed(true)}
            />
          ) : pdf ? (
            <PdfPage url={url} page={page} onCount={setCount} />
          ) : (
            <Empty
              icon={<FileText size={32} />}
              title={
                failed
                  ? "Image preview unavailable"
                  : "Inspect this file manually"
              }
            >
              Download the original file to review it.
            </Empty>
          )}
        </div>
      </div>
      <div className="viewer-caption">
        <span>{asset.name}</span>
        <span>{bytes(asset.size)} · Original file preserved</span>
      </div>
    </div>
  );
}
