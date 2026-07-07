// =============================================================================
// pdfjs-dist lazy loader
// =============================================================================
// pdfjs (plus its ~1.3MB worker) is only needed once someone actually opens a
// real PDF here, so it's dynamically imported instead of bundled into the
// main chunk, and the loader promise is cached so the module + worker setup
// only happen once, on first use.
// =============================================================================
import type * as PdfjsLib from "pdfjs-dist";

let pdfjsLibPromise: Promise<typeof PdfjsLib> | null = null;
export const loadPdfjs = () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsLibPromise;
};
