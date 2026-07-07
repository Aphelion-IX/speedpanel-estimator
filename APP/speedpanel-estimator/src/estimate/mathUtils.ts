// Tiny generic rounding/clamping helpers shared across the estimate/ module.
export const ceil = (x: number): number => Math.ceil(x - 1e-9);
export const r2 = (x: number): number => Math.round(x * 100) / 100;
export const r1 = (x: number): number => Math.round(x * 10) / 10;
export const r3 = (x: number): number => Math.round(x * 1000) / 1000;
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

// Parse a Wall field string (e.g. "3.2", "", undefined-as-"") to a number,
// defaulting to 0 -- the standard idiom for reading a Wall's numeric fields
// throughout estimate/.
export const numOr0 = (s: string): number => parseFloat(s) || 0;

// Linear metres -> whole pieces at a given stock length, 0 when there's
// nothing to buy -- the standard idiom for converting an LM total into an
// order quantity throughout estimate/.
export const piecesFromLM = (lm: number, stock: number): number => (lm > 0 ? ceil(lm / stock) : 0);
