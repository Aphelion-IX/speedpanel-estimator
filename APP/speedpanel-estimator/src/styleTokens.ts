// --- Design tokens ------------------------------------------------------------
// Each references a CSS custom property (defined in index.css for :root and
// overridden under .dark) instead of a literal hex code, so every existing
// style={{color: NAVY}}-style usage below becomes dark-mode-aware for free --
// no need to touch each individual usage site.
export const NAVY      = "var(--navy)";      // primary body/heading text colour
export const BLUE      = "var(--blue)";      // primary brand colour -- selected states, links, key values
export const GOLD      = "var(--gold)";      // accent colour -- highlights, warnings, custom/special-order badge
export const WHITE     = "var(--on-fill)";   // text/icon colour on filled (BLUE/GOLD) backgrounds
export const MUTED     = "var(--muted)";     // inactive/unselected text & icon colour

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
  card:      "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm",
  section:   "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4",

  // -- Interactive controls ---------------------------------------------------
  // Accordions: collapsible section toggles
  accordion:      "mt-5 flex w-full items-center justify-between rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 transition-colors hover:bg-blue-100/70 dark:hover:bg-blue-900/40",
  accordionInner: "flex w-full items-center justify-between rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 transition-colors hover:bg-blue-100/70 dark:hover:bg-blue-900/40",
  // Export/CTA button
  // Fixed dark fill regardless of theme (a disabled/not-yet-implemented CTA,
  // not meant to visually flip with light/dark like body text does).
  exportBtn: "mt-8 w-full rounded-xl py-4 text-sm font-bold tracking-widest text-white bg-slate-800 cursor-not-allowed opacity-50",

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
