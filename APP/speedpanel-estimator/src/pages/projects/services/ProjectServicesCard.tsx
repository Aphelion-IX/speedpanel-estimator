// =============================================================================
// Project Services card -- the four eligibility-gated support requests
// =============================================================================
// Spec section 12 ("Support and Services"): Technical Review and Pre-Start
// Meeting are always open-able once a project exists; Installation Review
// unlocks after the first delivered delivery; Product Warranty unlocks once
// every order is fully delivered. Availability is never guessed client-side
// -- useServiceEligibility() calls the real service_request_eligibility() RPC
// (see supabase/schema.sql) for all four types, so a locked tile always shows
// the server's own reasonCode/message.
//
// Distinct from ReviewActionPanel.tsx's "Request Services" card (install/
// technical review of the pre-order DESIGN pipeline) -- this card is the
// always-there support/services surface, unrelated to that state machine.
// =============================================================================
import { useState } from "react";
import { ChevronRight, ClipboardCheck, Lock, MessageSquare, ShieldCheck, Users, Wrench } from "lucide-react";
import { cx, NAVY, BLUE, MUTED } from "../../../styleTokens";
import { Card } from "../../../ui/primitives";
import { useProjectServiceRequests, useServiceEligibility } from "./serviceRequestsStore";
import { ServiceRequestForm } from "./ServiceRequestForm";
import { ServiceRequestDetailDrawer } from "./ServiceRequestDetailDrawer";
import {
  SERVICE_REQUEST_TYPES, SERVICE_REQUEST_TYPE_LABELS, SERVICE_REQUEST_TYPE_DESCRIPTIONS,
  SERVICE_REQUEST_STATUS_LABELS, SERVICE_REQUEST_STATUS_BADGE_CLASS,
  type ServiceRequestType, type ServiceRequestRow,
} from "./serviceRequestTypes";
import type { EffectiveLayout } from "../../../useLayoutMode";

const TYPE_ICON: Record<ServiceRequestType, React.ElementType> = {
  technical_review: ClipboardCheck,
  pre_start_meeting: Users,
  installation_review: ShieldCheck,
  product_warranty: Wrench,
};

const ServiceTile = ({ type, available, reasonMessage, onRequest }: {
  type: ServiceRequestType; available: boolean; reasonMessage?: string; onRequest: () => void;
}) => {
  const Icon = TYPE_ICON[type];
  return (
    <button onClick={onRequest} disabled={!available}
      className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0">
      <div className="flex w-full items-start justify-between gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/55" style={{ color: BLUE }}>
          <Icon size={16} />
        </span>
        {available ? <ChevronRight size={16} style={{ color: MUTED }} /> : <Lock size={14} style={{ color: MUTED }} />}
      </div>
      <div className="text-sm font-bold" style={{ color: NAVY }}>{SERVICE_REQUEST_TYPE_LABELS[type]}</div>
      <p className="text-xs" style={{ color: MUTED }}>{available ? SERVICE_REQUEST_TYPE_DESCRIPTIONS[type] : reasonMessage}</p>
    </button>
  );
};

export const ProjectServicesCard = ({ projectId, userId, layoutMode }: {
  projectId: string; userId: string | null; layoutMode: EffectiveLayout;
}) => {
  const { requests, createRequest, reload: reloadRequests } = useProjectServiceRequests(projectId);
  const { eligibility, reload: reloadEligibility } = useServiceEligibility(projectId);
  const [formType, setFormType] = useState<ServiceRequestType | null>(null);
  const [detail, setDetail] = useState<ServiceRequestRow | null>(null);

  const handleCreated = async () => {
    setFormType(null);
    await Promise.all([reloadRequests(), reloadEligibility()]);
  };

  return (
    <Card title="Project Services" icon={<MessageSquare size={14} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        {SERVICE_REQUEST_TYPES.map(type => (
          <ServiceTile key={type} type={type} available={eligibility[type]?.available ?? false}
            reasonMessage={eligibility[type]?.message} onRequest={() => setFormType(type)} />
        ))}
      </div>

      {requests.length > 0 && (
        <div className="mt-4 space-y-1">
          <div className={cx.cardHd}>Your requests</div>
          {requests.map(r => (
            <button key={r.id} onClick={() => setDetail(r)} className={`flex w-full items-center justify-between gap-2 text-left ${cx.rowBorder}`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" style={{ color: NAVY }}>{SERVICE_REQUEST_TYPE_LABELS[r.request_type]}</p>
                <p className={cx.footnote} style={{ paddingTop: 0 }}>{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`${cx.badge} shrink-0 ${SERVICE_REQUEST_STATUS_BADGE_CLASS[r.status]}`}>{SERVICE_REQUEST_STATUS_LABELS[r.status]}</span>
            </button>
          ))}
        </div>
      )}

      {formType && (
        <ServiceRequestForm requestType={formType} layoutMode={layoutMode}
          onClose={() => setFormType(null)}
          onSubmit={fields => createRequest(formType, fields)}
          onCreated={handleCreated}
        />
      )}

      {detail && (
        <ServiceRequestDetailDrawer request={detail} userId={userId} layoutMode={layoutMode} onClose={() => setDetail(null)} />
      )}
    </Card>
  );
};
