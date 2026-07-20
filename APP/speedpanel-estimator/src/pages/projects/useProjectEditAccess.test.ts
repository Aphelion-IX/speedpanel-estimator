/** @vitest-environment jsdom */
// =============================================================================
// useProjectEditAccess -- covers the synchronous "already knows the answer"
// branches (owner / internal staff / company-wide editor role), which mirror
// supabase/schema.sql's can_edit_project() without ever touching the
// network, plus the conservative "still resolving" default for the one
// branch that does (an explicit project_memberships row) -- supabase is
// mocked to null here so that branch's query is a guaranteed no-op instead
// of a real network call, same "no network in unit tests" convention the
// rest of this tree follows (see useAsyncResource.test.tsx's
// injected-fetcher pattern).
// =============================================================================
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../../lib/supabaseClient", () => ({ supabase: null }));

import { useProjectEditAccess, type OpenProjectAccessRef } from "./useProjectEditAccess";
import type { UseAuth } from "../../lib/useAuth";
import type { UseCompanyMemberships } from "../../lib/useCompanyMemberships";

function fakeAuth(userId: string | null): UseAuth {
  return {
    session: null, loading: false,
    user: userId ? ({ id: userId } as UseAuth["user"]) : null,
    signUp: async () => null, signIn: async () => null, signOut: async () => null,
  };
}

function fakeCompany(memberships: { company_id: string; role: string }[]): UseCompanyMemberships {
  return {
    memberships: memberships as UseCompanyMemberships["memberships"],
    loading: false, error: null, activeCompanyId: null, setActiveCompanyId: () => {},
    activeMembership: null, reload: async () => {},
  };
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "owner-1";
const OTHER_USER_ID = "user-2";
const COMPANY_ID = "company-1";

describe("useProjectEditAccess", () => {
  it("is editable (not read-only) when there's no open project", () => {
    const { result } = renderHook(() => useProjectEditAccess(null, fakeAuth(OTHER_USER_ID), fakeCompany([]), false));
    expect(result.current).toBe(false);
  });

  it("is editable for the project's own owner", () => {
    const project: OpenProjectAccessRef = { id: PROJECT_ID, ownerId: OWNER_ID, companyId: null };
    const { result } = renderHook(() => useProjectEditAccess(project, fakeAuth(OWNER_ID), fakeCompany([]), false));
    expect(result.current).toBe(false);
  });

  it("is editable for internal staff, regardless of ownership", () => {
    const project: OpenProjectAccessRef = { id: PROJECT_ID, ownerId: OWNER_ID, companyId: null };
    const { result } = renderHook(() => useProjectEditAccess(project, fakeAuth(OTHER_USER_ID), fakeCompany([]), true));
    expect(result.current).toBe(false);
  });

  it("is editable for a company owner/admin/project_manager on the project's company", () => {
    const project: OpenProjectAccessRef = { id: PROJECT_ID, ownerId: OWNER_ID, companyId: COMPANY_ID };
    const company = fakeCompany([{ company_id: COMPANY_ID, role: "project_manager" }]);
    const { result } = renderHook(() => useProjectEditAccess(project, fakeAuth(OTHER_USER_ID), company, false));
    expect(result.current).toBe(false);
  });

  it("is NOT editable for a company member whose role isn't owner/admin/project_manager", () => {
    const project: OpenProjectAccessRef = { id: PROJECT_ID, ownerId: OWNER_ID, companyId: COMPANY_ID };
    const company = fakeCompany([{ company_id: COMPANY_ID, role: "estimator" }]);
    const { result } = renderHook(() => useProjectEditAccess(project, fakeAuth(OTHER_USER_ID), company, false));
    expect(result.current).toBe(true);
  });

  it("ignores a company-editor role on a DIFFERENT company than the project's", () => {
    const project: OpenProjectAccessRef = { id: PROJECT_ID, ownerId: OWNER_ID, companyId: COMPANY_ID };
    const company = fakeCompany([{ company_id: "some-other-company", role: "owner" }]);
    const { result } = renderHook(() => useProjectEditAccess(project, fakeAuth(OTHER_USER_ID), company, false));
    expect(result.current).toBe(true);
  });

  it("is conservatively read-only while the project_memberships lookup hasn't resolved yet", () => {
    const project: OpenProjectAccessRef = { id: PROJECT_ID, ownerId: OWNER_ID, companyId: null };
    const { result } = renderHook(() => useProjectEditAccess(project, fakeAuth(OTHER_USER_ID), fakeCompany([]), false));
    expect(result.current).toBe(true);
  });
});
