// =============================================================================
// useProjectEditAccess
// =============================================================================
// Spec §13 "Read-only access" -- the real permission signal App.tsx's
// readOnlyProject used to be permanently stubbed to `false` (see git
// history/ui/readOnlyGate.tsx's old header comment). Mirrors supabase/
// schema.sql's can_edit_project(owner_id, company_id, project_id) exactly:
//   - the project's own owner, or
//   - internal staff (profiles.role = 'admin', see useMyInternalRole.ts --
//     matches can_edit_project's is_admin() clause), or
//   - an active owner/admin/project_manager company_memberships row for the
//     project's company (company-wide reach), or
//   - an explicit project_memberships row with project_role = 'editor'.
// The first three are already loaded client-side (auth/company/staff role),
// so only the last needs its own query -- and only when none of the other
// three already grant access, since can_view_project() guarantees at least
// ONE of these four clauses is true for any project this hook is ever
// handed (otherwise the project couldn't have been opened at all).
//
// This is a UX-layer signal only (hides/disables controls before a doomed
// save attempt) -- the real gate stays server-side RLS/can_edit_project(),
// never bypassed here. While the project_memberships row is still loading,
// this conservatively reports read-only (see membershipRole's initial null).
// =============================================================================
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { UseAuth } from "../../lib/useAuth";
import type { UseCompanyMemberships } from "../../lib/useCompanyMemberships";

const COMPANY_EDIT_ROLES = new Set(["owner", "admin", "project_manager"]);

export interface OpenProjectAccessRef { id: string; ownerId: string; companyId: string | null; }

export function useProjectEditAccess(
  project: OpenProjectAccessRef | null,
  auth: UseAuth,
  company: UseCompanyMemberships,
  isInternalStaff: boolean,
): boolean {
  const userId = auth.user?.id ?? null;
  const companyEditor = !!project?.companyId && company.memberships.some(
    m => m.company_id === project.companyId && COMPANY_EDIT_ROLES.has(m.role),
  );
  const knownEditable = !project || project.ownerId === userId || isInternalStaff || companyEditor;

  const [membershipRole, setMembershipRole] = useState<"editor" | "viewer" | null>(null);

  useEffect(() => {
    setMembershipRole(null);
    if (!supabase || !project || !userId || knownEditable) return;
    let cancelled = false;
    supabase.from("project_memberships").select("project_role")
      .eq("project_id", project.id).eq("user_id", userId).maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMembershipRole((data?.project_role as "editor" | "viewer" | undefined) ?? null);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.companyId, userId, knownEditable]);

  if (!project) return false;
  if (knownEditable) return false;
  return membershipRole !== "editor";
}
