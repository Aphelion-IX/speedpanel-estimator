// =============================================================================
// Estimate top card (Internal Calculator)
// =============================================================================
// Rendered once the estimator is out of the "No Project" state (see
// firstWallSetup.tsx, which now owns that empty state). Two regions, ported
// directly from the v5 mockup's own markup/classes (ui/estimatorTheme.css):
//   - `.project-bar`/`.project-identity`/`.project-actions` -- the project
//     identity card (icon, name, save-status pill, wall/kit counts, last
//     edited, Rename/Duplicate/Save actions).
//   - `.order-jump-banner` -- live panel/track/box/kit totals + a
//     scroll-to-order-review action, matching the mockup's own banner
//     between the project bar and the wall workspace.
// Deliberately its own copy, not shared with externalCalculator's mirror --
// same fork-not-share convention as phoneShell.tsx (see its header comment).
// =============================================================================
import { useRef, useState } from "react";
import {
  ChevronRight, Pencil, Copy, Save, FileText, RefreshCw, Boxes, AlertTriangle,
  Layers, Link2, Clock,
} from "lucide-react";
import type { WallResult } from "../estimate/wall.types";
import type { KitEntry } from "../estimate/synthesizeKits";
import type { aggregate } from "../estimate/aggregate";

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
  const nameFieldRef = useRef<HTMLInputElement>(null);
  const totalItems = results.length + kits.length;
  const warningsCount = results.filter(r => r.out.warnings.length > 0).length + kits.filter(k => k.result.warnings.length > 0).length;
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

  // "Project" is only accurate once it's actually a saved Supabase row (in
  // the Projects tab) -- an unsaved local draft is still a "draft" until the
  // Save to Projects button below turns it into one.
  const projectWord = isSaved ? "project" : "draft";
  const saveFailed = isSaved && !!saveProjectError;
  const saveStatusLabel = savingProject ? "Saving..." : saveFailed ? "Save failed" : projectDirty ? "Unsaved changes" : "All changes saved";
  const saveStatusPillClass = saveFailed ? "pill red" : projectDirty ? "pill" : "pill cyan";

  const kitNoun = kits.length === 1 ? kits[0].kind === "corner" ? "linked corner kit" : "linked shaft junction" : `linked kit${kits.length === 1 ? "" : "s"}`;
  const totals = orderTotals(projAgg, kits.length);

  return (
    <div className="est-shell mt-3">
      <section className="project-bar card">
        <div className="project-identity">
          <span className="project-icon"><FileText size={22} /></span>
          <div className="min-w-0">
            <span className="eyebrow">{isSaved ? "Active estimate" : "Local draft"}</span>
            {isSaved || !editingLabel ? (
              <h1 className="truncate flex items-center gap-1.5">
                {openProject ? openProject.name : (draftLabel ?? "Add a name")}
                {!isSaved && (
                  <button onClick={() => { setLabelInput(draftLabel ?? ""); setEditingLabel(true); }} aria-label="Edit draft label">
                    <Pencil size={13} className="subtle" />
                  </button>
                )}
              </h1>
            ) : (
              <input ref={nameFieldRef} autoFocus value={labelInput} onChange={e => setLabelInput(e.target.value)}
                onBlur={commitLabel} onKeyDown={e => e.key === "Enter" && commitLabel()}
                className="input" style={{ maxWidth: 260, marginTop: 2 }} />
            )}
            <div className="project-meta">
              <span className={saveStatusPillClass}>
                {saveFailed ? <AlertTriangle size={11} /> : <Save size={11} />} {saveStatusLabel}
              </span>
              <span className="flex items-center gap-1"><Layers size={11} />{results.length} wall{results.length === 1 ? "" : "s"}</span>
              {kits.length > 0 && <span className="flex items-center gap-1"><Link2 size={11} />{kits.length} {kitNoun}</span>}
              {warningsCount > 0 && <span className="pill red">{warningsCount} warning{warningsCount === 1 ? "" : "s"}</span>}
              <span className="flex items-center gap-1"><Clock size={11} />Edited {formatLastEdited(openProject ? openProject.updatedAt : lastEditedAt)}</span>
            </div>
          </div>
        </div>
        <div className="project-actions">
          {isSaved ? (
            <>
              {saveFailed && (
                <button className="btn small" onClick={onSaveOpenProject} disabled={savingProject}>
                  <RefreshCw size={13} />Retry
                </button>
              )}
              <button className="btn icon-only" title="Rename" aria-label="Rename" onClick={() => { setLabelInput(openProject.name); setEditingLabel(true); }}>
                <Pencil size={15} />
              </button>
              <button className="btn primary" onClick={onSaveOpenProject} disabled={savingProject}>
                <Save size={15} />{savingProject ? "Saving..." : "Save project"}
              </button>
            </>
          ) : namingOpen ? (
            <form onSubmit={handleSaveAsProject} className="flex flex-wrap items-center gap-2">
              <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Project name" required autoFocus className="input" style={{ width: 180 }} />
              {draftSaveError && <span style={{ color: "var(--red)" }} className="text-xs">{draftSaveError}</span>}
              <button type="submit" className="btn primary small" disabled={savingDraft || !nameInput.trim()}>{savingDraft ? "Saving..." : "Save"}</button>
              <button type="button" className="btn small" onClick={() => { setNamingOpen(false); setDraftSaveError(null); }}>Cancel</button>
            </form>
          ) : (
            <>
              <button className="btn icon-only" title="Duplicate" aria-label="Duplicate" onClick={onGoToProjects}>
                <Copy size={15} />
              </button>
              <button className="btn primary" onClick={() => { setNameInput(draftLabel ?? ""); setNamingOpen(true); }}>
                <Save size={15} />Save project
              </button>
            </>
          )}
        </div>
      </section>

      <p className="note" style={{ marginBottom: 14 }}>
        You can view and manage all your projects in the <button onClick={onGoToProjects} className="font-bold underline decoration-2 underline-offset-2" style={{ color: "var(--blue)" }}>Projects</button> tab.
      </p>

      {totalItems > 1 || projAgg.totalPanels > 0 ? (
        <section className="order-jump-banner">
          <div className="order-jump-left">
            <span className="order-jump-icon"><Boxes size={18} /></span>
            <div className="order-jump-copy">
              <strong>Complete project order totals</strong>
              <span>Panels and all accessories are consolidated below in one sendable order sheet.</span>
            </div>
          </div>
          <div className="order-jump-stats">
            <span className="pill blue">{totals.panels} panels</span>
            <span className="pill cyan">{totals.lengths} lengths</span>
            <span className="pill cyan">{totals.boxes} boxes</span>
            {totals.kits > 0 && <span className="pill blue">{totals.kits} kit{totals.kits === 1 ? "" : "s"}</span>}
          </div>
          <button className="btn primary" onClick={onViewOrder}>
            View complete order <ChevronRight size={14} />
          </button>
        </section>
      ) : (
        <button onClick={onViewDetails} className="btn ghost small" style={{ marginBottom: 14 }}>
          View {projectWord} details <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
};
