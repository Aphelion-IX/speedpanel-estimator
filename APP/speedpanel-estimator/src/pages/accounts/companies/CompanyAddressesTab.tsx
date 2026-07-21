// =============================================================================
// Company Accounts & Pricing -- Company Addresses tab (Phase 3)
// =============================================================================
// One reusable block -- CompanyOverviewPage.tsx's Addresses tab renders it
// directly, and CompanyWizard.tsx's Addresses step embeds the exact same
// component (companyId already known by then), rather than a parallel
// implementation. The screenshots' "Address Usage" card (recent
// transactions using saved addresses) is deliberately omitted -- order
// deliveries freeze addresses as plain text with no address_id FK (see the
// phased plan's corrected-understanding notes), so there's no real data to
// show there, only what would be fabricated.
// =============================================================================
import { useState } from "react";
import { Plus, Star, Pencil, Trash2 } from "lucide-react";
import { cx, NAVY, MUTED, tone } from "../../../styleTokens";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { Button } from "../../../ui/button";
import { IconButton } from "../../../ui/primitives";
import { Field, SelectField } from "../../shared/fields";
import {
  useCompanyAddresses, adminSetCompanyAddress, adminDeleteCompanyAddress, adminSetDefaultAddress,
  ADDRESS_TYPES, ADDRESS_TYPE_LABELS, type AddressType, type CompanyAddressRow,
} from "./companyAddressesStore";

const TYPE_TONE: Record<AddressType, "info" | "ok" | "neutral"> = {
  billing: "info", delivery: "ok", office: "neutral",
};

const TYPE_OPTIONS = ADDRESS_TYPES.map(value => ({ value, label: ADDRESS_TYPE_LABELS[value] }));

const emptyForm = { type: "delivery" as AddressType, label: "", line1: "", line2: "", suburb: "", state: "", postcode: "", deliveryContactName: "", deliveryContactPhone: "", isDefault: false };

