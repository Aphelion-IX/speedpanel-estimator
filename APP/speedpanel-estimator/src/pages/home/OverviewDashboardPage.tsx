// =============================================================================
// Overview dashboard -- signed-in front door ("mySPEEDPORTAL Workspace" design)
// =============================================================================
// Shown at "/" (the home route, see useHashRoute.ts) whenever there's a
// session. One identical page for every signed-in user -- staff and
// customers alike see the same four workspace cards; Admin stays reachable
// via the top nav tab and the account-menu shortcut (AuthStatus.tsx), not a
// card here. Ported from an uploaded SpeedHubWorkspacePage.tsx mockup
// (dark-only) with light-mode equivalents added throughout, same approach
// used for the mySPEEDPORTAL login page.
// =============================================================================
import { Calculator, LayoutGrid, BookOpen, FolderKanban, CheckCircle2, ChevronRight, Search, Headphones, AlertCircle, FileText, Send, ListChecks } from "lucide-react";
import { NAVY, BLUE } from "../../styleTokens";
import { Card } from "../../ui/primitives";
import type { Route } from "../../appShell/useHashRoute";
import type { UseAuth } from "../../lib/useAuth";
import { nameFromEmail } from "../../lib/emailDisplay";
import { useOrdersSummary } from "../projects/dashboardStore";
import { useProjects } from "../projects/projectsStore";

type Accent = "blue" | "cyan" | "purple";

const ACCENTS: Record<Accent, { icon: string; iconWrap: string; check: string; hover: string }> = {
  blue: {
    icon: "text-blue-600 dark:text-blue-300",
    iconWrap: "border-blue-200 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10",
    check: "text-blue-600 dark:text-blue-300",
    hover: "hover:border-blue-300 dark:hover:border-blue-500/50",
  },
  cyan: {
    icon: "text-cyan-600 dark:text-cyan-300",
    iconWrap: "border-cyan-200 bg-cyan-50 dark:border-cyan-400/40 dark:bg-cyan-400/10",
    check: "text-cyan-600 dark:text-cyan-300",
    hover: "hover:border-cyan-300 dark:hover:border-cyan-400/50",
  },
  purple: {
    icon: "text-violet-600 dark:text-violet-400",
    iconWrap: "border-violet-200 bg-violet-50 dark:border-violet-400/40 dark:bg-violet-400/10",
    check: "text-violet-600 dark:text-violet-400",
    hover: "hover:border-violet-300 dark:hover:border-violet-400/50",
  },
};

const WORKSPACES: { title: string; description: string; features: string[]; accent: Accent; icon: React.ElementType; route: Route }[] = [
  { title: "Projects", description: "Plan, manage and track projects from estimate to delivery.", features: ["Project Planning", "Task Tracking", "Progress Monitoring"], accent: "blue", icon: FolderKanban, route: { tab: "projects" } },
  { title: "System Selector", description: "Choose the correct SPEEDPANEL system for the application.", features: ["System Finder", "Compatibility", "Specifications"], accent: "cyan", icon: LayoutGrid, route: { tab: "selector" } },
  { title: "Project Estimator", description: "Create quantities, schedules and project estimates.", features: ["Accurate Estimates", "BOM Generation", "Export Reports"], accent: "purple", icon: Calculator, route: { tab: "estimator" } },
  { title: "Education Hub", description: "Access technical documents, guides and training.", features: ["Technical Guides", "Training Videos", "Product Knowledge"], accent: "blue", icon: BookOpen, route: { tab: "education" } },
];

