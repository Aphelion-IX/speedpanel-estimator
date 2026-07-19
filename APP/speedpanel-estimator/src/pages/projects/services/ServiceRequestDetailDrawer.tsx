// =============================================================================
// Service request detail -- message thread + attachments, in a Drawer
// =============================================================================
// Attachments reuse project_documents/useProjectDocuments (the same store
// ProjectDocumentsCard.tsx uses) tagged with this request's id, rather than a
// second upload store -- see supabase/schema.sql's comment on
// project_documents.service_request_id for why.
// =============================================================================
import { useRef, useState } from "react";
import { Download, FileText, Send, Upload } from "lucide-react";
import { cx, NAVY, BLUE, MUTED, WHITE } from "../../../styleTokens";
import { Drawer } from "../../../ui/drawer";
import { Button } from "../../../ui/button";
import { useServiceRequestMessages } from "./serviceRequestsStore";
import { useProjectDocuments } from "../documents/projectDocumentsStore";
import { formatFileSize } from "../documents/projectDocumentsTypes";
import {
  SERVICE_REQUEST_TYPE_LABELS, SERVICE_REQUEST_STATUS_LABELS, SERVICE_REQUEST_STATUS_BADGE_CLASS,
  type ServiceRequestRow,
} from "./serviceRequestTypes";
import type { EffectiveLayout } from "../../../useLayoutMode";

// viewerKind flips message-bubble alignment/labels ("You" vs "Speedpanel
// Team") for whichever side is actually looking at the thread -- the
// customer-facing card (ProjectServicesCard.tsx) and the staff-facing
// AdminServiceRequestsPage.tsx both render this same component rather than
// keeping two copies of an otherwise-identical thread view.
// statusControl is staff-only (omitted entirely on the customer side) --
// customers never get a raw status dropdown, only the read-only badge above.
export const ServiceRequestDetailDrawer = ({ request, userId, layoutMode, viewerKind = "customer", statusControl, onClose }: {
  request: ServiceRequestRow; userId: string | null; layoutMode: EffectiveLayout; viewerKind?: "customer" | "staff";
  statusControl?: React.ReactNode;
  onClose: () => void;
}) => {
  const { messages, addMessage } = useServiceRequestMessages(request.id);
  const { documents, uploadDocument, downloadDocument } = useProjectDocuments(request.project_id, userId);
  const attachments = documents.filter(d => d.service_request_id === request.id);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    const err = await addMessage(reply.trim());
    setSending(false);
    if (err) { setError(err); return; }
    setReply("");
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    const err = await uploadDocument(file, request.id);
    setUploading(false);
    if (err) setError(err);
  };

  const handleDownload = async (doc: (typeof documents)[number]) => {
    const url = await downloadDocument(doc);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Drawer open onClose={onClose} layoutMode={layoutMode} title={SERVICE_REQUEST_TYPE_LABELS[request.request_type]}>
      <div className="flex items-center justify-between gap-2">
        <span className={`${cx.badge} ${SERVICE_REQUEST_STATUS_BADGE_CLASS[request.status]}`}>{SERVICE_REQUEST_STATUS_LABELS[request.status]}</span>
        <span className={cx.footnote} style={{ paddingTop: 0 }}>{new Date(request.created_at).toLocaleString()}</span>
      </div>
      {statusControl && <div className="mt-2">{statusControl}</div>}

      {request.category && <p className="mt-3 text-sm font-semibold" style={{ color: NAVY }}>{request.category}</p>}
      {request.question && <p className="mt-1 text-sm" style={{ color: NAVY }}>{request.question}</p>}
      {request.description && <p className="mt-1 text-sm" style={{ color: MUTED }}>{request.description}</p>}
      {request.drawing_reference && <p className="mt-1 text-xs" style={{ color: MUTED }}>Drawing ref: {request.drawing_reference}</p>}
      {request.meeting_details && (
        <div className="mt-2 space-y-0.5 text-sm" style={{ color: NAVY }}>
          {request.meeting_details.preferredDate && <p>Preferred date: {request.meeting_details.preferredDate} {request.meeting_details.preferredTime}</p>}
          {request.meeting_details.meetingType && <p>Type: {request.meeting_details.meetingType}</p>}
          {request.meeting_details.attendees && <p>Attendees: {request.meeting_details.attendees}</p>}
          {request.meeting_details.notes && <p className="text-xs" style={{ color: MUTED }}>{request.meeting_details.notes}</p>}
        </div>
      )}

      <div className={cx.cardHd + " mt-4"}>Attachments</div>
      {attachments.length === 0 ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>No attachments yet.</p>
      ) : (
        <div className="space-y-1">
          {attachments.map(doc => (
            <button key={doc.id} onClick={() => handleDownload(doc)} className={`flex w-full items-center gap-2 text-left ${cx.rowBorder}`}>
              <FileText size={14} style={{ color: BLUE }} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: NAVY }}>{doc.file_name}</span>
              <span className={cx.footnote} style={{ paddingTop: 0 }}>{formatFileSize(doc.file_size)}</span>
              <Download size={13} style={{ color: MUTED }} className="shrink-0" />
            </button>
          ))}
        </div>
      )}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChosen} />
      <Button variant="secondary" icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()} disabled={uploading} className="mt-2 w-full">
        {uploading ? "Uploading..." : "Attach a file"}
      </Button>

      <div className={cx.cardHd + " mt-4"}>Messages</div>
      <div className="space-y-2">
        {messages.length === 0 && <p className={cx.footnote} style={{ paddingTop: 0 }}>No messages yet.</p>}
        {messages.map(m => {
          const isViewer = m.author_kind === viewerKind;
          return (
            <div key={m.id} className={`flex ${isViewer ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${isViewer ? "" : "bg-slate-100 dark:bg-slate-700"}`}
                style={isViewer ? { background: BLUE, color: WHITE } : { color: NAVY }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                  {isViewer ? "You" : m.author_kind === "staff" ? "Speedpanel Team" : "Customer"}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="mt-3 flex items-end gap-2">
        <textarea value={reply} onChange={e => setReply(e.target.value)} rows={2} placeholder="Write a message..."
          className={cx.input} style={{ color: NAVY }} />
        <Button type="submit" disabled={sending || !reply.trim()} icon={<Send size={14} />} className="h-[46px] shrink-0">Send</Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
    </Drawer>
  );
};
