// =============================================================================
// Admin > Analytics -- read-only counts across every admin-visible table
// =============================================================================
// No mutations, no per-row interaction -- just Stat tiles fed by
// analyticsStore.ts's aggregate queries.
// =============================================================================
import { cx } from "../../styleTokens";
import { Stat } from "../../ui/primitives";
import { LoadingState, ErrorState } from "../../ui/states";
import { useAdminAnalytics } from "./analytics/analyticsStore";
import { REQUEST_STATUSES } from "../projects/requests/requestTypes";
import { STAGES, STAGE_LABELS } from "../projects/projectTypes";

export const AdminAnalyticsPage = () => {
  const { data, loading, error, reload } = useAdminAnalytics();

  if (loading) {
    return <LoadingState className="mt-6" label="Loading analytics" />;
  }

  if (error || !data) {
    return <ErrorState className="mt-6" message={error ?? "No data."} onRetry={() => reload()} />;
  }

  return (
    <div className="mt-2 space-y-5">
      <div>
        <div className={cx.cardHd}>Catalog</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Stat value={data.catalog.panels} label="Panels" />
          <Stat value={data.catalog.tracks} label="Tracks" />
          <Stat value={data.catalog.fixings} label="Fixings" />
          <Stat value={data.catalog.sealants} label="Sealants" />
          <Stat value={data.catalog.colours} label="Colours" />
          <Stat value={data.catalog.documents} label="Documents" />
        </div>
      </div>

      <div>
        <div className={cx.cardHd}>Requests ({data.requestsTotal})</div>
        <div className="grid grid-cols-3 gap-2">
          {REQUEST_STATUSES.map(s => <Stat key={s} value={data.requestsByStatus[s]} label={s} />)}
        </div>
      </div>

      <div>
        <div className={cx.cardHd}>Projects ({data.projectsTotal})</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STAGES.map(s => <Stat key={s} value={data.projectsByStage[s]} label={STAGE_LABELS[s]} />)}
        </div>
      </div>

      <div>
        <div className={cx.cardHd}>Users</div>
        <div className="grid grid-cols-2 gap-2">
          <Stat value={data.users.total} label="Total" />
          <Stat value={data.users.admins} label="Admins" />
        </div>
      </div>
    </div>
  );
};
