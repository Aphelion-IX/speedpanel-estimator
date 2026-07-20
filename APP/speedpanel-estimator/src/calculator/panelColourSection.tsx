// =============================================================================
// External Calculator -- Panel colour section
// =============================================================================
// "Panel configuration" sidebar content: the P78 type badge (colour-tinted
// to match the current selection) and the stocked-colour/custom picker grid.
// =============================================================================
import { cx, NAVY, BLUE, GOLD, selectedFill, selectableOffCx } from "../styleTokens";
import { COLOUR_HEX, EXT_STOCKED_COLOURS } from "../data";
import type { Wall } from "../estimate/wall.types";

export const PanelColourSection = ({ active, update }: { active: Wall; update: (patch: Partial<Wall>) => void }) => {
  const isCustom = active.colourType === "special";
  const stockedHex = !isCustom && active.colour ? COLOUR_HEX[active.colour] : null;
  const isLight = active.colour === "OW";
  const colourName = !isCustom && active.colour
    ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour)?.label ?? ""
    : "";
  const badgeBg = isCustom ? GOLD : stockedHex ?? BLUE;
  const textColour = isCustom ? NAVY : isLight ? NAVY : "#fff";

  return (
    <>
      {/* P78 badge -- styled to match internal panel type buttons */}
      <div className={cx.cardHd}>Panel type</div>
      <div className="w-full rounded-xl border-2 py-3.5 px-3 transition-all" style={{ borderColor: badgeBg, background: badgeBg, transition: "background 0.3s, border-color 0.3s" }}>
        <div className="text-xs font-bold uppercase tracking-widest text-center" style={{ color: textColour }}>
          {isCustom ? "P78 - Custom" : `P78${colourName ? ` - ${colourName}` : ""}`}
        </div>
      </div>
      {/* Colour selection */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
        <div className={cx.cardHd}>Colour selection</div>
        <div className="grid grid-cols-3 gap-2 items-stretch">
          {[...EXT_STOCKED_COLOURS.map(c => {
            const hex = COLOUR_HEX[c.code];
            const selected = active.colour === c.code && active.colourType === "stocked";
            const isLight = c.code === "OW";
            const textColour = isLight ? NAVY : "#fff";
            return (
              <button key={c.code} onClick={() => update({ colour: c.code, colourType: "stocked" })}
                className={"w-full rounded-xl border-2 py-3 px-1.5 text-center transition-all active:scale-95" + (selected ? "" : " hover:-translate-y-0.5 hover:shadow-md")}
                style={{
                  background: hex,
                  borderColor: selected ? BLUE : "rgba(0,0,0,0.08)",
                  boxShadow: selected
                    ? `0 0 0 2px ${BLUE}, inset 0 1px 1px rgba(255,255,255,0.3), 0 12px 20px -8px color-mix(in srgb, ${BLUE} 60%, transparent)`
                    : "0 1px 2px rgba(15,23,42,0.08)",
                }}>
                <div className="text-[10px] font-bold uppercase leading-tight truncate"
                  style={{ color: textColour }}>{c.label}</div>
              </button>
            );
          }), (() => {
            const selected = active.colourType === "special";
            return (
              <button key="special" onClick={() => update({ colourType: "special", colour: "" })}
                className={"w-full rounded-xl border-2 py-3 px-1.5 text-center active:scale-95 transition-all " + (selected ? "" : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 ${selectableOffCx}`)}
                style={selected ? selectedFill : undefined}>
                <div className="text-[10px] font-bold uppercase leading-tight"
                  style={{ color: selected ? "#fff" : BLUE }}>Custom</div>
              </button>
            );
          })()]}
        </div>
      </div>
    </>
  );
};
