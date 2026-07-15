// =============================================================================
// Admin Products -- corner-post table editor
// =============================================================================
// Composes two RepeatableRowEditors for panels' one nested case:
// cornerPost: { maxW, rows: [...] }[] -- an outer editor for the width bands,
// each rendering its own nested row editor beneath it. Keeps RepeatableRowEditor
// itself non-recursive/simple.
// =============================================================================
import { Plus, Trash2 } from "lucide-react";
import { MUTED, NAVY } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { IconButton } from "../../../ui/primitives";
import { RepeatableRowEditor } from "../shared/repeatableRowEditor";
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
            <IconButton size="sm" variant="danger" ariaLabel="Remove width band" onClick={() => removeBand(i)}>
              <Trash2 size={13} />
            </IconButton>
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
      <Button variant="ghost" icon={<Plus size={13} />} onClick={addBand}>Add width band</Button>
    </div>
  );
};
