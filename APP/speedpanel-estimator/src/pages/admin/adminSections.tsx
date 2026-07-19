// =============================================================================
// Admin section catalog -- shared data, no page components
// =============================================================================
// Trimmed down to the sections that still have a real backing table after
// the calculator-only schema rebuild (see supabase/schema.sql) -- Workflow
// (Requests/Project Reviews/Orders/Delivery Requests/Manufacturing), People
// (Users/Companies/Roles) and Reports (Analytics/Audit Log) all pointed at
// tables that no longer exist, same for Price Lists within Catalog. Their
// AdminSubPage routes/pages still exist (AdminRoot.tsx keeps routing to
// them for anyone who still has an old bookmark/direct link) -- they're
// just no longer advertised as a tile here, since a tile that opens an
// empty/error page is worse than no tile.
// =============================================================================
import { Package, Layers, Calculator, FileText } from "lucide-react";
import type { AdminSubPage } from "../../appShell/useHashRoute";

export type AdminSection = { key: AdminSubPage; label: string; description: string; icon: React.ReactNode };

export const ADMIN_GROUPS: { heading: string; items: AdminSection[] }[] = [
  {
    heading: "Catalog",
    items: [
      { key: "products",  label: "Products",  description: "Panel, track, fixing, sealant and colour product data.",   icon: <Package size={16} /> },
      { key: "systems",   label: "Systems",   description: "Locked system reference data (Internal/External).", icon: <Layers size={16} /> },
      { key: "maths",     label: "Maths",     description: "Estimate calculation constants (waste, stock lengths, spans).", icon: <Calculator size={16} /> },
      { key: "documents", label: "Documents", description: "Education Hub document library.",          icon: <FileText size={16} /> },
    ],
  },
];
