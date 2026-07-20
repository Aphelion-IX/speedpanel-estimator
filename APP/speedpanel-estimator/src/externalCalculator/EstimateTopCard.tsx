// =============================================================================
// Estimate top card (External Calculator)
// =============================================================================
// Mirrors internalCalculator/EstimateTopCard.tsx's mockup-ported markup (see
// its header comment) -- `.project-bar`/`.project-identity`/`.project-
// actions` and `.order-jump-banner`, ui/estimatorTheme.css. No kit/
// connection concept here -- External has no Corner/Shaft wall-system.
// Deliberately its own copy, not shared with internalCalculator's mirror --
// same fork-not-share convention as phoneShell.tsx (see its header comment).
// =============================================================================
import { useRef, useState } from "react";
import {
  ChevronRight, Pencil, Copy, Save, FileText, RefreshCw, Boxes, AlertTriangle,
  Layers, Clock,
} from "lucide-react";
import type { WallResult } from "../estimate/wall.types";
import type { buildExtProjAgg } from "../estimate/aggregate";

type ProjAgg = ReturnType<typeof buildExtProjAgg>;

export interface OpenProjectInfo { id: string; name: string; updatedAt: string; }

export interface EstimateTopCardProps {
  results: WallResult[];
  projAgg: ProjAgg;
  openProject: OpenProjectInfo | null;
  draftLabel: string | null;
  onSetDraftLabel: (label: string | null) => void;
  lastEditedAt?: number;
  onSaveDraftAsProject: (name: string) => Promise<string | null>;
  onSaveOpenProject: () => Promise<void>;
  // Spec §11 "Project deleted while open" recovery action -- offered instead
  // of Retry once saveProjectNotFound is set (Retry against a project that's
  // gone/unreachable can never succeed).
  onSaveOpenProjectAsNew: () => Promise<void>;
  savingProject: boolean;
  saveProjectError: string | null;
  saveProjectNotFound: boolean;
  // Spec §11 "Offline" -- disables the network-dependent Save actions;
  // wall editing itself stays live regardless (see ExternalCalculator.tsx's
  // saveBlocked comment).
  offline?: boolean;
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

// Order-jump banner's live KPI pills: panels ordered, and total track/
// flashing LENGTHS (every *Pieces field on the External aggregate -- see
// aggregateExternal.ts) and fixing/sealant BOXES (every *Boxes field).
// Summed here as a display rollup, not a new aggregate field.
function orderTotals(projAgg: ProjAgg) {
  const lengths = projAgg.cPieces + projAgg.jPieces + projAgg.zPieces + projAgg.flashPieces;
  const boxes = projAgg.boxes30 + projAgg.boxes16 + projAgg.sealantBoxes;
  return { panels: projAgg.panels, lengths, boxes };
}

export const EstimateTopCard = ({
  results, projAgg,
  openProject, draftLabel, onSetDraftLabel, lastEditedAt,
  onSaveDraftAsProject, onSaveOpenProject, onSaveOpenProjectAsNew,
  savingProject, saveProjectError, saveProjectNotFound, offline = false, projectDirty,
  onGoToProjects, onViewDetails, onViewOrder,
}: EstimateTopCardProps) => {
  const nameFieldRef = useRef<HTMLInputElement>(null);
  const totalItems = results.length;
  const warningsCount = results.filter(r => r.out.warnings.length > 0).length;
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
  const saveStatusLabel = savingProject ? "Saving..."
    : saveFailed && saveProjectNotFound ? "Project unavailable"
    : saveFailed ? "Save failed"
    : offline ? "Offline"
    : projectDirty ? "Unsaved changes" : "All changes saved";
  const saveStatusPillClass = saveFailed ? "pill red" : offline ? "pill" : projectDirty ? "pill" : "pill cyan";

  const totals = orderTotals(projAgg);

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
              {warningsCount > 0 && <span className="pill red">{warningsCount} warning{warningsCount === 1 ? "" : "s"}</span>}
              <span className="flex items-center gap-1"><Clock size={11} />Edited {formatLastEdited(openProject ? openProject.updatedAt : lastEditedAt)}</span>
            </div>
          </div>
        </div>
        <div className="project-actions">
          {isSaved ? (
            <>
              {saveFailed && saveProjectNotFound ? (
                <button className="btn small" onClick={onSaveOpenProjectAsNew} disabled={savingProject || offline}>
                  <Save size={13} />Save as new project
                </button>
              ) : saveFailed ? (
                <button className="btn small" onClick={onSaveOpenProject} disabled={savingProject || offline}>
                  <RefreshCw size={13} />Retry
                </button>
              ) : null}
              <button className="btn icon-only" title="Rename" aria-label="Rename" onClick={() => { setLabelInput(openProject.name); setEditingLabel(true); }}>
                <Pencil size={15} />
              </button>
              <button className="btn primary" onClick={onSaveOpenProject} disabled={savingProject || offline || saveProjectNotFound}
                title={offline ? "You're offline -- reconnect to save" : undefined}>
                <Save size={15} />{savingProject ? "Saving..." : "Save project"}
              </button>
            </>
          ) : namingOpen ? (
            <form onSubmit={handleSaveAsProject} className="flex flex-wrap items-center gap-2">
              <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Project name" required autoFocus className="input" style={{ width: 180 }} />
              {draftSaveError && <span style={{ color: "var(--red)" }} className="text-xs">{draftSaveError}</span>}
              <button type="submit" className="btn primary small" disabled={savingDraft || !nameInput.trim() || offline}>{savingDraft ? "Saving..." : "Save"}</button>
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

      {totalItems > 1 || projAgg.panels > 0 ? (
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
