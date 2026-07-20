// =============================================================================
// First-Wall Setup (Internal Calculator only)
// =============================================================================
// Spec §4.1/§4.3 "No Project"/"First-Wall Setup": shown in place of
// EstimateTopCard/the wall workspace while the store's single seeded wall
// (see wallStore.ts's defaultWall) is still fully blank -- see
// estimate/estimatorSession.ts's isNoEstimate(). Collects the minimum
// starting configuration (orientation, wall system, panel type, profile)
// then commits it onto that SAME seeded wall (Standard), or converts it into
// the primary member of a new linked pair (Corner/Shaft) via wallStore.ts's
// convertActiveToCornerPair/convertActiveToShaftPair -- it does not create a
// throwaway wall and discard the seeded one.
//
// Deliberately its own copy, not shared with externalCalculator's mirror --
// same fork-not-share convention as phoneShell.tsx/EstimateTopCard.tsx (see
// their header comments). External has no Corner/Shaft wall-system concept,
// so its own First-Wall Setup only ever needs the Standard path.
// =============================================================================
import { useState } from "react";
import { Info, Pencil, Copy, ArrowRight, FolderOpen } from "lucide-react";
import { cx, NAVY, BLUE, selectedFill, selectableOffCx } from "../styleTokens";
import { TYPES } from "../data";
import type { Wall } from "../estimate/wall.types";
import type { WallSystemId } from "../App";
import { WALL_SYSTEMS } from "../calculator/wallsCard";
import { ProfileSection } from "../calculator/wallConfig";
import type { ProfileId } from "../calculator/wallConfig";

const Seg = <T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) => (
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
  convertActiveToCornerPair: () => void;
  convertActiveToShaftPair: () => void;
  draftLabel: string | null;
  onSetDraftLabel: (label: string | null) => void;
  onDuplicateDraft: () => void;
  onGoToProjects: () => void;
}

export const FirstWallSetup = ({
  active, update, convertActiveToCornerPair, convertActiveToShaftPair,
  draftLabel, onSetDraftLabel, onDuplicateDraft, onGoToProjects,
}: FirstWallSetupProps) => {
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">(active.orient);
  const [system, setSystem] = useState<WallSystemId>(active.wallSystem);
  const [panelType, setPanelType] = useState<number>(active.type);
  const [profile, setProfile] = useState<ProfileId>(active.profile);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const commitLabel = () => { onSetDraftLabel(labelInput.trim() || null); setEditingLabel(false); };

  const setSystemChoice = (id: WallSystemId) => {
    setSystem(id);
    // Corner/Shaft are horizontal-only (see WallSystemSelector's own
    // comment in wallsCard.tsx) -- lock orientation to match once chosen.
    if (id !== "standard") setOrientation("horizontal");
    if (id === "shaft") setPanelType(78); // Shaft is always P78, not a user choice.
  };

  const handleCreate = () => {
    update({ type: panelType as Wall["type"], profile, orient: system === "standard" ? orientation : "horizontal" });
    if (system === "corner") convertActiveToCornerPair();
    else if (system === "shaft") convertActiveToShaftPair();
  };

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

        {orientation === "horizontal" && (
          <div className="mt-4">
            <div className={cx.cardHd}>2. Wall system</div>
            <Seg value={system} onChange={setSystemChoice} options={WALL_SYSTEMS.map(([id, label]) => [id, label.replace(" wall", "")] as [WallSystemId, string])} />
            {system !== "standard" && (
              <p className={cx.infoNote}>
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>
                  {system === "corner"
                    ? "Creates two linked wall runs sharing one corner kit -- Wall 01 and Wall 02."
                    : "Creates a primary and secondary shaft stack wall sharing one junction kit."}
                </span>
              </p>
            )}
          </div>
        )}

        {system !== "shaft" && (
          <div className="mt-4">
            <div className={cx.cardHd}>{orientation === "horizontal" ? "3. Panel type" : "2. Panel type"}</div>
            <Seg value={panelType} onChange={setPanelType} options={TYPES.map(t => [t.id, t.label] as [number, string])} />
          </div>
        )}

        <div className="mt-4">
          <ProfileSection profile={profile} onChange={setProfile} />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-700 pt-4">
          <button onClick={onGoToProjects} className="flex items-center gap-1.5 text-sm font-bold" style={{ color: BLUE }}>
            <FolderOpen size={14} />Open a saved project instead
          </button>
          <button onClick={handleCreate} className={cx.exportBtn + " !mt-0 !w-auto px-6"}>
            {system === "standard" ? "Create Wall 01" : system === "corner" ? "Create corner system" : "Create shaft system"}
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
