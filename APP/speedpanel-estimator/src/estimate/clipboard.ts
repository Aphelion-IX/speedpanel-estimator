// =============================================================================
// Clipboard copy with fallback
// =============================================================================
// Same navigator.clipboard.writeText + execCommand('copy')/hidden-textarea
// fallback pattern as the v5 mockups' own copy-summary script -- the one
// side-effecting call, kept separate from ./copyOrderSummary.ts's pure text
// builder (same split exportEstimateToExcel.ts already keeps between report-
// data building and the one XLSX-writing side effect).
// =============================================================================
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path below
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
