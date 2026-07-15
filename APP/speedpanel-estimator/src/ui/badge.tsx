// =============================================================================
// Badge
// =============================================================================
// Status pill driven by styleTokens.ts's tone() class map -- replaces the
// hand-typed Tailwind colour strings duplicated across companyTypes.ts,
// journeyStage.ts, requestTypes.ts, projectTypes.ts and orderTypes.ts.
// =============================================================================
import { tone, type StatusTone } from "../styleTokens";

export const Badge = ({ tone: t, children, className = "" }: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${tone(t)} ${className}`}>
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
    {children}
  </span>
);
