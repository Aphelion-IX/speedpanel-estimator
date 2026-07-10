// =============================================================================
// Education Hub -- live Supabase catalog
// =============================================================================
// Fetches the same admin_documents table Admin > Documents edits (see
// supabase/schema.sql), so section/metadata edits made there now show up
// here directly -- no separate publish step. Deliberately does NOT import
// from src/pages/admin/documents/ to keep this public feature independent of
// the admin tooling's internals; the row shape is duplicated here rather than
// shared, same "duplicated, not reused" call as documentMappers.ts's own
// category enum.
//
// Trade-off: admin_documents has no extracted-PDF-text column, so the
// previous MiniSearch full-text index (built offline by
// scripts/add-education-doc.mjs from each PDF's actual content, see
// catalog.ts's eduSearchIndex) is gone -- search here is metadata-only
// (title/tags/category/description), same as every other admin list's
// search box. A guide is only findable by what an editor has typed into its
// metadata now, not by a phrase buried on page 40.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../lib/supabaseClient";
import { EDU_SWATCH_MAP, type EduDocument } from "./catalog";

const NOT_CONFIGURED = "The Education Hub isn't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

const eduDocCategorySchema = z.enum([
  "Technical Guides", "Installation", "Connection Details",
  "Fire & Acoustic", "External Walls", "Estimating", "Compliance",
]);

const sectionSchema = z.object({ name: z.string(), description: z.string(), pages: z.string() });

const rowSchema = z.object({
  id: z.string(), title: z.string(), category: eduDocCategorySchema, tags: z.array(z.string()),
  description: z.string(), edition: z.string(), date: z.string(), file_size: z.string(), file_type: z.string(),
  page_count: z.number(), swatch: z.string(), sections: z.array(sectionSchema), file_url: z.string().nullable(),
});
type Row = z.infer<typeof rowSchema>;

function fromRow(row: Row): EduDocument {
  return {
    id: row.id, title: row.title, category: row.category, tags: row.tags, description: row.description,
    edition: row.edition, date: row.date, fileSize: row.file_size, fileType: row.file_type,
    pageCount: row.page_count, swatch: EDU_SWATCH_MAP[row.swatch] ?? row.swatch, sections: row.sections,
    fileUrl: row.file_url ? `${import.meta.env.BASE_URL}${row.file_url}` : undefined,
  };
}

interface CatalogState { documents: EduDocument[]; loading: boolean; error: string | null; }

export function useEducationCatalog() {
  const [state, setState] = useState<CatalogState>(() =>
    supabase
      ? { documents: [], loading: true, error: null }
      : { documents: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("admin_documents").select("*").order("created_at", { ascending: true });
    if (error) { setState({ documents: [], loading: false, error: error.message }); return; }
    const parsed = rowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ documents: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ documents: parsed.data.map(fromRow), loading: false, error: null });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
