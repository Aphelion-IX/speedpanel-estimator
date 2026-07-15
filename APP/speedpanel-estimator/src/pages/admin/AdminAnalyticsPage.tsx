// =============================================================================
// Admin > Analytics -- read-only counts across every admin-visible table
// =============================================================================
// No mutations, no per-row interaction -- just Stat tiles fed by
// analyticsStore.ts's aggregate queries.
// =============================================================================
import { cx, NAVY, MUTED } from "../../styleTokens";
import { Stat } from "../../ui/primitives";
import { useAdminAnalytics } from "./analytics/analyticsStore";
import { REQUEST_STATUSES } from "../projects/requests/requestTypes";
import { STAGES, STAGE_LABELS } from "../projects/projectTypes";

export const AdminAnalyticsPage = () => {
  const { data, loading, error, reload } = useAdminAnalytics();

  if (loading) {
    return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;
  }

  if (error || !data) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error ?? "No data."}</p>
        <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
      </div>
    );
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
