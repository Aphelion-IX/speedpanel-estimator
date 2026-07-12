---
name: vercel-optimize
description: Use for Vercel cost and performance optimization on deployed projects (Next.js, SvelteKit, Nuxt, limited Astro) — reducing the Vercel bill, investigating slow/expensive routes, caching opportunities, Function Invocations, Build Minutes, Fast Data Transfer, Core Web Vitals, or Fluid compute. This is a pointer, not the full skill — see below.
metadata:
  author: vercel
  upstream_version: "1.2.0"
  source: https://github.com/vercel-labs/agent-skills/tree/main/skills/vercel-optimize
---

# Vercel Optimize (pointer)

This skill is **not vendored in full** here. Upstream, `vercel-optimize` is a multi-stage
observability-first audit pipeline: a dozen+ interdependent Node scripts
(`scripts/collect-signals.mjs`, `gate-investigations.mjs`, `deep-dive.mjs`,
`verify-and-regen.mjs`, `render-report.mjs`, …), a shared metrics query library
(`lib/queries.mjs`), and several reference docs (`references/doctrine.md`,
`data-collection.md`, `recommendations.md`, `verification.md`, `scanner-patterns.md`,
`scoring.md`, `voice.md`, `observability-plus.md`, `candidates.md`). It also requires:

- Vercel CLI **v53+** with `vercel metrics` / `vercel usage` / `vercel contract` / `vercel api`
- An authenticated, linked project (`vercel login`, `vercel link`)
- Node.js 20+
- **Observability Plus** (paid add-on) for route-level metric-backed recommendations

Hand-copying that script tree into this repo would go stale silently (scripts reference each
other by relative path and by exact upstream version) and isn't worth it compared to installing
it directly.

## When to use

- The user wants to reduce their Vercel bill, find slow/expensive routes, or audit caching,
  Function Invocations, Build Minutes, Fast Data Transfer, or Core Web Vitals on a **deployed**
  Vercel project.

## How to actually run it

Install the real skill from upstream, then let the agent load it normally:

```bash
npx skills add vercel-labs/agent-skills --skill vercel-optimize
```

Prerequisites before running it: Vercel CLI v53+, `vercel login`, `vercel link` in the target
project, Node 20+, and Observability Plus enabled on the project being audited.

## Notes

- If the upstream skill's version drifts significantly from `metadata.upstream_version` above,
  re-check the source link for what changed before relying on this pointer's description.
