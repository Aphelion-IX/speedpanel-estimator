// =============================================================================
// Header toggles
// =============================================================================
// Icon buttons showing whichever layout/theme is currently in effect; click
// forces the other one. Placed in the header next to the reset button.
// =============================================================================
import { Smartphone, Monitor, Sun, Moon, Bell } from "lucide-react";
import { IconButton } from "../ui/primitives";
import { goldBubbleFill } from "../styleTokens";
import type { EffectiveLayout } from "../useLayoutMode";
import type { EffectiveTheme } from "../useThemeMode";

export const LayoutModeToggle = ({ effective, onToggle }: { effective: EffectiveLayout; onToggle: () => void }) => (
  <IconButton onClick={onToggle} title={effective === "phone" ? "Layout: Phone (click for Web)" : "Layout: Web (click for Phone)"}>
    {effective === "phone" ? <Smartphone size={16} /> : <Monitor size={16} />}
  </IconButton>
);

export const ThemeToggle = ({ effective, onToggle }: { effective: EffectiveTheme; onToggle: () => void }) => (
  <IconButton onClick={onToggle} title={effective === "dark" ? "Theme: Dark (click for Light)" : "Theme: Light (click for Dark)"}>
    {effective === "dark" ? <Moon size={16} /> : <Sun size={16} />}
  </IconButton>
);

// Opens My Requests; the badge counts this customer's OPEN requests
// (pending reviews, pending/proposed deliveries, new/contacted quote
// requests) -- see myRequestsStore.ts's isOpenRequest(). Not shown at all
// for a count of 0, same "safe to mount unconditionally, renders nothing
// extra when there's nothing to show" posture as WarningsList/
// NextActionsCallout elsewhere in this app.
export const NotificationBell = ({ count, onClick }: { count: number; onClick: () => void }) => (
  <span className="group relative inline-block">
    <IconButton onClick={onClick} title={count > 0 ? `${count} open request${count !== 1 ? "s" : ""}` : "My Requests"}>
      <Bell size={16} />
    </IconButton>
    {count > 0 && (
      <span className="pointer-events-none absolute -top-1 -right-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white transition-transform group-hover:scale-110" style={goldBubbleFill}>
        {count > 9 ? "9+" : count}
      </span>
    )}
  </span>
);
