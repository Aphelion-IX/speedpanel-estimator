// =============================================================================
// Documents card -- upload/list/download/delete for one project
// =============================================================================
// Lives in its own file (unlike Orders/Manufacturing & Delivery, which are
// inlined in ProjectDashboard.tsx) because it owns real interactive state
// (the file input, in-flight upload/delete/download status per row) rather
// than just rendering data -- same reasoning ReviewActionPanel.tsx already
// followed for this card row.
// =============================================================================
import { useRef, useState } from "react";
import { FileText, Upload, Download, Trash2 } from "lucide-react";
import { cx, NAVY, BLUE, MUTED } from "../../../styleTokens";
import { Card } from "../../../ui/primitives";
import { useProjectDocuments } from "./projectDocumentsStore";
import { formatFileSize, type ProjectDocumentRow } from "./projectDocumentsTypes";

const DocumentRow = ({ doc, onDownload, onRemove }: {
  doc: ProjectDocumentRow; onDownload: (doc: ProjectDocumentRow) => Promise<void>; onRemove: (doc: ProjectDocumentRow) => Promise<void>;
}) => {
  const [busy, setBusy] = useState<"download" | "delete" | null>(null);

  return (
    <div className={`flex items-center gap-3 ${cx.rowBorder}`}>
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
        <FileText size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: NAVY }}>{doc.file_name}</p>
        <p className={cx.footnote}>{formatFileSize(doc.file_size)} &middot; {new Date(doc.created_at).toLocaleDateString()}</p>
      </div>
      <button
        onClick={async () => { setBusy("download"); await onDownload(doc); setBusy(null); }}
        disabled={busy !== null}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
        style={{ color: BLUE }}
      >
        <Download size={14} />
      </button>
      <button
        onClick={async () => { if (!window.confirm(`Delete "${doc.file_name}"?`)) return; setBusy("delete"); await onRemove(doc); setBusy(null); }}
        disabled={busy !== null}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-red-500 disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

export const ProjectDocumentsCard = ({ projectId, userId }: { projectId: string; userId: string | null }) => {
  const { documents, loading, error, uploadDocument, removeDocument, downloadDocument } = useProjectDocuments(projectId, userId);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const err = await uploadDocument(file);
    setUploading(false);
    if (err) setUploadError(err);
  };

  const handleDownload = async (doc: ProjectDocumentRow) => {
    const url = await downloadDocument(doc);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setUploadError("Couldn't generate a download link.");
  };

  const handleRemove = async (doc: ProjectDocumentRow) => {
    const err = await removeDocument(doc);
    if (err) setUploadError(err);
  };

  return (
    <Card title="Documents" icon={<FileText size={14} />}>
      {loading ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : documents.length === 0 ? (
        <div className="grid place-items-center gap-2 py-2 text-center">
          <FileText size={28} style={{ color: MUTED }} />
          <p className={cx.footnote} style={{ paddingTop: 0 }}>
            No documents yet -- shop drawings, delivery dockets, and other project files will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {documents.map(doc => <DocumentRow key={doc.id} doc={doc} onDownload={handleDownload} onRemove={handleRemove} />)}
        </div>
      )}

      {uploadError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadError}</p>}

      <input ref={inputRef} type="file" className="hidden" onChange={handleFileChosen} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-bold disabled:opacity-50"
        style={{ color: NAVY }}
      >
        <Upload size={14} />
        {uploading ? "Uploading..." : "Upload document"}
      </button>
    </Card>
  );
};
