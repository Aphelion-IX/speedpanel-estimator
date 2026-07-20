// =============================================================================
// First-Wall Setup (External Calculator only)
// =============================================================================
// Spec §4.1/§4.3 "No Project"/"First-Wall Setup": shown in place of
// EstimateTopCard/the wall workspace while the store's single seeded wall
// (see wallStore.ts's defaultWall) is still fully blank -- see
// estimate/estimatorSession.ts's isNoEstimate(). Collects the minimum
// starting configuration (orientation, colour, profile) then commits it
// onto that SAME seeded wall. Simpler than internalCalculator/
// firstWallSetup.tsx's mirror -- External has no wallSystem/Corner/Shaft
// concept and is always P78, so there's no wall-system step and no linked-
// pair creation path.
//
// Deliberately its own copy, not shared with internalCalculator's mirror --
// same fork-not-share convention as phoneShell.tsx/EstimateTopCard.tsx (see
// their header comments).
// =============================================================================
import { useState } from "react";
import { Pencil, Copy, ArrowRight, FolderOpen } from "lucide-react";
import { cx, NAVY, BLUE, selectedFill, selectableOffCx } from "../styleTokens";
import type { Wall } from "../estimate/wall.types";
import { ProfileSection } from "../calculator/wallConfig";
import type { ProfileId } from "../calculator/wallConfig";
import { PanelColourSection } from "../calculator/panelColourSection";

const Seg = <T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) => (
  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
    {options.map(([id, label]) => {
      const on = value === id;
      return (
        <button key={id} onClick={() => onChange(id)}
          className={"w-full rounded-xl border-2 py-3 px-2 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 ${selectableOffCx}`)}
          style={on ? { ...selectedFill, color: "#fff" } : { color: BLUE }}>
          {label}
        </button>
      );
    })}
  </div>
);

export interface FirstWallSetupProps {
  active: Wall;
  update: (patch: Partial<Wall>) => void;
  draftLabel: string | null;
  onSetDraftLabel: (label: string | null) => void;
  onDuplicateDraft: () => void;
  onGoToProjects: () => void;
}

export const FirstWallSetup = ({
  active, update, draftLabel, onSetDraftLabel, onDuplicateDraft, onGoToProjects,
}: FirstWallSetupProps) => {
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">(active.orient);
  const [profile, setProfile] = useState<ProfileId>(active.profile);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const commitLabel = () => { onSetDraftLabel(labelInput.trim() || null); setEditingLabel(false); };

  const handleCreate = () => update({ orient: orientation, profile });

  return (
    <div className="mt-3">
      <div className={cx.section}>
        <span className={cx.eyebrow}>No project yet</span>
        <h2 className={cx.h2 + " mt-1"}>Start your first wall</h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-300">
          Choose the minimum configuration to create the right wall object. Panels, tracks and accessories won't
          appear until this wall has valid dimensions -- there's nothing to invent yet.
        </p>

        <div className="mt-4">
          <label className={cx.lbl}>Project name (optional)</label>
          <div className="flex items-stretch gap-2">
            {editingLabel ? (
              <input autoFocus value={labelInput} onChange={e => setLabelInput(e.target.value)}
                onBlur={commitLabel} onKeyDown={e => e.key === "Enter" && commitLabel()}
                placeholder="e.g. Front Lobby Project" className={cx.input + " min-w-0 flex-1"} style={{ color: NAVY }} />
            ) : (
              <button onClick={() => { setLabelInput(draftLabel ?? ""); setEditingLabel(true); }}
                className={cx.input + " min-w-0 flex-1 text-left"} style={{ color: draftLabel ? NAVY : undefined }}>
                {draftLabel ?? "Add a name"}
              </button>
            )}
            <NameActionButton title="Edit project name" icon={<Pencil size={16} />} onClick={() => { setLabelInput(draftLabel ?? ""); setEditingLabel(true); }} />
            <NameActionButton title="Duplicate project" icon={<Copy size={16} />} onClick={onDuplicateDraft} />
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 dark:border-slate-700 pt-4">
          <div className={cx.cardHd}>1. Orientation</div>
          <Seg value={orientation} onChange={setOrientation} options={[["vertical", "Vertical"], ["horizontal", "Horizontal"]]} />
        </div>

        <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
          <PanelColourSection active={active} update={update} />
        </div>

        <div className="mt-4">
          <ProfileSection profile={profile} onChange={setProfile} />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-700 pt-4">
          <button onClick={onGoToProjects} className="flex items-center gap-1.5 text-sm font-bold" style={{ color: BLUE }}>
            <FolderOpen size={14} />Open a saved project instead
          </button>
          <button onClick={handleCreate} className={cx.exportBtn + " !mt-0 !w-auto px-6"}>
            Create Wall 01
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

const NameActionButton = ({ onClick, title, icon }: { onClick: () => void; title: string; icon: React.ReactNode }) => (
  <button onClick={onClick} title={title} aria-label={title}
    className="grid w-11 shrink-0 place-items-center self-stretch rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-400 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600 active:translate-y-0 active:scale-95">
    {icon}
  </button>
);
