// =============================================================================
// Connections summary (read-only)
// =============================================================================
// Phone-only "Connections" tab content -- a read-only summary of a wall's
// corner/shaft/junction partner links. Deliberately NOT the interactive
// CornerLinkSelector/ShaftLinkSelector/JunctionLinkSelector (wallsCard.tsx) --
// those stay in WallsCard, above the tabs, as the live editors; this is just
// a non-interactive view of the same underlying fields, so a wall's tabbed
// workspace has somewhere to show "what's this linked to" without duplicating
// an editable control inside a tab.
// =============================================================================
import { cx, MUTED } from "../styleTokens";
import { Row } from "./primitives";
import type { Wall } from "../estimate/wall.types";

export const ConnectionsSummary = ({ active, walls }: { active: Wall; walls: Wall[] }) => {
  const cornerPartner = active.cornerPartnerId != null ? walls.find(w => w.id === active.cornerPartnerId) : undefined;
  const shaftPartner = active.shaftPartnerId != null ? walls.find(w => w.id === active.shaftPartnerId) : undefined;
  const junctionPartner = active.junctionPartnerId != null ? walls.find(w => w.id === active.junctionPartnerId) : undefined;

  const rows: { k: string; v: string }[] = [];
  if (active.wallSystem === "corner") rows.push({ k: "Corner partner", v: cornerPartner ? cornerPartner.name : "Not linked" });
  if (active.wallSystem === "shaft") rows.push({ k: "Shaft partner", v: shaftPartner ? shaftPartner.name : "Not linked" });
  rows.push({ k: "Junction partner", v: junctionPartner ? junctionPartner.name : "Not linked" });

  return (
    <div className={cx.section}>
      {rows.map(r => <Row key={r.k} k={r.k} v={r.v} dim={r.v === "Not linked"} />)}
      {rows.every(r => r.v === "Not linked") && (
        <p className="mt-2 text-xs" style={{ color: MUTED }}>This wall isn't linked to any other wall yet.</p>
      )}
    </div>
  );
};
