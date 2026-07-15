// =============================================================================
// Admin Documents -- catalog item card
// =============================================================================
// Modeled on src/pages/admin/products/productCard.tsx: touching anywhere on
// the card selects the document; the delete button stops propagation so it
// doesn't also fire the card's select handler, and confirms via the shared
// ConfirmDialog before calling onDelete. Named
// DocumentAdminCard (not DocumentCard) to avoid colliding with the read-only,
// customer-facing src/education/DocumentCard.tsx.
// =============================================================================
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cx, BLUE, NAVY, MUTED } from "../../../styleTokens";
import { IconButton } from "../../../ui/primitives";
import { ConfirmDialog } from "../../../ui/confirmDialog";
import type { AdminDocument } from "./documentTypes";

export const DocumentAdminCard = ({ item, selected, onSelect, onDelete }: {
  item: AdminDocument; selected: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void;
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div onClick={() => onSelect(item.id)}
      className={cx.card + " flex cursor-pointer flex-col gap-2"} style={selected ? { borderColor: BLUE, borderWidth: 2 } : undefined}>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete document"
        description={`Delete "${item.title}"? This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { setConfirmDelete(false); onDelete(item.id); }}
        onCancel={() => setConfirmDelete(false)}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{item.title}</div>
          <p className="mt-1 truncate text-sm" style={{ color: MUTED }}>{item.category} · {item.edition}</p>
        </div>
        <span onClick={e => e.stopPropagation()} className="shrink-0">
          <IconButton variant="danger" size="sm" ariaLabel="Delete document" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
          </IconButton>
        </span>
      </div>
    </div>
  );
};