const AddressForm = ({ companyId, editing, onDone, onCancel }: {
  companyId: string; editing: CompanyAddressRow | null; onDone: () => void; onCancel: () => void;
}) => {
  const [form, setForm] = useState(() => editing ? {
    type: editing.type, label: editing.label ?? "", line1: editing.line1, line2: editing.line2 ?? "",
    suburb: editing.suburb ?? "", state: editing.state ?? "", postcode: editing.postcode ?? "",
    deliveryContactName: editing.delivery_contact_name ?? "", deliveryContactPhone: editing.delivery_contact_phone ?? "",
    isDefault: editing.is_default,
  } : emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => setForm(f => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.line1.trim()) return;
    setSubmitting(true);
    setError(null);
    const err = await adminSetCompanyAddress({
      addressId: editing?.id ?? null, companyId, type: form.type, label: form.label,
      line1: form.line1, line2: form.line2, suburb: form.suburb, state: form.state, postcode: form.postcode,
      deliveryContactName: form.deliveryContactName, deliveryContactPhone: form.deliveryContactPhone,
      isDefault: form.isDefault,
    });
    setSubmitting(false);
    if (err) { setError(err); return; }
    onDone();
  };

  return (
    <form onSubmit={submit} className={`${cx.panel} mt-3 space-y-3 p-4`}>
      <h3 className={cx.h3}>{editing ? "Edit address" : "Add address"}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Address label (optional)" value={form.label} onChange={v => set("label", v)} />
        <SelectField label="Use" value={form.type} options={TYPE_OPTIONS} onChange={v => set("type", v as AddressType)} />
      </div>
      <Field label="Street address" value={form.line1} onChange={v => set("line1", v)} required />
      <Field label="Address line 2 (optional)" value={form.line2} onChange={v => set("line2", v)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Suburb" value={form.suburb} onChange={v => set("suburb", v)} />
        <Field label="State" value={form.state} onChange={v => set("state", v)} />
        <Field label="Postcode" value={form.postcode} onChange={v => set("postcode", v)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Delivery contact name (optional)" value={form.deliveryContactName} onChange={v => set("deliveryContactName", v)} />
        <Field label="Delivery contact phone (optional)" value={form.deliveryContactPhone} onChange={v => set("deliveryContactPhone", v)} />
      </div>
      <label className="flex items-center gap-2 text-sm" style={{ color: NAVY }}>
        <input type="checkbox" checked={form.isDefault} onChange={e => set("isDefault", e.target.checked)} />
        Set as the default {ADDRESS_TYPE_LABELS[form.type].toLowerCase()} address
      </label>

      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || !form.line1.trim()}>
          {submitting ? "Saving..." : editing ? "Save changes" : "Add address"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
};

const AddressCard = ({ address, onEdit, onChanged }: {
  address: CompanyAddressRow; onEdit: () => void; onChanged: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    const err = await adminDeleteCompanyAddress(address.id);
    setBusy(false);
    if (err) { setError(err); return; }
    onChanged();
  };

  const makeDefault = async () => {
    setBusy(true);
    setError(null);
    const err = await adminSetDefaultAddress(address.id);
    setBusy(false);
    if (err) { setError(err); return; }
    onChanged();
  };

  const lines = [address.line1, address.line2, [address.suburb, address.state, address.postcode].filter(Boolean).join(" ")].filter(Boolean);

  return (
    <div className={`${cx.card} mt-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm" style={{ color: NAVY }}>{address.label || `${ADDRESS_TYPE_LABELS[address.type]} address`}</strong>
            <span className={`${cx.badge} ${tone(TYPE_TONE[address.type])}`}>{ADDRESS_TYPE_LABELS[address.type]}</span>
            {address.is_default && <span className={`${cx.badge} ${tone("ok")}`}>Default</span>}
          </div>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>{lines.join(", ")}</p>
          {(address.delivery_contact_name || address.delivery_contact_phone) && (
            <p className="mt-1 text-xs" style={{ color: MUTED }}>
              {[address.delivery_contact_name, address.delivery_contact_phone].filter(Boolean).join(" -- ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!address.is_default && (
            <IconButton title="Set as default" ariaLabel="Set as default" size="sm" onClick={makeDefault} disabled={busy}>
              <Star size={14} />
            </IconButton>
          )}
          <IconButton title="Edit" ariaLabel="Edit address" size="sm" onClick={onEdit} disabled={busy}>
            <Pencil size={14} />
          </IconButton>
          <IconButton title="Delete" ariaLabel="Delete address" size="sm" variant="danger" onClick={remove} disabled={busy}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
};

export const CompanyAddressesTab = ({ companyId }: { companyId: string }) => {
  const { addresses, loading, error, reload } = useCompanyAddresses(companyId);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (loading) return <LoadingState className="mt-4" label="Loading addresses" />;
  if (error) return <ErrorState className="mt-4" message={error} onRetry={() => reload()} />;

  const editing = editingId ? addresses.find(a => a.id === editingId) ?? null : null;
  const showForm = adding || !!editing;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm" style={{ color: MUTED }}>
          {addresses.length} saved address{addresses.length === 1 ? "" : "es"} -- billing, delivery and office locations available to company users.
        </p>
        {!showForm && (
          <Button icon={<Plus size={15} />} onClick={() => { setAdding(true); setEditingId(null); }}>
            Add address
          </Button>
        )}
      </div>

      {showForm && (
        <AddressForm
          companyId={companyId}
          editing={editing}
          onDone={() => { setAdding(false); setEditingId(null); reload(); }}
          onCancel={() => { setAdding(false); setEditingId(null); }}
        />
      )}

      {addresses.length === 0 && !showForm && (
        <EmptyState className={`${cx.card} mt-4 text-center`} message="No saved addresses yet." />
      )}

      {addresses.map(a => (
        <AddressCard
          key={a.id}
          address={a}
          onEdit={() => { setEditingId(a.id); setAdding(false); }}
          onChanged={reload}
        />
      ))}

      <p className="mt-4 text-xs" style={{ color: MUTED }}>
        Historical orders keep the address text they were placed with -- changing or removing a saved address here never alters a past order's delivery record. Project-specific site addresses are entered per order and stay separate from this list.
      </p>
    </div>
  );
};
