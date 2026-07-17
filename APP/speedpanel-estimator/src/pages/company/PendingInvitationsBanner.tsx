// =============================================================================
// Pending invitations banner
// =============================================================================
// Shown app-wide (mounted once in App.tsx, not tied to any one tab) whenever
// the signed-in user has a pending invitation into a SECOND company -- the
// only case this app can't handle by email alone (a brand-new person's
// invite is auto-accepted the moment they sign up, see handle_new_user() in
// supabase/schema.sql). Renders nothing when there's nothing pending, so
// it's safe to mount unconditionally.
// =============================================================================
import { useState } from "react";
import { Mail } from "lucide-react";
import { cx, NAVY, BLUE } from "../../styleTokens";
import { Button } from "../../ui/button";
import { useMyPendingInvitations } from "./companyStore";
import { COMPANY_ROLE_LABELS } from "./companyTypes";

export const PendingInvitationsBanner = ({ userEmail, onAccepted }: { userEmail: string | null | undefined; onAccepted: () => void }) => {
  const { invitations, accept, decline } = useMyPendingInvitations(userEmail);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  const handle = async (id: string, action: (id: string) => Promise<string | null>, thenAccepted: boolean) => {
    setBusyId(id);
    setError(null);
    const err = await action(id);
    setBusyId(null);
    if (err) { setError(err); return; }
    if (thenAccepted) onAccepted();
  };

  return (
    <div className="mt-4 space-y-2">
      {invitations.map(inv => (
        <div key={inv.id} className={`${cx.card} flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex items-center gap-2">
            <Mail size={16} style={{ color: BLUE }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: NAVY }}>You've been invited to join a company workspace</p>
              <p className={cx.footnote} style={{ paddingTop: 0 }}>Role: {COMPANY_ROLE_LABELS[inv.role]}{inv.message ? ` -- "${inv.message}"` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => handle(inv.id, accept, true)} disabled={busyId === inv.id}>Accept</Button>
            <Button variant="secondary" onClick={() => handle(inv.id, decline, false)} disabled={busyId === inv.id}>Decline</Button>
          </div>
        </div>
      ))}
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
};
