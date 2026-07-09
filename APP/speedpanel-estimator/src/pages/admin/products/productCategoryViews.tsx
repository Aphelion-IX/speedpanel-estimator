// =============================================================================
// Admin Products -- per-category read-only views
// =============================================================================
// The non-editing counterpart to productCategoryForms.tsx: one summary view
// per category, plus itemTitle for the detail panel's header/list titles.
// =============================================================================
import { Row } from "../../../ui/primitives";
import type { ProductCategory, AdminPanel, AdminTrack, AdminFixing, AdminSealant, AdminColour } from "./productTypes";
import type { ProductItem } from "./productCard";

export function panelView(p: AdminPanel) {
  return (
    <div className="space-y-1">
      <Row k="Depth" v={p.depth} dim /><Row k="FRL" v={p.frl} dim /><Row k="Pack size" v={p.pack} dim />
      <Row k="Vertical C-track" v={`${p.ctrackDim} · ${p.ctrackStock} m`} dim />
      <Row k="J-track" v={p.jtrackDim} dim />
      <Row k="Max H vert / horiz" v={`${p.maxHVert} m / ${p.maxHHoriz} m`} dim />
      <Row k="Span (vert)" v={`W ${p.spanVert.maxW} · H ${p.spanVert.maxH}`} dim />
      <Row k="Horizontal span rows" v={p.spanHoriz.length} dim />
      <Row k="Corner post width bands" v={p.cornerPost.length} dim />
      <Row k="Horizontal C-track rows" v={p.horizCtrack.length} dim />
      <Row k="Price per panel" v={p.pricePerPanel != null ? `$${p.pricePerPanel}` : "Not set"} dim />
    </div>
  );
}

export function trackView(t: AdminTrack) {
  return (
    <div className="space-y-1">
      <Row k="Kind" v={t.kind} dim /><Row k="System" v={t.system} dim /><Row k="Dimension" v={t.dim} dim />
      {t.bmt && <Row k="BMT" v={t.bmt} dim />}
      {t.panelType != null && <Row k="Panel type" v={t.panelType} dim />}
      <Row k="Stock lengths" v={t.stockLengths.length ? `${t.stockLengths.join(", ")} m` : "—"} dim />
      <Row k="Price per metre" v={t.pricePerMetre != null ? `$${t.pricePerMetre}` : "Not set"} dim />
    </div>
  );
}

export function fixingView(f: AdminFixing) {
  return (
    <div className="space-y-1">
      <Row k="Code" v={f.code} dim /><Row k="Gauge" v={f.gauge} dim /><Row k="Length" v={`${f.lengthMm} mm`} dim />
      <Row k="Use" v={f.use} dim /><Row k="Per box" v={f.perBox} dim />
      <Row k="Price per box" v={f.pricePerBox != null ? `$${f.pricePerBox}` : "Not set"} dim />
    </div>
  );
}

export function sealantView(s: AdminSealant) {
  return (
    <div className="space-y-1">
      <Row k="Product" v={s.product} dim /><Row k="System" v={s.system} dim />
      <Row k="Coverage" v={`${s.m2PerSausage} m2/sausage`} dim /><Row k="Per box" v={s.perBox} dim />
      <Row k="Price per box" v={s.pricePerBox != null ? `$${s.pricePerBox}` : "Not set"} dim />
    </div>
  );
}

export function colourView(c: AdminColour) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-10 w-10 shrink-0 rounded-full border border-slate-200 dark:border-slate-700" style={{ background: c.hex }} />
      <div className="space-y-1">
        <Row k="Label" v={c.label} dim /><Row k="Code" v={c.code} dim /><Row k="Hex" v={c.hex} dim />
      </div>
    </div>
  );
}

export function itemTitle(category: ProductCategory, item: ProductItem): string {
  switch (category) {
    case "panel": return (item as AdminPanel).label;
    case "track": return (item as AdminTrack).label;
    case "fixing": return (item as AdminFixing).code;
    case "sealant": return (item as AdminSealant).product;
    case "colour": return (item as AdminColour).label;
  }
}
