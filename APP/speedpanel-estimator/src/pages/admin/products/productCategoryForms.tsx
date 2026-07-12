// =============================================================================
// Admin Products -- per-category edit forms
// =============================================================================
// blankDraft seeds a fresh Draft when adding; the five *Fields functions each
// render one category's editable fields, sharing the field primitives from
// productFields.tsx and the two array-field editors for panels' nested tables.
// =============================================================================
import { cx, NAVY, MUTED } from "../../../styleTokens";
import type { ProductCategory, AdminPanel, AdminTrack, AdminFixing, AdminSealant, AdminColour } from "./productTypes";
import { Field, NumField, SelectField, NumberListField } from "../../shared/fields";
import { RepeatableRowEditor } from "../shared/repeatableRowEditor";
import { CornerPostEditor } from "./cornerPostEditor";

export type Draft = Record<string, unknown>;

// Price is no longer set here -- see supabase/schema.sql's "Pricing: Price
// Lists" section. Kept as a read-only pointer (not just silently removed)
// so an admin who remembers this field's old location isn't left wondering
// where pricing went.
const DeprecatedPriceNote = () => (
  <div>
    <label className={cx.lbl}>Price</label>
    <p className="pt-1.5 text-sm" style={{ color: MUTED }}>Managed in Admin &rsaquo; Price Lists &rsaquo; PL1 - Standard.</p>
  </div>
);

// --- Blank drafts per category, used when isAdding ---------------------------
export function blankDraft(category: ProductCategory): Draft {
  switch (category) {
    case "panel":
      return {
        type: 51, label: "", depth: "", frl: "", pack: 0, ctrackStock: 0, ctrackDim: "", jtrackDim: "",
        maxHVert: 0, maxHHoriz: 0, spanVert: { maxW: "", maxH: "" }, spanHoriz: [], cornerPost: [], horizCtrack: [],
        pricePerPanel: undefined,
      };
    case "track":
      return { kind: "c-track", system: "internal", label: "", dim: "", bmt: "", panelType: undefined, stockLengths: [], pricePerMetre: undefined };
    case "fixing":
      return { code: "", gauge: "", lengthMm: 0, use: "", perBox: 0, pricePerBox: undefined };
    case "sealant":
      return { system: "internal", product: "", m2PerSausage: 0, perBox: 0, pricePerBox: undefined };
    case "colour":
      return { label: "", code: "", hex: "#cccccc" };
  }
}

const set = (setDraft: (fn: (d: Draft) => Draft) => void, key: string, value: unknown) =>
  setDraft(d => ({ ...d, [key]: value }));

export function panelFields(d: Draft, setDraft: (fn: (d: Draft) => Draft) => void) {
  const p = d as unknown as AdminPanel;
  const spanVert = (d.spanVert as AdminPanel["spanVert"]) ?? { maxW: "", maxH: "" };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Type" value={p.type} onChange={v => set(setDraft, "type", v)} />
        <Field label="Label" value={p.label} onChange={v => set(setDraft, "label", v)} />
        <Field label="Depth" value={p.depth} onChange={v => set(setDraft, "depth", v)} />
        <Field label="FRL" value={p.frl} onChange={v => set(setDraft, "frl", v)} />
        <NumField label="Pack size" value={p.pack} onChange={v => set(setDraft, "pack", v)} />
        <NumField label="C-track stock (m)" value={p.ctrackStock} onChange={v => set(setDraft, "ctrackStock", v)} />
        <Field label="C-track section" value={p.ctrackDim} onChange={v => set(setDraft, "ctrackDim", v)} />
        <Field label="J-track section" value={p.jtrackDim} onChange={v => set(setDraft, "jtrackDim", v)} />
        <NumField label="Max H vertical (m)" value={p.maxHVert} onChange={v => set(setDraft, "maxHVert", v)} />
        <NumField label="Max H horizontal (m)" value={p.maxHHoriz} onChange={v => set(setDraft, "maxHHoriz", v)} />
        <DeprecatedPriceNote />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Span vert -- max width" value={spanVert.maxW} onChange={v => set(setDraft, "spanVert", { ...spanVert, maxW: v })} />
        <Field label="Span vert -- max height" value={spanVert.maxH} onChange={v => set(setDraft, "spanVert", { ...spanVert, maxH: v })} />
      </div>

      <div className={cx.cardHd + " mt-3"}>Horizontal span table</div>
      <RepeatableRowEditor<AdminPanel["spanHoriz"][number]>
        rows={p.spanHoriz ?? []}
        columns={[
          { key: "maxW", label: "Max W", type: "text" }, { key: "maxH", label: "Max H", type: "text" },
          { key: "cTrack", label: "C-track", type: "text" }, { key: "fix", label: "Fixing", type: "text" },
          { key: "note", label: "Note", type: "text" },
        ]}
        onChange={rows => set(setDraft, "spanHoriz", rows)}
        onAdd={() => set(setDraft, "spanHoriz", [...(p.spanHoriz ?? []), { maxW: "", maxH: "", cTrack: "", fix: "" }])}
        onRemove={i => set(setDraft, "spanHoriz", (p.spanHoriz ?? []).filter((_, idx) => idx !== i))}
        addLabel="Add span row"
      />

      <div className={cx.cardHd + " mt-3"}>Corner post</div>
      <CornerPostEditor value={p.cornerPost ?? []} onChange={rows => set(setDraft, "cornerPost", rows)} />

      <div className={cx.cardHd + " mt-3"}>Horizontal C-track selection</div>
      <RepeatableRowEditor<AdminPanel["horizCtrack"][number]>
        rows={p.horizCtrack ?? []}
        columns={[
          { key: "wMax", label: "W max", type: "number" }, { key: "hMax", label: "H max", type: "number" },
          { key: "section", label: "Section", type: "text" }, { key: "fix", label: "Fix", type: "select", options: [1, 2] },
          { key: "outsideTable", label: "Outside table", type: "boolean" },
        ]}
        onChange={rows => set(setDraft, "horizCtrack", rows)}
        onAdd={() => set(setDraft, "horizCtrack", [...(p.horizCtrack ?? []), { wMax: 0, hMax: 0, section: "", fix: 1 }])}
        onRemove={i => set(setDraft, "horizCtrack", (p.horizCtrack ?? []).filter((_, idx) => idx !== i))}
        addLabel="Add C-track row"
      />
    </div>
  );
}

