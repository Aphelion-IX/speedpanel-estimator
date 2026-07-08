// =============================================================================
// Editable estimate math constants
// =============================================================================
// Single source of truth for the "system constants" block of src/data.ts
// (internal + external waste thresholds, stock lengths, pack sizes, span/
// height/width caps, sealant rates). data.ts reads these once at module load
// via loadMathConstants(), so every existing `import { X } from "./data"` in
// src/estimate/* keeps working unchanged -- this file only decides what value
// X starts out as.
//
// Overrides are staged in localStorage by the Admin > Maths page. Unlike the
// other admin pages (Products/Systems/Documents/Requests), which are
// decoupled preview-only staging areas, these overrides are meant to actually
// change calculator output -- see AdminMathsPage.tsx for why that requires a
// reload rather than live React state.
// =============================================================================

export interface MathConstants {
  PANEL_WIDTH: number;
  STOCK_WASTE_THRESHOLD: number;
  STOCK_LENGTHS: number[];
  FLASH_STOCK: number;
  FIX_PER_BOX: number;
  HORIZ_CTRACK_STOCK: number;
  JTRACK_STOCK: number[];
  SEALANT_M2_PER_SAUSAGE: number;
  SEALANT_PER_BOX: number;
  MAX_W_HORIZ: number;
  MAX_W_HORIZ_STD_51_64: number;
  MAX_W_HORIZ_STACK_78: number;
  STEEL_MAX_H_VERT: number;
  CUSTOM_MAX_LENGTH: number;
  SHAFT_MAX_W: number;
  SHAFT_MAX_F: number;
  EXT_STOCK: number[];
  EXT_PACK: number;
  EXT_SEALANT_M2: number;
  EXT_SEALANT_PER_BOX: number;
  EXT_ZFLASH_STOCK: number;
  EXT_JTRACK_STOCK: number[];
  EXT_CTRACK_STOCK: number[];
  EXT_MAX_H_VERT: number;
  EXT_MAX_W_HORIZ: number;
  EXT_MAX_W_HORIZ_STACK: number;
}

export const MATH_CONSTANT_DEFAULTS: MathConstants = {
  PANEL_WIDTH: 0.25,
  STOCK_WASTE_THRESHOLD: 0.20,
  STOCK_LENGTHS: [2.8, 3.0, 3.3, 3.6, 4.0, 4.2, 4.5, 4.8, 5.2, 6.0],
  FLASH_STOCK: 3.0,
  FIX_PER_BOX: 1000,
  HORIZ_CTRACK_STOCK: 6.0,
  JTRACK_STOCK: [6.0, 3.6, 3.0],
  SEALANT_M2_PER_SAUSAGE: 4,
  SEALANT_PER_BOX: 20,
  MAX_W_HORIZ: 4.5,
  MAX_W_HORIZ_STD_51_64: 4.0,
  MAX_W_HORIZ_STACK_78: 5.0,
  STEEL_MAX_H_VERT: 14.0,
  CUSTOM_MAX_LENGTH: 9.0,
  SHAFT_MAX_W: 5.0,
  SHAFT_MAX_F: 6.0,
  EXT_STOCK: [3.0, 3.6, 4.2, 4.5, 5.0, 6.0],
  EXT_PACK: 14,
  EXT_SEALANT_M2: 2,
  EXT_SEALANT_PER_BOX: 20,
  EXT_ZFLASH_STOCK: 3.0,
  EXT_JTRACK_STOCK: [3.0, 3.6, 6.0],
  EXT_CTRACK_STOCK: [3.0, 3.6, 6.0],
  EXT_MAX_H_VERT: 6.0,
  EXT_MAX_W_HORIZ: 4.5,
  EXT_MAX_W_HORIZ_STACK: 5.0,
};

type FieldKind = "number" | "number[]";

export interface MathConstantField {
  key: keyof MathConstants;
  label: string;
  kind: FieldKind;
  group: "internal" | "external";
  helpText: string;
}

