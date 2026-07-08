// =============================================================================
// Admin Products -- detail panel (view / edit / add)
// =============================================================================
// Modeled on src/education/DocumentDetailPanel.tsx. Given a category and an
// item (or null), renders a read-only view with Edit/Delete, or -- while
// adding/editing -- a per-category form. Field components are module-scope
// (not defined inside ProductDetailPanel) so their identity is stable across
// renders; a component redefined on every render would remount on every
// keystroke and drop input focus.
// =============================================================================
import { useEffect, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { cx, BLUE, WHITE, NAVY, MUTED } from "../../../styleTokens";
import { Row } from "../../../ui/primitives";
import { CATEGORY_LABEL } from "./productTypes";
import type { ProductCategory, AdminPanel, AdminTrack, AdminFixing, AdminSealant, AdminColour } from "./productTypes";
import type { ProductItem } from "./productCard";
import { RepeatableRowEditor } from "./repeatableRowEditor";
import { CornerPostEditor } from "./cornerPostEditor";

type Draft = Record<string, unknown>;

// --- Blank drafts per category, used when isAdding ---------------------------
function blankDraft(category: ProductCategory): Draft {
  switch (category) {
    case "panel":
      return {
        type: 51, label: "", depth: "", frl: "", pack: 0, ctrackStock: 0, ctrackDim: "", jtrackDim: "",
        maxHVert: 0, maxHHoriz: 0, spanVert: { maxW: "", maxH: "" }, spanHoriz: [], cornerPost: [], horizCtrack: [],
      };
    case "track":
      return { kind: "c-track", system: "internal", label: "", dim: "", bmt: "", panelType: undefined, stockLengths: [] };
    case "fixing":
      return { code: "", gauge: "", lengthMm: 0, use: "", perBox: 0 };
    case "sealant":
      return { system: "internal", product: "", m2PerSausage: 0, perBox: 0 };
    case "colour":
      return { label: "", code: "", hex: "#cccccc" };
  }
}

function draftFromItem(item: ProductItem): Draft {
  const { id, createdAt, updatedAt, ...rest } = item as unknown as Draft & { id: string; createdAt: string; updatedAt: string };
  return rest;
}

// --- Module-scope field primitives -------------------------------------------
const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div>
    <label className={cx.lbl}>{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className={cx.input} style={{ color: NAVY }} />
  </div>
);

const NumField = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div>
    <label className={cx.lbl}>{label}</label>
    <input type="number" value={Number.isFinite(value) ? value : 0} onChange={e => onChange(Number(e.target.value))}
      className={cx.input} style={{ color: NAVY }} />
  </div>
);

const SelectField = ({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
  <div>
    <label className={cx.lbl}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className={cx.input}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const NumberListField = ({ label, value, onChange }: { label: string; value: number[]; onChange: (v: number[]) => void }) => {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  const commit = () => onChange(text.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n)));
  return (
    <div>
      <label className={cx.lbl}>{label} (comma-separated, m)</label>
      <input value={text} onChange={e => setText(e.target.value)} onBlur={commit} className={cx.input} style={{ color: NAVY }} />
    </div>
  );
};

const TextAreaField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <label className={cx.lbl}>{label}</label>
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className={cx.input} style={{ color: NAVY }} />
  </div>
);

// --- Per-category edit forms --------------------------------------------------
const set = (setDraft: (fn: (d: Draft) => Draft) => void, key: string, value: unknown) =>
  setDraft(d => ({ ...d, [key]: value }));

function panelFields(d: Draft, setDraft: (fn: (d: Draft) => Draft) => void) {
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

function trackFields(d: Draft, setDraft: (fn: (d: Draft) => Draft) => void) {
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
      <div className="col-span-2">
        <NumberListField label="Stock lengths" value={t.stockLengths ?? []} onChange={v => set(setDraft, "stockLengths", v)} />
      </div>
    </div>
  );
}

