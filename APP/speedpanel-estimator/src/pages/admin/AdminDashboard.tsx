import { Building2 } from "lucide-react";
import { cx, BLUE, NAVY } from "../../styleTokens";
import { PlaceholderPage } from "../PlaceholderPage";
import { BackendStatusCard } from "./BackendStatusCard";
import type { AdminSubPage } from "../../appShell/useHashRoute";
import { ADMIN_GROUPS } from "./adminSections";

// Workflow/People/Reports tile groups (and their "awaiting action" count
// badges) were dropped along with the tables they pointed at -- see
// adminSections.tsx's own header comment. What's left (Catalog) has no
// staff-role tiering anymore either (see useMyInternalRole.ts -- there's
// only one admin tier now), so this no longer needs to know who's asking
// (the `auth` prop it used to read staffRole/permissions from is gone too)
// -- just render every remaining section.
//
// Company Accounts & Pricing gets a card here too (onOpenAccounts). It is a
// staff-only admin area that lived entirely outside the Admin section --
// reachable only from AuthStatus.tsx's account dropdown -- so an admin
// working from this dashboard had no way to see or reach it. It stays its
// own top-level workspace with its own shell/route (#/accounts, see
// AccountsRoot.tsx); this is the way IN from Admin, not a move of its pages.
// Both entry points are gated on the same isInternalStaff check by AdminGate,
// so the card can't expose it to anyone the dropdown wouldn't.
export const AdminDashboard = ({ onNavigate, onOpenAccounts }: {
  onNavigate: (sub: AdminSubPage) => void;
  onOpenAccounts: () => void;
}) => (
  <PlaceholderPage
    title="Admin Dashboard"
    description="Control room for Speedpanel admin tools."
  >
    {ADMIN_GROUPS.map(group => (
      <div key={group.heading}>
        <div className={cx.sectionLbl}>{group.heading}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {group.items.map(section => (
            <button
              key={section.key}
              onClick={() => onNavigate(section.key)}
              className={`${cx.card} relative text-left transition-shadow hover:shadow-md`}
            >
              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
                <span style={{ color: BLUE }}>{section.icon}</span>{section.label}
              </div>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-300">{section.description}</p>
            </button>
          ))}
        </div>
      </div>
    ))}

    <div>
      <div className={cx.sectionLbl}>Account Management</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={onOpenAccounts}
          className={`${cx.card} relative text-left transition-shadow hover:shadow-md`}
        >
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
            <span style={{ color: BLUE }}><Building2 size={16} /></span>Company Accounts &amp; Pricing
          </div>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-300">
            Companies, company users, invitations, price lists, permissions and audit history.
          </p>
        </button>
      </div>
    </div>

    <BackendStatusCard />
  </PlaceholderPage>
);
