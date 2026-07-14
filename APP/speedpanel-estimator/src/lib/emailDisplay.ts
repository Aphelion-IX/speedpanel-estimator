// No display-name field exists anywhere in this app (profiles only carries
// role/staff_role) -- these are the pragmatic email-derived fallbacks shared
// by AuthStatus.tsx's avatar/label and the workspace page's "Welcome back"
// heading.

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._-]+/).filter(Boolean);
  return words.length ? words.map(w => w[0].toUpperCase() + w.slice(1)).join(" ") : "there";
}

export function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const initials = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return (initials || "?").toUpperCase();
}
