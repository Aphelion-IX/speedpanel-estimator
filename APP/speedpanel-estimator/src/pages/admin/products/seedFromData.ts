// =============================================================================
// Admin Products -- seed catalog from src/data.ts
// =============================================================================
// The ONLY file in src/pages/admin/products/ that imports from src/data.ts, and
// only reads plain constants -- transcribes them into the admin entity shapes
// (productTypes.ts), generating id/createdAt/updatedAt. Called lazily, once,
// from productStore.ts's loadCatalog() when localStorage is empty. Fixings have
// no source data in data.ts, so they're seeded from the naming already used in
// estimate/wallFixings.ts's comments.
// =============================================================================
import {
  PANELS, FLASH_DIM, EXT_CTRACK_DIM, EXT_JTRACK_DIM, EXT_ZFLASH_DIM, EXT_HORIZ_COVER_DIM,
  STOCK_LENGTHS, JTRACK_STOCK, EXT_STOCK, EXT_JTRACK_STOCK, EXT_CTRACK_STOCK,
  FIX_PER_BOX, SEALANT_M2_PER_SAUSAGE, SEALANT_PER_BOX, EXT_SEALANT_M2, EXT_SEALANT_PER_BOX,
  EXT_STOCKED_COLOURS, COLOUR_HEX,
} from "../../../data";
import type { AdminPanel, AdminTrack, AdminFixing, AdminSealant, AdminColour, ProductCatalog } from "./productTypes";

let seedCounter = 0;
// Deterministic per-seed-run ids (crypto.randomUUID() would also work, but a
// counter keeps seed output stable across reseeds for easier eyeballing/testing).
const seedId = () => `seed-${++seedCounter}`;

function stamp<T extends object>(entity: T): T & { id: string; createdAt: string; updatedAt: string } {
  const now = new Date().toISOString();
  return { ...entity, id: seedId(), createdAt: now, updatedAt: now };
}

function seedPanels(): AdminPanel[] {
  return PANELS.map(p => stamp<Omit<AdminPanel, "id" | "createdAt" | "updatedAt">>({
    type: p.type, label: p.label, depth: p.depth, frl: p.frl, pack: p.pack,
    ctrackStock: p.ctrackStock, ctrackDim: p.ctrackDim, jtrackDim: p.jtrackDim,
    maxHVert: p.maxHVert, maxHHoriz: p.maxHHoriz,
    spanVert: { ...p.spanVert },
    spanHoriz: p.spanHoriz.map(row => ({ ...row })),
    cornerPost: p.cornerPost.map(band => ({ maxW: band.maxW, rows: band.rows.map(r => ({ ...r })) })),
    horizCtrack: p.horizCtrack.map(row => ({ ...row })),
  }));
}

function seedTracks(): AdminTrack[] {
  const perPanel: AdminTrack[] = PANELS.flatMap(p => [
    stamp<Omit<AdminTrack, "id" | "createdAt" | "updatedAt">>({
      kind: "c-track", system: "internal", label: `${p.label} vertical C-track`, dim: p.ctrackDim,
      panelType: p.type, stockLengths: [p.ctrackStock],
    }),
    stamp<Omit<AdminTrack, "id" | "createdAt" | "updatedAt">>({
      kind: "j-track", system: "internal", label: `${p.label} J-track`, dim: p.jtrackDim,
      panelType: p.type, stockLengths: [...JTRACK_STOCK],
    }),
  ]);

  // Head track flashing and the external horizontal joint cover have no
  // dedicated stock-length constant of their own in data.ts (unlike C-track/
  // J-track) -- they're cut from the same general panel stock-length range,
  // so that range seeds their stockLengths.
  const internalShared: AdminTrack[] = [
    stamp<Omit<AdminTrack, "id" | "createdAt" | "updatedAt">>({
      kind: "head-flash", system: "internal", label: "Head track flashing", dim: FLASH_DIM,
      stockLengths: [...STOCK_LENGTHS],
    }),
  ];

  const external: AdminTrack[] = [
    stamp<Omit<AdminTrack, "id" | "createdAt" | "updatedAt">>({
      kind: "c-track", system: "external", label: "External C-track", dim: EXT_CTRACK_DIM,
      stockLengths: [...EXT_CTRACK_STOCK],
    }),
    stamp<Omit<AdminTrack, "id" | "createdAt" | "updatedAt">>({
      kind: "j-track", system: "external", label: "External J-track", dim: EXT_JTRACK_DIM,
      stockLengths: [...EXT_JTRACK_STOCK],
    }),
    stamp<Omit<AdminTrack, "id" | "createdAt" | "updatedAt">>({
      kind: "z-flash", system: "external", label: "Z-Flashing", dim: EXT_ZFLASH_DIM,
      stockLengths: [...EXT_STOCK],
    }),
    stamp<Omit<AdminTrack, "id" | "createdAt" | "updatedAt">>({
      kind: "horiz-cover", system: "external", label: "Horizontal external joint cover flashing", dim: EXT_HORIZ_COVER_DIM,
      stockLengths: [...EXT_STOCK],
    }),
  ];

  return [...perPanel, ...internalShared, ...external];
}

function seedFixings(): AdminFixing[] {
  return [
    stamp<Omit<AdminFixing, "id" | "createdAt" | "updatedAt">>({
      code: "10g-30", gauge: "10g", lengthMm: 30, use: "Perimeter / flashing", perBox: FIX_PER_BOX,
    }),
    stamp<Omit<AdminFixing, "id" | "createdAt" | "updatedAt">>({
      code: "10g-16", gauge: "10g", lengthMm: 16, use: "Panel-to-panel joints", perBox: FIX_PER_BOX,
    }),
  ];
}

function seedSealants(): AdminSealant[] {
  return [
    stamp<Omit<AdminSealant, "id" | "createdAt" | "updatedAt">>({
      system: "internal", product: "Hilti CP606", m2PerSausage: SEALANT_M2_PER_SAUSAGE, perBox: SEALANT_PER_BOX,
    }),
    stamp<Omit<AdminSealant, "id" | "createdAt" | "updatedAt">>({
      system: "external", product: "Sikaflex 400 Fire PU", m2PerSausage: EXT_SEALANT_M2, perBox: EXT_SEALANT_PER_BOX,
    }),
  ];
}

function seedColours(): AdminColour[] {
  return EXT_STOCKED_COLOURS.map(c => stamp<Omit<AdminColour, "id" | "createdAt" | "updatedAt">>({
    label: c.label, code: c.code, hex: COLOUR_HEX[c.code] ?? "#cccccc",
  }));
}

export function buildSeedCatalog(): ProductCatalog {
  seedCounter = 0;
  return {
    panels: seedPanels(),
    tracks: seedTracks(),
    fixings: seedFixings(),
    sealants: seedSealants(),
    colours: seedColours(),
  };
}
