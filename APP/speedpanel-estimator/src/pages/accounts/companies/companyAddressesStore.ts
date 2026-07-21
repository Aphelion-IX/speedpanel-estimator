// =============================================================================
// Company Accounts & Pricing -- Company Addresses (Phase 3)
// =============================================================================
// Backs CompanyAddressesTab.tsx, used both as CompanyOverviewPage's
// Addresses tab and embedded in CompanyWizard.tsx's Addresses step (same
// component, same data -- not a fork). Reads via company_list_addresses()
// (has_permission('company_addresses.read')-gated), writes via
// admin_set_company_address()/admin_delete_company_address()/
// admin_set_default_address() (has_permission('company_addresses.write')),
// all defined in supabase/schema.sql's "Phase 3: Company Addresses" section.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";

const NOT_CONFIGURED = "Company addresses aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export const ADDRESS_TYPES = ["billing", "delivery", "office"] as const;
export type AddressType = typeof ADDRESS_TYPES[number];

export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = {
  billing: "Billing", delivery: "Delivery", office: "Office",
};

const CompanyAddressRowSchema = z.object({
  id: z.string(), type: z.enum(ADDRESS_TYPES), is_default: z.boolean(),
  label: z.string().nullable(), line1: z.string(), line2: z.string().nullable(),
  suburb: z.string().nullable(), state: z.string().nullable(), postcode: z.string().nullable(),
  delivery_contact_name: z.string().nullable(), delivery_contact_phone: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(),
});
export type CompanyAddressRow = z.infer<typeof CompanyAddressRowSchema>;

export function useCompanyAddresses(companyId: string | null) {
  const [addresses, setAddresses] = useState<CompanyAddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !companyId) { setAddresses([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("company_list_addresses", { p_company_id: companyId });
    if (err) { setError(err.message); setLoading(false); return; }
    const parsed = CompanyAddressRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
    setAddresses(parsed.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { addresses, loading, error, reload: load };
}

export interface CompanyAddressInput {
  addressId?: string | null;
  companyId: string;
  type: AddressType;
  label?: string;
  line1: string;
  line2?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  isDefault?: boolean;
}

export async function adminSetCompanyAddress(input: CompanyAddressInput): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.rpc("admin_set_company_address", {
    p_address_id: input.addressId ?? null,
    p_company_id: input.companyId,
    p_type: input.type,
    p_label: input.label || null,
    p_line1: input.line1,
    p_line2: input.line2 || null,
    p_suburb: input.suburb || null,
    p_state: input.state || null,
    p_postcode: input.postcode || null,
    p_delivery_contact_name: input.deliveryContactName || null,
    p_delivery_contact_phone: input.deliveryContactPhone || null,
    p_is_default: input.isDefault ?? false,
  });
  return error ? error.message : null;
}

export async function adminDeleteCompanyAddress(addressId: string): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.rpc("admin_delete_company_address", { p_address_id: addressId });
  return error ? error.message : null;
}

export async function adminSetDefaultAddress(addressId: string): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.rpc("admin_set_default_address", { p_address_id: addressId });
  return error ? error.message : null;
}
