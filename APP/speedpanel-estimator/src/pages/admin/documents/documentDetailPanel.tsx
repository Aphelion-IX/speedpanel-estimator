// =============================================================================
// Admin Documents -- detail panel (view / edit / add)
// =============================================================================
// Single-entity-type sibling of src/pages/admin/products/productDetailPanel.tsx --
// same view/edit/add shape, but with no per-category dispatch since there's
// only one document type. Field primitives and RepeatableRowEditor come from
// ../shared/, the same generic pieces Products uses.
// =============================================================================
import { useEffect, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { cx, BLUE, WHITE, NAVY, MUTED } from "../../../styleTokens";
import { Row } from "../../../ui/primitives";
import { EDU_CATEGORIES } from "../../../education/catalog";
import { Field, NumField, SelectField, StringListField, TextAreaField } from "../shared/fields";
import { RepeatableRowEditor } from "../shared/repeatableRowEditor";
import type { AdminDocument, AdminDocSection } from "./documentTypes";

type Draft = Record<string, unknown>;

const REAL_CATEGORIES = EDU_CATEGORIES.filter(c => c !== "All");

function blankDraft(): Draft {
  return {
    title: "", category: REAL_CATEGORIES[0], tags: [], description: "",
    edition: "", date: "", fileSize: "", fileType: "PDF", pageCount: 0,
    swatch: BLUE, sections: [], fileUrl: "",
  };
}

function draftFromItem(item: AdminDocument): Draft {
  const { id, createdAt, updatedAt, ...rest } = item as unknown as Draft & { id: string; createdAt: string; updatedAt: string };
  return rest;
}

const set = (setDraft: (fn: (d: Draft) => Draft) => void, key: string, value: unknown) =>
  setDraft(d => ({ ...d, [key]: value }));

function documentFields(d: Draft, setDraft: (fn: (d: Draft) => Draft) => void) {
  const doc = d as unknown as AdminDocument;
  return (
    <div className="space-y-3">
      <Field label="Title" value={doc.title} onChange={v => set(setDraft, "title", v)} />
      <SelectField label="Category" value={doc.category} onChange={v => set(setDraft, "category", v)}
        options={REAL_CATEGORIES.map(c => ({ value: c, label: c }))} />
      <StringListField label="Tags" value={doc.tags ?? []} onChange={v => set(setDraft, "tags", v)} />
      <TextAreaField label="Description" value={doc.description} onChange={v => set(setDraft, "description", v)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Edition" value={doc.edition} onChange={v => set(setDraft, "edition", v)} />
        <Field label="Date" value={doc.date} onChange={v => set(setDraft, "date", v)} />
        <Field label="File size" value={doc.fileSize} onChange={v => set(setDraft, "fileSize", v)} />
        <Field label="File type" value={doc.fileType} onChange={v => set(setDraft, "fileType", v)} />
        <NumField label="Page count" value={doc.pageCount} onChange={v => set(setDraft, "pageCount", v)} />
        <Field label="Swatch (CSS colour)" value={doc.swatch} onChange={v => set(setDraft, "swatch", v)} />
      </div>
      <Field label="File URL (optional, path under public/docs/...)" value={doc.fileUrl ?? ""} onChange={v => set(setDraft, "fileUrl", v)} />

      <div className={cx.cardHd + " mt-3"}>Sections</div>
      <RepeatableRowEditor<AdminDocSection>
        rows={doc.sections ?? []}
        columns={[
          { key: "name", label: "Name", type: "text" },
          { key: "description", label: "Description", type: "text" },
          { key: "pages", label: "Pages", type: "text" },
        ]}
        onChange={rows => set(setDraft, "sections", rows)}
        onAdd={() => set(setDraft, "sections", [...(doc.sections ?? []), { name: "", description: "", pages: "" }])}
        onRemove={i => set(setDraft, "sections", (doc.sections ?? []).filter((_, idx) => idx !== i))}
        addLabel="Add section"
      />
    </div>
  );
}

function documentView(doc: AdminDocument) {
  return (
    <div className="space-y-1">
      <Row k="Category" v={doc.category} dim />
      <Row k="Tags" v={doc.tags.length ? doc.tags.join(", ") : "—"} dim />
      <Row k="Edition" v={doc.edition} dim /><Row k="Date" v={doc.date} dim />
      <Row k="File" v={`${doc.fileType} · ${doc.fileSize}`} dim />
      <Row k="Pages" v={doc.pageCount} dim />
      <Row k="Sections" v={doc.sections.length} dim />
      {doc.fileUrl && (
        <div className="pt-1 text-sm">
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: BLUE }}>{doc.fileUrl}</a>
        </div>
      )}
    </div>
  );
}

export const DocumentAdminDetailPanel = ({ item, isAdding, isEditing, onSave, onCancel, onStartEdit, onDelete }: {
  item: AdminDocument | null; isAdding: boolean; isEditing: boolean;
  onSave: (values: Draft) => void; onCancel: () => void; onStartEdit: () => void; onDelete: () => void;
}) => {
  const [draft, setDraft] = useState<Draft>(() => (isAdding || !item ? blankDraft() : draftFromItem(item)));

  useEffect(() => {
    setDraft(isAdding || !item ? blankDraft() : draftFromItem(item));
    // Re-seed whenever the target changes: starting a fresh add, or opening a
    // different item for edit.
  }, [item?.id, isAdding, isEditing]);

  const isFormMode = isAdding || isEditing;
  const title = isAdding ? "New Document" : item ? item.title : "Select a document";

  return (
    <div className={cx.card}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>Document</span>
        {!isFormMode && item && (
          <div className="flex items-center gap-2">
            <button onClick={onStartEdit} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="text-base font-bold" style={{ color: NAVY }}>{title}</div>

      <div className="mt-4">
        {isFormMode ? (
          <>
            {documentFields(draft, setDraft)}
            <TextAreaField label="Notes" value={(draft.notes as string) ?? ""} onChange={v => set(setDraft, "notes", v)} />
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => onSave(draft)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
                <Save size={14} /> Save
              </button>
              <button onClick={onCancel} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold" style={{ color: NAVY }}>
                <X size={14} /> Cancel
              </button>
            </div>
          </>
        ) : item ? (
          documentView(item)
        ) : (
          <p className={cx.footnote}>Pick a document from the list, or use + Add to create one.</p>
        )}
      </div>
    </div>
  );
};
