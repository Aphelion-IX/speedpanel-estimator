// =============================================================================
// No inert controls
// =============================================================================
// A source-level guard against a class of defect an audit found across the
// app: controls rendered as fully live buttons/inputs with no handler at all,
// so clicking or typing silently does nothing (System Selector's "Select
// System" on unmapped cards, the landing footer's Privacy/Terms, the home
// dashboard's support search, Orders' "Filters", ...).
//
// The rule: every <button>/<input> must either be able to act (onClick, a
// submit type, a spread that may supply one) or visibly declare that it
// can't (disabled). This is a static scan, not a render test -- it's cheap,
// covers every page at once including ones with no test of their own, and
// catches the omission at the point it's written.
//
// If a control legitimately needs neither, add it to ALLOWED with a reason.
// =============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("..", import.meta.url).pathname;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") && !full.includes(".test.") ? [full] : [];
  });
}

// Reads the full opening tag from `<tagName` to the `>` that closes it,
// skipping any `>` nested inside a JSX expression container.
function openingTag(src: string, start: number): string | null {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

// Comments routinely mention tags in prose ("plain styled <input>/<select>
// elements..."), which would otherwise scan as inert controls. Blanking them
// keeps byte offsets -- and therefore reported line numbers -- intact.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank => blank.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, lead: string) => lead + " ".repeat(match.length - lead.length));
}

// Controls that intentionally have no handler and no disabled attribute.
const ALLOWED: { file: string; reason: string }[] = [];

interface Finding { location: string; tag: string }

function inertControls(): Finding[] {
  const found: Finding[] = [];
  for (const file of tsxFiles(SRC)) {
    const src = stripComments(readFileSync(file, "utf8"));
    for (const tagName of ["button", "input"]) {
      const re = new RegExp(`<${tagName}\\b`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const tag = openingTag(src, m.index);
        if (!tag) continue;
        const canAct = /onClick=|onChange=|onInput=|type=["'{]?submit/.test(tag);
        const declaresInert = /\bdisabled\b|\breadOnly\b/.test(tag);
        // A `{...props}` spread may supply the handler; can't tell statically.
        const spread = /\{\.\.\./.test(tag);
        if (canAct || declaresInert || spread) continue;
        const relative = file.slice(file.indexOf("/src/") + 1);
        if (ALLOWED.some(a => a.file === relative)) continue;
        found.push({
          location: `${relative}:${src.slice(0, m.index).split("\n").length}`,
          tag: tag.replace(/\s+/g, " ").slice(0, 100),
        });
      }
    }
  }
  return found;
}

describe("no inert controls", () => {
  it("every button/input can either act or is marked disabled", () => {
    const found = inertControls();
    const report = found.map(f => `  ${f.location}\n    ${f.tag}`).join("\n");
    expect(found, `Controls with no handler and no disabled attribute:\n${report}`).toEqual([]);
  });

  it("the scanner actually detects an inert control (guards against a vacuous pass)", () => {
    // Same predicate the scan applies, exercised against a known-bad tag.
    const inert = '<button className="x">Do nothing</button>';
    const live = '<button onClick={go} className="x">Go</button>';
    const off = '<button disabled className="x">Unavailable</button>';
    const predicate = (tag: string) =>
      !/onClick=|onChange=|onInput=|type=["'{]?submit/.test(tag) && !/\bdisabled\b|\breadOnly\b/.test(tag) && !/\{\.\.\./.test(tag);

    expect(predicate(inert)).toBe(true);
    expect(predicate(live)).toBe(false);
    expect(predicate(off)).toBe(false);
  });
});