function WorkspaceCard({ title, description, features, accent, icon: Icon, onClick }: {
  title: string; description: string; features: string[]; accent: Accent; icon: React.ElementType; onClick: () => void;
}) {
  const styles = ACCENTS[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-600/80 dark:bg-slate-900/75 dark:shadow-[0_18px_60px_rgba(0,0,0,0.22)] dark:backdrop-blur dark:hover:bg-slate-900 ${styles.hover}`}
    >
      <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border ${styles.iconWrap}`}>
        <Icon className={`h-7 w-7 ${styles.icon}`} strokeWidth={1.8} />
      </div>
      <h2 className="mt-4 text-xl font-bold tracking-tight" style={{ color: NAVY }}>{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">{description}</p>

      <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
        {features.map(feature => (
          <span key={feature} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <CheckCircle2 className={`h-4 w-4 shrink-0 ${styles.check}`} />
            {feature}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-700">
        <span className="text-sm font-semibold" style={{ color: BLUE }}>Open workspace</span>
        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" style={{ color: BLUE }} />
      </div>
    </button>
  );
}

// Customer-only -- surfaces the handful of "needs your action" states that
// otherwise only show up once you're already inside a specific project/
// order (ReviewActionPanel.tsx's review gating, OrderDetailPage.tsx's
// stage-gated buttons). Reuses the same two hooks ProjectsListPage.tsx
// already mounts for its own stat rows -- no new Supabase query. Renders
// nothing while loading or once loaded with zero actionable items, same
// "safe to mount unconditionally" posture as WarningsList/
// PendingInvitationsBanner elsewhere in this app.
function NextActionsCallout({ auth, navigate, activeCompanyId }: {
  auth: UseAuth; navigate: (route: Route) => void; activeCompanyId: string | null;
}) {
  const orders = useOrdersSummary(auth.user);
  const projects = useProjects(auth.user, activeCompanyId);
  if (orders.loading || projects.loading) return null;

  const changesNeeded = projects.projects.filter(p =>
    p.install_review_status === "changes_requested" || p.technical_review_status === "changes_requested").length;
  const draftOrders = orders.ordersByStage.draft;
  const submittedOrders = orders.ordersByStage.submitted;
  const proformaIssuedOrders = orders.ordersByStage.proforma_issued;

  const rows = [
    changesNeeded > 0 && { key: "changes", Icon: AlertCircle, iconClass: "text-amber-600 dark:text-amber-300",
      label: `${changesNeeded} project${changesNeeded !== 1 ? "s" : ""} need${changesNeeded === 1 ? "s" : ""} changes from you` },
    draftOrders > 0 && { key: "draft", Icon: FileText, iconClass: "text-slate-500 dark:text-slate-300",
      label: `${draftOrders} order${draftOrders !== 1 ? "s" : ""} still in draft` },
    submittedOrders > 0 && { key: "submitted", Icon: Send, iconClass: "text-blue-600 dark:text-blue-300",
      label: `${submittedOrders} order${submittedOrders !== 1 ? "s" : ""} ready to request a pro forma invoice` },
    proformaIssuedOrders > 0 && { key: "proforma", Icon: CheckCircle2, iconClass: "text-emerald-600 dark:text-emerald-300",
      label: `${proformaIssuedOrders} pro forma invoice${proformaIssuedOrders !== 1 ? "s" : ""} ready to view` },
  ].filter((r): r is Exclude<typeof r, false> => r !== false);

  if (rows.length === 0) return null;

  return (
    <Card title="Next Actions" icon={<ListChecks size={14} />}>
      {rows.map(r => (
        <button key={r.key} type="button" onClick={() => navigate({ tab: "projects" })}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-left transition hover:border-blue-300 dark:hover:border-blue-500/50">
          <span className="flex items-center gap-3">
            <r.Icon className={`h-5 w-5 shrink-0 ${r.iconClass}`} />
            <span className="text-sm text-slate-700 dark:text-slate-300">{r.label}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      ))}
    </Card>
  );
}

export const OverviewDashboardPage = ({ auth, navigate, isInternalStaff, activeCompanyId }: {
  auth: UseAuth; navigate: (route: Route) => void; isInternalStaff: boolean; activeCompanyId: string | null;
}) => {
  const name = auth.user?.email ? nameFromEmail(auth.user.email) : "there";

  return (
    <div className="mt-6">
      <section>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: NAVY }}>
          Welcome back, {name}
        </h1>
        <p className="mt-3 text-lg text-slate-500 dark:text-slate-300">Select a workspace to get started.</p>
      </section>

      {!isInternalStaff && <NextActionsCallout auth={auth} navigate={navigate} activeCompanyId={activeCompanyId} />}

      <section className="mt-8 grid gap-6 lg:grid-cols-4">
        {WORKSPACES.map(w => (
          <WorkspaceCard key={w.title} title={w.title} description={w.description} features={w.features}
            accent={w.accent} icon={w.icon} onClick={() => navigate(w.route)} />
        ))}
      </section>

      <section className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600/80 dark:bg-slate-900/75 dark:shadow-[0_18px_60px_rgba(0,0,0,0.2)] md:grid-cols-[1fr_1.5fr_auto] md:items-center">
        <div>
          <p className="font-semibold" style={{ color: NAVY }}>Can&rsquo;t find what you need?</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Search help, documents or support.</p>
        </div>

        <label className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-400 dark:border-slate-600 dark:bg-slate-950/70 dark:focus-within:border-blue-500">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="search" placeholder="Search help, documents or support..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            style={{ color: NAVY }}
          />
        </label>

        <button
          type="button"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold transition hover:bg-blue-50 dark:hover:bg-blue-500/10"
          style={{ borderColor: BLUE, color: BLUE }}
        >
          <Headphones className="h-5 w-5" /> Contact Support
        </button>
      </section>
    </div>
  );
};
