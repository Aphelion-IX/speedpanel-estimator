// =============================================================================
// Queue scoping -- narrow a full-queue admin page to "my companies" for a
// non-super_admin staff role
// =============================================================================
// Replaces myAssignments/myAssignmentsStore.ts's useMyStaffCompanyIds (which
// resolved all 5 roles' company lists at once) -- a signed-in admin has
// exactly one staff_role (see staffTypes.ts), so scoping a given queue page
// only ever needs that one role's companies, not a full byRole map.
//
// null/"super_admin" staffRole -> {kind:"all"} -- mirrors has_staff_role()'s
// own grandfather rule (see supabase/schema.sql), so this can never be more
// restrictive than the server already enforces; it's UI-side convenience
// only, same as adminSectionAccess.ts's canAccessSection.
//
// applyQueueScope ANDs an existing query with
// (company_id IS NULL OR company_id IN (...)) -- never excludes solo/
// company-less rows. projects.company_id and orders.company_id are nullable
// by design (a customer who never joined a company workspace), and nobody
// is ever assigned to a null-company row via staff_assignments, so a plain
// "IN (my companies)" filter would silently drop every solo customer's row
// for every role-holder -- a real regression, not just a UX nit.
// =============================================================================
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import type { InternalRole } from "../../company/staffTypes";

const BAD_SHAPE = "Unexpected data shape from the server.";

export type QueueScope = { kind: "all" } | { kind: "companies"; companyIds: string[] };

interface QueueScopeState { scope: QueueScope; loading: boolean; error: string | null; }

export function useMyQueueScope(
  userId: string | null, staffRole: InternalRole | null, staffRoleLoading: boolean,
): QueueScopeState {
  const [state, setState] = useState<QueueScopeState>({ scope: { kind: "all" }, loading: true, error: null });

  useEffect(() => {
    if (staffRoleLoading) return;
    if (!supabase || !userId || !staffRole || staffRole === "super_admin") {
      setState({ scope: { kind: "all" }, loading: false, error: null });
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    supabase.from("staff_assignments").select("company_id")
      .eq("staff_user_id", userId).eq("role", staffRole).eq("active", true)
      .then(({ data, error }) => {
        if (error) { setState({ scope: { kind: "all" }, loading: false, error: error.message }); return; }
        const parsed = z.object({ company_id: z.string() }).array().safeParse(data ?? []);
        if (!parsed.success) { setState({ scope: { kind: "all" }, loading: false, error: BAD_SHAPE }); return; }
        setState({ scope: { kind: "companies", companyIds: parsed.data.map(r => r.company_id) }, loading: false, error: null });
      });
  }, [userId, staffRole, staffRoleLoading]);

  return state;
}

// query must be a Supabase PostgrestFilterBuilder-shaped object (or() returns
// the same builder type, matching every .eq()/.in() chain already used
// throughout this app's admin stores).
export function applyQueueScope<Q extends { or(filters: string): Q }>(query: Q, scope: QueueScope, column = "company_id"): Q {
  if (scope.kind === "all") return query;
  if (scope.companyIds.length === 0) return query.or(`${column}.is.null`);
  return query.or(`${column}.is.null,${column}.in.(${scope.companyIds.join(",")})`);
}
