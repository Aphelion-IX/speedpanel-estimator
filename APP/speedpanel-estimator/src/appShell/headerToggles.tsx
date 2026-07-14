// =============================================================================
// Header toggles
// =============================================================================
// Icon buttons showing whichever layout/theme is currently in effect; click
// forces the other one. Placed in the header next to the reset button.
// =============================================================================
import { Smartphone, Monitor, Sun, Moon, Bell } from "lucide-react";
import type { EffectiveLayout } from "../useLayoutMode";
import type { EffectiveTheme } from "../useThemeMode";

export const LayoutModeToggle = ({ effective, onToggle }: { effective: EffectiveLayout; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    title={effective === "phone" ? "Layout: Phone (click for Web)" : "Layout: Web (click for Phone)"}
    className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all"
  >
    {effective === "phone" ? <Smartphone size={16} /> : <Monitor size={16} />}
  </button>
);

export const ThemeToggle = ({ effective, onToggle }: { effective: EffectiveTheme; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    title={effective === "dark" ? "Theme: Dark (click for Light)" : "Theme: Light (click for Dark)"}
    className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all"
  >
    {effective === "dark" ? <Moon size={16} /> : <Sun size={16} />}
  </button>
);

// Decorative only -- no notifications backend exists yet, so there's no
// real unread count to badge and nothing to open on click.
export const NotificationBell = () => (
  <button
    title="Notifications"
    className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all"
  >
    <Bell size={16} />
  </button>
);
