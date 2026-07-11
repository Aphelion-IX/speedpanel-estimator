// =============================================================================
// Company switcher
// =============================================================================
// Only renders when the signed-in user belongs to more than one company (see
// useCompanyMemberships.ts) -- a single membership is auto-selected with no
// UI needed, and a solo user (zero memberships) sees nothing here at all.
// Sits next to AuthStatus.tsx in App.tsx's TopNav `right` slot.
// =============================================================================
import { NAVY } from "../styleTokens";
import type { UseCompanyMemberships } from "../lib/useCompanyMemberships";

export const CompanySwitcher = ({ company }: { company: UseCompanyMemberships }) => {
  if (company.memberships.length <= 1) return null;

  return (
    <select
      value={company.activeCompanyId ?? ""}
      onChange={e => company.setActiveCompanyId(e.target.value)}
      title="Active company"
      className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm font-semibold shadow-sm"
      style={{ color: NAVY }}
    >
      {company.memberships.map(m => (
        <option key={m.company_id} value={m.company_id}>
          {m.companies?.trading_name || m.companies?.legal_name || "Company"}
        </option>
      ))}
    </select>
  );
};
