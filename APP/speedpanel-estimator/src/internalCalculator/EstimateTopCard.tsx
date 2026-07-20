// =============================================================================
// Estimate top card (Internal Calculator)
// =============================================================================
// Rendered once the estimator is out of the "No Project" state (see
// firstWallSetup.tsx, which now owns that empty state -- this file used to
// have its own early-return branch for it, but that grew into a full
// First-Wall Setup chooser, so it moved to its own file). Two regions:
//   - A status hero (progress/warnings, editable draft label, Save controls)
//     matching the v5 mockup's "project bar" -- recolors green (unsaved
//     local draft) -> cyan (openProject set, i.e. an already-saved project
//     is open), reusing the app's existing tone("ok")/tone("info") tokens
//     rather than inventing new colours.
//   - An "order jump" banner (live panel/track/box/kit totals + a
//     scroll-to-order-review action), matching the mockup's own banner
//     between the project bar and the wall workspace.
// The two-column row's md:grid-cols split is a deliberate, scoped exception
// to the app's usual layoutMode-branching convention -- plain Tailwind
// responsive classes here let one component serve both phone and web without
// layoutMode ever being threaded into this file.
// Deliberately its own copy, not shared with externalCalculator's mirror --
// same fork-not-share convention as phoneShell.tsx (see its header comment).
// =============================================================================
import { useState } from "react";
import {
  Info, ChevronRight, Pencil, Save, CheckCircle2, FileText, RefreshCw, Boxes,
} from "lucide-react";
import { cx, tone, BLUE, NAVY } from "../styleTokens";
import { Button } from "../ui/button";
import { IconButton } from "../ui/primitives";
import type { WallResult } from "../estimate/wall.types";
import type { KitEntry } from "../estimate/synthesizeKits";
import type { aggregate } from "../estimate/aggregate";
import { isConfigured, deriveWallStatus } from "./phoneShell";

type ProjAgg = ReturnType<typeof aggregate>;

export interface OpenProjectInfo { id: string; name: string; updatedAt: string; }

export interface EstimateTopCardProps {
  results: WallResult[];
  kits: KitEntry[];
  projAgg: ProjAgg;
  openProject: OpenProjectInfo | null;
  draftLabel: string | null;
  onSetDraftLabel: (label: string | null) => void;
  lastEditedAt?: number;
  onSaveDraftAsProject: (name: string) => Promise<string | null>;
  onSaveOpenProject: () => Promise<void>;
  savingProject: boolean;
  saveProjectError: string | null;
  // Whether the open saved project has edits since it was opened/last saved
  // -- see App.tsx's projectDirty. Only meaningful once openProject is set.
  projectDirty: boolean;
  onGoToProjects: () => void;
  onViewDetails: () => void;
  // Order-jump banner's "View complete order" action -- scrolls to the
  // Order tab/Final Order Review rather than navigating anywhere new.
  onViewOrder: () => void;
}

