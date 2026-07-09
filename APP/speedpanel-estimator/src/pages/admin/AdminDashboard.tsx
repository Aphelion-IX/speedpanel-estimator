import { Package, Layers, Calculator, FileText, ClipboardList, FolderCheck, Users, BarChart3, History } from "lucide-react";
import { cx, BLUE, NAVY } from "../../styleTokens";
import { PlaceholderPage } from "../PlaceholderPage";
import { BackendStatusCard } from "./BackendStatusCard";
import type { AdminSubPage } from "../../appShell/useHashRoute";

const ADMIN_SECTIONS: { key: AdminSubPage; label: string; description: string; icon: React.ReactNode }[] = [
  { key: "products",  label: "Products",  description: "Panel, track and fixing product data.",   icon: <Package size={16} /> },
  { key: "systems",   label: "Systems",   description: "Wall system definitions and spans.",       icon: <Layers size={16} /> },
  { key: "maths",     label: "Maths",     description: "Estimate calculation constants (waste, stock lengths, spans).", icon: <Calculator size={16} /> },
  { key: "documents", label: "Documents", description: "Education Hub document library.",          icon: <FileText size={16} /> },
  { key: "requests",  label: "Requests",  description: "Incoming quote and project requests.",     icon: <ClipboardList size={16} /> },
  { key: "projectReviews", label: "Project Reviews", description: "Saved projects awaiting an install or technical review.", icon: <FolderCheck size={16} /> },
  { key: "users",     label: "Users",     description: "Signed-up accounts and admin role management.", icon: <Users size={16} /> },
  { key: "analytics", label: "Analytics", description: "Counts across requests, projects, catalog and users.", icon: <BarChart3 size={16} /> },
  { key: "auditLog",  label: "Audit Log", description: "Install/technical review history.",        icon: <History size={16} /> },
];

export const AdminDashboard = ({ onNavigate }: { onNavigate: (sub: AdminSubPage) => void }) => (
  <PlaceholderPage
    title="Admin Dashboard"
    description="Control room for Speedpanel admin tools."
  >
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ADMIN_SECTIONS.map(section => (
        <button
          key={section.key}
          onClick={() => onNavigate(section.key)}
          className={`${cx.card} text-left transition-shadow hover:shadow-md`}
        >
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
            <span style={{ color: BLUE }}>{section.icon}</span>{section.label}
          </div>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
        </button>
      ))}
    </div>
    <BackendStatusCard />
  </PlaceholderPage>
);
