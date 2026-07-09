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
// =============================================================================
import { cx, NAVY, MUTED, BLUE } from "../../styleTokens";
import type { UseAuth } from "../../lib/useAuth";
import { useAdminUsers } from "./users/usersStore";
import type { AdminUserRow } from "./users/userTypes";

const UserRow = ({ item, isSelf, onToggleRole }: {
  item: AdminUserRow; isSelf: boolean; onToggleRole: (item: AdminUserRow) => void;
}) => {
  const isAdmin = item.role === "admin";
  return (
    <div className={`${cx.card} mt-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold" style={{ color: NAVY }}>
            {item.email ?? "(no email)"}{isSelf && <span className={cx.footnote}> (you)</span>}
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
    </div>
  );
};

export const AdminUsersPage = ({ auth }: { auth: UseAuth }) => {
  const { users, loading, error, reload, setRole } = useAdminUsers();

  const handleToggle = async (item: AdminUserRow) => {
    const nextRole = item.role === "admin" ? "user" : "admin";
    if (item.role === "admin" && !window.confirm(`Remove admin access from ${item.email ?? "this user"}?`)) return;
    const err = await setRole(item.id, nextRole);
    if (err) window.alert(err);
  };

  if (loading) {
    return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;
  }

  if (error) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className={`${cx.card} mt-6 text-center`}>
        <p className={cx.footnote}>No signed-up users yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {users.map(item => (
        <UserRow key={item.id} item={item} isSelf={item.id === auth.user?.id} onToggleRole={handleToggle} />
      ))}
    </div>
  );
};
