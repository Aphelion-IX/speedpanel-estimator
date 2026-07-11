// =============================================================================
// Admin Companies -- read-only support visibility
// =============================================================================
// Speedpanel staff already see everything via is_admin() -- this is just a
// read view onto that existing access (admin_list_companies()/
// company_list_members(), both is_admin()-gated in their own where clause,
// see supabase/schema.sql), not the deferred SupportAccess grant model.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { CompanyMemberRowSchema, type CompanyMemberRow } from "../../company/companyTypes";
import { z } from "zod";

const NOT_CONFIGURED = "Companies aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

const AdminCompanyRowSchema = z.object({
  id: z.string(), name: z.string(), member_count: z.number(), created_at: z.string(),
});
export type AdminCompanyRow = z.infer<typeof AdminCompanyRowSchema>;

interface CompaniesState { companies: AdminCompanyRow[]; loading: boolean; error: string | null; }

export function useAdminCompanies() {
  const [state, setState] = useState<CompaniesState>(() =>
    supabase ? { companies: [], loading: true, error: null } : { companies: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("admin_list_companies");
    if (error) { setState({ companies: [], loading: false, error: error.message }); return; }
    const parsed = AdminCompanyRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ companies: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ companies: parsed.data, loading: false, error: null });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}

// Fetched on demand when an admin expands one company row -- not worth
// loading every company's roster up front.
export function useAdminCompanyMembers(companyId: string | null) {
  const [members, setMembers] = useState<CompanyMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !companyId) { setMembers([]); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.rpc("company_list_members", { p_company_id: companyId }).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }
      const parsed = CompanyMemberRowSchema.array().safeParse(data ?? []);
      if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
      setMembers(parsed.data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [companyId]);

  return { members, loading, error };
}
