// Tiny rounding helpers shared across the estimate/ module. Mirrors the
// equivalent local helpers in App.tsx (kept separate so this module has no
// import dependency on App.tsx).
export const ceil = (x: number): number => Math.ceil(x - 1e-9);
export const r2 = (x: number): number => Math.round(x * 100) / 100;
