// --- Design tokens ------------------------------------------------------------
// Each references a CSS custom property (defined in index.css for :root and
// overridden under .dark) instead of a literal hex code, so every existing
// style={{color: NAVY}}-style usage below becomes dark-mode-aware for free --
// no need to touch each individual usage site.
export const NAVY      = "var(--navy)";      // primary body/heading text colour
export const NAVY_2    = "var(--navy-2)";    // heading-weight gradient, H2 mid-step
export const NAVY_3    = "var(--navy-3)";    // heading-weight gradient, H3 mid-step
export const BLUE      = "var(--blue)";      // primary brand colour -- selected states, links, key values
export const GOLD      = "var(--gold)";      // accent colour -- highlights, warnings, custom/special-order badge
export const WHITE     = "var(--on-fill)";   // text/icon colour on filled (BLUE/GOLD) backgrounds
export const MUTED     = "var(--muted)";     // inactive/unselected text & icon colour

// --- Status tone -> class string ---------------------------------------------
// Single source for status-colour classes. Domain files (companyTypes.ts,
// journeyStage.ts, requestTypes.ts, projectTypes.ts, orderTypes.ts) keep their
// own status-string -> tone mapping (the vocab differs per domain) and call
// this instead of hand-typing Tailwind colour classes themselves.
export type StatusTone = "ok" | "warn" | "danger" | "info" | "neutral";

export const tone = (t: StatusTone): string => {
  switch (t) {
    case "ok":      return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400";
    // Pale amber, not the solid brand-Gold fill first tried in the design
    // samples -- that only ever got demonstrated in isolation. In a real
    // multi-status list (e.g. journeyStage.ts's 8-step ladder) it sits next
    // to five other pale-bg tones, and a lone solid chip reads as broken,
    // not "highlighted". Still unambiguously amber/gold, not orange.
    case "warn":    return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400";
    case "danger":  return "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400";
    case "info":    return "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400";
    case "neutral": return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
  }
};

