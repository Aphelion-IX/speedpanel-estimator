// =============================================================================
// Generate the product-catalog seed SQL from src/data.ts
// =============================================================================
// The panels/tracks/fixings/sealants tables ship EMPTY -- neither schema.sql
// nor seed.sql inserts a single catalog row. Nothing can be priced until they
// are populated, because a price list is edited per catalog item, so a fresh
// deployment lands with an uneditable Price Lists screen.
//
// The catalog data already exists in the app: src/data.ts's PANELS drives the
// estimator, and the track dims / fixing / sealant products are the same ones
// buildReportData.ts already prints on order sheets. This generates the seed
// FROM those values rather than hand-transcribing them, so the seeded catalog
// can't drift from what the estimator actually computes with.
//
// data.ts reads math constants via loadMathConstants(), which guards
// `typeof window` and falls back to MATH_CONSTANT_DEFAULTS outside a browser
// -- exactly the right source for a first-deploy seed.
//
// Run:  npx vite-node scripts/generate-catalog-seed.ts
// Emits: supabase/seed-product-catalog.sql
//
// The identity columns each row is matched on downstream are load-bearing --
// see priceEstimateReportData.ts:
//   panels   -> matched by `type` (51/64/78)
//   tracks   -> matched by (kind, system|'both', panel_type)
//   fixings  -> matched by `length_mm` (30 / 16)
//   sealants -> matched by `system` ('internal' / 'external')
// Changing those values silently unprices the corresponding order line.
// =============================================================================
import { writeFileSync } from "node:fs";
import {
  PANELS, CTRACK_DIM, JTRACK_DIM, CTRACK_STOCK, JTRACK_STOCK,
  FLASH_DIM, FLASH_STOCK, FIX_PER_BOX,
  SEALANT_M2_PER_SAUSAGE, SEALANT_PER_BOX,
  EXT_CTRACK_DIM, EXT_JTRACK_DIM, EXT_ZFLASH_DIM, EXT_HORIZ_COVER_DIM,
  EXT_CTRACK_STOCK, EXT_JTRACK_STOCK, EXT_ZFLASH_STOCK,
  EXT_SEALANT_M2, EXT_SEALANT_PER_BOX,
  EXT_STOCKED_COLOURS, COLOUR_HEX,
} from "../src/data";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

const lines: string[] = [];
const say = (s = "") => lines.push(s);

say("-- =============================================================================");
say("-- Product catalog seed -- GENERATED, do not edit by hand");
say("-- =============================================================================");
say("-- Regenerate with:  npx vite-node scripts/generate-catalog-seed.ts");
say("--");
say("-- Populates panels/tracks/fixings/sealants, which ship empty. Until they have");
say("-- rows, no price list can be edited: prices are entered per catalog item, so");
say("-- an empty catalog means an empty (and therefore uneditable) price list.");
say("--");
say("-- Idempotent: every insert is guarded by a `where not exists` on the same");
say("-- identity column the pricing engine matches on, so re-running adds nothing");
say("-- and never duplicates a row. It also never UPDATES an existing row, so a");
say("-- catalog you have since edited in Admin > Products is left untouched.");
say("-- =============================================================================");
say();
say("begin;");
say();

say("-- --- Panels: matched downstream by `type` -----------------------------------");
for (const p of PANELS) {
  say(`insert into panels (type, label, depth, frl, pack, ctrack_stock, ctrack_dim, jtrack_dim, max_h_vert, max_h_horiz, span_vert, span_horiz, corner_post, horiz_ctrack)`);
  say(`select ${p.type}, ${q(p.label)}, ${q(p.depth)}, ${q(p.frl)}, ${p.pack}, ${p.ctrackStock}, ${q(p.ctrackDim)}, ${q(p.jtrackDim)}, ${p.maxHVert}, ${p.maxHHoriz},`);
  say(`       ${j(p.spanVert)}, ${j(p.spanHoriz)}, ${j(p.cornerPost)}, ${j(p.horizCtrack)}`);
  say(`where not exists (select 1 from panels where type = ${p.type});`);
  say();
}

