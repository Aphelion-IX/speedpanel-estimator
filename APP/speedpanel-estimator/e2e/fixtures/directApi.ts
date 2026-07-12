import type { Page } from "@playwright/test";

// =============================================================================
// Direct Supabase REST/RPC calls, using the CURRENTLY SIGNED-IN session's own
// access token -- for "hidden UI control != security" checks (point 9 of the
// user's checklist). Never uses the service-role key. Reads the token straight
// out of the browser's own localStorage (wherever supabase-js stashed it),
// rather than assuming a specific storage-key format.
// =============================================================================
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://lxfsjntyxpaiqqkpxzlq.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_E7emICigq4iuyRgE_K7p4A_e6p8Yv-x";

export interface DirectApiResult { status: number; body: string; }

export async function directRest(page: Page, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<DirectApiResult> {
  return page.evaluate(
    async ({ path, init, baseUrl, anonKey }) => {
      const tokenKey = Object.keys(localStorage).find(k => k.includes("auth-token"));
      const token = tokenKey ? JSON.parse(localStorage.getItem(tokenKey)!)?.access_token : null;
      const res = await fetch(`${baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${token ?? anonKey}`,
          ...(init.headers ?? {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
      return { status: res.status, body: await res.text() };
    },
    { path, init, baseUrl: SUPABASE_URL, anonKey: ANON_KEY },
  );
}

export const directRpc = (page: Page, fn: string, args: Record<string, unknown> = {}) =>
  directRest(page, `/rest/v1/rpc/${fn}`, { method: "POST", body: args });

export const directTable = (page: Page, table: string, query = "") =>
  directRest(page, `/rest/v1/${table}${query ? `?${query}` : ""}`);

export const directEdgeFunction = (page: Page, slug: string, body: Record<string, unknown>) =>
  directRest(page, `/functions/v1/${slug}`, { method: "POST", body });
