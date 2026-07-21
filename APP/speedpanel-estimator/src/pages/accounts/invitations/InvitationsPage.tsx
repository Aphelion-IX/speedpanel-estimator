// =============================================================================
// Company Accounts & Pricing -- standalone Invitations page (Phase 5)
// =============================================================================
// Cross-company invitation queue -- today invitations only ever surfaced
// per-company (CompanyMemberList.tsx's "Pending invitations" section). No
// standalone "create invitation" form here on purpose: an invitation is
// always scoped to one company + role, and that form already exists
// (InviteMemberForm inside CompanyMemberList.tsx, reached via a company's
// own Users tab) -- "Create Invitation" below routes there rather than
// duplicating a company-picker + invite form Phase 5's own plan doesn't
// call for.
// =============================================================================
import { useMemo, useState } from "react";
import { Mail, Search, Pencil } from "lucide-react";
import { cx, MUTED, NAVY, tone } from "../../../styleTokens";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { Button } from "../../../ui/button";
import { Table, type TableColumn } from "../../../ui/table";
import { Field } from "../../shared/fields";
import { COMPANY_ROLE_LABELS } from "../../company/companyTypes";
import type { Route } from "../../../appShell/useHashRoute";
import {
  useAdminInvitations, adminResendInvitation, adminCancelInvitation, adminFixInvitationEmail,
  INVITATION_STATUSES, INVITATION_STATUS_LABELS, type AdminInvitationRow, type InvitationStatus,
} from "./invitationsStore";

const STATUS_TONE: Record<InvitationStatus, "ok" | "warn" | "danger" | "info" | "neutral"> = {
  pending: "info", accepted: "ok", expired: "neutral", cancelled: "neutral", delivery_failed: "danger",
};

const FixEmailPanel = ({ invitation, onDone, onCancel }: {
  invitation: AdminInvitationRow; onDone: () => void; onCancel: () => void;
}) => {
  const [email, setEmail] = useState(invitation.email);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    const err = await adminFixInvitationEmail(invitation.id, email.trim());
    setSubmitting(false);
    if (err) { setError(err); return; }
    onDone();
  };

  return (
    <form onSubmit={submit} className={`${cx.panel} mt-4 space-y-3 p-4`}>
      <h3 className={cx.h3}>Fix delivery-failed invitation</h3>
      <p className="text-sm" style={{ color: MUTED }}>
        Email could not be delivered to <strong style={{ color: NAVY }}>{invitation.invitee_name || invitation.email}</strong>
        {invitation.failure_reason && <> -- {invitation.failure_reason}</>}. Correct the address if needed, then resend.
      </p>
      <Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" />
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || !email.trim()}>{submitting ? "Sending..." : "Resend"}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
};

