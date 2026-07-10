// =============================================================================
// Admin: invite a new user
// =============================================================================
// This repo's first Edge Function -- the only place a service-role key is
// ever used, and it never leaves this server-side runtime (SUPABASE_URL/
// SUPABASE_SERVICE_ROLE_KEY are auto-provided by the Supabase platform to
// every deployed Edge Function, no manual secret configuration needed).
// Client callers only ever hold the anon key + their own session, exactly
// like every other Supabase call in this app (see src/lib/supabaseClient.ts).
//
// Two Supabase clients, two purposes:
// - `callerClient` (anon key + the caller's own Authorization header,
//   forwarded automatically by supabase.functions.invoke()) is used ONLY to
//   check is_admin() -- the exact same security-definer RPC
//   admin_list_users()/admin_set_role() already gate on (see
//   supabase/schema.sql), reused here rather than reimplemented.
// - `serviceClient` (service-role key) is used ONLY after that check passes,
//   to actually create the account and optionally promote its role.
//
// handle_new_user()'s existing trigger (supabase/schema.sql) auto-provisions
// the new user's `profiles` row (role: "user") the moment inviteUserByEmail
// creates their auth.users row -- no schema/trigger changes needed here.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["user", "admin"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { email?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = typeof body.role === "string" ? body.role : "user";
  if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (!VALID_ROLES.includes(role)) return json({ error: "Invalid role." }, 400);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Not authorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: isAdmin, error: authError } = await callerClient.rpc("is_admin");
  if (authError || !isAdmin) return json({ error: "Not authorized" }, 403);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email);
  if (error || !data.user) return json({ error: error?.message ?? "Could not invite user." }, 400);

  if (role === "admin") {
    const { error: roleError } = await serviceClient.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
    if (roleError) return json({ error: roleError.message }, 400);
  }

  return json({ id: data.user.id });
});
