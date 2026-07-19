// =============================================================================
// Projects Administration -- dashboard stats, full project browser, and
// admin-side project creation
// =============================================================================
// Backs AdminProjectsAdministrationPage.tsx's three panels. Distinct from
// adminProjectsStore.ts (that one is the install/technical review QUEUE,
// scoped to two stages only) -- this is a full, unscoped browser + creation
// flow for staff with projects.list_all/projects.create, same "server is
// the real gate" convention as every other admin store: each RPC does its
// own has_permission() check, this file just calls them and validates the
// shape.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import { blankSnapshot } from "../../projects/projectsStore";

const NOT_CONFIGURED = "Projects administration isn't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

const DashboardStatsSchema = z.object({
  activeProjects: z.number(),
  unassigned: z.number(),
  completionBlocked: z.number(),
  openServices: z.number(),
  serviceWorkload: z.record(z.string(), z.number()),
});
export type AdminProjectsDashboardStats = z.infer<typeof DashboardStatsSchema>;

const RequiringActionRowSchema = z.object({
  id: z.string(), name: z.string(), project_number: z.string().nullable(),
  reason: z.string(), project_manager_name: z.string().nullable(),
});
export type AdminProjectRequiringActionRow = z.infer<typeof RequiringActionRowSchema>;

export function useAdminProjectsDashboard() {
  const [stats, setStats] = useState<AdminProjectsDashboardStats | null>(null);
  const [requiringAction, setRequiringAction] = useState<AdminProjectRequiringActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); setError(NOT_CONFIGURED); return; }
    setLoading(true);
    setError(null);
    const [statsResult, actionResult] = await Promise.all([
      supabase.rpc("admin_projects_dashboard_stats"),
      supabase.rpc("admin_projects_requiring_action", { p_limit: 10 }),
    ]);
    if (statsResult.error) { setError(statsResult.error.message); setLoading(false); return; }
    if (actionResult.error) { setError(actionResult.error.message); setLoading(false); return; }
    const parsedStats = DashboardStatsSchema.safeParse(statsResult.data);
    const parsedAction = RequiringActionRowSchema.array().safeParse(actionResult.data ?? []);
    if (!parsedStats.success || !parsedAction.success) { setError(BAD_SHAPE); setLoading(false); return; }
    setStats(parsedStats.data);
    setRequiringAction(parsedAction.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { stats, requiringAction, loading, error, reload: load };
}

const ProjectOverviewRowSchema = z.object({
  id: z.string(), name: z.string(), project_number: z.string().nullable(), stage: z.string(),
  company_id: z.string().nullable(), company_name: z.string().nullable(),
  operational_status: z.string(),
  project_manager_user_id: z.string().nullable(), project_manager_name: z.string().nullable(),
  open_orders: z.number(), open_services: z.number(),
  archived_at: z.string().nullable(), updated_at: z.string(), created_at: z.string(),
});
export type AdminProjectOverviewRow = z.infer<typeof ProjectOverviewRowSchema>;

export function useAdminProjectsOverview() {
  const [projects, setProjects] = useState<AdminProjectOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); setError(NOT_CONFIGURED); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("admin_list_projects_overview");
    if (err) { setError(err.message); setLoading(false); return; }
    const parsed = ProjectOverviewRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
    setProjects(parsed.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { projects, loading, error, reload: load };
}

export function useAdminCreateProject() {
  const [submitting, setSubmitting] = useState(false);

  const createProject = async (input: {
    companyId: string; ownerUserId: string; name: string; siteAddress?: string;
    builderName?: string; startDate?: string; projectManagerUserId?: string;
  }): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };
    setSubmitting(true);
    const data = { ...blankSnapshot(), ...(input.siteAddress ? { siteAddress: input.siteAddress } : {}) };
    const { data: id, error } = await supabase.rpc("admin_create_project", {
      p_company_id: input.companyId,
      p_owner_user_id: input.ownerUserId,
      p_name: input.name,
      p_data: data,
      p_builder_name: input.builderName || null,
      p_start_date: input.startDate || null,
      p_project_manager_user_id: input.projectManagerUserId || null,
    });
    setSubmitting(false);
    if (error) return { id: null, error: error.message };
    return { id: id as string, error: null };
  };

  return { submitting, createProject };
}
