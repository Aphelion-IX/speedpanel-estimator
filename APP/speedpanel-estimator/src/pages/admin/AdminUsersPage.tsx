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
// Creates a REAL account (not just a role pre-authorization) via the
// admin-invite-user Edge Function -- see usersStore.ts's inviteUser and
// supabase/functions/admin-invite-user/index.ts. Two methods, one form (a
// "Method" dropdown rather than two separate cards, since they're the same
// action with a different last step): "Send invite email" (the original
// flow -- Supabase emails a set-password link, this app never generates or
// displays one) or "Set password directly" (the account is live
// immediately with the password typed here, no email sent -- for a
// super_admin who creates the account themselves rather than having the
// new hire self-serve). Always rendered (not gated behind the list's own
// loading/error/empty states) so a super_admin can create the very first
// staff account even before any exists.
// =============================================================================
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cx, NAVY, MUTED, BLUE } from "../../styleTokens";
import type { UseAuth } from "../../lib/useAuth";
import { Button } from "../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import { Field, SelectField } from "../shared/fields";
import { useAdminUsers } from "./users/usersStore";
import type { AdminUserRow } from "./users/userTypes";
import { INTERNAL_ROLES, INTERNAL_ROLE_LABELS, type InternalRole } from "../company/staffTypes";

const STAFF_ROLE_OPTIONS = INTERNAL_ROLES.map(value => ({ value, label: INTERNAL_ROLE_LABELS[value] }));

const ROLE_FILTER_OPTIONS = [{ value: "all", label: "All roles" }, ...STAFF_ROLE_OPTIONS];

const CREATE_METHOD_OPTIONS = [
  { value: "password", label: "Set password directly" },
  { value: "invite", label: "Send invite email" },
];
type CreateMethod = "password" | "invite";

const CreateStaffForm = ({ onCreate }: { onCreate: (email: string, staffRole: InternalRole, password: string | null) => Promise<string | null> }) => {
  const [method, setMethod] = useState<CreateMethod>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffRole, setStaffRole] = useState<InternalRole>("project_manager");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || (method === "password" && password.length < 8)) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const err = await onCreate(email.trim(), staffRole, method === "password" ? password : null);
    setSubmitting(false);
    if (err) { setError(err); return; }
    setEmail("");
    setPassword("");
    setSuccess(method === "password" ? "Created -- their account is live now with the password you set." : "Invited -- they'll get an email to set their password.");
  };

  return (
    <div className={cx.card}>
      <h2 className={cx.h3}>Add Speedpanel staff</h2>
      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:w-56"><SelectField label="Method" value={method} options={CREATE_METHOD_OPTIONS} onChange={v => setMethod(v as CreateMethod)} /></div>
          <div className="flex-1"><Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" /></div>
          <div className="sm:w-56"><SelectField label="Staff role" value={staffRole} options={STAFF_ROLE_OPTIONS} onChange={v => setStaffRole(v as InternalRole)} /></div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {method === "password" && (
            <div className="flex-1">
              <Field label="Password" value={password} onChange={setPassword} type="password" required autoComplete="new-password" />
              <p className="mt-1 text-xs" style={{ color: MUTED }}>At least 8 characters. Share it with them directly -- it's never shown again.</p>
            </div>
          )}
          <Button type="submit" className="h-[46px] shrink-0" disabled={submitting || !email.trim() || (method === "password" && password.length < 8)}>
            {submitting ? "Adding..." : method === "password" ? "Create" : "Invite"}
          </Button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {success && <p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>{success}</p>}
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
      <h2 className={cx.h3}>Promote an existing account to staff</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">For an account that already exists (e.g. created directly in Supabase) rather than a brand-new hire. No email is sent -- their existing login already works.</p>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1"><Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" /></div>
        <div className="sm:w-56"><SelectField label="Role" value={staffRole} options={STAFF_ROLE_OPTIONS} onChange={v => setStaffRole(v as InternalRole)} /></div>
        <Button type="submit" variant="secondary" className="h-[46px] shrink-0" disabled={promoting || !email.trim()}>
          {promoting ? "Promoting..." : "Promote"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
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
const cellInputCx = "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm";

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
    <tr className="border-t border-slate-100 align-top transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60">
      <td className="px-4 py-3">
        <div className="text-sm font-bold" style={{ color: NAVY }}>
          {item.display_name || item.email || "(no email)"}{isSelf && <span className={cx.footnote}> (you)</span>}
        </div>
        <p className={cx.footnote}>Joined {new Date(item.created_at).toLocaleDateString()}</p>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</p>}
      </td>
      <td className="px-4 py-3 w-48">
        <select value={item.staff_role ?? ""} onChange={e => e.target.value && handleSetStaffRole(e.target.value as InternalRole)} className={cellInputCx} style={{ color: NAVY }}>
          {!item.staff_role && <option value="">Choose a role...</option>}
          {STAFF_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-4 py-3"><input value={displayName} onChange={e => setDisplayName(e.target.value)} className={cellInputCx} style={{ color: NAVY }} /></td>
      <td className="px-4 py-3"><input value={title} onChange={e => setTitle(e.target.value)} className={cellInputCx} style={{ color: NAVY }} /></td>
      <td className="px-4 py-3"><input value={phone} onChange={e => setPhone(e.target.value)} className={cellInputCx} style={{ color: NAVY }} /></td>
      <td className="px-4 py-3 text-right">
        <Button variant="secondary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      </td>
    </tr>
  );
};

