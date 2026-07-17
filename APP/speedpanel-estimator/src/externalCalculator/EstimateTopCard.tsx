// =============================================================================
// Estimate top card (External Calculator)
// =============================================================================
// Replaces the old ProjectCardPhone -- now rendered on BOTH phone and web
// layout (previously phone-only, see ExternalCalculator.tsx), and absorbs the
// standalone "Save as Project"/"Editing project" banners App.tsx used to
// render above it (see the now-unused SaveDraftBanner.tsx). Two states:
//   - No estimate yet (exactly one wall, still fully blank/unconfigured): a
//     "Start a new estimate" hero + wall-type picker tiles.
//   - Working on an estimate: a status hero (progress/warnings, editable
//     draft label, Save controls) + a responsive two-column row (wall-type
//     tiles + an "Estimate summary" panel). Recolors green (unsaved local
//     draft) -> cyan (openProject set, i.e. an already-saved project is
//     open), reusing the app's existing tone("ok")/tone("info") tokens
//     rather than inventing new colours.
// The two-column row's md:grid-cols split is a deliberate, scoped exception
// to the app's usual layoutMode-branching convention -- plain Tailwind
// responsive classes here let one component serve both phone and web without
// layoutMode ever being threaded into this file.
// Deliberately its own copy, not shared with internalCalculator's mirror --
// same fork-not-share convention as phoneShell.tsx (see its header comment).
// =============================================================================
import { useState } from "react";
import {
  House, CloudRain, FilePlus2, Info, Plus, ChevronRight, Pencil, Save, CheckCircle2, FileText,
} from "lucide-react";
import { cx, tone, BLUE, NAVY, WHITE } from "../styleTokens";
import { Button } from "../ui/button";
import { IconButton } from "../ui/primitives";
import type { WallResult } from "../estimate/wall.types";
import type { buildExtProjAgg } from "../estimate/aggregate";
import { isConfigured, deriveWallStatus } from "./phoneShell";

type ProjAgg = ReturnType<typeof buildExtProjAgg>;

export interface OpenProjectInfo { id: string; name: string; updatedAt: string; }

