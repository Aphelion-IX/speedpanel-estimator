// =============================================================================
// Auth verification for serverless routes
// =============================================================================
// Every route that requires a signed-in caller does: verifyRequest(req) ->
// getOrCreateProfile(userId) -> its own owner/admin check -> query. This
// replaces Supabase's auth.uid()/RLS -- the browser never talks to Postgres
// directly anymore, so authorization lives here in code instead.
//
// NEON_AUTH_JWKS_URL/NEON_AUTH_ISSUER: placeholder env var names. Neon Auth's
// exact JWKS endpoint/issuer weren't confirmed against the live project at
// the time this was written (this sandbox has no network path to Neon's
// docs or console) -- fill these in from the project's actual Auth setup
// page before deploying, and adjust jwtVerify's options below if the
// provisioned flavor (Better Auth vs Stack Auth) expects a different claim
// for the user id than `sub`.
// =============================================================================
import { createRemoteJWKSet, jwtVerify } from "jose";
import { sql } from "./db";

const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
const issuer = process.env.NEON_AUTH_ISSUER;

const jwks = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null;

export interface VerifiedCaller {
  userId: string;
}

export async function verifyRequest(authHeader: string | undefined | null): Promise<VerifiedCaller | null> {
  if (!jwks || !authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  try {
    const { payload } = await jwtVerify(token, jwks, issuer ? { issuer } : undefined);
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export interface Profile {
  id: string;
  role: "user" | "admin";
}

export async function getOrCreateProfile(userId: string): Promise<Profile> {
  const rows = await sql`
    insert into profiles (id) values (${userId})
    on conflict (id) do nothing
    returning id, role
  `;
  if (rows.length > 0) return rows[0] as Profile;
  const existing = await sql`select id, role from profiles where id = ${userId}`;
  return existing[0] as Profile;
}

export async function requireAdmin(userId: string): Promise<boolean> {
  const rows = await sql`select role from profiles where id = ${userId}`;
  return rows[0]?.role === "admin";
}
