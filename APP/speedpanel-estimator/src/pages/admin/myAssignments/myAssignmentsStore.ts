// =============================================================================
// Admin > My Assignments -- role-scoped queues for a Speedpanel staff member
// =============================================================================
// staff_assignments has no notification/routing behind it (see
// supabase/schema.sql's "Assigned Speedpanel Team" section) -- this store is
// the practical version of "routing": it surfaces the right *data* to the
// right *person*, filtered by which companies the signed-in admin actually
// holds each staff role for. Every per-role query below is the same query
// shape an existing Admin page already runs (adminProjectsStore.ts/
// adminOrdersStore.ts/adminManufacturingStore.ts), just with an added
// `.in("company_id", ids)` -- is_admin() already grants read access to all
// of these tables, so no new RPCs are needed, same "plain table query"
// convention every other Admin page in this app already uses.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { ProjectRowSchema, type ProjectRow } from "../../projects/projectTypes";
import { OrderRowSchema, OrderDeliveryRowSchema, type OrderRow, type OrderDeliveryRow } from "../../projects/orders/orderTypes";
import { STAFF_ROLES, type StaffRole } from "../../company/staffTypes";
import { z } from "zod";

const BAD_SHAPE = "Unexpected data shape from the server.";

// Which companies the signed-in admin holds each staff role for -- a plain
// table read (staff_assignments' own RLS already lets is_admin() read
// everything, so "read my own rows" needs no separate policy).
export function useMyStaffCompanyIds(userId: string | null) {
  const [byRole, setByRole] = useState<Record<StaffRole, string[]>>({
    project_manager: [], bdm: [], internal_sales: [], dispatch: [], technical_services: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !userId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    supabase.from("staff_assignments").select("company_id, role").eq("staff_user_id", userId).eq("active", true)
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        const rows = z.object({ company_id: z.string(), role: z.enum(STAFF_ROLES) }).array().safeParse(data ?? []);
        if (!rows.success) { setError(BAD_SHAPE); setLoading(false); return; }
        const next: Record<StaffRole, string[]> = { project_manager: [], bdm: [], internal_sales: [], dispatch: [], technical_services: [] };
        for (const row of rows.data) next[row.role].push(row.company_id);
        setByRole(next);
        setLoading(false);
      });
  }, [userId]);

  return { byRole, loading, error };
}

interface ProjectsState { projects: ProjectRow[]; loading: boolean; error: string | null; }

// Project Manager section -- every non-approved project for the companies
// where the caller is the assigned PM (a fuller list than
// adminProjectsStore.ts's review-only queue, since a PM cares about the
// whole pipeline, not just what's awaiting a decision).
export function useMyPmProjects(companyIds: string[]) {
  const [state, setState] = useState<ProjectsState>({ projects: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase || companyIds.length === 0) { setState({ projects: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("projects").select("*")
      .in("company_id", companyIds).order("updated_at", { ascending: false });
    if (error) { setState({ projects: [], loading: false, error: error.message }); return; }
    const parsed = ProjectRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ projects: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ projects: parsed.data, loading: false, error: null });
  }, [companyIds.join(",")]);

  useEffect(() => { load(); }, [load]);

  return state;
}

// Technical Services section -- same shape as adminProjectsStore.ts's queue,
// narrowed to technical_review only (install_review isn't this team's job).
export function useMyTechnicalReviewProjects(companyIds: string[]) {
  const [state, setState] = useState<ProjectsState>({ projects: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase || companyIds.length === 0) { setState({ projects: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("projects").select("*")
      .eq("stage", "technical_review").in("company_id", companyIds).order("updated_at", { ascending: true });
    if (error) { setState({ projects: [], loading: false, error: error.message }); return; }
    const parsed = ProjectRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ projects: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ projects: parsed.data, loading: false, error: null });
  }, [companyIds.join(",")]);

  useEffect(() => { load(); }, [load]);

  return state;
}

interface OrdersState { orders: OrderRow[]; loading: boolean; error: string | null; }

// Internal Sales section -- same "awaiting a pro forma decision" queue as
// adminOrdersStore.ts, narrowed to the caller's companies.
export function useMyInternalSalesOrders(companyIds: string[]) {
  const [state, setState] = useState<OrdersState>({ orders: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase || companyIds.length === 0) { setState({ orders: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("orders").select("*")
      .eq("stage", "proforma_requested").in("company_id", companyIds).order("proforma_requested_at", { ascending: true });
    if (error) { setState({ orders: [], loading: false, error: error.message }); return; }
    const parsed = OrderRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ orders: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ orders: parsed.data, loading: false, error: null });
  }, [companyIds.join(",")]);

  useEffect(() => { load(); }, [load]);

  return state;
}

export interface MyDispatchOrder { order: OrderRow; deliveries: OrderDeliveryRow[]; }
interface DispatchState { rows: MyDispatchOrder[]; loading: boolean; error: string | null; }

// Dispatch section -- same "confirmed order" fulfillment record as
// adminManufacturingStore.ts, narrowed to the caller's companies. No
// pagination -- this is a personal queue, not the full company-wide record.
export function useMyDispatchDeliveries(companyIds: string[]) {
  const [state, setState] = useState<DispatchState>({ rows: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase || companyIds.length === 0) { setState({ rows: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data: orderData, error: orderError } = await supabase.from("orders").select("*")
      .eq("stage", "proforma_issued").in("company_id", companyIds).order("proforma_issued_at", { ascending: false });
    if (orderError) { setState({ rows: [], loading: false, error: orderError.message }); return; }
    const parsedOrders = OrderRowSchema.array().safeParse(orderData ?? []);
    if (!parsedOrders.success) { setState({ rows: [], loading: false, error: BAD_SHAPE }); return; }

    const orderIds = parsedOrders.data.map(o => o.id);
    const { data: deliveryData, error: deliveryError } = orderIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("order_deliveries").select("*").in("order_id", orderIds).order("sequence_no", { ascending: true });
    if (deliveryError) { setState({ rows: [], loading: false, error: deliveryError.message }); return; }
    const parsedDeliveries = OrderDeliveryRowSchema.array().safeParse(deliveryData ?? []);
    if (!parsedDeliveries.success) { setState({ rows: [], loading: false, error: BAD_SHAPE }); return; }

    setState({
      rows: parsedOrders.data.map(order => ({ order, deliveries: parsedDeliveries.data.filter(d => d.order_id === order.id) })),
      loading: false, error: null,
    });
  }, [companyIds.join(",")]);

  useEffect(() => { load(); }, [load]);

  return state;
}

export interface MyBdmCompany { id: string; name: string; openRequests: number; activeProjects: number; activeOrders: number; }
interface BdmState { companies: MyBdmCompany[]; loading: boolean; error: string | null; }

// BDM section -- one row per assigned company with lightweight counts, not
// a full record list (a BDM owns the relationship, not line-item detail).
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