// Not built on the shared <Table> primitive -- each row holds its own
// uncommitted draft state (name/title/phone) shared across several cells
// plus a Save button, which doesn't fit Table's per-cell render-prop model
// without prop-drilling a bespoke stateful row component through it anyway.
// Styled to match Table's recipe (rounded wrapper, uppercase header, row
// hover) so it still reads as the same table language.
const UsersTable = ({ items, myUserId, onSetStaffRole, onSaveStaffProfile }: {
  items: AdminUserRow[]; myUserId: string | null;
  onSetStaffRole: (item: AdminUserRow, staffRole: InternalRole) => Promise<string | null>;
  onSaveStaffProfile: (item: AdminUserRow, input: { displayName: string; title: string; phone: string }) => Promise<string | null>;
}) => (
  <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-600">
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-slate-50 dark:bg-slate-900/60">
          <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-300">Person</th>
          <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-300">Staff role</th>
          <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-300">Display name</th>
          <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-300">Title</th>
          <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-300">Phone</th>
          <th className="border-b border-slate-200 px-4 py-3 w-16 dark:border-slate-600" />
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

  const handleCreate = async (email: string, staffRole: InternalRole, password: string | null) => {
    const { error: err } = await inviteUser(email, staffRole, password ?? undefined);
    return err;
  };

  const handlePromote = (email: string, staffRole: InternalRole) => promoteToStaff(email, staffRole);

  const handleSetStaffRole = (item: AdminUserRow, staffRole: InternalRole) => setStaffRole(item.id, staffRole);

  const handleSaveStaffProfile = (item: AdminUserRow, input: { displayName: string; title: string; phone: string }) =>
    setStaffProfile(item.id, input);

  return (
    <div className="mt-2">
      <CreateStaffForm onCreate={handleCreate} />
      <PromoteUserForm onPromote={handlePromote} />

      {loading && <LoadingState className="mt-3" label="Loading staff" />}

      {!loading && error && <ErrorState className="mt-3" message={error} onRetry={() => reload()} />}

      {!loading && !error && users.length === 0 && (
        <EmptyState className={`${cx.card} mt-3 text-center`} message="No Speedpanel staff accounts yet." />
      )}

      {!loading && !error && users.length > 0 && (
        <>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
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
            <EmptyState className={`${cx.card} mt-3 text-center`} message="No staff match your search." />
          ) : (
            <UsersTable items={filtered} myUserId={auth.user?.id ?? null} onSetStaffRole={handleSetStaffRole} onSaveStaffProfile={handleSaveStaffProfile} />
          )}

          {hasMore && (
            <Button variant="secondary" className="mt-3 w-full" onClick={() => loadMore()} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Load more"}
            </Button>
          )}
        </>
      )}
    </div>
  );
};
