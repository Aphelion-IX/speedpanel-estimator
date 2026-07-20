// =============================================================================
// useOnlineStatus
// =============================================================================
// Spec §11 "Offline or connection lost" -- a plain navigator.onLine/online/
// offline listener. Local wall edits are unaffected either way (wallStore.ts
// already autosaves to localStorage regardless of connectivity); this only
// drives the OfflineBanner and gates the network-dependent Save actions.
// =============================================================================
import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
