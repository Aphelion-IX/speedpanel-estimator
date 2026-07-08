// =============================================================================
// Admin -- generic form field primitives
// =============================================================================
// Shared across admin sections (Products' productCategoryForms.tsx, Documents'
// documentDetailPanel.tsx, ...). Module-scope (not defined inside a component)
// so their identity is stable across renders -- a component redefined on
// every render would remount on every keystroke and drop input focus.
// =============================================================================
import { useEffect, useState } from "react";
import { cx, NAVY } from "../../../styleTokens";

export const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div>
    <label className={cx.lbl}>{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className={cx.input} style={{ color: NAVY }} />
  </div>
);

export const NumField = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div>
    <label className={cx.lbl}>{label}</label>
    <input type="number" value={Number.isFinite(value) ? value : 0} onChange={e => onChange(Number(e.target.value))}
      className={cx.input} style={{ color: NAVY }} />
  </div>
);

export const SelectField = ({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
  <div>
    <label className={cx.lbl}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className={cx.input}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export const NumberListField = ({ label, value, onChange }: { label: string; value: number[]; onChange: (v: number[]) => void }) => {
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

export const StringListField = ({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) => {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  const commit = () => onChange(text.split(",").map(s => s.trim()).filter(Boolean));
  return (
    <div>
      <label className={cx.lbl}>{label} (comma-separated)</label>
      <input value={text} onChange={e => setText(e.target.value)} onBlur={commit} className={cx.input} style={{ color: NAVY }} />
    </div>
  );
};

export const TextAreaField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <label className={cx.lbl}>{label}</label>
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className={cx.input} style={{ color: NAVY }} />
  </div>
);
