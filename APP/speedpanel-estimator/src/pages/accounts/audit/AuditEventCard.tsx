// =============================================================================
// Company Accounts & Pricing -- one audit-feed event card
// =============================================================================
// Shared by AuditHistoryPage.tsx (cross-company feed) and
// CompanyAuditTab.tsx (one company's feed, showCompany=false since the
// company is already fixed by the page it's embedded on) -- same card,
// same price-trace drill-down for any pricing_used_in_order event, not two
// near-identical copies drifting apart.
// =============================================================================
import { useState } from "react";
import { cx, NAVY, MUTED } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { auditDetailOrderId, eventLabel, type AdminAuditLogRow } from "./auditTypes";
import { TransactionPriceTrace } from "./TransactionPriceTrace";

export const AuditEventCard = ({ row, showCompany = true }: { row: AdminAuditLogRow; showCompany?: boolean }) => {
  const [traceOpen, setTraceOpen] = useState(false);
  const orderId = row.event_type === "pricing_used_in_order" ? auditDetailOrderId(row) : null;

  const metaParts = [
    showCompany ? row.company_name : null,
    row.project_name,
    row.target_email ? `target: ${row.target_email}` : null,
  ].filter((p): p is string => !!p);

  return (
    <div className={`${cx.card} mt-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold" style={{ color: NAVY }}>{eventLabel(row.event_type)}</div>
          {metaParts.length > 0 && (
            <div className="mt-0.5 text-xs" style={{ color: MUTED }}>{metaParts.join(" · ")}</div>
          )}
        </div>
        <div className="text-right">
          <div className={cx.footnote}>{new Date(row.created_at).toLocaleString()}</div>
          {row.actor_email && <div className="text-xs" style={{ color: MUTED }}>{row.actor_email}</div>}
        </div>
      </div>

      {row.detail && Object.keys(row.detail).length > 0 && (
        <p className="mt-2 font-mono text-xs leading-relaxed" style={{ color: MUTED }}>
          {Object.entries(row.detail).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join("  ·  ")}
        </p>
      )}

      {orderId && (
        <>
          <Button variant="secondary" className="mt-3" onClick={() => setTraceOpen(o => !o)}>
            {traceOpen ? "Hide price trace" : "View price trace"}
          </Button>
          {traceOpen && <TransactionPriceTrace orderId={orderId} />}
        </>
      )}
    </div>
  );
};