function fixingFields(d: Draft, setDraft: (fn: (d: Draft) => Draft) => void) {
  const f = d as unknown as AdminFixing;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Code" value={f.code} onChange={v => set(setDraft, "code", v)} />
      <Field label="Gauge" value={f.gauge} onChange={v => set(setDraft, "gauge", v)} />
      <NumField label="Length (mm)" value={f.lengthMm} onChange={v => set(setDraft, "lengthMm", v)} />
      <NumField label="Per box" value={f.perBox} onChange={v => set(setDraft, "perBox", v)} />
      <div className="col-span-2"><Field label="Use" value={f.use} onChange={v => set(setDraft, "use", v)} /></div>
    </div>
  );
}

function sealantFields(d: Draft, setDraft: (fn: (d: Draft) => Draft) => void) {
  const s = d as unknown as AdminSealant;
  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField label="System" value={s.system} onChange={v => set(setDraft, "system", v)}
        options={[["internal", "Internal"], ["external", "External"]].map(([value, label]) => ({ value, label }))} />
      <Field label="Product" value={s.product} onChange={v => set(setDraft, "product", v)} />
      <NumField label="m2 per sausage" value={s.m2PerSausage} onChange={v => set(setDraft, "m2PerSausage", v)} />
      <NumField label="Per box" value={s.perBox} onChange={v => set(setDraft, "perBox", v)} />
    </div>
  );
}

function colourFields(d: Draft, setDraft: (fn: (d: Draft) => Draft) => void) {
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

// --- Per-category read-only views --------------------------------------------
function panelView(p: AdminPanel) {
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
    </div>
  );
}

function trackView(t: AdminTrack) {
  return (
    <div className="space-y-1">
      <Row k="Kind" v={t.kind} dim /><Row k="System" v={t.system} dim /><Row k="Dimension" v={t.dim} dim />
      {t.bmt && <Row k="BMT" v={t.bmt} dim />}
      {t.panelType != null && <Row k="Panel type" v={t.panelType} dim />}
      <Row k="Stock lengths" v={t.stockLengths.length ? `${t.stockLengths.join(", ")} m` : "—"} dim />
    </div>
  );
}

function fixingView(f: AdminFixing) {
  return (
    <div className="space-y-1">
      <Row k="Code" v={f.code} dim /><Row k="Gauge" v={f.gauge} dim /><Row k="Length" v={`${f.lengthMm} mm`} dim />
      <Row k="Use" v={f.use} dim /><Row k="Per box" v={f.perBox} dim />
    </div>
  );
}

function sealantView(s: AdminSealant) {
  return (
    <div className="space-y-1">
      <Row k="Product" v={s.product} dim /><Row k="System" v={s.system} dim />
      <Row k="Coverage" v={`${s.m2PerSausage} m2/sausage`} dim /><Row k="Per box" v={s.perBox} dim />
    </div>
  );
}

function colourView(c: AdminColour) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-10 w-10 shrink-0 rounded-full border border-slate-200 dark:border-slate-700" style={{ background: c.hex }} />
      <div className="space-y-1">
        <Row k="Label" v={c.label} dim /><Row k="Code" v={c.code} dim /><Row k="Hex" v={c.hex} dim />
      </div>
    </div>
  );
}

// --- ProductDetailPanel -------------------------------------------------------
export const ProductDetailPanel = ({ category, item, isAdding, isEditing, onSave, onCancel, onStartEdit, onDelete }: {
  category: ProductCategory; item: ProductItem | null; isAdding: boolean; isEditing: boolean;
  onSave: (values: Draft) => void; onCancel: () => void; onStartEdit: () => void; onDelete: () => void;
}) => {
  const [draft, setDraft] = useState<Draft>(() => (isAdding || !item ? blankDraft(category) : draftFromItem(item)));

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
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>{CATEGORY_LABEL[category]}</span>
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
            {formForCategory()}
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
          viewForCategory(item)
        ) : (
          <p className={cx.footnote}>Pick an item from the list, or use + Add to create one.</p>
        )}
      </div>
    </div>
  );
};

function itemTitle(category: ProductCategory, item: ProductItem): string {
  switch (category) {
    case "panel": return (item as AdminPanel).label;
    case "track": return (item as AdminTrack).label;
    case "fixing": return (item as AdminFixing).code;
    case "sealant": return (item as AdminSealant).product;
    case "colour": return (item as AdminColour).label;
  }
}
