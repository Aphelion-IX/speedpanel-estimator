// =============================================================================
// Admin Documents -- catalog item card
// =============================================================================
// Modeled on src/pages/admin/products/productCard.tsx: touching anywhere on
// the card selects the document; the delete button stops propagation so it
// doesn't also fire the card's select handler, and confirms via native
// window.confirm, matching Products' zero-dependency posture. Named
// DocumentAdminCard (not DocumentCard) to avoid colliding with the read-only,
// customer-facing src/education/DocumentCard.tsx.
// =============================================================================
import { Trash2 } from "lucide-react";
import { cx, BLUE, NAVY, MUTED } from "../../../styleTokens";
import type { AdminDocument } from "./documentTypes";

export const DocumentAdminCard = ({ item, selected, onSelect, onDelete }: {
  item: AdminDocument; selected: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void;
}) => (
  <div onClick={() => onSelect(item.id)}
    className={cx.card + " flex cursor-pointer flex-col gap-2"} style={selected ? { borderColor: BLUE, borderWidth: 2 } : undefined}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{item.title}</div>
        <p className="mt-1 truncate text-sm" style={{ color: MUTED }}>{item.category} · {item.edition}</p>
      </div>
      <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${item.title}"? This can't be undone.`)) onDelete(item.id); }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
        <Trash2 size={14} />
      </button>
    </div>
  </div>
);
