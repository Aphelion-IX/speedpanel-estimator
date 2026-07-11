// =============================================================================
// Top navigation
// =============================================================================
// Logo + the app's top-level feature tabs, wired up to the hash router so
// their URLs are deep-linkable on GitHub Pages -- see App.tsx. `right`
// renders the theme/layout/reset controls passed down from the root
// component, plus a hamburger menu that only appears below the sm
// breakpoint. No notification bell / profile dropdown -- sign-in state is
// surfaced inside the Projects tab itself (see pages/projects/SignInGate.tsx),
// not up here.
// =============================================================================
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BLUE, WHITE, NAVY } from "../styleTokens";

// "company" is intentionally not in TOP_NAV_ITEMS below -- Company Team/
// Activity/Create pages are reached via a header control near AuthStatus.tsx
// and entry-point callouts on ProjectsListPage.tsx, not a top-nav tab. It's
// still part of this union purely so route.tab (which includes it) type-checks
// as an activeTab value -- it just never matches any TOP_NAV_ITEMS key, so no
// button ever highlights for it.
export type TopNavTab = "estimator" | "selector" | "education" | "projects" | "admin" | "company";

const TOP_NAV_ITEMS: { key: TopNavTab; label: string }[] = [
  { key: "projects",  label: "Projects" },
  { key: "selector",  label: "System Selector" },
  { key: "estimator", label: "System Estimator" },
  { key: "education", label: "Education Hub" },
  { key: "admin",     label: "Admin" },
];

// Inactive labels use NAVY (the app's primary text colour, same token used
// for headings elsewhere) rather than a pale slate shade -- darker/more
// legible than the previous text-slate-400. Uppercase + tracking-wide
// matches the cx.lbl/cardHd convention already used for section headings.
const TopNavTabButton = ({ label, active, onClick, className = "" }: { label: string; active: boolean; onClick: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={`rounded-xl px-3.5 py-2 text-sm font-bold uppercase tracking-wide whitespace-nowrap transition-all ${active ? "" : "hover:bg-slate-100 dark:hover:bg-slate-800"} ${className}`}
    style={active ? { background: BLUE, color: WHITE } : { color: NAVY }}
  >
    {label}
  </button>
);

export const TopNav = ({ activeTab, onTabChange, right }: { activeTab: TopNavTab; onTabChange: (t: TopNavTab) => void; right: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <img
            src="data:image/webp;base64,UklGRrQFAABXRUJQVlA4TKcFAAAvj8ETEMdAkG1Tifsnt7jfIQSWyej/k4Mg26ZYI77UZQwEQNGUWsJ0nnggC2T08OPg718UBr0GEIGEYEu23bCRpEeBoiiKFLrd7vZg/0sVAYJKK+ezIvo/AfLH/3/8///v3/Z/OrzG8TJ0HnmNMcY1lzZUa60l55z3Ws+xVp1b76zeplprLflaa53Raq1HvtbanLhaeaxV/bRx7TflrN49rup5r7/ML7kywTHbuBDMIR3aRhgNcT9tEc6xl+GtRMJwiLk5lIjhmJvDAes+FqEvtop+VDK8exVq/jEvuTIBIdpp5AgYz0qEazq/BpyXzCMZrrEOJRPNwP5gL7kyAaGJvdo4wfOYg1C+GxDyHYBtJJhwzgj8WC+5MgGhyYwIV54ElC8HULsDkq3Cvs/A9lQvuTIBocmMDa5RpuH4dgjHHZBN28A6BeczveTKBIQmMyp89xsE/nbAcQc0yzIAnrI+0kuuTEBoMmW1xJxzjsuljS251npkMmD/KmHLueacFltoDvmotebVshoaRssU1Ad6yZUJCE2mMPR4Sv/clyBjUfpH0JYh8TVk8dWiqC1ZQA7Sb6Th1HYlKWkO3aCK6096yZUJwJpzzuxXNRLzOUGahvMriTQyoLgJL1rRqEeHEuagPM1LrkzQid2yttusDpK040sJk2Hxk6JtCqOfWMExJ/CzvOTKBCvx9zi0/K2Eg4bDj7WoFKUIKZsT9ZAf5SVXrkYmgHgW3ad+PzkMyU/GVuWUTVmcioLzQV5yZYIxMQHEPkXDyr8HWbRwI/QXkUNB86lBSQ/SZYI5MQHELqcBofA9snZ8sV3D6XZoW+9Qkohom1NWUJ+FCQhZDUBiAog9hAxA2M4b8KK1kWpvY6naeVYzVLdV23tJKSKyKuTEQYmT9mr/eUxAaKK2ACQmgNijmgBQmZagBhkZjGOjdZYYsleB3npBYRHZFZw+khUcc0Z/HBMQmhhbABITQNxLFkkDQMhTzhV6+mo0iTP0RboNfRIRObXdiYOyPAcTEJqYWwASE0B8SQAOjWkEWKrHkms9coS1fbXolo9a8xpgLL1N2S5CSnSSrKA8BRMQmgy2ACQmoIpIAlDEyGkIyA6OSR5pfJE+KbWzKWAnDsryFASEJsMtAFvuJABF7HsYwjaP+FcQWu9EP0i3asVJsoLyEEBo4tgCYicBKDLKOYzgmEVNvlu4SajS35W1J0FZvTgoi7SHyOIaewlAEUfel4HAc1YWh2jfxpZob9Og1ynURI1KzP1FgZdkBVX8KNq/GQEo4txSsGCfsRxiNYivIYuvWzW0CUsWneF/ePGixAlVXL8SgCL+nC3RjbYm9u+0GcRrSYdYy4TkJUVB+w0Uub7/dRFpQcMI7TnnXKuMf6dFW4dKzjkflWVwnRDchJREz1fk+v54SXWL4v6VCvR9SJzDBDS3quD5ilzfHz8JvwBeDHyPAzM3N4mK+lxFru/PjOUXsEJPco80ZfE7fwGEmItc3x8T88CJx+MVxvMmiybGpqG5SXq8BETpvj+2PWzNwqTFp6oLjJvco0FdLRK03Y/DwyUApfP+DKwAlu1ol3NfoO/3y6N1JObB4tR2gpX4JlnbTUkjP8mTUh4sI0scLD8gAShyfX9GApwD3284jwzHEcQrBkOTm5DWTIeG04+XOcNxZDjfLwEocn1/Rhq8szyMZ2hykxPqImY2FD8pD5YAFLm+P0O7V5THoyZ32bVkk1VbJwg9VgJQ5Pr+jK1OkR9vY7nNqh0DuwaeUJ/Ds8j1/XEIPpsYHyqdMjiFofPAaSgTJD5Xkev741FXh3TKs9F+yvCUopGMkpZmtIeIjkWu//vP/u6JcElkCOt+in2L/c1vi96lU6L31lvjYotrPlg8S1Q99qiWoT2qa2eL/WaTHNVNKdF767ToXSb9zLN2WR661VpP+eP/P3kGAA=="
            alt="Speedpanel"
            className="h-10 w-auto object-contain shrink-0"
          />
          <div className="hidden md:flex items-center gap-1 overflow-x-auto">
            {TOP_NAV_ITEMS.map(item => (
              <TopNavTabButton key={item.key} label={item.label} active={activeTab === item.key} onClick={() => onTabChange(item.key)} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all md:hidden"
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="mt-3 flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-sm md:hidden">
          {TOP_NAV_ITEMS.map(item => (
            <TopNavTabButton
              key={item.key} label={item.label} active={activeTab === item.key}
              className="w-full text-left"
              onClick={() => { onTabChange(item.key); setMobileOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
