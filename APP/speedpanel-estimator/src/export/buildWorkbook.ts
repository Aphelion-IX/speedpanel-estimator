// =============================================================================
// buildWorkbook
// =============================================================================
// Pure function: EstimateReportData -> XLSX workbook. No React, no DOM --
// framework-agnostic and independently testable, same convention as
// calculateCombinedEstimate.ts. The actual "download the file" side effect
// lives in ./exportEstimateToExcel.ts.
//
// xlsx is dynamically imported (not a top-level `import * as XLSX`) so it
// isn't bundled into the initial page load -- it's only needed once someone
// actually clicks Export, same "fetch the heavy dependency on first use"
// approach as src/education/pdfjsLoader.ts's pdfjs-dist loading.
//
// Sheet list checked against the implementation spec's §7.31
// exportProjectOrderExcel minimum set (Project Summary, Wall Schedule,
// Panel Order, Tracks and Flashings, Connections, Fixings and Sealants,
// Special and Custom Items, Warnings and Notes) -- Summary/Walls/Panel
// Schedule/Track & Flashing/Fixings & Sealant are always present;
// Connections/Special & Custom Items/Warnings & Notes are added only when
// there's real data for them (an empty sheet is worse than no sheet).
// =============================================================================
import type * as XLSXType from "xlsx";
import type { EstimateReportData } from "./reportTypes";

function autoWidth(rows: (string | number)[][]): { wch: number }[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = String(cell ?? "").length;
      widths[i] = Math.max(widths[i] || 8, Math.min(len + 2, 60));
    });
  }
  return widths.map(wch => ({ wch }));
}

function sheetFromRows(XLSX: typeof XLSXType, header: string[], rows: (string | number)[][]): XLSXType.WorkSheet {
  const aoa = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = autoWidth(aoa);
  // Keep the header row visible while scrolling -- the free (community)
  // xlsx package drops cell fill/font styling on write, so this (plus
  // column widths above) is the readability aid actually available to us.
  ws["!views"] = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

export async function buildWorkbook(data: EstimateReportData): Promise<XLSXType.WorkBook> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // --- Summary ---------------------------------------------------------------
  const summaryRows: (string | number)[][] = [
    ["Report", "Speedpanel material estimate"],
    ["System", data.systemLabel],
    ["Generated", data.generatedAt.toLocaleString()],
    ["", ""],
    ["Total area (m2)", data.totals.area],
    ["Total panels", data.totals.panels],
  ];
  if (data.totals.packs != null) summaryRows.push(["Total packs", data.totals.packs]);
  if (data.totals.wastePct != null) summaryRows.push(["Wastage (order) %", Math.round(data.totals.wastePct * 10) / 10]);
  if (data.warnings.length > 0) {
    summaryRows.push(["", ""], ["Warnings", ""]);
    for (const w of data.warnings) summaryRows.push(["", w]);
  }
  if (data.notes.length > 0) {
    summaryRows.push(["", ""], ["Notes", ""]);
    for (const n of data.notes) summaryRows.push(["", n]);
  }
  summaryRows.push(
    ["", ""],
    ["Disclaimer", "Quantities are estimates only. Does not confirm compliance, FRL, engineering, restraint, certification or approval."],
  );
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs["!cols"] = autoWidth(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // --- Walls -------------------------------------------------------------------
  const hasSystemCol = data.walls.some(w => w.system);
  const wallHeader = ["Wall", "Orientation", ...(hasSystemCol ? ["Wall system"] : []), "Panel type", "Width", "Height", "Area", "Panels", "Warning"];
  const wallRows = data.walls.map(w => [
    w.name,
    w.orientation === "vertical" ? "Vertical" : "Horizontal",
    ...(hasSystemCol ? [w.system || "--"] : []),
    w.panelType, w.width, w.height, w.area, w.panels, w.warning ? "Yes" : "",
  ]);
  XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, wallHeader, wallRows), "Walls");

  // --- Panel schedule (standard/stocked order only -- spec §7.31's "Panel
  // Order" sheet; custom-length panels get their own "Special & Custom
  // Items" sheet below, matching the spec's minimum sheet list) ------------
  const panelHeader = ["Length", "Status", "Required", "Pack size", "Packs", "Ordered", "Spare"];
  const panelRows = data.panelGroups.map(g => [
    g.label, g.status, g.required, g.packSize, g.packs, g.ordered, g.spare,
  ]);
  if (panelRows.length === 0) panelRows.push(["No panels", "", 0, 0, 0, 0, 0]);
  XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, panelHeader, panelRows), "Panel Schedule");

  // --- Track & flashing ----------------------------------------------------------
  const trackHeader = ["Item", "Pieces", "Length (m)", "Stock"];
  const trackRows = data.trackLines.map(t => [t.label, t.pieces, t.lengthM, t.stockLabel]);
  if (trackRows.length === 0) trackRows.push(["No track/flashing", 0, 0, ""]);
  XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, trackHeader, trackRows), "Track & Flashing");

  // --- Fixings & sealant -----------------------------------------------------------
  const f = data.fixings;
  const fixHeader = ["Item", "Quantity"];
  const fixRows: (string | number)[][] = [
    ["10g 30mm SDS - boxes", f.boxes30],
    ["10g 30mm SDS - qty required", f.fix30],
    ["10g 16mm SDS - boxes", f.boxes16],
    ["10g 16mm SDS - qty required", f.fix16],
    [`${f.sealantLabel} - boxes`, f.sealantBoxes],
    [`${f.sealantLabel} - sausages`, f.sausages],
    ["Area (m2)", f.area],
    ["Structure fixings (base track)", "By others / engineer"],
  ];
  for (const extra of f.extraLines || []) fixRows.push([extra.label, extra.value]);
  XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, fixHeader, fixRows), "Fixings & Sealant");

  // --- Connections (project mode only, when present) ------------------------------
  if (data.connections.length > 0) {
    const connHeader = ["Wall A", "Wall B", "Length (m)", "Quantity", "Stock (m)", "Pieces", "Reason", "Warnings"];
    const connRows = data.connections.map(c => [
      c.wallA, c.wallB, c.lengthM, c.quantity, c.stock, c.pieces, c.reason, c.warnings.join(" | "),
    ]);
    XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, connHeader, connRows), "Connections");
  }

  // --- Special & custom items (spec §7.31's minimum sheet list -- only
  // when present, same "don't add a sheet with nothing in it" convention
  // Connections above already uses) ------------------------------------------
  if (data.customPanels.length > 0) {
    const customHeader = ["Length", "Status", "Required", "Pack size", "Packs", "Ordered", "Spare"];
    const customRows = data.customPanels.map(g => [g.label, g.status, g.required, g.packSize, g.packs, g.ordered, g.spare]);
    XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, customHeader, customRows), "Special & Custom Items");
  }

  // --- Warnings & notes (spec §7.31's minimum sheet list -- the Summary
  // sheet above already inlines these for a quick read, this is the
  // dedicated, easier-to-scan sheet the spec asks for) -----------------------
  if (data.warnings.length > 0 || data.notes.length > 0) {
    const noteHeader = ["Type", "Detail"];
    const noteRows: (string | number)[][] = [
      ...data.warnings.map(w => ["Warning", w]),
      ...data.notes.map(n => ["Note", n]),
    ];
    XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, noteHeader, noteRows), "Warnings & Notes");
  }

  return wb;
}
