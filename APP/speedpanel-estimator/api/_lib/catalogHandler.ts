// =============================================================================
// Generic public catalog CRUD handler
// =============================================================================
// Server-side mirror of src/pages/admin/shared/supabaseCatalogStore.ts's
// generic shape -- one factory serves panels/tracks/fixings/sealants/
// colours/admin_documents. No auth check (the Admin panel is intentionally
// fully public, see AdminGate.tsx).
//
// `writableColumns` is a hardcoded allowlist, not derived from the request
// body's own keys -- table/column names end up interpolated directly into
// the SQL text (parameters only cover values), so treating arbitrary body
// keys as column names would be a SQL-injection hole regardless of these
// tables being intentionally publicly writable. Only VALUES are
// user-controlled; every column name in a query comes from this file, never
// from req.body.
// =============================================================================
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ZodType } from "zod";
import { sql } from "./db";

export function createCatalogHandler<Row>(config: {
  table: string;
  rowSchema: ZodType<Row>;
  writableColumns: readonly string[];
  orderBy?: { column: string; ascending: boolean };
}) {
  const { table, rowSchema, writableColumns, orderBy } = config;

  function pickWritable(body: unknown): Record<string, unknown> {
    if (typeof body !== "object" || body === null) return {};
    const source = body as Record<string, unknown>;
    const picked: Record<string, unknown> = {};
    for (const col of writableColumns) {
      if (col in source) picked[col] = source[col];
    }
    return picked;
  }

  return async function handler(req: VercelRequest, res: VercelResponse) {
    try {
      if (req.method === "GET") {
        const order = orderBy ? ` order by ${orderBy.column} ${orderBy.ascending ? "asc" : "desc"}` : "";
        const rows = await sql.query(`select * from ${table}${order}`);
        const parsed = rowSchema.array().safeParse(rows);
        if (!parsed.success) return res.status(500).json({ error: "Unexpected data shape from the server." });
        return res.status(200).json(parsed.data);
      }

      if (req.method === "POST") {
        const picked = pickWritable(req.body);
        const columns = Object.keys(picked);
        if (columns.length === 0) return res.status(400).json({ error: "Empty body." });
        const placeholders = columns.map((_, i) => `$${i + 1}`);
        const values = columns.map(c => picked[c]);
        const text = `insert into ${table} (${columns.join(", ")}) values (${placeholders.join(", ")}) returning *`;
        const rows = await sql.query(text, values);
        const parsed = rowSchema.safeParse(rows[0]);
        if (!parsed.success) return res.status(500).json({ error: "Unexpected data shape from the server." });
        return res.status(200).json(parsed.data);
      }

      if (req.method === "PATCH" || req.method === "PUT") {
        const id = req.query.id;
        if (typeof id !== "string") return res.status(400).json({ error: "Missing id." });
        const picked = pickWritable(req.body);
        const columns = Object.keys(picked);
        if (columns.length === 0) return res.status(400).json({ error: "Empty body." });
        const setClause = columns.map((c, i) => `${c} = $${i + 1}`).join(", ");
        const values = columns.map(c => picked[c]);
        const text = `update ${table} set ${setClause}, updated_at = now() where id = $${columns.length + 1} returning *`;
        const rows = await sql.query(text, [...values, id]);
        if (rows.length === 0) return res.status(404).json({ error: "Not found." });
        const parsed = rowSchema.safeParse(rows[0]);
        if (!parsed.success) return res.status(500).json({ error: "Unexpected data shape from the server." });
        return res.status(200).json(parsed.data);
      }

      if (req.method === "DELETE") {
        const id = req.query.id;
        if (typeof id !== "string") return res.status(400).json({ error: "Missing id." });
        await sql.query(`delete from ${table} where id = $1`, [id]);
        return res.status(200).json({ ok: true });
      }

      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return res.status(405).json({ error: "Method not allowed." });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error." });
    }
  };
}