say("-- --- Tracks: matched downstream by (kind, system, panel_type) ---------------");
interface TrackSeed {
  kind: string; system: string; label: string; dim: string;
  bmt: string | null; panelType: number | null; stock: number[];
}
const tracks: TrackSeed[] = [];
for (const p of PANELS) {
  tracks.push({
    kind: "c-track", system: "internal", label: `C-track - ${p.label}`,
    dim: `${CTRACK_DIM[p.type]} - 1.15 mm BMT`, bmt: "1.15 mm",
    panelType: p.type, stock: [CTRACK_STOCK[p.type]],
  });
}
// Internal J-track is P78-only (INT_CONFIG.jValidFn), matching the single
// j-track line buildReportData.ts emits for Internal.
tracks.push({
  kind: "j-track", system: "internal", label: "J-track - Base",
  dim: `${JTRACK_DIM[78]} - 1.15 mm BMT`, bmt: "1.15 mm",
  panelType: 78, stock: [...JTRACK_STOCK],
});
// Head flashing is the same physical product on both systems (identical dim
// on the Internal and External track lines), so it seeds once as 'both'
// rather than as two separately-priceable rows.
tracks.push({
  kind: "head-flash", system: "both", label: "Head track flashing",
  dim: FLASH_DIM, bmt: "0.7 mm", panelType: null, stock: [FLASH_STOCK],
});
tracks.push({
  kind: "c-track", system: "external", label: "C-track - Head + 2 sides",
  dim: EXT_CTRACK_DIM, bmt: "1.15 mm", panelType: 78, stock: [...EXT_CTRACK_STOCK],
});
tracks.push({
  kind: "j-track", system: "external", label: "J-track - Base",
  dim: EXT_JTRACK_DIM, bmt: "1.15 mm", panelType: 78, stock: [...EXT_JTRACK_STOCK],
});
tracks.push({
  kind: "z-flash", system: "external", label: "Z-flashing (coloured)",
  dim: EXT_ZFLASH_DIM, bmt: "0.7 mm", panelType: 78, stock: [EXT_ZFLASH_STOCK],
});
tracks.push({
  kind: "horiz-cover", system: "external", label: "Horizontal joint cover flashing",
  dim: EXT_HORIZ_COVER_DIM, bmt: "0.7 mm", panelType: 78, stock: [EXT_ZFLASH_STOCK],
});

for (const t of tracks) {
  const pt = t.panelType === null ? "null" : String(t.panelType);
  const ptWhere = t.panelType === null ? "panel_type is null" : `panel_type = ${t.panelType}`;
  say(`insert into tracks (kind, system, label, dim, bmt, panel_type, stock_lengths)`);
  say(`select ${q(t.kind)}, ${q(t.system)}, ${q(t.label)}, ${q(t.dim)}, ${t.bmt ? q(t.bmt) : "null"}, ${pt}, ${j(t.stock)}`);
  say(`where not exists (select 1 from tracks where kind = ${q(t.kind)} and system = ${q(t.system)} and ${ptWhere});`);
  say();
}

say("-- --- Fixings: matched downstream by `length_mm` (30 / 16) -------------------");
for (const f of [
  { code: "10g 30mm SDS", gauge: "10g", length: 30, use: "Panel to track" },
  { code: "10g 16mm SDS", gauge: "10g", length: 16, use: "Panel to panel" },
]) {
  say(`insert into fixings (code, gauge, length_mm, use, per_box)`);
  say(`select ${q(f.code)}, ${q(f.gauge)}, ${f.length}, ${q(f.use)}, ${FIX_PER_BOX}`);
  say(`where not exists (select 1 from fixings where length_mm = ${f.length});`);
  say();
}

say("-- --- Sealants: matched downstream by `system` -------------------------------");
for (const s of [
  { system: "internal", product: "Hilti CP606 sealant", m2: SEALANT_M2_PER_SAUSAGE, perBox: SEALANT_PER_BOX },
  { system: "external", product: "Sikaflex 400 Fire PU", m2: EXT_SEALANT_M2, perBox: EXT_SEALANT_PER_BOX },
]) {
  say(`insert into sealants (system, product, m2_per_sausage, per_box)`);
  say(`select ${q(s.system)}, ${q(s.product)}, ${s.m2}, ${s.perBox}`);
  say(`where not exists (select 1 from sealants where system = ${q(s.system)});`);
  say();
}

// Colours aren't priceable (a colour is a finish attribute of a panel, never
// its own orderable line item -- see schema.sql), so nothing matches on them
// downstream. They ship empty like the rest of the catalog though, which
// leaves Admin > Products' Colours tab blank, so they seed here too.
say("-- --- Colours: not priceable, matched by `code` for idempotency ------------");
for (const c of EXT_STOCKED_COLOURS) {
  say(`insert into colours (label, code, hex)`);
  say(`select ${q(c.label)}, ${q(c.code)}, ${q(COLOUR_HEX[c.code])}`);
  say(`where not exists (select 1 from colours where code = ${q(c.code)});`);
  say();
}

say("commit;");
say();

const out = new URL("../supabase/seed-product-catalog.sql", import.meta.url).pathname;
writeFileSync(out, lines.join("\n"));
console.log(`Wrote ${out}`);
console.log(`  panels:   ${PANELS.length}`);
console.log(`  tracks:   ${tracks.length}`);
console.log(`  fixings:  2`);
console.log(`  sealants: 2`);
console.log(`  colours:  ${EXT_STOCKED_COLOURS.length}`);
