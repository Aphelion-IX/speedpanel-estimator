// =============================================================================
// ConfirmDialog
// =============================================================================
// Replaces window.confirm/alert (13 call sites across the admin/projects/
// company areas) with an on-brand, accessible modal. No Modal/Dialog
// primitive existed anywhere in the app before this -- built minimal and
// dependency-free (no Radix/Headless UI installed): Escape and backdrop
// click both cancel, focus moves to the panel on open.
// =============================================================================
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { NAVY } from "../styleTokens";

export const ConfirmDialog = ({
  open, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, hideCancel = false, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  // For a pure notification (e.g. surfacing a save/delete error) rather than
  // a yes/no decision -- window.alert()'s replacement, as opposed to
  // window.confirm()'s. Renders a single button (confirmLabel/onConfirm).
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-6 shadow-[0_30px_60px_-24px_rgba(15,23,42,0.4)] outline-none dark:shadow-[0_30px_60px_-24px_rgba(0,0,0,0.6)]"
      >
        {danger && (
          <span className="mb-3.5 grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-900/50 dark:text-red-300">
            <AlertTriangle size={18} />
          </span>
        )}
        <h2 className="text-base font-bold" style={{ color: NAVY }}>{title}</h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-300">{description}</p>
        <div className="mt-5 flex justify-end gap-2.5">
          {!hideCancel && (
            <button
              onClick={onCancel}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-[color:var(--navy)] hover:border-[color:var(--blue)] hover:text-[color:var(--blue)] dark:border-slate-600"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={
              danger
                ? "rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                : "rounded-xl bg-[color:var(--blue)] px-4 py-2 text-sm font-bold text-white hover:bg-[#045A9E]"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Convenience wrapper for the common "surface an async save/delete error"
// case -- window.alert()'s replacement (a single-button notice), as opposed
// to ConfirmDialog itself covering window.confirm()'s yes/no case. Callers
// just need a `string | null` error state and a way to clear it:
//   <ErrorDialog message={error} onDismiss={() => setError(null)} />
export const ErrorDialog = ({ message, onDismiss }: { message: string | null; onDismiss: () => void }) => (
  <ConfirmDialog
    open={message !== null}
    danger
    hideCancel
    title="Something went wrong"
    description={message ?? ""}
    confirmLabel="OK"
    onConfirm={onDismiss}
    onCancel={onDismiss}
  />
);
