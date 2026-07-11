// =============================================================================
// BDM "My companies" rollup -- one row per assigned company with lightweight
// counts, not a full record list (a BDM owns the relationship, not
// line-item detail). Relocated from the now-deleted
// myAssignments/myAssignmentsStore.ts's useMyBdmCompanies, unchanged.
// =============================================================================
// openRequests is correct for "this company's attributed requests" -- it's
// necessarily narrower than AdminRequestsPage's own total, since an
// anonymous request (no project_id) can never be attributed to any company
// (see requestsStore.ts's header comment). Don't try to reconcile the two
// numbers; they answer different questions.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";

const BAD_SHAPE = "Unexpected data shape from the server.";

export interface MyBdmCompany { id: string; name: string; openRequests: number; activeProjects: number; activeOrders: number; }
interface BdmState { companies: MyBdmCompany[]; loading: boolean; error: string | null; }

export function useMyBdmCompanies(companyIds: string[]) {
  const [state, setState] = useState<BdmState>({ companies: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase || companyIds.length === 0) { setState({ companies: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const [companiesResult, projectsResult, ordersResult] = await Promise.all([
      supabase.from("companies").select("id, legal_name, trading_name").in("id", companyIds),
      supabase.from("projects").select("id, company_id, stage").in("company_id", companyIds).neq("stage", "approved"),
      supabase.from("orders").select("id, company_id, stage").in("company_id", companyIds).neq("stage", "cancelled"),
    ]);
    if (companiesResult.error) { setState({ companies: [], loading: false, error: companiesResult.error.message }); return; }
    const parsedCompanies = z.object({ id: z.string(), legal_name: z.string(), trading_name: z.string().nullable() }).array().safeParse(companiesResult.data ?? []);
    if (!parsedCompanies.success) { setState({ companies: [], loading: false, error: BAD_SHAPE }); return; }

    const projects = (projectsResult.data ?? []) as { id: string; company_id: string | null }[];
    const orders = (ordersResult.data ?? []) as { id: string; company_id: string | null }[];
    const projectIds = projects.map(p => p.id);
    const { data: requestsData } = projectIds.length === 0
      ? { data: [] as { id: string; project_id: string | null }[] }
      : await supabase.from("requests").select("id, project_id").in("project_id", projectIds);
    const requests = requestsData ?? [];
    const projectCompanyOf = new Map(projects.map(p => [p.id, p.company_id]));

    setState({
      companies: parsedCompanies.data.map(c => ({
        id: c.id,
        name: c.trading_name || c.legal_name,
        activeProjects: projects.filter(p => p.company_id === c.id).length,
        activeOrders: orders.filter(o => o.company_id === c.id).length,
        openRequests: requests.filter(r => projectCompanyOf.get(r.project_id ?? "") === c.id).length,
      })),
      loading: false, error: null,
    });
  }, [companyIds.join(",")]);

  useEffect(() => { load(); }, [load]);

  return state;
}
