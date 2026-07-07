// =============================================================================
// System Selector -- wall system catalog
// =============================================================================
// Pure data: the catalog of basic + application-specific wall systems shown
// by SystemSelector. No React/JSX here -- see WallSystemOptionCard.tsx for
// how each entry is rendered.
// =============================================================================
import {
  RectangleHorizontal, CornerDownRight, Building2, Shield, RectangleVertical,
  CloudRain, Warehouse, Clapperboard, DoorOpen, Building, SquareParking, Wrench, LayoutPanelLeft,
} from "lucide-react";
import type { WallSystemId } from "../App";

export type WallSystemOptionId =
  | "single" | "corner" | "shaft" | "ext-horiz"
  | "external-app" | "separation" | "cinema" | "shaft-app" | "stair" | "intertenancy"
  | "car-park" | "plant-room" | "facade" | "scissor-horiz" | "scissor-vert";

export interface WallSystemOption {
  id: WallSystemOptionId;
  group: "basic" | "application";
  title: string;
  description: string;
  note: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  // One of SYSTEMS[].id -- for future wiring + selected-state matching. Left undefined
  // for application cards that don't correspond to one single engineering configuration
  // (e.g. Separation/Cinema/Car Park walls can be built either horizontal or vertical
  // per the product literature) -- those cards never show as "selected" and are
  // descriptive-only until a real mapping is decided.
  system?: string;
  wallSystem?: WallSystemId;  // only set for the horizontal-Internal cards
}

export const WALL_SYSTEM_OPTIONS: WallSystemOption[] = [
  { id: "single", group: "basic", title: "Single Wall",
    description: "Straight wall section — horizontal or vertical panel installation.",
    note: "Use this when estimating one continuous wall run, in either orientation.",
    icon: RectangleHorizontal, system: "int-horiz", wallSystem: "standard" },
  { id: "corner", group: "basic", title: "Corner Wall",
    description: "Two wall runs meeting at a corner",
    note: "Use this when estimating internal or external corners.",
    icon: CornerDownRight, system: "int-horiz", wallSystem: "corner" },
  { id: "shaft", group: "basic", title: "Shaft Wall",
    description: "Shaft, stair or lift enclosure walls.",
    note: "Use this when wall runs are broken into sections.",
    icon: Building2, system: "int-horiz", wallSystem: "shaft" },
  { id: "ext-horiz", group: "basic", title: "External Wall",
    description: "External wall system — horizontal or vertical panel installation, with weather-facing finish.",
    note: "Use this for weather-facing applications, in either orientation.",
    icon: Shield, system: "ext-horiz" },

  // --- Application-specific systems ---------------------------------------------
  // Broader use-case catalog from the product literature. Several of these describe
  // the same underlying engineering config as a card above (e.g. External Wall System
  // ~ External Wall, Shaft Wall System ~ Shaft Wall) under different naming -- kept as
  // separate cards per product request rather than deduped/replaced. "Shafts & Risers"
  // was merged into "Shaft Wall System" (both describe the same shaft application).
  { id: "external-app", group: "application", title: "External Wall System",
    description: "External walls, boundary walls, weather-facing walls.",
    note: "Use this for boundary or weather-facing external wall applications.",
    icon: CloudRain, system: "ext-horiz" },
  { id: "separation", group: "application", title: "Separation Wall System",
    description: "Factory, warehouse, fire and acoustic separation walls.",
    note: "Use this for factory or warehouse fire and acoustic separation." ,
    icon: Warehouse },
  { id: "cinema", group: "application", title: "Cinema Wall System",
    description: "High acoustic / fire-rated cinema partition walls.",
    note: "Use this for high acoustic or fire-rated cinema partitions.",
    icon: Clapperboard },
  { id: "shaft-app", group: "application", title: "Shaft Wall System",
    description: "Lift shafts, service shafts, open cores, multi-level shaft divisions, risers.",
    note: "Use this for lift/service shafts, open cores or riser divisions.",
    icon: Building2, system: "int-horiz", wallSystem: "shaft" },
  { id: "stair", group: "application", title: "Stair Wall System",
    description: "Fire stair walls, stairwell separation walls.",
    note: "Use this for fire stair or stairwell separation walls.",
    icon: DoorOpen },
  { id: "intertenancy", group: "application", title: "Intertenancy & Corridor System",
    description: "Apartments, corridors, plasterboard-lined fire/acoustic walls.",
    note: "Use this for apartment, corridor or plasterboard-lined fire/acoustic walls.",
    icon: Building },
  { id: "car-park", group: "application", title: "Car Park System",
    description: "Car park fire/security walls, blockwork alternative, impact areas.",
    note: "Use this for car park fire/security walls or impact areas.",
    icon: SquareParking },
  { id: "plant-room", group: "application", title: "Plant Room System",
    description: "Plant rooms, service rooms, walls with penetrations/apertures.",
    note: "Use this for plant/service rooms or walls needing penetrations.",
    icon: Wrench },
  { id: "facade", group: "application", title: "Façade System",
    description: "External façade/boundary wall applications with pre-finished panel face.",
    note: "Use this for pre-finished external façade or boundary applications.",
    icon: LayoutPanelLeft, system: "ext-horiz" },
  { id: "scissor-horiz", group: "application", title: "Scissor Stair System — Horizontal Orientation",
    description: "78mm horizontal panels fixed to stair stringers.",
    note: "Use this for horizontal scissor-stair installations.",
    icon: RectangleHorizontal, system: "int-horiz", wallSystem: "standard" },
  { id: "scissor-vert", group: "application", title: "Scissor Stair System — Vertical Orientation",
    description: "78mm vertical panels between landings.",
    note: "Use this for vertical scissor-stair installations between landings.",
    icon: RectangleVertical, system: "int-vert" },
];
