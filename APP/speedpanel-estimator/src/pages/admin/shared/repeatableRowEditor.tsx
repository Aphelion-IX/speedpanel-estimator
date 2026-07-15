// =============================================================================
// Admin -- generic repeatable-row table editor
// =============================================================================
// A small table-like editor for array-of-object fields, shared across admin
// sections (Products' spanHoriz/horizCtrack, cornerPostEditor.tsx's nesting,
// Documents' sections). Deliberately non-recursive/simple: one flat table of
// rows, each cell typed per-column.
// =============================================================================
import { Plus, Trash2 } from "lucide-react";
import { NAVY } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { IconButton } from "../../../ui/primitives";
import { Table, type TableColumn } from "../../../ui/table";

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

  const tableColumns: TableColumn<T>[] = [
    ...columns.map(c => ({
      key: String(c.key),
      header: c.label,
      cell: (row: T, i: number) => {
        const raw = row[c.key];
        return c.type === "boolean" ? (
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
        );
      },
    })),
    {
      key: "remove",
      header: "",
      align: "center" as const,
      cell: (_row: T, i: number) => (
        <IconButton variant="danger" size="sm" ariaLabel="Remove row" onClick={() => onRemove(i)}>
          <Trash2 size={14} />
        </IconButton>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      <Table columns={tableColumns} rows={rows} rowKey={(_row, i) => i} />
      <Button variant="ghost" icon={<Plus size={13} />} onClick={onAdd}>{addLabel}</Button>
    </div>
  );
}
