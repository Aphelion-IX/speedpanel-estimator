// =============================================================================
// Admin > Systems -- "Locked system data" staging editor
// =============================================================================
// Stages edits to the Internal/External "Locked system data" reference tables
// (src/data.ts's INT_LOCKED/EXT_LOCKED), persisted to localStorage via
// useSystemsStore -- fully decoupled from data.ts and the live calculators
// (see systemsStore.ts/seedFromLockedData.ts). Unlike Products/Documents,
// this isn't a searchable collection of cards -- it's two flat ordered lists,
// so the layout is a direct table editor (RepeatableRowEditor) plus a
// live-style preview reusing DataRow/LDRow from ui/lockedData.tsx, the same
// components the real calculator pages render this data with.
// =============================================================================
import { useState } from "react";
import { cx, BLUE, WHITE, NAVY } from "../../styleTokens";
import type { EffectiveLayout } from "../../useLayoutMode";
import { LDRow } from "../../ui/lockedData";
import { RepeatableRowEditor } from "./shared/repeatableRowEditor";
import { useSystemsStore } from "./systems/systemsStore";
import type { LockedRow, SystemId } from "./systems/systemsTypes";

const SYSTEM_LABEL: Record<SystemId, string> = { internal: "Internal", external: "External" };

const SystemToggle = ({ active, onChange }: { active: SystemId; onChange: (s: SystemId) => void }) => (
  <div className="grid grid-cols-2 gap-2">
    {(["internal", "external"] as SystemId[]).map(s => {
      const on = active === s;
      return (
        <button key={s} onClick={() => onChange(s)}
          className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
          style={on ? { borderColor: BLUE, background: BLUE, color: WHITE } : { color: BLUE }}>{SYSTEM_LABEL[s]}</button>
      );
    })}
  </div>
);

export const AdminSystemsPage = ({ layoutMode }: { layoutMode: EffectiveLayout }) => {
  const { internal, external, setRows } = useSystemsStore();
  const [system, setSystem] = useState<SystemId>("internal");

  const rows = system === "internal" ? internal : external;

  const editor = (
    <>
      <span className={`${cx.badge} mt-4 inline-block bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400`}>
        Local test data
      </span>
      <div className="mt-4"><SystemToggle active={system} onChange={setSystem} /></div>
      <div className={cx.card + " mt-4"}>
        <div className={cx.cardHd}>{SYSTEM_LABEL[system]} locked data rows</div>
        <div className="mt-3">
          <RepeatableRowEditor<LockedRow>
            rows={rows}
            columns={[
              { key: "key", label: "Key / header text", type: "text" },
              { key: "value", label: "Value (blank = section header)", type: "text" },
            ]}
            onChange={r => setRows(system, r)}
            onAdd={() => setRows(system, [...rows, { key: "", value: "" }])}
            onRemove={i => setRows(system, rows.filter((_, idx) => idx !== i))}
            addLabel="Add row"
          />
        </div>
      </div>
    </>
  );

  const preview = (
    <div className={cx.card}>
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>Preview</span>
      <div className="mt-3 space-y-2.5">
        {rows.length === 0 ? (
          <p className={cx.footnote}>No rows yet.</p>
        ) : (
          rows.map((r, i) => <LDRow key={i} row={r.value ? [r.key, r.value] : [r.key]} />)
        )}
      </div>
    </div>
  );

  if (layoutMode === "phone") {
    return (
      <div className="mt-2">
        {editor}
        <div className="mt-6">{preview}</div>
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-[1fr_380px] items-start gap-6">
      <div className="min-w-0">{editor}</div>
      <aside className="sticky top-5">{preview}</aside>
    </div>
  );
};
