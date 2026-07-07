// =============================================================================
// Education Hub -- PDF viewer
// =============================================================================
// Renders PDF pages ourselves (pdfjs-dist, canvas) with our own Prev/Next
// controls, rather than relying on the browser's native PDF plugin inside an
// <iframe> -- that approach looked fine on desktop Chrome but showed no
// toolbar/controls at all on mobile/touch browsers, since the full PDF.js
// viewer chrome is a desktop-Chrome-only feature, not a guaranteed <iframe>
// behavior.
// =============================================================================
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type * as PdfjsLib from "pdfjs-dist";
import { MUTED } from "../styleTokens";
import { clamp } from "../estimate/mathUtils";
import { loadPdfjs } from "./pdfjsLoader";

export const PdfViewer = ({ url, page, onPageChange, tall }: { url: string; page: number; onPageChange: (p: number) => void; tall: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPdfDoc(null);
    setPageCount(0);
    loadPdfjs().then(pdfjsLib => pdfjsLib.getDocument({ url }).promise).then(pdf => {
      if (cancelled) return;
      setPdfDoc(pdf);
      setPageCount(pdf.numPages);
    });
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    const clamped = clamp(page, 1, pdfDoc.numPages);
    pdfDoc.getPage(clamped).then(pdfPage => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const containerWidth = canvas.parentElement?.clientWidth || 600;
      const unscaled = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: containerWidth / unscaled.width });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      pdfPage.render({ canvasContext: ctx, viewport });
    });
    return () => { cancelled = true; };
  }, [pdfDoc, page, tall]);

  return (
    <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} title="Previous page"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 dark:text-slate-400 disabled:opacity-30">
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-bold" style={{ color: MUTED }}>Page {page} of {pageCount || "-"}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={!pageCount || page >= pageCount} title="Next page"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 dark:text-slate-400 disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className={`overflow-auto bg-slate-100 dark:bg-slate-950 ${tall ? "h-[calc(100vh-200px)]" : "h-[60vh]"}`}>
        <canvas ref={canvasRef} className="mx-auto block" />
      </div>
    </div>
  );
};
