// =============================================================================
// Offline banner
// =============================================================================
// Spec §11 "Offline or connection lost" -- genuinely calculator-agnostic (see
// readOnlyGate.tsx's own note on that split), so it lives in src/ui/ and is
// rendered once from App.tsx, above the tab content, rather than duplicated
// per fork. Local edits are safe either way (see useOnlineStatus.ts); this
// only explains why Save/quote/order actions are disabled while it's shown.
// =============================================================================
import { WifiOff } from "lucide-react";
import { cx } from "../styleTokens";

export const OfflineBanner = () => (
  <div className={cx.warnbox}>
    <WifiOff size={15} className="mt-0.5 shrink-0" />
    <span>You're offline. Wall edits stay saved on this device -- saving to Projects, exports and quote requests will resume once you're back online.</span>
  </div>
);
