// =============================================================================
// Admin > Maths -- editable estimate calculation constants & decision tables
// =============================================================================
// Unlike Products/Systems/Documents/Requests (all decoupled preview-only
// staging areas), edits here are meant to actually change calculator output.
// data.ts reads both the scalar constants (mathConstants.ts) and the
// per-panel-type decision tables (systemTables.ts) once at module load, so
// the only way for an edit to take effect is to persist it and reload the
// page -- there's no React state/context threaded through the pure
// calculation functions in src/estimate/* for this to update live otherwise.
//
// Organized as tabs per panel type (P51/P64/P78/External) rather than one
// flat Internal/External page: each internal tab shows that type's own
// scalar (max vertical height) plus its corner-post and horizontal-C-track
// decision tables; shared internal scalars (stock lengths, waste threshold,
// etc.) render once, above the tabs, rather than duplicated on all three.
// =============================================================================
import { useEffect, useRef, useState } from "react";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../styleTokens";
import { NumField, NumberListField } from "../shared/fields";
import { MATH_CONSTANT_DEFAULTS, MATH_CONSTANT_FIELDS, type MathConstants, type MathConstantField } from "../../mathConstants";
import { useMathConstantsStore } from "./maths/mathConstantsStore";
import { SYSTEM_TABLES_DEFAULTS, type SystemTables, type CornerPostBand, type HorizCtrackBand, type ShaftTrackRow } from "../../systemTables";
import { useSystemTablesStore } from "./maths/systemTablesStore";
import { CornerPostEditor } from "./products/cornerPostEditor";
import { RepeatableRowEditor } from "./shared/repeatableRowEditor";

type PanelTypeKey = "51" | "64" | "78";
type TabKey = PanelTypeKey | "external";
const TABS: { key: TabKey; label: string }[] = [
  { key: "51", label: "P51" },
  { key: "64", label: "P64" },
  { key: "78", label: "P78" },
  { key: "external", label: "External" },
];

// --- Non-blocking table validation --------------------------------------------
// The lookup functions (spanLookups.ts) are first-match-wins over ordered
// bands, so a table saved out of order would silently misbehave -- warn, but
// don't block, since an admin mid-edit shouldn't be locked out.
const isAscending = (nums: number[]) => nums.every((n, i) => i === 0 || n > nums[i - 1]);

const cornerPostWarning = (bands: CornerPostBand[]): string | null => {
  if (!isAscending(bands.map(b => b.maxW))) return "Width bands should be in ascending order.";
  for (const b of bands) {
    if (!isAscending(b.rows.map(r => r.maxH))) return `Height rows under the ${b.maxW} m band should be in ascending order.`;
  }
  return null;
};

// horizCtrack is a genuine 2D band table (width AND height), not simply
// sorted by one field -- only height thresholds *within the same width* need
// to ascend for the lookup to behave correctly.
const horizCtrackWarning = (bands: HorizCtrackBand[]): string | null => {
  const byWidth = new Map<number, number[]>();
  for (const b of bands) byWidth.set(b.wMax, [...(byWidth.get(b.wMax) ?? []), b.hMax ?? Infinity]);
  for (const [wMax, heights] of byWidth) {
    if (!isAscending(heights)) return `Height thresholds for the ${wMax} m width band should be in ascending order.`;
  }
  return null;
};

const shaftTrackWarning = (rows: ShaftTrackRow[]): string | null =>
  isAscending(rows.map(r => r.maxF)) ? null : "Floor-height rows should be in ascending order.";

const TableWarning = ({ message }: { message: string | null }) =>
  message ? <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">{message}</p> : null;

