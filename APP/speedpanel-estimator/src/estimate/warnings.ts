// =============================================================================
// Structured warnings
// =============================================================================
// The compute pipeline (computeWall.ts, cornerShaftKits.ts,
// calculateConnectionMaterials.ts) only ever produces plain warning strings
// (ComputeOut.warnings, CornerPairResult/ShaftPairResult.warnings,
// CombinedEstimate.connectionWarnings). The implementation spec's §8 wants a
// title/affected-wall/detail/acknowledgement shape. Rather than rewriting
// every warning-producing step to emit that shape natively (large, and not
// needed by anything except display), this is a thin classification wrapper:
// a lookup table over known warning phrasing, with an "Unspecified" fallback
// so no warning is ever silently dropped just because it doesn't match a
// known pattern.
// =============================================================================
export interface StructuredWarning {
  id: string;
  title: string;
  affected: string;
  detail: string;
  acknowledgeable: boolean;
  affectsReadiness: boolean;
}

const CLASSIFIERS: { title: string; test: RegExp }[] = [
  { title: "Horizontal span review", test: /span/i },
  { title: "Wall height limit", test: /height limit|exceeds.*(height|max)/i },
  { title: "Custom panel length", test: /custom length|custom panel/i },
  { title: "Waste above threshold", test: /waste/i },
  { title: "Custom external colour", test: /colour|color/i },
  { title: "External lead time", test: /lead time/i },
  { title: "Outside standard table", test: /outside the standard table|conservatively selected/i },
  { title: "Linked wall height mismatch", test: /different height|height.*mismatch/i },
];

function classify(detail: string): string {
  return CLASSIFIERS.find(c => c.test.test(detail))?.title ?? "Review required";
}

export function toStructuredWarnings(raw: string[], affected: string): StructuredWarning[] {
  return raw.map((detail, i) => ({
    id: `${affected}::${i}::${detail.slice(0, 40)}`,
    title: classify(detail),
    affected,
    detail,
    acknowledgeable: true,
    affectsReadiness: true,
  }));
}
