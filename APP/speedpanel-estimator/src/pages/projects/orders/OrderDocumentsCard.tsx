
import { useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { Card, IconButton } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { SelectField } from "../../shared/fields";
import { cx, MUTED, NAVY } from "../../../styleTokens";
import {
  ORDER_DOCUMENT_TYPES,
  ORDER_DOCUMENT_TYPE_LABELS,
  formatOrderFileSize,
  type OrderDocumentType,
  type OrderDocumentVisibility,
} from "./orderOperationsTypes";
import { useOrderDocuments } from "./orderOperationsStore";

const TYPE_OPTIONS = ORDER_DOCUMENT_TYPES.map(value => ({
  value,
  label: ORDER_DOCUMENT_TYPE_LABELS[value],
}));

export const OrderDocumentsCard = ({
  orderId,
  userId,
  viewerKind = "customer",
}: {
  orderId: string;
  userId: string | null;
  viewerKind?: "customer" | "staff";
}) => {
  const {
    documents,
    loading,
    error,
    uploadDocument,
    removeDocument,
    downloadDocument,
  } = useOrderDocuments(orderId, userId);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] =
    useState<OrderDocumentType>("purchase_order");
  const [visibility, setVisibility] =
    useState<OrderDocumentVisibility>("customer");
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const visibleDocuments =
    viewerKind === "staff"
      ? documents
      : documents.filter(document => document.visibility === "customer");

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setActionError(null);
    const uploadError = await uploadDocument(
      file,
      documentType,
      viewerKind === "staff" ? visibility : "customer",
    );
    setUploading(false);
    if (uploadError) {
      setActionError(uploadError);
      return;
    }
    setFile(null);
  };

  return (
    <Card title="Order Documents" icon={<FileText size={14} />}>
      {loading ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>
          Loading documents...
        </p>
      ) : visibleDocuments.length === 0 ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>
          No order documents available yet.
        </p>
      ) : (
        <div className="space-y-2">
          {visibleDocuments.map(document => (
            <div
              key={document.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-600"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" style={{ color: NAVY }}>
                  {document.file_name}
                </p>
                <p className="truncate text-xs" style={{ color: MUTED }}>
                  {ORDER_DOCUMENT_TYPE_LABELS[document.document_type]}
                  {" · "}v{document.version}
                  {" · "}{formatOrderFileSize(document.file_size)}
                  {viewerKind === "staff" ? ` · ${document.visibility}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <IconButton
                  size="sm"
                  title="Download"
                  ariaLabel={`Download ${document.file_name}`}
                  onClick={async () => {
                    const url = await downloadDocument(document);
                    if (url) window.open(url, "_blank");
                  }}
                >
                  <Download size={13} />
                </IconButton>
                {viewerKind === "staff" && (
                  <IconButton
                    size="sm"
                    variant="danger"
                    title="Delete"
                    ariaLabel={`Delete ${document.file_name}`}
                    onClick={async () => {
                      const removeError = await removeDocument(document);
                      if (removeError) setActionError(removeError);
                    }}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {userId && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Document type"
            value={documentType}
            options={TYPE_OPTIONS}
            onChange={value => setDocumentType(value as OrderDocumentType)}
          />
          {viewerKind === "staff" && (
            <SelectField
              label="Visibility"
              value={visibility}
              options={[
                { value: "customer", label: "Customer visible" },
                { value: "internal", label: "Internal only" },
              ]}
              onChange={value => setVisibility(value as OrderDocumentVisibility)}
            />
          )}
          <div className={viewerKind === "staff" ? "" : "sm:col-span-2"}>
            <label className={cx.lbl}>Choose file</label>
            <input
              type="file"
              onChange={event => setFile(event.target.files?.[0] ?? null)}
              className={cx.input}
            />
          </div>
          <div className="flex items-end">
            <Button
              icon={<Upload size={14} />}
              disabled={!file || uploading}
              onClick={upload}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      )}

      {(error || actionError) && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error || actionError}
        </p>
      )}
    </Card>
  );
};
