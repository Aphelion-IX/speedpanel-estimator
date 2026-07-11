// =============================================================================
// Admin > Users -- Speedpanel staff directory
// =============================================================================
// Staff-only: external/customer accounts are managed exclusively via each
// company's own roster on Admin > Companies now (see CompanyMemberList.tsx)
// -- admin_list_users() itself is narrowed to role='admin' rows server-side
// (see supabase/schema.sql), so this page never sees a customer account
// regardless of what it queries for. Every invite from here is inherently a
// new Speedpanel hire, with a required internal staff_role (used both for
// Admin section access -- see adminSectionAccess.ts -- and eligibility for
// Assigned Speedpanel Team assignment).
// Receives `auth` as a prop (App.tsx's own useAuth() instance, same
// convention as ProjectsRouter) rather than calling useAuth() again here,
// which would open a second independent auth subscription.
//
// "Invite" creates a REAL account (not just a role pre-authorization) via
// the admin-invite-user Edge Function -- see usersStore.ts's inviteUser and
// supabase/functions/admin-invite-user/index.ts. The invited person gets a
// Supabase email with a link to set their own password; this app never
// generates or displays one. Always rendered (not gated behind the list's
// own loading/error/empty states) so a super_admin can invite the very
// first staff account even before any exists.
// =============================================================================
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cx, NAVY, MUTED, BLUE, WHITE } from "../../styleTokens";
import type { UseAuth } from "../../lib/useAuth";
import { Field, SelectField } from "../shared/fields";
import { useAdminUsers } from "./users/usersStore";
import type { AdminUserRow } from "./users/userTypes";
import { INTERNAL_ROLES, INTERNAL_ROLE_LABELS, type InternalRole } from "../company/staffTypes";

const STAFF_ROLE_OPTIONS = INTERNAL_ROLES.map(value => ({ value, label: INTERNAL_ROLE_LABELS[value] }));

const ROLE_FILTER_OPTIONS = [{ value: "all", label: "All roles" }, ...STAFF_ROLE_OPTIONS];

const InviteUserForm = ({ onInvite }: { onInvite: (email: string, staffRole: InternalRole) => Promise<string | null> }) => {
  const [email, setEmail] = useState("");
  const [staffRole, setStaffRole] = useState<InternalRole>("project_manager");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    setSuccess(false);
    const err = await onInvite(email.trim(), staffRole);
    setInviting(false);
    if (err) { setError(err); return; }
    setEmail("");
    setSuccess(true);
  };

  return (
    <div className={cx.card}>
      <h1 className="text-sm font-bold" style={{ color: NAVY }}>Invite Speedpanel staff</h1>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1"><Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" /></div>
        <div className="sm:w-56"><SelectField label="Role" value={staffRole} options={STAFF_ROLE_OPTIONS} onChange={v => setStaffRole(v as InternalRole)} /></div>
        <button type="submit" disabled={inviting || !email.trim()}
          className="h-[46px] shrink-0 rounded-xl px-5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
          {inviting ? "Inviting..." : "Invite"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>Invited -- they'll get an email to set their password.</p>}
    </div>
  );
};

// For an account that already exists (a former customer signup, or one
// created directly in Supabase) rather than a brand-new hire -- looks the
// account up by email and sets role='admin' + staff_role in one step
// (admin_promote_user_to_staff_by_email), after which it shows up in the
// list below like any other staff account. No email is sent; the person's
// existing login already works.
const PromoteUserForm = ({ onPromote }: { onPromote: (email: string, staffRole: InternalRole) => Promise<string | null> }) => {
  const [email, setEmail] = useState("");
  const [staffRole, setStaffRole] = useState<InternalRole>("project_manager");
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setPromoting(true);
    setError(null);
    setSuccess(false);
    const err = await onPromote(email.trim(), staffRole);
    setPromoting(false);
    if (err) { setError(err); return; }
    setEmail("");
    setSuccess(true);
  };

  return (
    <div className={`${cx.card} mt-3`}>
      <h1 className="text-sm font-bold" style={{ color: NAVY }}>Promote an existing account to staff</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">For an account that already exists (e.g. created directly in Supabase) rather than a brand-new hire. No email is sent -- their existing login already works.</p>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1"><Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" /></div>
        <div className="sm:w-56"><SelectField label="Role" value={staffRole} options={STAFF_ROLE_OPTIONS} onChange={v => setStaffRole(v as InternalRole)} /></div>
        <button type="submit" disabled={promoting || !email.trim()}
          className="h-[46px] shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 px-5 text-sm font-bold disabled:opacity-50" style={{ color: BLUE }}>
          {promoting ? "Promoting..." : "Promote"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>Promoted -- they now appear in the staff list below.</p>}
    </div>
  );
};

// display_name/title/phone are how this person shows up on a customer's
// "Your Speedpanel Team" card once assigned via Admin > Companies, see
// supabase/schema.sql's admin_set_staff_profile.
//
// One <tr> per person, inline-editable cells -- same underlying behavior as
// the card layout this replaced (role change auto-applies on select, the
// three profile fields batch into one Save click), just laid out as a table
// row so a long staff list scans/compares in one glance instead of stacking
// tall cards. Plain styled <input>/<select> elements (not Field/SelectField,
// which each render their own <label> and aren't meant to sit inside a
// <td>) -- same convention as RepeatableRowEditor's editable cells
// (src/pages/admin/shared/repeatableRowEditor.tsx).
const cellInputCx = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm";

