// =============================================================================
// Company roster + pending invitations -- shared between the customer-facing
// Team page and Admin > Companies
// =============================================================================
// Extracted out of CompanyTeamPage.tsx so Admin > Companies can manage any
// company's roster through the exact same, already-tested invite/role/
// suspend/remove controls, now that is_company_admin/is_company_owner's
// is_admin() bypass (see supabase/schema.sql) lets an admin call these RPCs
// for a company they were never added to as a member. canManage is passed in
// rather than derived here: on the customer side it's "am I owner/admin of
// this company", on the Admin side it's always true (is_admin() is the real
// gate either way).
// =============================================================================
import { useState } from "react";
import { UserPlus, Mail } from "lucide-react";
import { cx, NAVY, BLUE, WHITE } from "../../styleTokens";
import { Field, SelectField, TextAreaField } from "../shared/fields";
import {
  COMPANY_ROLES, COMPANY_ROLE_LABELS, MEMBERSHIP_STATUS_BADGE_CLASS,
  type CompanyMemberRow, type CompanyRole, type InvitationRow,
} from "./companyTypes";
import { useCompanyMembers, useCompanyProjects } from "./companyStore";

const ROLE_OPTIONS = COMPANY_ROLES.map(value => ({ value, label: COMPANY_ROLE_LABELS[value] }));

