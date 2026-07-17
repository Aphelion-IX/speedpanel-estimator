// =============================================================================
// Button
// =============================================================================
// The one labelled-button component for the single primary, path-forward
// action on a screen (e.g. a form's main "Save & continue"). Everything
// repeated or secondary -- Save/Edit/Delete/Retry and the like -- uses the
// bordered IconButton (src/ui/primitives.tsx) instead, per the design-samples
// spec worked out with the user: a label is the exception, not the default.
// =============================================================================
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const base = "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--blue)]";

const variantCx: Record<Variant, string> = {
  primary:   "px-5 py-2.5 bg-[color:var(--blue)] text-white shadow-sm hover:bg-[#045A9E] hover:-translate-y-px",
  secondary: "px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-[color:var(--navy)] hover:border-[color:var(--blue)] hover:text-[color:var(--blue)] hover:-translate-y-px",
  danger:    "px-5 py-2.5 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 hover:-translate-y-px",
  ghost:     "px-2 py-2 bg-transparent text-[color:var(--blue)] hover:underline",
};

export const Button = ({ variant = "primary", icon, children, className = "", ...rest }: {
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={`${base} ${variantCx[variant]} ${className}`} {...rest}>
    {icon}
    {children}
  </button>
);