const UserTableRow = ({ item, isSelf, onSetStaffRole, onSaveStaffProfile }: {
  item: AdminUserRow; isSelf: boolean;
  onSetStaffRole: (item: AdminUserRow, staffRole: InternalRole) => Promise<string | null>;
  onSaveStaffProfile: (item: AdminUserRow, input: { displayName: string; title: string; phone: string }) => Promise<string | null>;
}) => {
  const [displayName, setDisplayName] = useState(item.display_name ?? "");
  const [title, setTitle] = useState(item.title ?? "");
  const [phone, setPhone] = useState(item.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetStaffRole = async (staffRole: InternalRole) => {
    setError(null);
    const err = await onSetStaffRole(item, staffRole);
    if (err) setError(err);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const err = await onSaveStaffProfile(item, { displayName: displayName.trim(), title: title.trim(), phone: phone.trim() });
    setSaving(false);
    if (err) setError(err);
  };

  return (
    <tr className="border-t border-slate-100 dark:border-slate-800 align-top">
      <td className="py-2.5 pr-3">
        <div className="text-sm font-bold" style={{ color: NAVY }}>
          {item.display_name || item.email || "(no email)"}{isSelf && <span className={cx.footnote}> (you)</span>}
        </div>
        <p className={cx.footnote}>Joined {new Date(item.created_at).toLocaleDateString()}</p>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </td>
      <td className="py-2.5 pr-3 w-48">
        <select value={item.staff_role ?? ""} onChange={e => e.target.value && handleSetStaffRole(e.target.value as InternalRole)} className={cellInputCx} style={{ color: NAVY }}>
          {!item.staff_role && <option value="">Choose a role...</option>}
          {STAFF_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="py-2.5 pr-3"><input value={displayName} onChange={e => setDisplayName(e.target.value)} className={cellInputCx} style={{ color: NAVY }} /></td>
      <td className="py-2.5 pr-3"><input value={title} onChange={e => setTitle(e.target.value)} className={cellInputCx} style={{ color: NAVY }} /></td>
      <td className="py-2.5 pr-3"><input value={phone} onChange={e => setPhone(e.target.value)} className={cellInputCx} style={{ color: NAVY }} /></td>
      <td className="py-2.5 text-right">
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ color: BLUE }}>
          {saving ? "Saving..." : "Save"}
        </button>
      </td>
    </tr>
  );
};

const UsersTable = ({ items, myUserId, onSetStaffRole, onSaveStaffProfile }: {
  items: AdminUserRow[]; myUserId: string | null;
  onSetStaffRole: (item: AdminUserRow, staffRole: InternalRole) => Promise<string | null>;
  onSaveStaffProfile: (item: AdminUserRow, input: { displayName: string; title: string; phone: string }) => Promise<string | null>;
}) => (
  <div className={`${cx.card} mt-3 overflow-x-auto`}>
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="pb-1.5 pr-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Person</th>
          <th className="pb-1.5 pr-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Staff role</th>
          <th className="pb-1.5 pr-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Display name</th>
          <th className="pb-1.5 pr-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Title</th>
          <th className="pb-1.5 pr-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Phone</th>
          <th className="pb-1.5 w-16" />
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <UserTableRow key={item.id} item={item} isSelf={item.id === myUserId} onSetStaffRole={onSetStaffRole} onSaveStaffProfile={onSaveStaffProfile} />
        ))}
      </tbody>
    </table>
  </div>
);

export const AdminUsersPage = ({ auth }: { auth: UseAuth }) => {
  const { users, loading, loadingMore, hasMore, error, reload, loadMore, setStaffRole, setStaffProfile, inviteUser, promoteToStaff } = useAdminUsers();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(u => (roleFilter === "all" || u.staff_role === roleFilter) && (!q || (u.email ?? "").toLowerCase().includes(q)));
  }, [users, query, roleFilter]);

  const handleInvite = async (email: string, staffRole: InternalRole) => {
    const { error: err } = await inviteUser(email, staffRole);
    return err;
  };

  const handlePromote = (email: string, staffRole: InternalRole) => promoteToStaff(email, staffRole);

  const handleSetStaffRole = (item: AdminUserRow, staffRole: InternalRole) => setStaffRole(item.id, staffRole);

  const handleSaveStaffProfile = (item: AdminUserRow, input: { displayName: string; title: string; phone: string }) =>
    setStaffProfile(item.id, input);

  return (
    <div className="mt-2">
      <InviteUserForm onInvite={handleInvite} />
      <PromoteUserForm onPromote={handlePromote} />

      {loading && <div className={`${cx.card} mt-3 text-sm`} style={{ color: MUTED }}>Loading...</div>}

      {!loading && error && (
        <div className={`${cx.card} mt-3`}>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className={`${cx.card} mt-3 text-center`}>
          <p className={cx.footnote}>No Speedpanel staff accounts yet.</p>
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
              <Search size={16} className="shrink-0" style={{ color: MUTED }} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search email..."
                className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
            </div>
            <div className="sm:w-48">
              <SelectField label="Filter by role" value={roleFilter} options={ROLE_FILTER_OPTIONS} onChange={setRoleFilter} />
            </div>
          </div>
          {hasMore && query.trim() && (
            <p className="mt-2 text-xs" style={{ color: MUTED }}>Search only covers users loaded so far -- load more below if you can't find who you're after.</p>
          )}

          {filtered.length === 0 ? (
            <div className={`${cx.card} mt-3 text-center`}>
              <p className={cx.footnote}>No staff match your search.</p>
            </div>
          ) : (
            <UsersTable items={filtered} myUserId={auth.user?.id ?? null} onSetStaffRole={handleSetStaffRole} onSaveStaffProfile={handleSaveStaffProfile} />
          )}

          {hasMore && (
            <button onClick={() => loadMore()} disabled={loadingMore}
              className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ color: NAVY }}>
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
};
