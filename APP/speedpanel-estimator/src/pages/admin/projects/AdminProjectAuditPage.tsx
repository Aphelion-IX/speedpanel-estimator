
import { ClipboardList } from "lucide-react";
import { Card } from "../../../ui/primitives";
import { LoadingState } from "../../../ui/states";
import { cx, MUTED, NAVY } from "../../../styleTokens";
import { useProjectOperationsAudit } from "../../projects/projectOperationsStore";

export const AdminProjectAuditPage = ({
  projectId,
}: {
  projectId: string;
}) => {
  const { events, loading, error } =
    useProjectOperationsAudit(projectId);

  return (
    <Card
      title="Project Operations Audit"
      icon={<ClipboardList size={14} />}
    >
      {loading ? (
        <LoadingState label="Loading project audit" />
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : events.length === 0 ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>
          No operational changes recorded.
        </p>
      ) : (
        <div className="space-y-3">
          {events.map(event => (
            <div key={event.id} className={cx.rowBorder}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: NAVY }}>
                    {event.event_type.replace(/_/g, " ")}
                  </p>
                  {event.reason && (
                    <p className="mt-1 text-xs" style={{ color: MUTED }}>
                      {event.reason}
                    </p>
                  )}
                </div>
                <time className="text-xs" style={{ color: MUTED }}>
                  {new Date(event.created_at).toLocaleString()}
                </time>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
