// =============================================================================
// Project documents -- live Supabase fetch/upload/delete
// =============================================================================
// Two writes per upload (Storage object + project_documents row), same
// "bytes in Storage, metadata in a table" split described in schema.sql. If
// the metadata insert fails after the file lands in Storage, the orphaned
// object is best-effort cleaned up so a failed upload doesn't silently leave
// unreferenced bytes behind; if that cleanup itself fails, it's a harmless
// orphan (never surfaced anywhere, no billing/quota concern at this scale)
// rather than something worth surfacing a second error for.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { ProjectDocumentRowSchema, PROJECT_DOCUMENTS_BUCKET, type ProjectDocumentRow } from "./projectDocumentsTypes";

const NOT_CONFIGURED = "Documents aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface DocumentsState { documents: ProjectDocumentRow[]; loading: boolean; error: string | null; }

export function useProjectDocuments(projectId: string, userId: string | null) {
  const [state, setState] = useState<DocumentsState>(() =>
    supabase
      ? { documents: [], loading: true, error: null }
      : { documents: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("project_documents").select("*")
      .eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) { setState({ documents: [], loading: false, error: error.message }); return; }
    const parsed = ProjectDocumentRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ documents: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ documents: parsed.data, loading: false, error: null });
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const uploadDocument = async (file: File): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    if (!userId) return "Not signed in.";
    const path = `${projectId}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).upload(path, file);
    if (uploadError) return uploadError.message;

    const { data, error } = await supabase.from("project_documents").insert({
      project_id: projectId, uploaded_by: userId, storage_path: path,
      file_name: file.name, file_size: file.size, content_type: file.type || null,
    }).select("*").single();
    if (error) {
      await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([path]);
      return error.message;
    }
    const parsed = ProjectDocumentRowSchema.safeParse(data);
    if (!parsed.success) return BAD_SHAPE;
    setState(s => ({ ...s, documents: [parsed.data, ...s.documents] }));
    return null;
  };

  const removeDocument = async (doc: ProjectDocumentRow): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("project_documents").delete().eq("id", doc.id);
    if (error) return error.message;
    await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([doc.storage_path]);
    setState(s => ({ ...s, documents: s.documents.filter(d => d.id !== doc.id) }));
    return null;
  };

  const downloadDocument = async (doc: ProjectDocumentRow): Promise<string | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, 60);
    if (error || !data) return null;
    return data.signedUrl;
  };

  return { ...state, reload: load, uploadDocument, removeDocument, downloadDocument };
}