export const MATH_CONSTANT_FIELDS: MathConstantField[] = [
  { key: "PANEL_WIDTH", label: "Panel width (m)", kind: "number", group: "internal", helpText: "Fixed panel width used to derive panels-per-row across every wall." },
  { key: "STOCK_WASTE_THRESHOLD", label: "Stock waste threshold", kind: "number", group: "internal", helpText: "Fraction (0-1) of allowable offcut waste when bin-packing internal panels onto stock lengths." },
  { key: "STOCK_LENGTHS", label: "Internal panel stock lengths (m)", kind: "number[]", group: "internal", helpText: "Order matters -- the last value is treated as the longest available stock length." },
  { key: "FLASH_STOCK", label: "Head-flashing stock length (m)", kind: "number", group: "internal", helpText: "Stock length used to convert head-flashing linear metres into pieces." },
  { key: "FIX_PER_BOX", label: "Fixings per box", kind: "number", group: "internal", helpText: "Screws per box used to convert fixing counts into boxes to order." },
  { key: "HORIZ_CTRACK_STOCK", label: "Horizontal C-track stock length (m)", kind: "number", group: "internal", helpText: "Stock length for horizontal C-track / corner-post / shaft-junction pieces." },
  { key: "JTRACK_STOCK", label: "Internal J-track stock lengths (m)", kind: "number[]", group: "internal", helpText: "Order matters -- the first value is the stock length used to convert J-track linear metres into pieces." },
  { key: "SEALANT_M2_PER_SAUSAGE", label: "Internal sealant coverage (m2/sausage)", kind: "number", group: "internal", helpText: "Coverage rate per sealant sausage for internal walls." },
  { key: "SEALANT_PER_BOX", label: "Internal sealant sausages per box", kind: "number", group: "internal", helpText: "Sausages per box used to convert sealant counts into boxes to order." },
  { key: "MAX_W_HORIZ", label: "Max horizontal span width (m)", kind: "number", group: "internal", helpText: "Ceiling used by the internal horizontal span table." },
  { key: "MAX_W_HORIZ_STD_51_64", label: "Max horizontal span width, P51/P64 extended range (m)", kind: "number", group: "internal", helpText: "Breakpoint for the P51/P64 extended horizontal-span range." },
  { key: "MAX_W_HORIZ_STACK_78", label: "Max horizontal span width, P78 stacked (m)", kind: "number", group: "internal", helpText: "Width ceiling for stacked/shaft P78 walls." },
  { key: "STEEL_MAX_H_VERT", label: "Steel structure max vertical height (m)", kind: "number", group: "internal", helpText: "Vertical height cap for steel-structure walls." },
  { key: "CUSTOM_MAX_LENGTH", label: "Custom cut max length (m)", kind: "number", group: "internal", helpText: "Absolute longest length that can be cut as a custom piece." },
  { key: "SHAFT_MAX_W", label: "Shaft wall max width (m)", kind: "number", group: "internal", helpText: "Widest a single shaft-wall stack can be." },
  { key: "SHAFT_MAX_F", label: "Shaft wall max floor height (m)", kind: "number", group: "internal", helpText: "Per-floor height limit for shaft walls." },
  { key: "EXT_STOCK", label: "External panel stock lengths (m)", kind: "number[]", group: "external", helpText: "Order matters -- the last value is treated as the longest available stock length." },
  { key: "EXT_PACK", label: "External pack size", kind: "number", group: "external", helpText: "Panels per pack for external walls." },
  { key: "EXT_SEALANT_M2", label: "External sealant coverage (m2/sausage)", kind: "number", group: "external", helpText: "Coverage rate per sealant sausage for external walls." },
  { key: "EXT_SEALANT_PER_BOX", label: "External sealant sausages per box", kind: "number", group: "external", helpText: "Sausages per box used to convert external sealant counts into boxes to order." },
  { key: "EXT_ZFLASH_STOCK", label: "External Z-flashing stock length (m)", kind: "number", group: "external", helpText: "Stock length used to convert Z-flashing linear metres into pieces." },
  { key: "EXT_JTRACK_STOCK", label: "External J-track stock lengths (m)", kind: "number[]", group: "external", helpText: "Order matters -- the first value is the stock length used to convert J-track linear metres into pieces." },
  { key: "EXT_CTRACK_STOCK", label: "External C-track stock lengths (m)", kind: "number[]", group: "external", helpText: "Order matters -- the first value is the stock length used to convert C-track linear metres into pieces." },
  { key: "EXT_MAX_H_VERT", label: "External max vertical height (m)", kind: "number", group: "external", helpText: "Vertical height cap for external walls." },
  { key: "EXT_MAX_W_HORIZ", label: "External max horizontal span width (m)", kind: "number", group: "external", helpText: "Ceiling used by the external horizontal span table." },
  { key: "EXT_MAX_W_HORIZ_STACK", label: "External max horizontal span width, stacked (m)", kind: "number", group: "external", helpText: "Width ceiling for stacked external walls." },
];

const STORAGE_KEY = "speedpanel:mathConstants";

interface PersistedMathConstants { v: number; values: Partial<MathConstants>; }

export function loadMathConstants(): MathConstants {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as PersistedMathConstants;
        if (p && p.v === 1 && p.values && typeof p.values === "object") {
          return { ...MATH_CONSTANT_DEFAULTS, ...p.values };
        }
      }
    } catch { /* ignore parse/access errors, fall through to defaults */ }
  }
  return MATH_CONSTANT_DEFAULTS;
}

export function saveMathConstants(values: MathConstants): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedMathConstants = { v: 1, values };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { /* ignore quota/serialization errors */ }
}
