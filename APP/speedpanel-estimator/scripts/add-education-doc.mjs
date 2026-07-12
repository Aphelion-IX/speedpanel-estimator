#!/usr/bin/env node
// Adds (or updates) one Education Hub document: copies the PDF into public/docs/,
// reads its page count and file size, extracts full text for search, writes/updates
// the entry in src/eduDocuments.json, and regenerates src/eduSearchIndex.json from
// every document's extracted text (mock entries with no PDF are indexed on their
// metadata fields only).
//
// Usage:
//   node scripts/add-education-doc.mjs <path-to-pdf> \
//     --id concrete-connections --title "Concrete Connections" \
//     --category "Connection Details" --tags "Concrete,Connections,Base Track" \
//     --description "..." --edition "Edition 2 / Release 2" --date "May 2024" \
//     --swatch blue \
//     --sections '[{"name":"About this guide","description":"...","pages":"4-7"}, ...]'

import { readFile, writeFile, copyFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";
import MiniSearch from "minisearch";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT, "public", "docs");
const CATALOG_PATH = path.join(ROOT, "src", "eduDocuments.json");
const INDEX_PATH = path.join(ROOT, "src", "eduSearchIndex.json");

loadEnv({ path: path.join(ROOT, ".env") });

function parseArgs(argv) {
  const [pdfPath, ...rest] = argv;
  if (!pdfPath) {
    console.error("Usage: node scripts/add-education-doc.mjs <path-to-pdf> --id ... --title ... [...]");
    process.exit(1);
  }
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      flags[arg.slice(2)] = rest[i + 1];
      i++;
    }
  }
  const required = ["id", "title", "category", "tags", "description", "edition", "date", "swatch"];
  const missing = required.filter(k => !flags[k]);
  if (missing.length) {
    console.error(`Missing required flags: ${missing.map(k => `--${k}`).join(", ")}`);
    process.exit(1);
  }
  return { pdfPath: path.resolve(pdfPath), flags };
}

function fmtSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  const { pdfPath, flags } = parseArgs(process.argv.slice(2));
  if (!existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  const destName = `${flags.id}.pdf`;
  const destPath = path.join(DOCS_DIR, destName);
  await copyFile(pdfPath, destPath);
  console.log(`Copied PDF -> public/docs/${destName}`);

  const buffer = await readFile(destPath);
  const parser = new PDFParse({ data: buffer });
  const info = await parser.getInfo({ parsePageInfo: false });
  const textResult = await parser.getText();
  await parser.destroy();

  const { size } = await stat(destPath);

  const sections = flags.sections ? JSON.parse(flags.sections) : [];
  const newEntry = {
    id: flags.id,
    title: flags.title,
    category: flags.category,
    tags: flags.tags.split(",").map(t => t.trim()).filter(Boolean),
    description: flags.description,
    edition: flags.edition,
    date: flags.date,
    fileSize: fmtSize(size),
    fileType: "PDF",
    pageCount: info.total,
    swatch: flags.swatch,
    fileUrl: `docs/${destName}`,
    sections,
    _text: textResult.text, // consumed only by the search-index build below, not shipped in eduDocuments.json
  };

  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf-8"));
  const idx = catalog.findIndex(d => d.id === newEntry.id);
  const { _text, ...entryForCatalog } = newEntry;
  if (idx >= 0) catalog[idx] = entryForCatalog;
  else catalog.push(entryForCatalog);
  await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Updated src/eduDocuments.json (${idx >= 0 ? "replaced" : "added"} "${newEntry.id}")`);

  // Full index rebuild: re-extract text for every other real (fileUrl-bearing) document so the
  // index always reflects every document currently in the catalog, not just the one just added.
  const records = [];
  for (const doc of catalog) {
    let text = doc.id === newEntry.id ? _text : "";
    if (doc.id !== newEntry.id && doc.fileUrl) {
      const docPath = path.join(ROOT, "public", doc.fileUrl);
      if (existsSync(docPath)) {
        const p = new PDFParse({ data: await readFile(docPath) });
        text = (await p.getText()).text;
        await p.destroy();
      }
    }
    records.push({
      id: doc.id,
      title: doc.title,
      tags: doc.tags.join(" "),
      category: doc.category,
      description: doc.description,
      text,
    });
  }

  const miniSearch = new MiniSearch({
    idField: "id",
    fields: ["title", "tags", "category", "description", "text"],
    storeFields: ["id"],
  });
  miniSearch.addAll(records);
  await writeFile(INDEX_PATH, JSON.stringify(miniSearch));
  console.log(`Regenerated src/eduSearchIndex.json (${records.length} documents indexed)`);

  await pushSearchText(newEntry.fileUrl, _text);
}

// Pushes the extracted text into the live admin_documents row's search_text column
// (see supabase/schema.sql), which is what actually powers Education Hub full-text
// search -- src/eduDocuments.json / eduSearchIndex.json above are metadata staging,
// not what the live Hub reads. Requires the row to already exist (created via
// Admin > Documents) and VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY to be set
// (.env or already in the environment); skipped with a warning otherwise, since a
// missing push here can't corrupt anything -- it just leaves that one row's
// search_text stale until re-run.
async function pushSearchText(fileUrl, text) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.warn("VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY not set -- skipped pushing search_text to Supabase.");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: rows, error } = await supabase.from("admin_documents").select("id, file_url");
  if (error) {
    console.warn(`Could not reach Supabase to push search_text: ${error.message}`);
    return;
  }
  // file_url is admin-typed free text (see documentTypes.ts), so it may or may not
  // carry a leading slash -- compare with it stripped rather than requiring an exact match.
  const match = rows.find(r => r.file_url?.replace(/^\//, "") === fileUrl);
  if (!match) {
    console.warn(`No admin_documents row with file_url matching "${fileUrl}" -- add it in Admin > Documents first, then re-run this script.`);
    return;
  }
  const { error: updateError } = await supabase.from("admin_documents").update({ search_text: text }).eq("id", match.id);
  if (updateError) console.warn(`Could not push search_text: ${updateError.message}`);
  else console.log(`Pushed extracted text to admin_documents (id ${match.id}) for full-text search.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
