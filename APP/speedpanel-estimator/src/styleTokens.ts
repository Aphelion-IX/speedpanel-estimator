import type { CSSProperties } from "react";

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

// --- Selected-option fill (buttons, nav rows, pills, chips) ------------------
// Every button-grid-style selector in the app (Orientation, Wall type, Wall
// system, Panel type/configuration, Profile, link/partner pickers, the
// Estimate Structure nav, the phone pill scroller, colour swatches...) is its
// own hand-rolled button, not one shared component -- so without a shared
// style object here, each one's "selected" state drifts independently. This
// used to be a flat `background: BLUE` with no shadow at all; spread into the
// "on" branch of each call site's inline style (alongside `color`, which
// still varies per call site since some set it on child elements instead of
// the button itself) for a gradient fill + glow-lift matching EdgeBtn/
// ToggleSwitch's existing treatment instead of a flat colour swap.
export const selectedFill: CSSProperties = {
  borderColor: BLUE,
  background: `linear-gradient(180deg, color-mix(in srgb, ${BLUE} 100%, white 12%), ${BLUE})`,
  boxShadow: `inset 0 1px 1px rgba(255,255,255,0.28), 0 12px 22px -10px color-mix(in srgb, ${BLUE} 60%, transparent)`,
};

// -- Small "bubble" accents: warning dots, notification-count badges -----------
// Was a flat GOLD disc (`style={{ background: GOLD }}`), duplicated across the
// notification bell badge and three separate warning-dot call sites (Internal/
// External Estimate Structure nav, the phone pill scroller) -- a radial
// highlight + soft glow instead, so it reads as a lit indicator rather than a
// coloured sticker. Spread/assign wherever one of those bare GOLD dots lives.
export const goldBubbleFill: CSSProperties = {
  background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${GOLD} 100%, white 30%), ${GOLD})`,
  boxShadow: `inset 0 1px 1px rgba(255,255,255,0.3), 0 3px 8px -1px color-mix(in srgb, ${GOLD} 60%, transparent)`,
};
// className fragment for the *resting* (unselected) branch of the same
// buttons -- a real contact shadow instead of a bare hairline border, and a
// hover-lift/border-tint so an unselected option reads as clickable before
// it's ever pressed. Append after the existing
// "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800".
export const selectableOffCx = "shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-700";

// --- Status tone -> class string ---------------------------------------------
// Single source for status-colour classes. Domain files (companyTypes.ts,
// journeyStage.ts, requestTypes.ts, projectTypes.ts, orderTypes.ts) keep their
// own status-string -> tone mapping (the vocab differs per domain) and call
// this instead of hand-typing Tailwind colour classes themselves.
export type StatusTone = "ok" | "warn" | "danger" | "info" | "neutral";

export const tone = (t: StatusTone): string => {
  switch (t) {
    case "ok":      return "bg-emerald-50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300";
    // Pale amber, not the solid brand-Gold fill first tried in the design
    // samples -- that only ever got demonstrated in isolation. In a real
    // multi-status list (e.g. journeyStage.ts's 8-step ladder) it sits next
    // to five other pale-bg tones, and a lone solid chip reads as broken,
    // not "highlighted". Still unambiguously amber/gold, not orange.
    case "warn":    return "bg-amber-50 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300";
    case "danger":  return "bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300";
    case "info":    return "bg-cyan-50 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300";
    case "neutral": return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
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
  // Resting shadow is a real (if small) contact shadow rather than shadow-sm,
  // hover nudges the border toward brand-blue so a field reads as "live"
  // before it's even focused, and focus swaps the old flat focus:shadow-md
  // for an actual glow ring (halo + crisp border) -- the same language
  // buttons/chips below use for their own selected/focus state.
  input:     "w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all hover:border-blue-200 dark:hover:border-blue-700 focus:border-blue-400 dark:focus:border-blue-500 focus:shadow-[0_0_0_3.5px_rgba(0,103,185,0.15)] dark:focus:shadow-[0_0_0_3.5px_rgba(58,168,255,0.22)] focus:outline-none",
  lbl:       "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300 pl-1",
  wallName:  "min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none transition-all hover:border-blue-200 dark:hover:border-blue-700 focus:border-blue-400 dark:focus:border-blue-500 focus:shadow-[0_0_0_3.5px_rgba(0,103,185,0.15)] dark:focus:shadow-[0_0_0_3.5px_rgba(58,168,255,0.22)]",

  // -- Layout containers ------------------------------------------------------
  // Raised baseline -- bigger radius + a layered shadow (soft contact shadow
  // + a wider, deeper ambient one) plus a hairline top rim-highlight (inset),
  // matching the depth already used on the sign-in card and the signed-in
  // home screen's workspace cards, instead of the flatter shadow-sm every
  // other page used previously. The ambient layer is deliberately stronger
  // than the original -- at the old opacity/spread, cards read as barely
  // elevated above the page (see estimator visual-flatness feedback).
  card:      "rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-6 lg:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.05),0_28px_48px_-24px_rgba(15,23,42,0.26)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.25),0_28px_48px_-22px_rgba(0,0,0,0.45)]",
  section:   "rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-6 lg:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.05),0_28px_48px_-24px_rgba(15,23,42,0.26)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.25),0_28px_48px_-22px_rgba(0,0,0,0.45)] space-y-4",
  // Recessed "well" surface for content nested inside a card (e.g. a preview
  // box) -- tinted background + inset shadow so it reads as sunken rather
  // than another flat white rectangle stacked on the card behind it.
  panel:     "rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)]",
  // Same border/radius/shadow as cx.card, but no padding and overflow-hidden
  // instead -- for CollapsibleSection's integrated header-bar treatment,
  // where the header strip and the padded body are two regions inside one
  // shell rather than a bare label floating above a separately-padded card.
  cardShell: "rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.05),0_28px_48px_-24px_rgba(15,23,42,0.26)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.25),0_28px_48px_-22px_rgba(0,0,0,0.45)]",

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
  accordion:      "mt-5 flex w-full items-center justify-between rounded-xl border border-blue-100 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-900/55 px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 transition-colors hover:bg-blue-100/70 dark:hover:bg-blue-900/40",
  accordionInner: "flex w-full items-center justify-between rounded-xl border border-blue-100 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-900/55 px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 transition-colors hover:bg-blue-100/70 dark:hover:bg-blue-900/40",
  // Export/CTA button
  // Fixed dark fill regardless of theme -- not meant to visually flip with
  // light/dark like body text does.
  exportBtn: "mt-8 w-full rounded-xl py-4 text-sm font-bold tracking-widest text-white bg-slate-800 flex items-center justify-center gap-2 transition-colors hover:bg-slate-700 active:scale-[0.99]",
  exportBtnDisabled: "mt-8 w-full rounded-xl py-4 text-sm font-bold tracking-widest text-white bg-slate-800 cursor-not-allowed opacity-50",

  // -- Informational boxes ----------------------------------------------------
  // Amber warning boxes
  warnbox:   "flex gap-3 rounded-xl border border-amber-200 dark:border-amber-700/80 bg-amber-50/80 dark:bg-amber-900/50 p-4 text-sm leading-relaxed text-amber-800 dark:text-amber-300",
  // Blue info / note boxes
  infoNote:  "mt-3 flex gap-2.5 rounded-xl border border-blue-100 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-900/55 px-4 py-3 text-sm leading-relaxed text-blue-700 dark:text-blue-300",
  // Green info / note box -- unsaved-draft-in-progress variant of infoNote
  infoNoteOk:   "mt-3 flex gap-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-900/55 px-4 py-3 text-sm leading-relaxed text-emerald-700 dark:text-emerald-300",
  // Cyan info / note box -- editing-a-saved-project variant of infoNote
  infoNoteInfo: "mt-3 flex gap-2.5 rounded-xl border border-cyan-100 dark:border-cyan-800/80 bg-cyan-50/70 dark:bg-cyan-900/55 px-4 py-3 text-sm leading-relaxed text-cyan-700 dark:text-cyan-300",
  // Pack notes (amber, inside cards)
  packNote:  "mt-2 flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/50 px-3.5 py-2.5 text-sm leading-relaxed text-amber-700 dark:text-amber-300",

  // -- Data rows -------------------------------------------------------------
  // Row key (left side label)
  rowKey:    "text-sm font-medium text-slate-400 dark:text-slate-400",
  rowKeyDim: "text-sm font-medium text-slate-300 dark:text-slate-500",
  // Row value (right side)
  rowVal:    "text-right text-sm font-semibold shrink-0",
  // Sub-detail line beneath a primary row value (stocked @ etc.)
  rowSub:    "mt-1 text-xs text-slate-400 dark:text-slate-400",
  // Dividers
  rowBorder: "border-b border-slate-100 dark:border-slate-700 pb-3 last:border-0",
  hr:        "mt-3 border-t border-slate-100 dark:border-slate-700 pt-3",

  // -- Section headings -------------------------------------------------------
  // Card sub-heading (Restrained edges, Corner angles, etc.)
  cardHd:    "mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 pl-1",
  cardTitle: "mb-3.5 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3 text-xs font-bold uppercase tracking-widest",
  // Section label with icon
  sectionLbl:"mb-2 mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300",

  // -- Badges & pills ---------------------------------------------------------
  pill:      "rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white",
  badge:     "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",

  // -- Tabs --------------------------------------------------------------------
  // Click-to-switch pill tab bar (src/ui/tabs.tsx) -- same pill visual
  // language as SectionNav's scroll-spy pills, but a plain non-sticky row
  // since tab switching stays within one card, not the whole page.
  // Track is a recessed groove (inset shadow, same idea as cx.panel) instead
  // of a flat grey box; the active tab is a small raised chip sitting inside
  // it (real elevation + brand-blue text) rather than a flat solid-blue fill
  // -- matches the "pill in a groove" pattern used by Stripe/Linear segmented
  // controls instead of a plain colour swap.
  tabList:     "flex gap-1.5 overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 p-1.5 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)]",
  tabActive:   "shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-[color:var(--blue)] bg-white dark:bg-slate-800 shadow-[0_1px_1px_rgba(15,23,42,0.04),0_8px_16px_-10px_rgba(12,35,64,0.35)] dark:shadow-[0_1px_1px_rgba(0,0,0,0.2),0_8px_16px_-8px_rgba(0,0,0,0.4)]",
  tabInactive: "shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-slate-400 dark:text-slate-400 transition-colors hover:text-[color:var(--blue)]",

  // -- Drawer / slide-over ------------------------------------------------------
  // src/ui/drawer.tsx -- right-side panel on web layout, bottom sheet on phone
  // layout (rounded top corners, capped at 82vh, scrolls internally), same
  // backdrop feel as ConfirmDialog's centered modal. Phone gets its own overlay
  // alignment (bottom-anchored) since the web overlay's justify-end
  // (right-anchored) doesn't fit a bottom sheet.
  drawerOverlay:      "fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm",
  drawerOverlaySheet: "fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm",
  drawerPanel:   "flex h-full w-full max-w-md flex-col bg-white dark:bg-slate-800 shadow-[-30px_0_60px_-24px_rgba(15,23,42,0.4)] outline-none dark:shadow-[-30px_0_60px_-24px_rgba(0,0,0,0.6)]",
  drawerSheet:   "flex max-h-[82vh] w-full flex-col rounded-t-2xl bg-white dark:bg-slate-800 shadow-[0_-20px_60px_-24px_rgba(15,23,42,0.4)] outline-none dark:shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.6)]",

  // -- Mobile sticky summary bar -------------------------------------------------
  // src/ui/stickyBar.tsx -- fixed bottom bar, no equivalent existed anywhere
  // in the app before this. Safe-area-aware bottom padding for iOS home indicator.
  stickyBar:    "fixed inset-x-0 bottom-0 z-40 flex items-center gap-4 border-t border-slate-200 dark:border-slate-600 bg-white/95 dark:bg-slate-800/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-20px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur dark:shadow-[0_-20px_40px_-24px_rgba(0,0,0,0.5)]",
  stickyBarBtn: "shrink-0 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold tracking-wide text-white transition-colors hover:bg-slate-700 active:scale-[0.99]",

  // -- Footnotes & auxiliary text ---------------------------------------------
  footnote:  "pt-2 text-sm leading-relaxed text-slate-400 dark:text-slate-400",
  // Locked-data panel wrapper
  ldWrap:    "mt-2 space-y-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-5 text-sm text-slate-500 dark:text-slate-300",
  ldHead:    "pt-3 pb-1 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300",
  // Highlighted info box inside a card (C-track section, etc.)
  infoBox:   "rounded-lg border border-blue-100 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-900/55 px-3.5 py-2.5",
  infoBoxHd: "text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300",
  infoBoxVal:"mt-1 text-sm font-bold",
  infoBoxSub:"mt-1 text-sm text-slate-500 dark:text-slate-300",
};
