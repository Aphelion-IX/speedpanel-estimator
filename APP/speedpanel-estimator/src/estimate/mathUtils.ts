// Tiny generic rounding/clamping helpers shared across the estimate/ module.
export const ceil = (x: number): number => Math.ceil(x - 1e-9);
export const r2 = (x: number): number => Math.round(x * 100) / 100;
export const r1 = (x: number): number => Math.round(x * 10) / 10;
export const r3 = (x: number): number => Math.round(x * 1000) / 1000;
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
