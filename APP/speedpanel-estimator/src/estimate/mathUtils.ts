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

// Whole units needed to cover a quantity at a given unit size, 0 when
// there's nothing to buy -- the standard idiom throughout estimate/ for
// LM-to-pieces, count-to-packs, and count-to-boxes conversions alike.
export const ceilDiv0 = (qty: number, unitSize: number): number => (qty > 0 ? ceil(qty / unitSize) : 0);