export const InvitationsPage = ({ navigate }: { navigate: (r: Route) => void }) => {
  const { invitations, loading, error, reload } = useAdminInvitations();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const counts = useMemo(() => ({
    pending: invitations.filter(i => i.status === "pending").length,
    deliveryFailed: invitations.filter(i => i.status === "delivery_failed").length,
    acceptedThisMonth: invitations.filter(i => {
      if (i.status !== "accepted" || !i.accepted_at) return false;
      const d = new Date(i.accepted_at);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length,
    expired: invitations.filter(i => i.status === "expired").length,
  }), [invitations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invitations.filter(i => {
      if (status !== "all" && i.status !== status) return false;
      if (!q) return true;
      return [i.email, i.invitee_name ?? "", i.company_name].join(" ").toLowerCase().includes(q);
    });
  }, [invitations, query, status]);

  const fixing = fixingId ? invitations.find(i => i.id === fixingId) ?? null : null;

  const run = async (action: () => Promise<string | null>) => {
    setRowError(null);
    const err = await action();
    if (err) { setRowError(err); return; }
    reload();
  };

  const columns: TableColumn<AdminInvitationRow>[] = [
    {
      key: "invitee", header: "Invitee",
      cell: i => (
        <div>
          <div className="text-sm font-bold" style={{ color: NAVY }}>{i.invitee_name || i.email}</div>
          {i.invitee_name && <div className="text-xs" style={{ color: MUTED }}>{i.email}</div>}
        </div>
      ),
    },
    { key: "company", header: "Company", cell: i => i.company_name },
    { key: "role", header: "Role", cell: i => COMPANY_ROLE_LABELS[i.role] },
    {
      key: "status", header: "Status",
      cell: i => <span className={`${cx.badge} ${tone(STATUS_TONE[i.status])}`}>{INVITATION_STATUS_LABELS[i.status]}</span>,
    },
    { key: "sent", header: "Sent", cell: i => new Date(i.created_at).toLocaleDateString() },
    { key: "expires", header: "Expires", cell: i => i.status === "pending" ? new Date(i.expires_at).toLocaleDateString() : "—" },
    {
      key: "actions", header: "", align: "right",
      cell: i => {
        if (i.status === "pending") return (
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" onClick={() => run(() => adminResendInvitation(i.id))}>Resend</Button>
            <Button variant="ghost" onClick={() => run(() => adminCancelInvitation(i.id))}>Cancel</Button>
          </div>
        );
        if (i.status === "delivery_failed") return (
          <Button variant="secondary" icon={<Pencil size={13} />} onClick={() => setFixingId(i.id)}>Fix Email</Button>
        );
        if (i.status === "expired") return (
          <Button variant="ghost" onClick={() => navigate({ tab: "accounts", sub: "companies", companyId: i.company_id })}>
            Open company
          </Button>
        );
        return null;
      },
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className={cx.eyebrow}>Account Management</span>
          <h1 className={cx.h1 + " mt-1"}>Invitations</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-300">
            Secure invitation lifecycle across all external company accounts -- pending, accepted, expired, cancelled and delivery-failed states.
          </p>
        </div>
        <Button icon={<Mail size={15} />} onClick={() => navigate({ tab: "accounts", sub: "companies" })}>
          Create Invitation
        </Button>
      </div>

      <div className="cap-kpis mt-6">
        <div className="cap-kpi"><span className="cap-kpi-label">Pending</span><span className="cap-kpi-value">{counts.pending}</span></div>
        <div className="cap-kpi"><span className="cap-kpi-label">Delivery Failed</span><span className="cap-kpi-value">{counts.deliveryFailed}</span></div>
        <div className="cap-kpi"><span className="cap-kpi-label">Accepted this month</span><span className="cap-kpi-value">{counts.acceptedThisMonth}</span></div>
        <div className="cap-kpi"><span className="cap-kpi-label">Expired</span><span className="cap-kpi-value">{counts.expired}</span></div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search invitee, email or company"
            className={cx.input + " pl-10"}
          />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className={cx.input + " w-auto"}>
          <option value="all">All statuses</option>
          {INVITATION_STATUSES.map(s => <option key={s} value={s}>{INVITATION_STATUS_LABELS[s]}</option>)}
        </select>
        <span className={`${cx.badge} ${tone("neutral")}`}>{filtered.length} record{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {rowError && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{rowError}</p>}

      {fixing && (
        <FixEmailPanel
          invitation={fixing}
          onDone={() => { setFixingId(null); reload(); }}
          onCancel={() => setFixingId(null)}
        />
      )}

      {loading && <LoadingState className="mt-6" label="Loading invitations" />}
      {!loading && error && <ErrorState className="mt-6" message={error} onRetry={() => reload()} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          className={`${cx.card} mt-6 text-center`}
          message={invitations.length === 0 ? "No invitations yet." : "No invitations match your search."}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="mt-6">
          <Table columns={columns} rows={filtered} rowKey={i => i.id} />
        </div>
      )}

      <p className="mt-4 text-xs" style={{ color: MUTED }}>
        Password creation stays user-controlled -- invitations only ever let someone set their own password. Default expiry is 5 days; a delivery failure preserves the invitation record and shows a safe error rather than deleting it, so it can be corrected and resent from here.
      </p>
    </div>
  );
};