export interface EstimateTopCardProps {
  results: WallResult[];
  projAgg: ProjAgg;
  addBlankWall: () => void;
  // Adds a wall then switches the whole project over to the Internal
  // calculator -- see App.tsx's addInternalWall (no per-wall internal/
  // external flag exists, Internal-ness is a project-level system choice).
  // Mirror image of Internal's own onAddExternalWall.
  onAddInternalWall: () => void;
  openProject: OpenProjectInfo | null;
  draftLabel: string | null;
  onSetDraftLabel: (label: string | null) => void;
  lastEditedAt?: number;
  onSaveDraftAsProject: (name: string) => Promise<string | null>;
  onSaveOpenProject: () => Promise<void>;
  savingProject: boolean;
  saveProjectError: string | null;
  onGoToProjects: () => void;
  onViewDetails: () => void;
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

export const EstimateTopCard = ({
  results, projAgg, addBlankWall, onAddInternalWall,
  openProject, draftLabel, onSetDraftLabel, lastEditedAt,
  onSaveDraftAsProject, onSaveOpenProject, savingProject, saveProjectError,
  onGoToProjects, onViewDetails,
}: EstimateTopCardProps) => {
  const totalItems = results.length;
  const configuredCount = results.filter(r => isConfigured(deriveWallStatus(r.wall, r.out))).length;
  const warningsCount = results.filter(r => r.out.warnings.length > 0).length;
  const pct = totalItems ? Math.round((configuredCount / totalItems) * 100) : 0;
  // "Nothing started yet" -- the store always seeds one blank wall, so a
  // literal results.length === 0 gate would never fire. This is the reachable
  // proxy: exactly one wall, and it's still fully unconfigured.
  const noEstimate = totalItems === 1 && results[0].out.empty;
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

  if (noEstimate) {
    return (
      <div className="mt-3">
        <span className={`${cx.badge} ${tone("neutral")}`}>NO ESTIMATE ACTIVE</span>
        <div className={`mt-2 ${cx.section}`}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: BLUE }}>
              <FilePlus2 size={18} style={{ color: BLUE }} />
            </span>
            <div>
              <div className="text-base font-extrabold" style={{ color: NAVY }}>Start a new estimate</div>
              <div className="mt-0.5 text-sm text-slate-400 dark:text-slate-400">Choose a wall type below to start building your estimate.</div>
            </div>
          </div>
          <div className="mt-4">
            <label className={cx.lbl}>Estimate description (optional)</label>
            <input
              value={draftLabel ?? ""}
              onChange={e => onSetDraftLabel(e.target.value || null)}
              placeholder="e.g. Front lobby internal walls"
              className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-900/40 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-colors focus:border-blue-300 dark:focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800"
            />
          </div>
          <Button icon={<Plus size={14} />} onClick={addBlankWall} className="mt-4 w-full sm:w-auto">
            Start New Estimate <ChevronRight size={14} />
          </Button>
        </div>
        <div className={cx.infoNote}>
          <Info size={15} className="mt-0.5 shrink-0" />
          <span>You can view your projects in the <button onClick={onGoToProjects} className="font-bold underline decoration-2 underline-offset-2">Projects</button> tab.</span>
        </div>
        <div className={`mt-3 ${cx.section}`}>
          <div className={cx.cardHd} style={{ marginTop: 0 }}>Add a new wall estimate</div>
          <div className="mb-3 text-sm text-slate-400 dark:text-slate-400">Choose the type of wall you want to estimate.</div>
          <div className="grid grid-cols-2 gap-2.5">
            <AddTile label="External Wall" sublabel="Add a weather-exposed estimate" onClick={addBlankWall} icon={<CloudRain size={16} />} highlighted />
            <AddTile label="Internal Wall" sublabel="Add a new internal estimate" onClick={onAddInternalWall} icon={<House size={16} />} />
          </div>
        </div>
      </div>
    );
  }

  const pillTone = isSaved ? "info" : "ok";
  const noteCx = isSaved ? cx.infoNoteInfo : cx.infoNoteOk;
  const heroFill = isSaved ? "bg-cyan-500 dark:bg-cyan-600" : "bg-emerald-500 dark:bg-emerald-600";

  return (
    <div className="mt-3">
      <span className={`${cx.badge} ${tone(pillTone)}`}>WORKING ON AN ESTIMATE</span>
      <div className={`mt-2 ${cx.section}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white ${heroFill}`}>
              <FileText size={18} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold" style={{ color: NAVY }}>
                {openProject ? openProject.name : "Current estimate"}
              </div>
              <span className={`${cx.badge} ${tone(pillTone)} mt-1 inline-block`}>{isSaved ? "Saved" : "In progress"}</span>
              <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-300">
                {openProject ? (
                  <span>{openProject.name}</span>
                ) : editingLabel ? (
                  <input autoFocus value={labelInput} onChange={e => setLabelInput(e.target.value)}
                    onBlur={commitLabel} onKeyDown={e => e.key === "Enter" && commitLabel()}
                    className={cx.input + " w-40 !py-1 !text-sm"} style={{ color: NAVY }} />
                ) : (
                  <>
                    <span>{draftLabel ?? "Draft estimate"}</span>
                    <button onClick={() => { setLabelInput(draftLabel ?? ""); setEditingLabel(true); }} aria-label="Edit draft label">
                      <Pencil size={13} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400" />
                    </button>
                  </>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 dark:text-slate-400">
                <span className="flex items-center gap-1"><CheckCircle2 size={12} />{pct}% configured</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={12} />{warningsCount} warning{warningsCount === 1 ? "" : "s"}</span>
                <span>{totalItems} wall item{totalItems === 1 ? "" : "s"}</span>
                <span>{projAgg.totalArea} m² total area</span>
                <span>Last edited {formatLastEdited(openProject ? openProject.updatedAt : lastEditedAt)}</span>
              </div>
              <button onClick={onViewDetails} className="mt-2 flex items-center gap-1 text-xs font-bold" style={{ color: BLUE }}>
                View estimate details <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isSaved ? (
              <>
                {saveProjectError && <span className="text-xs text-red-600 dark:text-red-300">{saveProjectError}</span>}
                <IconButton onClick={onSaveOpenProject} disabled={savingProject} title={savingProject ? "Saving..." : "Save"} ariaLabel="Save">
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
              <Button icon={<Plus size={14} />} onClick={() => { setNameInput(draftLabel ?? ""); setNamingOpen(true); }}>
                Save to Projects
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className={noteCx}>
        <Info size={15} className="mt-0.5 shrink-0" />
        <span>You can view and manage all your projects in the <button onClick={onGoToProjects} className="font-bold underline decoration-2 underline-offset-2">Projects</button> tab.</span>
      </div>
      <div className={`mt-3 ${cx.section}`}>
        <div className={cx.cardHd} style={{ marginTop: 0 }}>Continue building your estimate</div>
        <div className="mb-3 text-sm text-slate-400 dark:text-slate-400">Add more walls to your current estimate.</div>
        <div className="grid grid-cols-2 gap-2.5">
          <AddTile label="External Wall" sublabel="Add another weather-exposed wall" onClick={addBlankWall} icon={<CloudRain size={16} />} highlighted />
          <AddTile label="Internal Wall" sublabel="Add another internal wall" onClick={onAddInternalWall} icon={<House size={16} />} />
        </div>
      </div>
    </div>
  );
};

// Leading icon box denotes wall type (House/CloudRain); trailing "+" circle
// carries the highlight styling -- BLUE fill for this calculator's own
// primary wall type, tone("info") (the same cyan classes the Custom status
// chip elsewhere already uses) for the other, rather than inventing a new
// colour for it.
const AddTile = ({ label, sublabel, onClick, icon, highlighted = false }: {
  label: string; sublabel: string; onClick: () => void; icon: React.ReactNode; highlighted?: boolean;
}) => (
  <button onClick={onClick}
    className={`flex min-h-[76px] items-center gap-2.5 rounded-xl border bg-white dark:bg-slate-800 px-3 py-2.5 text-left shadow-sm active:scale-95 transition-all ${highlighted ? "" : "border-slate-200 dark:border-slate-600"}`}
    style={highlighted ? { borderColor: BLUE } : undefined}>
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-slate-100 dark:bg-slate-700" style={{ color: BLUE }}>
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[13px] font-bold leading-tight" style={{ color: NAVY }}>{label}</span>
      <span className="mt-0.5 block text-[10px] leading-tight text-slate-400 dark:text-slate-400">{sublabel}</span>
    </span>
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${highlighted ? "" : tone("info")}`}
      style={highlighted ? { background: BLUE, color: WHITE } : undefined}>
      <Plus size={14} />
    </span>
  </button>
);
