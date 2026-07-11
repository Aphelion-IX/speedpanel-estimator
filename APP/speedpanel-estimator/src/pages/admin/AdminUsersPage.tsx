// =============================================================================
// Admin > Users -- signed-up accounts + role management
// =============================================================================
// Replaces the manual "update profiles set role = 'admin' where id = ..."
// SQL step (see supabase/schema.sql's profiles comment) with a UI toggle,
// gated server-side by admin_set_role()'s is_admin() check and its own
// "last admin" guard -- this page can't lock every admin out of itself.
// Receives `auth` as a prop (App.tsx's own useAuth() instance, same
// convention as ProjectsRouter) rather than calling useAuth() again here,
// which would open a second independent auth subscription.
//
// "Invite user" creates a REAL account (not just a role pre-authorization)
// via the admin-invite-user Edge Function -- see usersStore.ts's inviteUser
// and supabase/functions/admin-invite-user/index.ts. The invited person gets
// a Supabase email with a link to set their own password; this app never
// generates or displays one. Always rendered (not gated behind the list's
// own loading/error/empty states) so an admin can invite the very first user
// even before any account exists.
// =============================================================================
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cx, NAVY, MUTED, BLUE, WHITE } from "../../styleTokens";
import type { UseAuth } from "../../lib/useAuth";
import { Field, SelectField } from "../shared/fields";
import { useAdminUsers } from "./users/usersStore";
import type { AdminUserRow, UserRole } from "./users/userTypes";

const ROLE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
];

const ROLE_FILTER_OPTIONS = [
  { value: "all", label: "All roles" },
  ...ROLE_OPTIONS,
];

const InviteUserForm = ({ onInvite }: { onInvite: (email: string, role: UserRole) => Promise<string | null> }) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    setSuccess(false);
    const err = await onInvite(email.trim(), role);
    setInviting(false);
    if (err) { setError(err); return; }
    setEmail("");
    setRole("user");
    setSuccess(true);
  };

  return (
    <div className={cx.card}>
      <h1 className="text-sm font-bold" style={{ color: NAVY }}>Invite user</h1>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1"><Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" /></div>
        <div className="sm:w-36"><SelectField label="Role" value={role} options={ROLE_OPTIONS} onChange={v => setRole(v as UserRole)} /></div>
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

// Only shown for role='admin' rows -- display_name/title/phone are how this
// person shows up on a customer's "Your Speedpanel Team" card once assigned
// via Admin > Companies, see supabase/schema.sql's admin_set_staff_profile.
const StaffProfileForm = ({ item, onSave }: { item: AdminUserRow; onSave: (input: { displayName: string; title: string; phone: string }) => Promise<string | null> }) => {
  const [displayName, setDisplayName] = useState(item.display_name ?? "");
  const [title, setTitle] = useState(item.title ?? "");
  const [phone, setPhone] = useState(item.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const err = await onSave({ displayName: displayName.trim(), title: title.trim(), phone: phone.trim() });
    setSaving(false);
    if (err) setError(err);
  };

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      <Field label="Display name" value={displayName} onChange={setDisplayName} />
      <Field label="Title" value={title} onChange={setTitle} />
      <div className="flex items-end gap-2">
        <div className="flex-1"><Field label="Phone" value={phone} onChange={setPhone} /></div>
        <button onClick={handleSave} disabled={saving}
          className="h-[46px] shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-sm font-bold disabled:opacity-50" style={{ color: BLUE }}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-3">{error}</p>}
    </div>
  );
};

const UserRow = ({ item, isSelf, onToggleRole, onSaveStaffProfile }: {
  item: AdminUserRow; isSelf: boolean; onToggleRole: (item: AdminUserRow) => void;
  onSaveStaffProfile: (item: AdminUserRow, input: { displayName: string; title: string; phone: string }) => Promise<string | null>;
}) => {
  const isAdmin = item.role === "admin";
  return (
    <div className={`${cx.card} mt-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold" style={{ color: NAVY }}>
            {item.display_name || item.email || "(no email)"}{isSelf && <span className={cx.footnote}> (you)</span>}
          </div>
          <p className={cx.footnote}>Joined {new Date(item.created_at).toLocaleDateString()}</p>
        </div>
        <span className={`${cx.badge} ${isAdmin ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
          {item.role}
        </span>
      </div>
      <button onClick={() => onToggleRole(item)} className="mt-3 text-sm font-bold" style={{ color: BLUE }}>
        {isAdmin ? "Remove admin" : "Make admin"}
      </button>
      {isAdmin && <StaffProfileForm item={item} onSave={input => onSaveStaffProfile(item, input)} />}
    </div>
  );
};

export const AdminUsersPage = ({ auth }: { auth: UseAuth }) => {
  const { users, loading, loadingMore, hasMore, error, reload, loadMore, setRole, setStaffProfile, inviteUser } = useAdminUsers();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(u => (roleFilter === "all" || u.role === roleFilter) && (!q || (u.email ?? "").toLowerCase().includes(q)));
  }, [users, query, roleFilter]);

  const handleToggle = async (item: AdminUserRow) => {
    const nextRole = item.role === "admin" ? "user" : "admin";
    if (item.role === "admin" && !window.confirm(`Remove admin access from ${item.email ?? "this user"}?`)) return;
    const err = await setRole(item.id, nextRole);
    if (err) window.alert(err);
  };

  const handleInvite = async (email: string, role: UserRole) => {
    const { error: err } = await inviteUser(email, role);
    return err;
  };

  const handleSaveStaffProfile = (item: AdminUserRow, input: { displayName: string; title: string; phone: string }) =>
    setStaffProfile(item.id, input);

  return (
    <div className="mt-2">
      <InviteUserForm onInvite={handleInvite} />

      {loading && <div className={`${cx.card} mt-3 text-sm`} style={{ color: MUTED }}>Loading...</div>}

      {!loading && error && (
        <div className={`${cx.card} mt-3`}>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className={`${cx.card} mt-3 text-center`}>
          <p className={cx.footnote}>No signed-up users yet.</p>
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
            <div className="sm:w-40">
              <SelectField label="Filter by role" value={roleFilter} options={ROLE_FILTER_OPTIONS} onChange={setRoleFilter} />
            </div>
          </div>
          {hasMore && query.trim() && (
            <p className="mt-2 text-xs" style={{ color: MUTED }}>Search only covers users loaded so far -- load more below if you can't find who you're after.</p>
          )}

          {filtered.length === 0 ? (
            <div className={`${cx.card} mt-3 text-center`}>
              <p className={cx.footnote}>No users match your search.</p>
            </div>
          ) : (
            filtered.map(item => (
              <UserRow key={item.id} item={item} isSelf={item.id === auth.user?.id} onToggleRole={handleToggle} onSaveStaffProfile={handleSaveStaffProfile} />
            ))
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
