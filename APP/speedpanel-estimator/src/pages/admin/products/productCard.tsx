// =============================================================================
// Admin Products -- catalog item card
// =============================================================================
// Modeled on src/education/DocumentCard.tsx: touching anywhere on the card
// selects the item; the delete button stops propagation so it doesn't also
// fire the card's select handler, and confirms via native window.confirm --
// no dialog primitive exists in the app, matching the zero-dependency posture
// already used elsewhere (e.g. the header's reset-all button).
// =============================================================================
import { Trash2 } from "lucide-react";
import { cx, BLUE, NAVY, MUTED } from "../../../styleTokens";
import type { ProductCategory, AdminPanel, AdminTrack, AdminFixing, AdminSealant, AdminColour } from "./productTypes";

export type ProductItem = AdminPanel | AdminTrack | AdminFixing | AdminSealant | AdminColour;

const summarize = (category: ProductCategory, item: ProductItem): { title: string; subtitle: string } => {
  switch (category) {
    case "panel": {
      const p = item as AdminPanel;
      return { title: p.label, subtitle: `${p.depth} · FRL ${p.frl}` };
    }
    case "track": {
      const t = item as AdminTrack;
      return { title: t.label, subtitle: `${t.dim} · ${t.system}` };
    }
    case "fixing": {
      const f = item as AdminFixing;
      return { title: f.code, subtitle: f.use };
    }
    case "sealant": {
      const s = item as AdminSealant;
      return { title: s.product, subtitle: s.system === "internal" ? "Internal system" : "External system" };
    }
    case "colour": {
      const c = item as AdminColour;
      return { title: c.label, subtitle: c.code };
    }
  }
};

export const ProductCard = ({ category, item, selected, onSelect, onDelete }: {
  category: ProductCategory; item: ProductItem; selected: boolean;
  onSelect: (id: string) => void; onDelete: (id: string) => void;
}) => {
  const { title, subtitle } = summarize(category, item);
  return (
    <div onClick={() => onSelect(item.id)}
      className={cx.card + " flex cursor-pointer flex-col gap-2"} style={selected ? { borderColor: BLUE, borderWidth: 2 } : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {category === "colour" && (
            <span className="mb-1.5 inline-block h-6 w-6 rounded-full border border-slate-200 dark:border-slate-700"
              style={{ background: (item as AdminColour).hex }} />
          )}
          <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{title}</div>
          <p className="mt-1 truncate text-sm" style={{ color: MUTED }}>{subtitle}</p>
        </div>
        <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${title}"? This can't be undone.`)) onDelete(item.id); }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};
