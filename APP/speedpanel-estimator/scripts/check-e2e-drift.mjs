// =============================================================================
// E2E/pgTAP drift check -- advisory, never blocking
// =============================================================================
// Warns (as a GitHub Actions ::warning:: annotation, not a failure) when a PR
// touches an auth/admin UI file without touching the e2e specs or pgTAP
// tests that assert against it. Exists because exactly this silently broke
// once already: the signed-out UI was redesigned (SignInGate.tsx ->
// LandingPage.tsx, "Sign in" -> "Log in") while e2e/fixtures/auth.ts kept
// asserting the old selectors, and nobody noticed for a long time because
// the whole suite never actually ran (see .github/workflows/ci.yml's e2e
// job history and issue #129). Now that e2e is self-contained and does run,
// this is a cheap early nudge in the PR itself rather than relying on
// someone remembering to grep for stale selectors by hand.
//
// Deliberately advisory, not a gate: while an area (e.g. the admin section)
// is under active rewrite, its tests are *expected* to lag for a few
// commits -- see #129 -- so this only ever warns, exit code 0 always.
// =============================================================================
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const APP_DIR = "APP/speedpanel-estimator/";

// Add a rule whenever a new "UI surface <-> its own test coverage" pairing
// is worth protecting. `source`/`tests` entries match a changed file by
// exact path or by prefix (so a directory entry like "e2e/roles/" covers
// every file under it).
const RULES = [
  {
    label: "Sign-in / signed-out UI",
    source: ["src/appShell/AuthStatus.tsx", "src/pages/home/LandingPage.tsx", "src/pages/projects/SignInGate.tsx"],
    tests: ["e2e/fixtures/auth.ts"],
  },
  {
    label: "Admin dashboard / nav / section access",
    source: [
      "src/pages/admin/AdminDashboard.tsx",
      "src/pages/admin/adminSections.tsx",
      "src/pages/admin/adminSectionAccess.ts",
      "src/pages/admin/AdminRoot.tsx",
      "src/pages/admin/AdminGate.tsx",
    ],
    tests: ["e2e/scoped-queue.spec.ts", "e2e/roles/", "e2e/session.spec.ts"],
  },
  {
    label: "Company Accounts & Pricing admin area",
    source: ["src/pages/accounts/"],
    tests: ["e2e/", "supabase/tests/database/08_", "supabase/tests/database/09_", "supabase/tests/database/10_", "supabase/tests/database/11_"],
  },
  {
    label: "Schema/RLS surface",
    source: ["supabase/schema.sql", "supabase/seed.sql"],
    tests: ["supabase/tests/database/"],
  },
];

function diffFiles(base, head) {
  const out = execFileSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" });
  return out.split("\n").map(l => l.trim()).filter(Boolean);
}

// git diff paths are always repo-root-relative regardless of cwd -- strip
// the app subdir prefix so RULES can stay written relative to it (matching
// every other path in this repo's own docs/comments). Anything outside
// APP/speedpanel-estimator/ (workflow files, root CLAUDE.md, ...) is
// intentionally out of scope for this check.
function stripAppDir(path) {
  return path.startsWith(APP_DIR) ? path.slice(APP_DIR.length) : null;
}

function matchesAny(path, patterns) {
  return patterns.some(p => path === p || path.startsWith(p));
}

const [base, head] = process.argv.slice(2);
if (!base || !head) {
  console.error("Usage: check-e2e-drift.mjs <base-sha> <head-sha>");
  process.exit(0); // advisory tool -- a bad invocation shouldn't fail a build
}

let changed;
try {
  changed = diffFiles(base, head).map(stripAppDir).filter(Boolean);
} catch (err) {
  console.error(`check-e2e-drift: could not diff ${base}...${head} (${err.message}) -- skipping.`);
  process.exit(0);
}

const warnings = RULES
  .map(rule => ({ rule, files: changed.filter(f => matchesAny(f, rule.source)) }))
  .filter(({ files }) => files.length > 0)
  .filter(({ rule }) => !changed.some(f => matchesAny(f, rule.tests)));

if (warnings.length === 0) {
  console.log("check-e2e-drift: no drift risk detected.");
  process.exit(0);
}

for (const { rule, files } of warnings) {
  console.log(
    `::warning::"${rule.label}" changed (${files.join(", ")}) without touching its usual test coverage ` +
    `(${rule.tests.join(", ")}). If behaviour changed, the tests likely need updating too -- ` +
    `see e2e/README.md and issue #129 for the last time this drifted silently.`
  );
}

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  const lines = [
    "### ⚠️ E2E/pgTAP drift check",
    "",
    "These changed without their usual test coverage also changing in the same PR. Not blocking -- just a nudge (see `e2e/README.md`).",
    "",
    "| Area | Changed files | Expected coverage |",
    "|---|---|---|",
    ...warnings.map(({ rule, files }) => `| ${rule.label} | ${files.join("<br>")} | ${rule.tests.join(", ")} |`),
    "",
  ];
  appendFileSync(summaryPath, lines.join("\n"));
}
