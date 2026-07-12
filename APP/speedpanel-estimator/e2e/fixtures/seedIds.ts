// Fixed UUIDs from supabase/seed.sql -- kept in sync manually (deliberately
// not generated/read at runtime, so a spec file fails loudly and obviously
// if the seed script's IDs ever drift instead of silently querying nothing).
export const COMPANY_A = "eeeeeeee-0000-0000-0001-000000000001";
export const COMPANY_B = "eeeeeeee-0000-0000-0001-000000000002";

export const PROJECT_A_DRAFT = "eeeeeeee-0000-0000-0002-000000000001"; // owned by member
export const PROJECT_A_INSTALL_REVIEW = "eeeeeeee-0000-0000-0002-000000000002"; // owned by company-admin
export const PROJECT_A_TECHNICAL_REVIEW = "eeeeeeee-0000-0000-0002-000000000003"; // owned by company-admin
export const PROJECT_B_DRAFT = "eeeeeeee-0000-0000-0002-000000000004"; // owned by outsider
export const PROJECT_B_INSTALL_REVIEW = "eeeeeeee-0000-0000-0002-000000000005"; // owned by outsider -- the cross-company negative case for the Project Reviews queue

// Project NAMEs, for UI text assertions -- the Project Reviews queue renders
// project.name, not company.legal_name, so these (not COMPANY_A/COMPANY_B's
// legal names) are what a scoped-queue test actually asserts on.
export const PROJECT_A_INSTALL_REVIEW_NAME = "E2E Co A -- Install Review Project";
export const PROJECT_B_INSTALL_REVIEW_NAME = "E2E Co B -- Install Review Project";

export const ORDER_A_DRAFT = "eeeeeeee-0000-0000-0003-000000000001";
export const ORDER_A_PROFORMA_REQUESTED = "eeeeeeee-0000-0000-0003-000000000002";
export const ORDER_A_PROFORMA_ISSUED = "eeeeeeee-0000-0000-0003-000000000003";

export const USER_IDS = {
  admin: "eeeeeeee-0000-0000-0000-000000000001",
  projectManager: "eeeeeeee-0000-0000-0000-000000000002",
  bdm: "eeeeeeee-0000-0000-0000-000000000003",
  internalSales: "eeeeeeee-0000-0000-0000-000000000004",
  dispatch: "eeeeeeee-0000-0000-0000-000000000005",
  technical: "eeeeeeee-0000-0000-0000-000000000006",
  companyAdmin: "eeeeeeee-0000-0000-0000-000000000007",
  member: "eeeeeeee-0000-0000-0000-000000000008",
  outsider: "eeeeeeee-0000-0000-0000-000000000009",
  unassigned: "eeeeeeee-0000-0000-0000-00000000000a",
} as const;
