// =============================================================================
// Education Hub -- static catalog
// =============================================================================
// Reads from the bundled src/eduDocuments.json snapshot -- no live Supabase
// table backs this anymore (admin_documents was deleted along with the rest
// of the business-layer schema; see supabase/schema.sql's header comment).
// Same "single source of truth, edited by hand, no logic changes needed"
// posture as src/data.ts's calculator specs -- add/edit a guide by editing
// the JSON file directly.
//
// Keeps the same {documents, loading, error, reload} hook shape the old
// live-Supabase version had, so EducationHub.tsx didn't need to change --
// loading/error are always the trivial case now, reload() is a no-op (the
// bundle can't change at runtime).
// =============================================================================
import { useCallback } from "react";
import eduDocumentsJson from "../eduDocuments.json";
import { EDU_SWATCH_MAP, type EduDocument } from "./catalog";

interface RawEduDocument extends Omit<EduDocument, "swatch"> { swatch: string; }

// eduDocuments.json stores each entry's swatch as a colour KEY ("blue"/
// "gold"/"slate"), not a literal value -- same reasoning as
// EDU_SWATCH_MAP's own header comment. fileUrl, when present, is a
// public/-relative path ("docs/foo.pdf") resolved against Vite's BASE_URL
// so it works both in dev and once deployed under a subpath.
function resolveDoc(raw: RawEduDocument): EduDocument {
  return {
    ...raw,
    swatch: EDU_SWATCH_MAP[raw.swatch] ?? raw.swatch,
    fileUrl: raw.fileUrl ? `${import.meta.env.BASE_URL}${raw.fileUrl.replace(/^\/+/, "")}` : undefined,
  };
}

const DOCUMENTS: EduDocument[] = (eduDocumentsJson as RawEduDocument[]).map(resolveDoc);

export function useEducationCatalog() {
  const reload = useCallback(async () => {}, []);
  return { documents: DOCUMENTS, loading: false, error: null as string | null, reload };
}
