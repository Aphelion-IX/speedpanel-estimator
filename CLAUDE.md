# speedpanel-estimator

## Project basics

The app lives in `APP/speedpanel-estimator/`, not the repo root — run all
commands from there. Before considering any task complete:

```
npm run typecheck && npm test && npm run build
```

Stack: React 19 + Vite + TypeScript (strict) + Tailwind, backed by
Supabase (Postgres + Auth + Storage + Edge Functions). Authorization is
RLS-driven — `has_staff_role()`/`is_admin()` (see `supabase/schema.sql`)
gate almost everything server-side, not just client-side nav.

## Supabase auth / RLS rules

- Never disable RLS.
- Never expose the `service_role` key to the frontend.
- Never use a service-role client in frontend code.
- All privileged operations go through an Edge Function
  (`supabase/functions/`) or a `security definer` RPC gated by
  `has_staff_role()`/`is_admin()` — see `admin-invite-user` and
  `admin_promote_user_to_staff_by_email` for the existing pattern to follow.
- Preserve strict TypeScript (`tsconfig.json`: `strict`, `noUnusedLocals`,
  `noUnusedParameters` are all on).
- Preserve Zod validation on every Supabase row shape (existing convention
  throughout `src/pages/**/*.ts` stores).
- Run `npm run typecheck`, `npm test`, and `npm run build` before
  considering a task complete.

## Debugging an auth/RLS failure ("permission denied for table ...", etc.)

Do NOT bypass the failure by disabling RLS, weakening a policy, or reaching
for a service-role client in the frontend. Instead:

1. Reproduce the issue.
2. Trace the request: React component → hook → Supabase query →
   authenticated user → JWT claims → matching RLS policy.
3. Identify which of these is the actual cause: missing session, expired
   JWT, incorrect Supabase client, RLS policy, database function, Edge
   Function, frontend auth flow, or incorrect role assignment.
4. Explain the root cause.
5. Propose the smallest secure fix.
6. Implement it — if elevated access is genuinely needed, add or modify an
   Edge Function or security-definer RPC rather than bypassing RLS.
7. Run `npm run typecheck`, `npm test`, and `npm run build`.
8. Explain what changed and why it's still secure.
