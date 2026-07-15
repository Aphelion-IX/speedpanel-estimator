// =============================================================================
// My Requests -- consolidated request history
// =============================================================================
// Reached via AuthStatus.tsx's account dropdown (customer-only, mirroring
// the staff-only "Admin" shortcut in the same menu), not a top-nav tab --
// see useHashRoute.ts's Route comment for why. Shows EVERY install/
// technical review request, delivery request, and quote/contact request
// across all of this customer's projects, whatever its current status --
// a history view, distinct from OverviewDashboardPage.tsx's "Next Actions"
// callout, which only surfaces items still needing action right now.
// =============================================================================
import { ClipboardCheck, ClipboardList, Truck, Mail, ChevronRight, ListChecks } from "lucide-react";
import { cx, NAVY, MUTED } from "../../../styleTokens";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import type { Route } from "../../../appShell/useHashRoute";
import type { UseAuth } from "../../../lib/useAuth";
import { useProjects } from "../projectsStore";
import { useMyRequests, type MyRequestItem } from "./myRequestsStore";
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_BADGE_CLASS } from "../projectTypes";
import { DELIVERY_APPROVAL_STATUS_LABELS, DELIVERY_APPROVAL_STATUS_BADGE_CLASS } from "../orders/orderTypes";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_BADGE_CLASS } from "./requestTypes";
import { relativeTime } from "../projectActivityStore";

function itemDetails(item: MyRequestItem): {
  Icon: React.ElementType; label: string; badge: string; badgeClass: string; onClick?: () => void;
} {
  if (item.source === "review") {
    return {
      Icon: item.kind === "install" ? ClipboardCheck : ClipboardList,
      label: `${item.kind === "install" ? "Install" : "Technical"} review — ${item.project.name}`,
      badge: REVIEW_STATUS_LABELS[item.status],
      badgeClass: REVIEW_STATUS_BADGE_CLASS[item.status],
    };
  }
  if (item.source === "delivery") {
    return {
      Icon: Truck,
      label: `Delivery request — ${item.project.name}`,
      badge: DELIVERY_APPROVAL_STATUS_LABELS[item.delivery.approval_status],
      badgeClass: DELIVERY_APPROVAL_STATUS_BADGE_CLASS[item.delivery.approval_status],
    };
  }
  return {
    Icon: Mail,
    label: `Quote request — ${item.project?.name ?? "General inquiry"}`,
    badge: REQUEST_STATUS_LABELS[item.request.status],
    badgeClass: REQUEST_STATUS_BADGE_CLASS[item.request.status],
  };
}

const RequestRow = ({ item, navigate }: { item: MyRequestItem; navigate: (route: Route) => void }) => {
  const { Icon, label, badge, badgeClass } = itemDetails(item);
  const onClick =
    item.source === "review" ? () => navigate({ tab: "projects", id: item.project.id })
    : item.source === "delivery" ? () => navigate({ tab: "projects", id: item.project.id, orderId: item.order.id })
    : undefined;

  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="h-5 w-5 shrink-0" style={{ color: NAVY }} />
        <span className="min-w-0 truncate text-sm font-semibold" style={{ color: NAVY }}>{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <span className={`${cx.badge} ${badgeClass}`}>{badge}</span>
        <span className="text-xs" style={{ color: MUTED }}>{relativeTime(item.at)}</span>
        {onClick && <ChevronRight className="h-4 w-4" style={{ color: MUTED }} />}
      </span>
    </>
  );

  return onClick ? (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-4 text-left last:border-b-0">
      {content}
    </button>
  ) : (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-4 last:border-b-0">
      {content}
    </div>
  );
};

export const MyRequestsPage = ({ auth, navigate, activeCompanyId }: {
  auth: UseAuth; navigate: (route: Route) => void; activeCompanyId: string | null;
}) => {
  const { projects, loading: projectsLoading, error: projectsError } = useProjects(auth.user, activeCompanyId);
  const { items, loading: requestsLoading, error: requestsError } = useMyRequests(auth.user, projects);
  const loading = projectsLoading || requestsLoading;
  const error = projectsError || requestsError;

  return (
    <div className="mt-2">
      <h1 className={`${cx.h1} flex items-center gap-2`}>
        <ListChecks className="h-5 w-5" style={{ color: NAVY }} /> My Requests
      </h1>
      <p className={cx.footnote} style={{ paddingTop: 4 }}>
        Every install/technical review, delivery, and quote request across your projects.
      </p>

      {loading ? (
        <LoadingState className="mt-4" />
      ) : error ? (
        <ErrorState className="mt-4" message={error} />
      ) : items.length === 0 ? (
        <EmptyState className={`${cx.card} mt-4`} message="No requests yet." />
      ) : (
        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          {items.map((item, i) => (
            <RequestRow key={`${item.source}-${item.source === "review" ? `${item.project.id}-${item.kind}` : item.source === "delivery" ? item.delivery.id : item.request.id}-${i}`} item={item} navigate={navigate} />
          ))}
        </section>
      )}
    </div>
  );
};
