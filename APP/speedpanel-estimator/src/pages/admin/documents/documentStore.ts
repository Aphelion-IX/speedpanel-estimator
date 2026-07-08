// =============================================================================
// Admin Documents -- local persistence
// =============================================================================
// Mirrors src/pages/admin/products/productStore.ts's pattern: a versioned
// localStorage payload, load/save guarded with typeof window checks +
// try/catch, and a hook that seeds state from disk and persists on every
// change. Simpler than productStore.ts since there's only one entity type --
// no category-keyed generics needed, just a flat AdminDocument[].
// =============================================================================
import { useState, useEffect } from "react";
import { buildSeedDocuments } from "./seedFromEducation";
import type { AdminDocument } from "./documentTypes";

const STORAGE_KEY = "speedpanel:adminDocuments";

interface PersistedDocuments { v: number; documents: AdminDocument[]; }

export function loadDocuments(): AdminDocument[] {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as PersistedDocuments;
        if (p && p.v === 1 && Array.isArray(p.documents)) return p.documents;
      }
    } catch { /* ignore parse/access errors, fall through to seed */ }
  }
  return buildSeedDocuments();
}

export function saveDocuments(documents: AdminDocument[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedDocuments = { v: 1, documents };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { /* ignore quota/serialization errors */ }
}

export function useDocumentStore() {
  const [documents, setDocuments] = useState<AdminDocument[]>(loadDocuments);

  useEffect(() => { saveDocuments(documents); }, [documents]);

  const add = (item: Omit<AdminDocument, "id" | "createdAt" | "updatedAt">): string => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const entity: AdminDocument = { ...item, id, createdAt: now, updatedAt: now };
    setDocuments(docs => [...docs, entity]);
    return id;
  };

  const update = (id: string, patch: Partial<Omit<AdminDocument, "id" | "createdAt">>): void => {
    const now = new Date().toISOString();
    setDocuments(docs => docs.map(d => d.id === id ? { ...d, ...patch, updatedAt: now } : d));
  };

  const remove = (id: string): void => {
    setDocuments(docs => docs.filter(d => d.id !== id));
  };

  // QA escape hatch -- discards all local edits and restores the Education
  // Hub-derived seed.
  const resetToSeed = (): void => setDocuments(buildSeedDocuments());

  return { documents, add, update, remove, resetToSeed };
}
