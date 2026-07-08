// =============================================================================
// Admin Products -- corner-post table editor
// =============================================================================
// Composes two RepeatableRowEditors for panels' one nested case:
// cornerPost: { maxW, rows: [...] }[] -- an outer editor for the width bands,
// each rendering its own nested row editor beneath it. Keeps RepeatableRowEditor
// itself non-recursive/simple.
// =============================================================================
import { Plus, Trash2 } from "lucide-react";
import { BLUE, MUTED, NAVY } from "../../../styleTokens";
import { RepeatableRowEditor } from "./repeatableRowEditor";
import type { AdminPanel } from "./productTypes";

type CornerPost = AdminPanel["cornerPost"];
type CornerPostRow = CornerPost[number]["rows"][number];

export const CornerPostEditor = ({ value, onChange }: { value: CornerPost; onChange: (next: CornerPost) => void }) => {
  const addBand = () => onChange([...value, { maxW: 0, rows: [] }]);
  const removeBand = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const setMaxW = (i: number, maxW: number) => onChange(value.map((b, idx) => (idx === i ? { ...b, maxW } : b)));
  const setRows = (i: number, rows: CornerPostRow[]) => onChange(value.map((b, idx) => (idx === i ? { ...b, rows } : b)));

  return (
    <div className="space-y-3">
      {value.map((band, i) => (
        <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>
              Max width (m)
              <input type="number" value={band.maxW} onChange={e => setMaxW(i, Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs" style={{ color: NAVY }} />
            </label>
            <button onClick={() => removeBand(i)} className="grid h-7 w-7 place-items-center rounded text-slate-400 dark:text-slate-500">
              <Trash2 size={13} />
            </button>
          </div>
          <div className="mt-2">
            <RepeatableRowEditor<CornerPostRow>
              rows={band.rows}
              columns={[
                { key: "maxH", label: "Max H (m)", type: "number" },
                { key: "section", label: "Section", type: "text" },
                { key: "fixPerCourse", label: "Fix/course", type: "select", options: [1, 2] },
              ]}
              onChange={rows => setRows(i, rows)}
              onAdd={() => setRows(i, [...band.rows, { maxH: 0, section: "" }])}
              onRemove={idx => setRows(i, band.rows.filter((_, r) => r !== idx))}
              addLabel="Add height row"
            />
          </div>
        </div>
      ))}
      <button onClick={addBand} className="flex items-center gap-1.5 text-xs font-bold" style={{ color: BLUE }}>
        <Plus size={13} /> Add width band
      </button>
    </div>
  );
};