export function trackFields(d: Draft, setDraft: (fn: (d: Draft) => Draft) => void) {
  const t = d as unknown as AdminTrack;
  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField label="Kind" value={t.kind} onChange={v => set(setDraft, "kind", v)}
        options={[["c-track", "C-track"], ["j-track", "J-track"], ["head-flash", "Head flashing"], ["z-flash", "Z-flashing"], ["horiz-cover", "Horizontal cover"]]
          .map(([value, label]) => ({ value, label }))} />
      <SelectField label="System" value={t.system} onChange={v => set(setDraft, "system", v)}
        options={[["internal", "Internal"], ["external", "External"], ["both", "Both"]].map(([value, label]) => ({ value, label }))} />
      <Field label="Label" value={t.label} onChange={v => set(setDraft, "label", v)} />
      <Field label="Dimension / section" value={t.dim} onChange={v => set(setDraft, "dim", v)} />
      <Field label="BMT (optional)" value={t.bmt ?? ""} onChange={v => set(setDraft, "bmt", v)} />
      <NumField label="Panel type (optional)" value={t.panelType ?? 0} onChange={v => set(setDraft, "panelType", v || undefined)} />
      <DeprecatedPriceNote />
      <div className="col-span-2">
        <NumberListField label="Stock lengths" value={t.stockLengths ?? []} onChange={v => set(setDraft, "stockLengths", v)} />
      </div>
    </div>
  );
}

export function fixingFields(d: Draft, setDraft: (fn: (d: Draft) => Draft) => void) {
  const f = d as unknown as AdminFixing;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Code" value={f.code} onChange={v => set(setDraft, "code", v)} />
      <Field label="Gauge" value={f.gauge} onChange={v => set(setDraft, "gauge", v)} />
      <NumField label="Length (mm)" value={f.lengthMm} onChange={v => set(setDraft, "lengthMm", v)} />
      <NumField label="Per box" value={f.perBox} onChange={v => set(setDraft, "perBox", v)} />
      <DeprecatedPriceNote />
      <div className="col-span-2"><Field label="Use" value={f.use} onChange={v => set(setDraft, "use", v)} /></div>
    </div>
  );
}

export function sealantFields(d: Draft, setDraft: (fn: (d: Draft) => Draft) => void) {
  const s = d as unknown as AdminSealant;
  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField label="System" value={s.system} onChange={v => set(setDraft, "system", v)}
        options={[["internal", "Internal"], ["external", "External"]].map(([value, label]) => ({ value, label }))} />
      <Field label="Product" value={s.product} onChange={v => set(setDraft, "product", v)} />
      <NumField label="m2 per sausage" value={s.m2PerSausage} onChange={v => set(setDraft, "m2PerSausage", v)} />
      <NumField label="Per box" value={s.perBox} onChange={v => set(setDraft, "perBox", v)} />
      <DeprecatedPriceNote />
    </div>
  );
}

export function colourFields(d: Draft, setDraft: (fn: (d: Draft) => Draft) => void) {
  const c = d as unknown as AdminColour;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Label" value={c.label} onChange={v => set(setDraft, "label", v)} />
      <Field label="Code" value={c.code} onChange={v => set(setDraft, "code", v)} />
      <div>
        <label className={cx.lbl}>Hex</label>
        <div className="flex items-center gap-2">
          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#cccccc"} onChange={e => set(setDraft, "hex", e.target.value)}
            className="h-10 w-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
          <input value={c.hex} onChange={e => set(setDraft, "hex", e.target.value)} className={cx.input} style={{ color: NAVY }} />
        </div>
      </div>
    </div>
  );
}