export const AdminMathsPage = () => {
  const mathStore = useMathConstantsStore();
  const tablesStore = useSystemTablesStore();
  const [constants, setConstants] = useState<MathConstants>(mathStore.draft);
  const [tables, setTables] = useState<SystemTables>(tablesStore.draft);
  const touchedConstants = useRef(false);
  const touchedTables = useRef(false);
  const [tab, setTab] = useState<TabKey>("51");

  // Same "don't clobber an in-progress edit" pattern as before, applied to
  // both stores independently -- see the original comment this replaces.
  useEffect(() => { if (!touchedConstants.current) setConstants(mathStore.draft); }, [mathStore.draft]);
  useEffect(() => { if (!touchedTables.current) setTables(tablesStore.draft); }, [tablesStore.draft]);

  const setConst = <K extends keyof MathConstants>(key: K, value: MathConstants[K]) => {
    touchedConstants.current = true;
    setConstants(d => ({ ...d, [key]: value }));
  };
  const setCornerPost = (type: PanelTypeKey, bands: CornerPostBand[]) => {
    touchedTables.current = true;
    setTables(t => ({ ...t, cornerPost: { ...t.cornerPost, [type]: bands } }));
  };
  const setHorizCtrack = (type: PanelTypeKey, bands: HorizCtrackBand[]) => {
    touchedTables.current = true;
    // Normalize a blanked "Max H" cell back to null (unbounded) rather than
    // undefined -- RepeatableRowEditor's number cells resolve an empty input
    // to undefined, but the schema requires hMax to be present (number or
    // null), so an undefined value would fail validation on the next load.
    setTables(t => ({ ...t, horizCtrack: { ...t.horizCtrack, [type]: bands.map(b => ({ ...b, hMax: b.hMax ?? null })) } }));
  };
  const setShaftTrack = (rows: ShaftTrackRow[]) => {
    touchedTables.current = true;
    setTables(t => ({ ...t, shaftTrack: rows }));
  };

  // save()/resetToDefaults() always reload: both stores now persist locally
  // regardless of whether the Supabase sync succeeds (see mathConstantsStore.ts/
  // systemTablesStore.ts), so a non-null err here means only that cross-device
  // sync failed, not that this device's edit was lost -- worth telling the
  // admin (so they know to retry once back online), but not worth blocking
  // the reload that actually applies their change to this session.
  const save = async () => {
    const [constErr, tablesErr] = await Promise.all([mathStore.save(constants), tablesStore.save(tables)]);
    const err = constErr || tablesErr;
    if (err) window.alert(`Saved on this device, but failed to sync to the server: ${err}\n\nOther devices won't see this change until you save again while online.`);
    window.location.reload();
  };
  const cancel = () => {
    touchedConstants.current = false; setConstants(mathStore.draft);
    touchedTables.current = false; setTables(tablesStore.draft);
  };
  const resetToDefaults = async () => {
    const [constErr, tablesErr] = await Promise.all([mathStore.save(MATH_CONSTANT_DEFAULTS), tablesStore.save(SYSTEM_TABLES_DEFAULTS)]);
    const err = constErr || tablesErr;
    if (err) window.alert(`Reset on this device, but failed to sync to the server: ${err}\n\nOther devices won't see this change until you reset again while online.`);
    window.location.reload();
  };

  const renderField = (f: MathConstantField) => (
    <div key={f.key}>
      {f.kind === "number" ? (
        <NumField label={f.label} value={constants[f.key] as number} onChange={v => setConst(f.key, v as MathConstants[typeof f.key])} />
      ) : (
        <NumberListField label={f.label} value={constants[f.key] as number[]} onChange={v => setConst(f.key, v as MathConstants[typeof f.key])} />
      )}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{f.helpText}</p>
    </div>
  );

  const sharedInternalFields = MATH_CONSTANT_FIELDS.filter(f => f.group === "internal" && f.panelType === undefined);
  const externalFields = MATH_CONSTANT_FIELDS.filter(f => f.group === "external");
  const shaftWarning = shaftTrackWarning(tables.shaftTrack);

  return (
    <div className="mt-2">
      <span className={`${cx.badge} inline-block bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400`}>
        Saving applies these values to every estimate and reloads the app
      </span>
      {(mathStore.error || tablesStore.error) && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{mathStore.error || tablesStore.error} (showing this device's last-saved values)</p>
      )}
      {(mathStore.loading || tablesStore.loading) && <p className="mt-2 text-xs" style={{ color: MUTED }}>Loading latest saved values...</p>}

      <div className="mt-4 grid grid-cols-4 gap-2">
        {TABS.map(t => {
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={"w-full rounded-xl border-2 py-3 px-2 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
              style={on ? { borderColor: BLUE, background: BLUE, color: WHITE } : { color: BLUE }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab !== "external" && (
        <div className={`${cx.card} mt-4`}>
          <div className={cx.cardHd}>Internal — shared constants</div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Applies across all internal panel types (P51/P64/P78).</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sharedInternalFields.map(renderField)}
          </div>
        </div>
      )}

      {tab === "external" ? (
        <div className={`${cx.card} mt-4`}>
          <div className={cx.cardHd}>External system constants</div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {externalFields.map(renderField)}
          </div>
        </div>
      ) : (
        <>
          <div className={`${cx.card} mt-4`}>
            <div className={cx.cardHd}>P{tab} constants</div>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {MATH_CONSTANT_FIELDS.filter(f => f.panelType === Number(tab)).map(renderField)}
            </div>
          </div>

          <div className={`${cx.card} mt-4`}>
            <div className={cx.cardHd}>Corner post table</div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Section used for Corner wall posts, by width band and height.</p>
            <TableWarning message={cornerPostWarning(tables.cornerPost[tab] ?? [])} />
            <div className="mt-3">
              <CornerPostEditor value={tables.cornerPost[tab] ?? []} onChange={bands => setCornerPost(tab, bands)} />
            </div>
          </div>

          <div className={`${cx.card} mt-4`}>
            <div className={cx.cardHd}>Horizontal C-track table</div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Section used for horizontal walls, by width/height band. Leave "Max H" blank for the unbounded (outside-table) row.</p>
            <TableWarning message={horizCtrackWarning(tables.horizCtrack[tab] ?? [])} />
            <div className="mt-3">
              <RepeatableRowEditor<HorizCtrackBand>
                rows={tables.horizCtrack[tab] ?? []}
                columns={[
                  { key: "wMax", label: "Max W (m)", type: "number" },
                  { key: "hMax", label: "Max H (m)", type: "number" },
                  { key: "section", label: "Section", type: "text" },
                  { key: "fix", label: "Fix/face", type: "select", options: [1, 2] },
                  { key: "outsideTable", label: "Outside table", type: "boolean" },
                ]}
                onChange={bands => setHorizCtrack(tab, bands)}
                onAdd={() => setHorizCtrack(tab, [...(tables.horizCtrack[tab] ?? []), { wMax: 0, hMax: 0, section: "", fix: 1 }])}
                onRemove={i => setHorizCtrack(tab, (tables.horizCtrack[tab] ?? []).filter((_, idx) => idx !== i))}
                addLabel="Add band"
              />
            </div>
          </div>

          {tab === "78" && (
            <div className={`${cx.card} mt-4`}>
              <div className={cx.cardHd}>Shaft wall vertical track (by floor height)</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Shaft walls are always P78, so this table isn't split per panel type.</p>
              <TableWarning message={shaftWarning} />
              <div className="mt-3">
                <RepeatableRowEditor<ShaftTrackRow>
                  rows={tables.shaftTrack}
                  columns={[
                    { key: "maxF", label: "Max floor height (m)", type: "number" },
                    { key: "section", label: "Section", type: "text" },
                    { key: "fixPerCourse", label: "Fix/course", type: "select", options: [1, 2] },
                  ]}
                  onChange={setShaftTrack}
                  onAdd={() => setShaftTrack([...tables.shaftTrack, { maxF: 0, section: "", fixPerCourse: 1 }])}
                  onRemove={i => setShaftTrack(tables.shaftTrack.filter((_, idx) => idx !== i))}
                  addLabel="Add row"
                />
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={save} className="rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm active:scale-95 transition-all" style={{ background: BLUE, color: WHITE }}>
          Save &amp; reload
        </button>
        <button onClick={cancel} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold active:scale-95 transition-all" style={{ color: NAVY }}>
          Cancel
        </button>
        <button onClick={resetToDefaults} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 active:scale-95 transition-all">
          Reset to defaults
        </button>
      </div>
    </div>
  );
};
