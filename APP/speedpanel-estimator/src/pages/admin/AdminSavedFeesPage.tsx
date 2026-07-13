// =============================================================================
// Admin > Saved Fees -- manage the Delivery/Fee pick-list Internal Sales
// draws from when adjusting a quote
// =============================================================================
// A flat CRUD list (no category chips/master-detail needed -- saved_fees
// has three real fields), built directly on useSupabaseCatalog via
// savedFeesStore.ts. Super_admin/null-gated, omitted from
// adminSectionAccess.ts's SECTION_ROLES, same as Products/Price Lists --
// Internal Sales reads this table fine via its own RLS policy when using
// the "+ Saved Fee" picker on Admin > Orders, no nav access to this
// management page required.
// =============================================================================
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { cx, BLUE, WHITE, NAVY, MUTED } from "../../styleTokens";
import { Field, NumField, SelectField } from "../shared/fields";
import { useSavedFees } from "./savedFees/savedFeesStore";
import { SAVED_FEE_KINDS, type AdminSavedFee } from "./savedFees/savedFeeTypes";

interface Draft { label: string; kind: string; defaultAmountExGst: number; active: boolean; }

const blankDraft: Draft = { label: "", kind: "delivery", defaultAmountExGst: 0, active: true };
const draftFromFee = (f: AdminSavedFee): Draft => ({ label: f.label, kind: f.kind, defaultAmountExGst: f.defaultAmountExGst ?? 0, active: f.active });

const SavedFeeForm = ({ draft, onChange, onSave, onCancel }: {
  draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void;
}) => (
  <div className={`${cx.card} mt-3`}>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><Field label="Label" value={draft.label} onChange={v => onChange({ ...draft, label: v })} /></div>
      <SelectField label="Kind" value={draft.kind} onChange={v => onChange({ ...draft, kind: v })}
        options={SAVED_FEE_KINDS.map(k => ({ value: k, label: k === "delivery" ? "Delivery" : "Fee" }))} />
      <NumField label="Default amount ($)" value={draft.defaultAmountExGst} onChange={v => onChange({ ...draft, defaultAmountExGst: v })} />
    </div>
    <div className="mt-3 flex items-center gap-2">
      <button onClick={() => onChange({ ...draft, active: !draft.active })}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold" style={{ color: draft.active ? BLUE : MUTED }}>
        {draft.active ? <Check size={13} /> : <X size={13} />} {draft.active ? "Active" : "Inactive"}
      </button>
    </div>
    <div className="mt-4 flex items-center gap-2">
      <button onClick={onSave} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
        <Check size={14} /> Save
      </button>
      <button onClick={onCancel} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold" style={{ color: NAVY }}>
        <X size={14} /> Cancel
      </button>
    </div>
  </div>
);

export const AdminSavedFeesPage = () => {
  const { savedFees, loading, error, reload, add, update, remove } = useSavedFees();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startAdd = () => { setIsAdding(true); setEditingId(null); setDraft(blankDraft); setSaveError(null); };
  const startEdit = (f: AdminSavedFee) => { setEditingId(f.id); setIsAdding(false); setDraft(draftFromFee(f)); setSaveError(null); };
  const cancel = () => { setIsAdding(false); setEditingId(null); setSaveError(null); };

  const handleSave = async () => {
    if (!draft.label.trim()) { setSaveError("Enter a label."); return; }
    const payload = { label: draft.label.trim(), kind: draft.kind as AdminSavedFee["kind"], defaultAmountExGst: draft.defaultAmountExGst || undefined, active: draft.active };
    if (isAdding) {
      const { error: err } = await add(payload);
      if (err) { setSaveError(err); return; }
    } else if (editingId) {
      const err = await update(editingId, payload);
      if (err) { setSaveError(err); return; }
    }
    cancel();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this saved fee? This can't be undone.")) return;
    const err = await remove(id);
    if (err) window.alert(err);
  };

  if (loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;

  if (error) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Saved Fees</h1>
        {!isAdding && !editingId && (
          <button onClick={startAdd} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
            <Plus size={15} /> New saved fee
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <>
          <SavedFeeForm draft={draft} onChange={setDraft} onSave={handleSave} onCancel={cancel} />
          {saveError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{saveError}</p>}
        </>
      )}

      {savedFees.length === 0 && !isAdding ? (
        <div className={`${cx.card} mt-6 text-center`}>
          <p className={cx.footnote}>No saved fees yet.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {savedFees.map(f => (
            <div key={f.id} className={`${cx.card} flex items-center justify-between gap-3`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold" style={{ color: NAVY }}>{f.label}</span>
                  {!f.active && <span className={cx.badge} style={{ background: "#f1f5f9", color: MUTED }}>Inactive</span>}
                </div>
                <p className={cx.footnote}>{f.kind === "delivery" ? "Delivery" : "Fee"} {f.defaultAmountExGst != null ? `· $${f.defaultAmountExGst} default` : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => startEdit(f)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(f.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
