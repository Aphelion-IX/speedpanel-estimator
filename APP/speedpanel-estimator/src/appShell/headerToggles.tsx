// =============================================================================
// Header toggles
// =============================================================================
// Icon buttons showing whichever layout/theme is currently in effect; click
// forces the other one. Placed in the header next to the reset button.
// =============================================================================
import { Smartphone, Monitor, Sun, Moon, Bell } from "lucide-react";
import { IconButton } from "../ui/primitives";
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

// Decorative only -- no notifications backend exists yet, so there's no
// real unread count to badge and nothing to open on click.
export const NotificationBell = () => (
  <IconButton title="Notifications">
    <Bell size={16} />
  </IconButton>
);
