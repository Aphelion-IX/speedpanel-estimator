// =============================================================================
// Admin -- generic repeatable-row table editor
// =============================================================================
// A small table-like editor for array-of-object fields, shared across admin
// sections (Products' spanHoriz/horizCtrack, cornerPostEditor.tsx's nesting,
// Documents' sections). Deliberately non-recursive/simple: one flat table of
// rows, each cell typed per-column.
// =============================================================================
import { Plus, Trash2 } from "lucide-react";
import { BLUE, MUTED, NAVY } from "../../../styleTokens";

export interface RepeatableColumn<T> {
  key: keyof T;
  label: string;
  type?: "text" | "number" | "select" | "boolean";
  options?: (string | number)[]; // required when type === "select"
}

const cellValueFromInput = <T,>(col: RepeatableColumn<T>, raw: string): unknown => {
  if (col.type === "number") return raw === "" ? undefined : Number(raw);
  if (col.type === "select") return col.options?.find(o => String(o) === raw) ?? raw;
  return raw;
};

export function RepeatableRowEditor<T extends Record<string, unknown>>({
  rows, columns, onChange, onAdd, onRemove, addLabel = "Add row",
}: {
  rows: T[];
  columns: RepeatableColumn<T>[];
  onChange: (rows: T[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  addLabel?: string;
}) {
  const setCell = (index: number, col: RepeatableColumn<T>, raw: string) => {
    const value = cellValueFromInput(col, raw);
    onChange(rows.map((row, i) => (i === index ? ({ ...row, [col.key]: value } as T) : row)));
  };

  const setBoolCell = (index: number, col: RepeatableColumn<T>, checked: boolean) => {
    onChange(rows.map((row, i) => (i === index ? ({ ...row, [col.key]: checked } as T) : row)));
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {columns.map(c => (
                <th key={String(c.key)} className="pb-1.5 pr-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>{c.label}</th>
              ))}
              <th className="pb-1.5 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                {columns.map(c => {
                  const raw = row[c.key];
                  return (
                    <td key={String(c.key)} className="py-1.5 pr-2 align-middle">
                      {c.type === "boolean" ? (
                        <input type="checkbox" checked={!!raw} onChange={e => setBoolCell(i, c, e.target.checked)} />
                      ) : c.type === "select" ? (
                        <select value={raw == null ? "" : String(raw)} onChange={e => setCell(i, c, e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs" style={{ color: NAVY }}>
                          {(c.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={c.type === "number" ? "number" : "text"} value={raw == null ? "" : String(raw)}
                          onChange={e => setCell(i, c, e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs" style={{ color: NAVY }} />
                      )}
                    </td>
                  );
                })}
                <td className="py-1.5 text-right">
                  <button onClick={() => onRemove(i)} className="grid h-6 w-6 place-items-center rounded text-slate-400 dark:text-slate-500">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={onAdd} className="flex items-center gap-1.5 text-xs font-bold" style={{ color: BLUE }}>
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  );
}
