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
//
// Fetch/loading/error plumbing lives in useAsyncResource.ts, shared by every
// store in this tree.
// =============================================================================
import { useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { ProjectDocumentRowSchema, PROJECT_DOCUMENTS_BUCKET, type ProjectDocumentRow } from "./projectDocumentsTypes";
import { useAsyncResource } from "../useAsyncResource";

const NOT_CONFIGURED = "Documents aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export function useProjectDocuments(projectId: string, userId: string | null) {
  const fetchDocuments = useCallback(async (): Promise<{ data: ProjectDocumentRow[]; error: string | null }> => {
    if (!supabase) return { data: [], error: null };
    const { data, error } = await supabase.from("project_documents").select("*")
      .eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    const parsed = ProjectDocumentRowSchema.array().safeParse(data ?? []);
    return parsed.success ? { data: parsed.data, error: null } : { data: [], error: BAD_SHAPE };
  }, [projectId]);

  const { data: documents, loading, error, reload, setData } = useAsyncResource(fetchDocuments, [projectId], {
    initialData: [] as ProjectDocumentRow[],
    skip: !supabase,
    skipError: NOT_CONFIGURED,
  });

  const uploadDocument = async (file: File, serviceRequestId?: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    if (!userId) return "Not signed in.";
    const path = `${projectId}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).upload(path, file);
    if (uploadError) return uploadError.message;

    const { data, error } = await supabase.from("project_documents").insert({
      project_id: projectId, uploaded_by: userId, storage_path: path,
      file_name: file.name, file_size: file.size, content_type: file.type || null,
      service_request_id: serviceRequestId ?? null,
    }).select("*").single();
    if (error) {
      await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([path]);
      return error.message;
    }
    const parsed = ProjectDocumentRowSchema.safeParse(data);
    if (!parsed.success) return BAD_SHAPE;
    setData(prev => [parsed.data, ...prev]);
    return null;
  };

  const removeDocument = async (doc: ProjectDocumentRow): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("project_documents").delete().eq("id", doc.id);
    if (error) return error.message;
    await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([doc.storage_path]);
    setData(prev => prev.filter(d => d.id !== doc.id));
    return null;
  };

  const downloadDocument = async (doc: ProjectDocumentRow): Promise<string | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, 60);
    if (error || !data) return null;
    return data.signedUrl;
  };

  return { documents, loading, error, reload, uploadDocument, removeDocument, downloadDocument };
}
