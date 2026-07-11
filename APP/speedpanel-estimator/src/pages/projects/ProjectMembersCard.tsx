// =============================================================================
// Project Access card -- who's specifically assigned to this project
// =============================================================================
// Only rendered when project.company_id is set (see ProjectDashboard.tsx) --
// solo projects have no company roster to assign from. Lists
// project_memberships rows for this project (readable via its own
// "Project access implies project_memberships visibility" RLS policy, see
// supabase/schema.sql) with an editor/viewer toggle, plus an "add teammate"
// picker sourced from company_list_members() filtered to people not already
// assigned. Owner/Admin/Project Manager (company-wide) or anyone with an
// 'editor' project_memberships row on this specific project can manage it --
// server-side can_edit_project() is the real gate; this UI doesn't
// pre-filter who sees the controls beyond that.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { cx, NAVY, BLUE, MUTED } from "../../styleTokens";
import { Card } from "../../ui/primitives";
import { SelectField } from "../shared/fields";
import { supabase } from "../../lib/supabaseClient";
import { ProjectMembershipRowSchema, PROJECT_ROLES, type ProjectMembershipRow, type ProjectRole } from "../company/companyTypes";
import { useCompanyMembers } from "../company/companyStore";

const ROLE_OPTIONS = PROJECT_ROLES.map(value => ({ value, label: value === "editor" ? "Editor" : "Viewer (read-only)" }));

export const ProjectMembersCard = ({ projectId, companyId }: { projectId: string; companyId: string }) => {
  const { members } = useCompanyMembers(companyId);
  const [assignments, setAssignments] = useState<ProjectMembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingUserId, setAddingUserId] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from("project_memberships").select("*").eq("project_id", projectId);
    if (err) { setError(err.message); setLoading(false); return; }
    const parsed = ProjectMembershipRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setError("Unexpected data shape from the server."); setLoading(false); return; }
    setAssignments(parsed.data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const emailFor = (userId: string) => members.find(m => m.user_id === userId)?.email ?? userId;
  const availableToAdd = members.filter(m => !assignments.some(a => a.user_id === m.user_id));

  const setRole = async (userId: string, role: ProjectRole) => {
    if (!supabase) return;
    const { error: err } = await supabase.rpc("set_project_member_role", { p_project_id: projectId, p_user_id: userId, p_project_role: role });
    if (err) { setError(err.message); return; }
    setAssignments(prev => prev.map(a => a.user_id === userId ? { ...a, project_role: role } : a));
  };

  const remove = async (userId: string) => {
    if (!supabase) return;
    const { error: err } = await supabase.rpc("remove_project_member", { p_project_id: projectId, p_user_id: userId });
    if (err) { setError(err.message); return; }
    setAssignments(prev => prev.filter(a => a.user_id !== userId));
  };

  const add = async () => {
    if (!supabase || !addingUserId) return;
    const { error: err } = await supabase.rpc("add_project_member", { p_project_id: projectId, p_user_id: addingUserId, p_project_role: "editor" });
    if (err) { setError(err.message); return; }
    setAddingUserId("");
    load();
  };

  return (
    <Card title="Project Access" icon={<Users size={14} />}>
      {loading ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>Loading...</p>
      ) : assignments.length === 0 ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>No teammates explicitly assigned -- Owners, Admins and Project Managers already see every company project.</p>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => (
            <div key={a.user_id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
              <span className="text-sm truncate" style={{ color: NAVY }}>{emailFor(a.user_id)}</span>
              <div className="flex items-center gap-2">
                <select value={a.project_role} onChange={e => setRole(a.user_id, e.target.value as ProjectRole)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs" style={{ color: NAVY }}>
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button onClick={() => remove(a.user_id)} className="text-xs font-bold text-red-500">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {availableToAdd.length > 0 && (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <SelectField label="Add teammate" value={addingUserId}
              options={[{ value: "", label: "Choose someone..." }, ...availableToAdd.map(m => ({ value: m.user_id, label: m.email ?? m.user_id }))]}
              onChange={setAddingUserId} />
          </div>
          <button onClick={add} disabled={!addingUserId}
            className="h-[46px] shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-sm font-bold disabled:opacity-50" style={{ color: BLUE }}>
            Add
          </button>
        </div>
      )}
      {members.length === 0 && !loading && <p className={cx.footnote} style={{ color: MUTED }}>No other company members yet.</p>}
    </Card>
  );
};
