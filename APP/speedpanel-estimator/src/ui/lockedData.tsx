// =============================================================================
// Locked system data
// =============================================================================
// Read-only reference-table display for the "Locked system data" card shown
// in both calculators -- generic key/value row, header/row dispatcher, and
// the Internal/External wrappers over each system's INT_LOCKED/EXT_LOCKED
// table (see ./data).
// =============================================================================
import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { cx } from "../styleTokens";
import { INT_LOCKED, EXT_LOCKED } from "../data";

// --- Locked system data -------------------------------------------------------
// INT_LOCKED / EXT_LOCKED (display-only reference tables) now live in ./data.
export const DataRow = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5 last:border-0">
    <span className="shrink-0 text-sm font-medium text-slate-400 dark:text-slate-500">{k}</span>
    <span className="text-right text-sm font-semibold text-slate-700 dark:text-slate-200">{v}</span>
  </div>
);
export const LDRow = ({ row }: { row: string[] }) =>
  row.length === 1
    ? <div className={cx.ldHead}>{row[0].replace(/-/g, "")}</div>
    : <DataRow k={row[0]} v={row[1]} />;
export const LockedDataInt = () => <div className={cx.ldWrap}>{INT_LOCKED.map((r, i) => <LDRow key={i} row={r} />)}</div>;
export const LockedDataExt = () => <div className={cx.ldWrap}>{EXT_LOCKED.map((r, i) => <LDRow key={i} row={r} />)}</div>;

// --- LockedDataFooter ----------------------------------------------------------
// Calculator footer shared by Internal/External: a "Locked system data"
// accordion (title + one of the tables above) followed by the Export PDF
// button. Owns its own open/closed state -- neither calculator needs it
// for anything else.
export const LockedDataFooter = ({ title, table }: { title: string; table: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(v => !v)} className={cx.accordion}>
        <span className="flex items-center gap-2"><Lock size={13} className="text-slate-400 dark:text-slate-500" /> {title}</span>
        <ChevronDown size={16} className={`text-blue-300 dark:text-blue-700 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && table}
      <button className={cx.exportBtn}>Export PDF</button>
    </>
  );
};
