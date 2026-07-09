// =============================================================================
// Neon Postgres client
// =============================================================================
// HTTP-based driver (one round trip per query, no connection pool to manage)
// -- fits this API's shape, since every route here does at most one query or
// one function call (the stage-transition functions are single atomic
// statements from the caller's side; their internal multi-statement
// transaction/row-lock lives inside the plpgsql function body itself).
// Requires the POOLED connection string (DATABASE_URL), never the direct one.
// =============================================================================
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const sql = neon(connectionString);
