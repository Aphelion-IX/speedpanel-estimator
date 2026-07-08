// =============================================================================
// Admin Documents -- seed catalog from src/education/catalog.ts
// =============================================================================
// The ONLY file in src/pages/admin/documents/ that imports from
// src/education/ -- and only reads EDU_DOCUMENTS, never writes to it. Called
// lazily, once, from documentStore.ts's loadDocuments() when localStorage is
// empty. swatch passes straight through unchanged: EDU_DOCUMENTS has already
// resolved it from a JSON colour-key ("blue"/"gold"/"slate") to a literal CSS
// value via catalog.ts's own module-level map, so no extra resolution is
// needed here -- this is a one-time staging snapshot, not a live derivation.
// =============================================================================
import { EDU_DOCUMENTS } from "../../../education/catalog";
import type { AdminDocument, AdminDocCategory } from "./documentTypes";

let seedCounter = 0;
// Deterministic per-seed-run ids (crypto.randomUUID() would also work, but a
// counter keeps seed output stable across reseeds for easier eyeballing/testing).
const seedId = () => `seed-${++seedCounter}`;

function stamp<T extends object>(entity: T): T & { id: string; createdAt: string; updatedAt: string } {
  const now = new Date().toISOString();
  return { ...entity, id: seedId(), createdAt: now, updatedAt: now };
}

export function buildSeedDocuments(): AdminDocument[] {
  seedCounter = 0;
  return EDU_DOCUMENTS.map(d => stamp<Omit<AdminDocument, "id" | "createdAt" | "updatedAt">>({
    title: d.title,
    // Every real EDU_DOCUMENTS entry's category is one of EDU_CATEGORIES minus
    // "All" in practice; EduDocument just types it as the wider `string`.
    category: d.category as AdminDocCategory,
    tags: [...d.tags],
    description: d.description,
    edition: d.edition,
    date: d.date,
    fileSize: d.fileSize,
    fileType: d.fileType,
    pageCount: d.pageCount,
    swatch: d.swatch,
    sections: d.sections.map(s => ({ ...s })),
    fileUrl: d.fileUrl,
  }));
}
