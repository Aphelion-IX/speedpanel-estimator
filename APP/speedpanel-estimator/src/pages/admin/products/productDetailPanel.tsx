// =============================================================================
// Admin Products -- detail panel (view / edit / add)
// =============================================================================
// Modeled on src/education/DocumentDetailPanel.tsx. Given a category and an
// item (or null), renders a read-only view with Edit/Delete, or -- while
// adding/editing -- a per-category form. Per-category forms/views live in
// productCategoryForms.tsx/productCategoryViews.tsx; this file only owns the
// draft state and the shared chrome (title, edit/delete/save/cancel controls).
// =============================================================================
import { useEffect, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { cx, NAVY, MUTED } from "../../../styleTokens";
import { IconButton } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { ConfirmDialog } from "../../../ui/confirmDialog";
import { CATEGORY_LABEL } from "./productTypes";
import type { ProductCategory, AdminPanel, AdminTrack, AdminFixing, AdminSealant, AdminColour } from "./productTypes";
import type { ProductItem } from "./productCard";
import { TextAreaField } from "../../shared/fields";
import { type Draft, blankDraft, panelFields, trackFields, fixingFields, sealantFields, colourFields } from "./productCategoryForms";
import { panelView, trackView, fixingView, sealantView, colourView, itemTitle } from "./productCategoryViews";

function draftFromItem(item: ProductItem): Draft {
  const { id, createdAt, updatedAt, ...rest } = item as unknown as Draft & { id: string; createdAt: string; updatedAt: string };
  return rest;
}

const set = (setDraft: (fn: (d: Draft) => Draft) => void, key: string, value: unknown) =>
  setDraft(d => ({ ...d, [key]: value }));

export const ProductDetailPanel = ({ category, item, isAdding, isEditing, onSave, onCancel, onStartEdit, onDelete }: {
  category: ProductCategory; item: ProductItem | null; isAdding: boolean; isEditing: boolean;
  onSave: (values: Draft) => void; onCancel: () => void; onStartEdit: () => void; onDelete: () => void;
}) => {
  const [draft, setDraft] = useState<Draft>(() => (isAdding || !item ? blankDraft(category) : draftFromItem(item)));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft(isAdding || !item ? blankDraft(category) : draftFromItem(item));
    // Re-seed whenever the target changes: switching categories, starting a
    // fresh add, or opening a different item for edit.
  }, [category, item?.id, isAdding, isEditing]);

  const formForCategory = () => {
    switch (category) {
      case "panel": return panelFields(draft, setDraft);
      case "track": return trackFields(draft, setDraft);
      case "fixing": return fixingFields(draft, setDraft);
      case "sealant": return sealantFields(draft, setDraft);
      case "colour": return colourFields(draft, setDraft);
    }
  };

  const viewForCategory = (it: ProductItem) => {
    switch (category) {
      case "panel": return panelView(it as AdminPanel);
      case "track": return trackView(it as AdminTrack);
      case "fixing": return fixingView(it as AdminFixing);
      case "sealant": return sealantView(it as AdminSealant);
      case "colour": return colourView(it as AdminColour);
    }
  };

  const isFormMode = isAdding || isEditing;
  const title = isAdding ? `New ${CATEGORY_LABEL[category].replace(/s$/, "")}`
    : item ? itemTitle(category, item) : `Select a ${CATEGORY_LABEL[category].replace(/s$/, "").toLowerCase()}`;

  return (
    <div className={cx.card}>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete item"
        description={item ? `Delete "${itemTitle(category, item)}"? This can't be undone.` : ""}
        confirmLabel="Delete"
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>{CATEGORY_LABEL[category]}</span>
        {!isFormMode && item && (
          <div className="flex items-center gap-2">
            <IconButton size="sm" ariaLabel="Edit item" onClick={onStartEdit}><Pencil size={14} /></IconButton>
            <IconButton size="sm" variant="danger" ariaLabel="Delete item" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /></IconButton>
          </div>
        )}
      </div>
      <div className="text-base font-bold" style={{ color: NAVY }}>{title}</div>

      <div className="mt-4">
        {isFormMode ? (
          <>
            {formForCategory()}
            <TextAreaField label="Notes" value={(draft.notes as string) ?? ""} onChange={v => set(setDraft, "notes", v)} />
            <div className="mt-4 flex items-center gap-2">
              <Button className="flex-1" icon={<Save size={14} />} onClick={() => onSave(draft)}>Save</Button>
              <Button variant="secondary" className="flex-1" icon={<X size={14} />} onClick={onCancel}>Cancel</Button>
            </div>
          </>
        ) : item ? (
          viewForCategory(item)
        ) : (
          <p className={cx.footnote}>Pick an item from the list, or use + Add to create one.</p>
        )}
      </div>
    </div>
  );
};