const InviteMemberForm = ({ companyId, onInvited }: {
  companyId: string;
  onInvited: (input: { email: string; role: CompanyRole; name?: string; message?: string; projectIds?: string[] }) => Promise<string | null>;
}) => {
  const projects = useCompanyProjects(companyId);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<CompanyRole>("estimator");
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toggleProject = (id: string) =>
    setSelectedProjects(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    setSuccess(false);
    const err = await onInvited({
      email: email.trim(), role, name: name.trim() || undefined, message: message.trim() || undefined,
      projectIds: scope === "selected" && selectedProjects.length > 0 ? selectedProjects : undefined,
    });
    setInviting(false);
    if (err) { setError(err); return; }
    setEmail(""); setName(""); setMessage(""); setSelectedProjects([]); setScope("all");
    setSuccess(true);
  };

  return (
    <div className={cx.card}>
      <div className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
        <UserPlus size={15} /> Invite a teammate
      </div>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" />
          <Field label="Name (optional)" value={name} onChange={setName} />
        </div>
        <div className="sm:w-56"><SelectField label="Role" value={role} options={ROLE_OPTIONS} onChange={v => setRole(v as CompanyRole)} /></div>
        <TextAreaField label="Message (optional)" value={message} onChange={setMessage} />

        {projects.length > 0 && (
          <div>
            <label className={cx.lbl}>Project access</label>
            <div className="mt-1 flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-sm" style={{ color: NAVY }}>
                <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} /> All projects allowed by role
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: NAVY }}>
                <input type="radio" checked={scope === "selected"} onChange={() => setScope("selected")} /> Selected projects only
              </label>
            </div>
            {scope === "selected" && (
              <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 p-2">
                {projects.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm" style={{ color: NAVY }}>
                    <input type="checkbox" checked={selectedProjects.includes(p.id)} onChange={() => toggleProject(p.id)} /> {p.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="text-sm font-semibold" style={{ color: BLUE }}>Invitation sent.</p>}

        <button type="submit" disabled={inviting || !email.trim()}
          className="rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
          {inviting ? "Sending..." : "Send invitation"}
        </button>
      </form>
    </div>
  );
};

const MemberRow = ({ member, isSelf, canManage, onSetRole, onSetStatus, onRemove }: {
  member: CompanyMemberRow; isSelf: boolean; canManage: boolean;
  onSetRole: (role: CompanyRole) => void;
  onSetStatus: (status: "active" | "suspended") => void;
  onRemove: () => void;
}) => (
  <div className={`${cx.card} mt-3`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="text-sm font-bold" style={{ color: NAVY }}>
          {member.email ?? "(no email)"}{isSelf && <span className={cx.footnote}> (you)</span>}
        </div>
        <p className={cx.footnote}>
          Joined {new Date(member.joined_at).toLocaleDateString()}
          {member.last_active_at && ` · Last active ${new Date(member.last_active_at).toLocaleDateString()}`}
        </p>
        <p className={cx.footnote}>
          {["owner", "admin", "project_manager"].includes(member.role) ? "All projects" : `${member.assigned_project_count} project${member.assigned_project_count === 1 ? "" : "s"} assigned`}
        </p>
      </div>
      <span className={`${cx.badge} ${MEMBERSHIP_STATUS_BADGE_CLASS[member.status]}`}>{member.status}</span>
    </div>

    {canManage && !isSelf ? (
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="w-48"><SelectField label="Role" value={member.role} options={ROLE_OPTIONS} onChange={v => onSetRole(v as CompanyRole)} /></div>
        <button onClick={() => onSetStatus(member.status === "suspended" ? "active" : "suspended")}
          className="h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-sm font-bold" style={{ color: NAVY }}>
          {member.status === "suspended" ? "Reactivate" : "Suspend"}
        </button>
        <button onClick={onRemove} className="h-[46px] rounded-xl px-4 text-sm font-bold text-red-500">Remove</button>
      </div>
    ) : (
      <p className="mt-3 text-sm font-semibold" style={{ color: NAVY }}>{COMPANY_ROLE_LABELS[member.role]}</p>
    )}
  </div>
);

const PendingInvitationRow = ({ invitation, canManage, onResend, onCancel }: {
  invitation: InvitationRow; canManage: boolean; onResend: () => void; onCancel: () => void;
}) => (
  <div className={`${cx.card} mt-3`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
          <Mail size={14} /> {invitation.email}{invitation.invitee_name && <span className={cx.footnote}> ({invitation.invitee_name})</span>}
        </div>
        <p className={cx.footnote}>
          {COMPANY_ROLE_LABELS[invitation.role]} &middot; Expires {new Date(invitation.expires_at).toLocaleDateString()}
        </p>
      </div>
      <span className={`${cx.badge} bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400`}>pending</span>
    </div>
    {canManage && (
      <div className="mt-3 flex gap-2">
        <button onClick={onResend} className="text-sm font-bold" style={{ color: BLUE }}>Resend</button>
        <button onClick={onCancel} className="text-sm font-bold text-red-500">Cancel</button>
      </div>
    )}
  </div>
);

export const CompanyMemberList = ({ companyId, myUserId, canManage }: {
  companyId: string; myUserId: string | null; canManage: boolean;
}) => {
  const { members, invitations, loading, error, inviteMember, resendInvitation, cancelInvitation, setRole, setStatus, removeMember, removalWarnings } = useCompanyMembers(companyId);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setActionError(null);
    const err = await action();
    if (err) setActionError(err);
  };

  const handleRemove = async (member: CompanyMemberRow) => {
    const warnings = await removalWarnings(member.user_id);
    const parts: string[] = [];
    if (warnings) {
      if (warnings.activeProjectsAsPm > 0) parts.push(`project manager on ${warnings.activeProjectsAsPm} active project(s)`);
      if (warnings.draftOrders > 0) parts.push(`${warnings.draftOrders} draft order(s)`);
      if (warnings.openReviewsAsPm > 0) parts.push(`${warnings.openReviewsAsPm} open review(s)`);
    }
    const note = parts.length > 0 ? ` They're currently ${parts.join(", ")} -- you may want to reassign these first.` : "";
    if (!window.confirm(`Remove ${member.email ?? "this person"} from the company?${note}`)) return;
    run(() => removeMember(member.user_id));
  };

  if (loading) return <p className={cx.footnote}>Loading...</p>;

  return (
    <div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {actionError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{actionError}</p>}

      {canManage && (
        <div className="mt-3">
          <InviteMemberForm companyId={companyId} onInvited={inviteMember} />
        </div>
      )}

      <div className={cx.cardHd + " mt-6"}>Members</div>
      {members.length === 0 && <p className={cx.footnote}>No members yet.</p>}
      {members.map(m => (
        <MemberRow key={m.user_id} member={m} isSelf={m.user_id === myUserId} canManage={canManage}
          onSetRole={role => run(() => setRole(m.user_id, role))}
          onSetStatus={status => run(() => setStatus(m.user_id, status))}
          onRemove={() => handleRemove(m)}
        />
      ))}

      {invitations.length > 0 && (
        <>
          <div className={cx.cardHd + " mt-6"}>Pending invitations</div>
          {invitations.map(inv => (
            <PendingInvitationRow key={inv.id} invitation={inv} canManage={canManage}
              onResend={() => run(() => resendInvitation(inv.id))}
              onCancel={() => run(() => cancelInvitation(inv.id))}
            />
          ))}
        </>
      )}
    </div>
  );
};