// --- Single source of truth for all text sizes and spacing -------------------
//
// TYPE SCALE
//   xs  = 12px  -- metadata labels, badges, uppercase caps only
//   sm  = 14px  -- all body text: descriptions, row keys, notes, button labels
//   base= 16px  -- primary output numbers (panel counts, lengths)
//   2xl = 24px  -- stat values
//   4xl = 36px  -- app title
//
// SPACING RHYTHM
//   gap-2 / py-2  -- tight (inline chips, badges)
//   gap-3 / p-3   -- compact rows
//   gap-3 / p-4   -- standard notes/warnings
//   p-5           -- cards and sections
//   mt-3          -- between related groups
//   mt-5          -- between sections
//
export const cx = {
  // -- Inputs & labels --------------------------------------------------------
  input:     "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 shadow-sm transition-shadow focus:border-blue-300 dark:focus:border-blue-600 focus:shadow-md focus:outline-none",
  lbl:       "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 pl-1",
  wallName:  "min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm outline-none transition-shadow focus:border-blue-300 dark:focus:border-blue-600 focus:shadow-md",

  // -- Layout containers ------------------------------------------------------
  // Raised baseline -- bigger radius + a layered shadow (soft contact shadow
  // + a wider ambient one), matching the depth already used on the sign-in
  // card and the signed-in home screen's workspace cards, instead of the
  // flatter shadow-sm every other page used previously.
  card:      "rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 lg:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_40px_-28px_rgba(15,23,42,0.18)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_20px_40px_-24px_rgba(0,0,0,0.35)]",
  section:   "rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 lg:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_40px_-28px_rgba(15,23,42,0.18)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_20px_40px_-24px_rgba(0,0,0,0.35)] space-y-4",

  // -- Page heading scale -------------------------------------------------------
  // Colour fades from full-strength Navy (H1) through two mid-steps to the
  // muted body tone (see --navy-2/--navy-3 in index.css), so hierarchy reads
  // via colour as well as size/weight. H1 is set to text-3xl rather than the
  // 44px used in the design-samples reference doc -- that scale reads as a
  // hero for an isolated spec sheet, but is too large for the app's denser,
  // information-heavy real pages.
  eyebrow:   "text-xs font-extrabold uppercase tracking-wide text-[color:var(--blue)]",
  h1:        "text-3xl font-extrabold tracking-tight text-[color:var(--navy)]",
  h2:        "text-xl font-bold tracking-tight text-[color:var(--navy-2)]",
  h3:        "text-base font-bold text-[color:var(--navy-3)]",

  // -- Interactive controls ---------------------------------------------------
  // Accordions: collapsible section toggles
  accordion:      "mt-5 flex w-full items-center justify-between rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 transition-colors hover:bg-blue-100/70 dark:hover:bg-blue-900/40",
  accordionInner: "flex w-full items-center justify-between rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 transition-colors hover:bg-blue-100/70 dark:hover:bg-blue-900/40",
  // Export/CTA button
  // Fixed dark fill regardless of theme -- not meant to visually flip with
  // light/dark like body text does.
  exportBtn: "mt-8 w-full rounded-xl py-4 text-sm font-bold tracking-widest text-white bg-slate-800 flex items-center justify-center gap-2 transition-colors hover:bg-slate-700 active:scale-[0.99]",
  exportBtnDisabled: "mt-8 w-full rounded-xl py-4 text-sm font-bold tracking-widest text-white bg-slate-800 cursor-not-allowed opacity-50",

  // -- Informational boxes ----------------------------------------------------
  // Amber warning boxes
  warnbox:   "flex gap-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 p-4 text-sm leading-relaxed text-amber-800 dark:text-amber-300",
  // Blue info / note boxes
  infoNote:  "mt-3 flex gap-2.5 rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 px-4 py-3 text-sm leading-relaxed text-blue-700 dark:text-blue-300",
  // Pack notes (amber, inside cards)
  packNote:  "mt-2 flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-sm leading-relaxed text-amber-700 dark:text-amber-400",

  // -- Data rows -------------------------------------------------------------
  // Row key (left side label)
  rowKey:    "text-sm font-medium text-slate-400 dark:text-slate-500",
  rowKeyDim: "text-sm font-medium text-slate-300 dark:text-slate-600",
  // Row value (right side)
  rowVal:    "text-right text-sm font-semibold shrink-0",
  // Sub-detail line beneath a primary row value (stocked @ etc.)
  rowSub:    "mt-1 text-xs text-slate-400 dark:text-slate-500",
  // Dividers
  rowBorder: "border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0",
  hr:        "mt-3 border-t border-slate-100 dark:border-slate-800 pt-3",

  // -- Section headings -------------------------------------------------------
  // Card sub-heading (Restrained edges, Corner angles, etc.)
  cardHd:    "mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-1",
  cardTitle: "mb-3.5 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-xs font-bold uppercase tracking-widest",
  // Section label with icon
  sectionLbl:"mb-2 mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400",

  // -- Badges & pills ---------------------------------------------------------
  pill:      "rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white",
  badge:     "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",

  // -- Footnotes & auxiliary text ---------------------------------------------
  footnote:  "pt-2 text-sm leading-relaxed text-slate-400 dark:text-slate-500",
  // Locked-data panel wrapper
  ldWrap:    "mt-2 space-y-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-sm text-slate-500 dark:text-slate-400",
  ldHead:    "pt-3 pb-1 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400",
  // Highlighted info box inside a card (C-track section, etc.)
  infoBox:   "rounded-lg border border-blue-100 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 px-3.5 py-2.5",
  infoBoxHd: "text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400",
  infoBoxVal:"mt-1 text-sm font-bold",
  infoBoxSub:"mt-1 text-sm text-slate-500 dark:text-slate-400",
};
