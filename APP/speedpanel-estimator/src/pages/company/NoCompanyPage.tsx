// =============================================================================
// No company workspace yet
// =============================================================================
// Shown in place of the Team/Activity screens for a signed-in user with zero
// active company_memberships. Company creation is Speedpanel-admin-only now
// (see supabase/schema.sql's admin_create_company) -- there's nothing
// actionable for the customer to do here beyond contacting Speedpanel, so
// this is purely informational, not a form.
// =============================================================================
import { Building2 } from "lucide-react";
import { cx, BLUE, MUTED } from "../../styleTokens";

export const NoCompanyPage = ({ onBack }: { onBack: () => void }) => (
  <div className="mt-2">
    <button onClick={onBack} className="text-sm font-semibold hover:underline" style={{ color: BLUE }}>&larr; Back to projects</button>

    <div className={`${cx.card} mt-3 max-w-lg text-center`}>
      <Building2 size={28} className="mx-auto" style={{ color: MUTED }} />
      <h1 className={`${cx.h2} mt-3`}>No company workspace yet</h1>
      <p className={cx.footnote} style={{ paddingTop: 0 }}>
        You're not part of a company workspace yet. Contact Speedpanel to get one set up for your team.
      </p>
    </div>
  </div>
);