function formatLastEdited(value?: number | string | null): string {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

// Order-jump banner's live KPI pills: panels ordered, total track/flashing/
// kit-material LENGTHS (every *Pieces field across the project aggregate --
// each one is a stock length to order, whether it's C-track, flashing, a
// shaft's vertical track, a corner post, or a junction), and total fixing/
// sealant BOXES (every *Boxes field). Summed here rather than adding a new
// aggregate field, since these are purely a display rollup of numbers
// aggregate() already computes.
function orderTotals(projAgg: ProjAgg, kitCount: number) {
  const lengths = projAgg.cTracks.reduce((a, c) => a + c.pieces, 0)
    + projAgg.jPieces + projAgg.flashPieces + projAgg.vertTrackPieces
    + projAgg.stripPieces + projAgg.junctionPieces + projAgg.cornerPostPieces;
  const boxes = projAgg.boxes30 + projAgg.boxes16 + projAgg.sealantBoxes
    + projAgg.slabPassSealantBoxes + projAgg.junctionScrewBoxes + projAgg.cornerScrewBoxes;
  return { panels: projAgg.totalPanels, lengths, boxes, kits: kitCount };
}

export const EstimateTopCard = ({
  results, kits, projAgg,
  openProject, draftLabel, onSetDraftLabel, lastEditedAt,
  onSaveDraftAsProject, onSaveOpenProject, savingProject, saveProjectError, projectDirty,
  onGoToProjects, onViewDetails, onViewOrder,
}: EstimateTopCardProps) => {
  const totalItems = results.length + kits.length;
  const allWalls = results.map(r => r.wall);
  const configuredCount = results.filter(r => isConfigured(deriveWallStatus(r.wall, allWalls, r.out))).length + kits.length;
  const warningsCount = results.filter(r => r.out.warnings.length > 0).length + kits.filter(k => k.result.warnings.length > 0).length;
  const pct = totalItems ? Math.round((configuredCount / totalItems) * 100) : 0;
  const isSaved = openProject !== null;

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const commitLabel = () => { onSetDraftLabel(labelInput.trim() || null); setEditingLabel(false); };

  const [namingOpen, setNamingOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const handleSaveAsProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSavingDraft(true);
    setDraftSaveError(null);
    const err = await onSaveDraftAsProject(nameInput.trim());
    setSavingDraft(false);
    if (err) setDraftSaveError(err);
    else setNamingOpen(false);
  };

  const noteCx = isSaved ? cx.infoNoteInfo : cx.infoNoteOk;
  const heroFill = isSaved
    ? "bg-gradient-to-br from-cyan-400 to-cyan-600 dark:from-cyan-500 dark:to-cyan-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_14px_24px_-12px_rgba(8,145,178,0.5)]"
    : "bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-500 dark:to-emerald-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_14px_24px_-12px_rgba(16,185,129,0.5)]";
  // "Project" is only accurate once it's actually a saved Supabase row (in
  // the Projects tab) -- an unsaved local draft is still a "draft" until the
  // Save to Projects button below turns it into one. Calling it "project"
  // in both states made that button read as contradictory ("save to
  // projects" on something already labeled a project).
  const projectWord = isSaved ? "project" : "draft";
  // Save-status indicator for an already-saved project -- autosave is off
  // once a project is open (see wallStore.ts's persistLocally), so this
  // tells the user whether the explicit Save button next to it actually has
  // anything to do right now. Spec §10.5 "Save Failed": a failed save gets
  // its own red badge + Retry, distinct from the normal saving/dirty/clean
  // cycle, rather than the error just riding along as inline text next to an
  // unchanged "Unsaved changes" badge.
  const saveFailed = isSaved && !!saveProjectError;
  const saveStatusLabel = savingProject ? "Saving..." : projectDirty ? "Unsaved changes" : "All changes saved";
  const saveStatusTone = savingProject ? "info" : projectDirty ? "warn" : "ok";

  const totals = orderTotals(projAgg, kits.length);

  return (
    <div className="mt-3">
      <div className={cx.section}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white ${heroFill}`}>
              <FileText size={18} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold" style={{ color: NAVY }}>
                {openProject ? openProject.name : `Current ${projectWord}`}
              </div>
              {!openProject && (
                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-300">
                  {editingLabel ? (
                    <input autoFocus value={labelInput} onChange={e => setLabelInput(e.target.value)}
                      onBlur={commitLabel} onKeyDown={e => e.key === "Enter" && commitLabel()}
                      className={cx.input + " w-40 !py-1 !text-sm"} style={{ color: NAVY }} />
                  ) : (
                    <>
                      <span>{draftLabel ?? "Add a name"}</span>
                      <button onClick={() => { setLabelInput(draftLabel ?? ""); setEditingLabel(true); }} aria-label="Edit draft label">
                        <Pencil size={13} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400" />
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 dark:text-slate-400">
                <span className="flex items-center gap-1"><CheckCircle2 size={12} />{pct}% configured</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={12} />{warningsCount} warning{warningsCount === 1 ? "" : "s"}</span>
                <span>{totalItems} wall item{totalItems === 1 ? "" : "s"}</span>
                <span>{projAgg.totalArea} m² total area</span>
                <span>Last edited {formatLastEdited(openProject ? openProject.updatedAt : lastEditedAt)}</span>
              </div>
              <button onClick={onViewDetails} className="mt-2 flex items-center gap-1 text-xs font-bold" style={{ color: BLUE }}>
                View {projectWord} details <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isSaved ? (
              <>
                {saveFailed ? (
                  <>
                    <span className={`${cx.badge} ${tone("danger")}`}>Save failed</span>
                    <button onClick={onSaveOpenProject} disabled={savingProject}
                      className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-300 disabled:opacity-50">
                      <RefreshCw size={12} />Retry
                    </button>
                  </>
                ) : (
                  <span className={`${cx.badge} ${tone(saveStatusTone)}`}>{saveStatusLabel}</span>
                )}
                <IconButton onClick={onSaveOpenProject} disabled={savingProject} title="Save" ariaLabel="Save">
                  <Save size={16} />
                </IconButton>
              </>
            ) : namingOpen ? (
              <form onSubmit={handleSaveAsProject} className="flex flex-wrap items-center gap-2">
                <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Project name" required autoFocus
                  className={cx.input + " w-40 !py-2"} style={{ color: NAVY }} />
                {draftSaveError && <span className="text-xs text-red-600 dark:text-red-300">{draftSaveError}</span>}
                <Button type="submit" disabled={savingDraft || !nameInput.trim()}>{savingDraft ? "Saving..." : "Save"}</Button>
                <Button type="button" variant="ghost" onClick={() => { setNamingOpen(false); setDraftSaveError(null); }}>Cancel</Button>
              </form>
            ) : (
              <IconButton onClick={() => { setNameInput(draftLabel ?? ""); setNamingOpen(true); }} title="Save to Projects" ariaLabel="Save to Projects">
                <Save size={16} />
              </IconButton>
            )}
          </div>
        </div>
      </div>
      <div className={noteCx}>
        <Info size={15} className="mt-0.5 shrink-0" />
        <span>You can view and manage all your projects in the <button onClick={onGoToProjects} className="font-bold underline decoration-2 underline-offset-2">Projects</button> tab.</span>
      </div>

      {configuredCount > 0 && (
        <button onClick={onViewOrder}
          className="mt-3 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-900/40 px-4 py-3.5 text-left transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/55">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white dark:bg-slate-800 shadow-sm" style={{ color: BLUE }}>
              <Boxes size={17} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-extrabold" style={{ color: NAVY }}>Complete project order totals</div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">Panels and accessories are consolidated in one sendable order.</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`${cx.badge} ${tone("neutral")}`}>{totals.panels} panels</span>
            <span className={`${cx.badge} ${tone("info")}`}>{totals.lengths} lengths</span>
            <span className={`${cx.badge} ${tone("info")}`}>{totals.boxes} boxes</span>
            {totals.kits > 0 && <span className={`${cx.badge} ${tone("neutral")}`}>{totals.kits} kit{totals.kits === 1 ? "" : "s"}</span>}
          </div>
        </button>
      )}
    </div>
  );
};
