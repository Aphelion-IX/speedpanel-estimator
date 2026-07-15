// =============================================================================
// Drawer
// =============================================================================
// Slide-over primitive for the future Order Review drawer: a right-side
// panel on "web" layout, a full-screen sheet on "phone" layout -- same
// backdrop/focus/Escape-key conventions as ConfirmDialog (src/ui/confirmDialog.tsx),
// the first modal-shaped primitive in the app, just a different panel
// geometry (slide-over instead of centered card).
// =============================================================================
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { NAVY, cx } from "../styleTokens";
import type { EffectiveLayout } from "../useLayoutMode";

export const Drawer = ({ open, onClose, layoutMode, title, children }: {
  open: boolean;
  onClose: () => void;
  layoutMode: EffectiveLayout;
  title: string;
  children: React.ReactNode;
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={cx.drawerOverlay} onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className={layoutMode === "phone" ? cx.drawerSheet : cx.drawerPanel}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <h2 className="text-base font-bold" style={{ color: NAVY }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-700"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
};
