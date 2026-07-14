/**
 * S-004 — repo-wide honesty sweeps (REQ-KIT-03 V2/V3/V4, `foundations-skeleton` spec): two
 * independent scans proving no pre-rename write-verb vocabulary survives the
 * `author-write-surface` campaign (ADR-0050).
 *
 * **Sweep 1 — `.raw` retirement.** Pattern A (`\.raw\(`, call-shaped — requires the paren)
 * over every `src/**` file's JSDoc/comments; Pattern B (bare `.raw`, word-boundary, NO paren
 * required — catches paren-less prose mentions, strictly wider than Pattern A) UNIFORMLY over
 * every markdown file in scope: `*.md` at the repo root (non-recursive glob — no hand-pinned
 * file list) plus every `docs/**` file. Pattern B is the widened predicate slices.md's
 * "Sweep Implementation Spec" section calls for (nit 2) — Pattern A alone misses ROADMAP's
 * paren-less mentions. Both patterns MUST return zero hits — no exclusions; `.raw` no longer
 * exists anywhere on `Handle` (S-000), so every remaining occurrence in scope is retired
 * vocabulary, never a legitimate surviving reference.
 *
 * **Sweep 2 — free `modify(` retirement.** Bans the OLD commons string-form call
 * `modify(path, content)` as a FREE call (i.e. NOT preceded by `.` or another identifier
 * character) across the same uniform markdown scope (root `*.md` + `docs/**`) and every
 * JSDoc/comment under `src/**`. Two exclusions, both by CONSTRUCTION of the "not preceded
 * by `.`" predicate, never a separate allowlist: `.modify(fn)` (the dialect AST escape
 * hatch) and `factory.modify(` (the kit-internal `DirectiveFactory` method, REQ-KIT-03's
 * "Author→factory mapping" row) — both are always dot-prefixed, so the free-call regex
 * never matches them to begin with.
 *
 * **`src/**` scans comments/JSDoc only, never live code** — `modify(a: ModifyArgs)` (a
 * method SIGNATURE, `directive-factory.ts`), `{ modify(fn): ... }` (a type MEMBER,
 * `define-dialect.ts`), and `` `modify() on "${path}" threw` `` (a STRING LITERAL, the
 * frozen wire-altitude tail, `dialect-handle.ts`) are all real, sanctioned, unrelated code
 * shapes that happen to contain the substring `modify(` — `maskToCommentsOnly` blanks every
 * non-comment character (preserving line numbers) before either pattern runs, so only actual
 * prose/JSDoc text is ever matched inside `src/**`.
 *
 * Both sweeps structurally cannot pass before every module's rename lands (S-001/S-002/S-003)
 * AND this slice's own doc migrations (S-004.1-.3) — this file sits last in the build order
 * for exactly that reason (design.md §4.8, slices.md Build Order table).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { collectFiles, collectTsFiles } from "../support/import-scan.ts";
import { PROJECT_ROOT } from "../support/jsdoc-scan.ts";

/**
 * Blanks every character NOT inside a `//` or `/* *\/` comment to a space, preserving every
 * newline (and therefore every line number) — the src/** scans below match against this
 * masked text, never the raw source, so a call/declaration/string-literal that merely
 * CONTAINS the scanned substring (e.g. a method signature or a frozen tail-literal string)
 * can never match. Comment detection is line/block-token driven, the same simplistic,
 * string-literal-blind approach `test/support/import-scan.ts`'s `stripComments` already uses
 * elsewhere in this suite (accepted tradeoff: a `//`-like substring inside a string literal
 * could misdetect a comment start — not a real risk across this scan's actual file set).
 */
function maskToCommentsOnly(source: string): string {
  let result = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    if (source[i] === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      result += source.slice(i, stop);
      i = stop;
      continue;
    }
    if (source[i] === "/" && source[i + 1] === "/") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      result += source.slice(i, stop);
      i = stop;
      continue;
    }
    result += source[i] === "\n" ? "\n" : " ";
    i++;
  }
  return result;
}

const SRC_ROOT = join(PROJECT_ROOT, "src");
const DOCS_ROOT = join(PROJECT_ROOT, "docs");

/** Non-recursive by design — recursing from the repo root would sweep node_modules, test
 * fixtures, and openspec planning artefacts; `docs/**` recurses via `collectFiles`. */
const ROOT_MARKDOWN_FILES = readdirSync(PROJECT_ROOT)
  .filter((entry) => extname(entry) === ".md")
  .map((entry) => join(PROJECT_ROOT, entry));

function relPath(path: string): string {
  return path.replace(`${PROJECT_ROOT}/`, "");
}

// Pattern A — call-shaped, requires the paren. No `g` flag: each pattern below runs as a
// per-line boolean (`.test`), never as a stateful global scan.
const RAW_CALL_PATTERN = /\.raw\(/;
// Pattern B — bare substring, word-boundary so it never matches a `.rawSomething` identifier.
const RAW_BARE_PATTERN = /\.raw\b/;
// Free `modify(` — NOT preceded by `.` or another identifier character (excludes
// `.modify(fn)` and `factory.modify(` by construction, never a separate allowlist).
const FREE_MODIFY_CALL_PATTERN = /(?<![.\w])modify\(/;

interface Violation {
  file: string;
  line: number;
  snippet: string;
}

function findMatches(source: string, file: string, pattern: RegExp): Violation[] {
  const violations: Violation[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (pattern.test(line)) {
      violations.push({ file: relPath(file), line: i + 1, snippet: line.trim() });
    }
  }
  return violations;
}

function describeViolations(violations: Violation[]): string[] {
  return violations.map((v) => `${v.file}:${v.line}: ${v.snippet}`);
}

interface ScanText {
  file: string;
  text: string;
}

// Corpora built ONCE at module scope — the sweep assertions below share these cached texts
// instead of re-globbing/re-reading/re-masking the same files per `it` block.
// src/** scans comments/JSDoc only — see `maskToCommentsOnly`'s own doc comment.
const SRC_COMMENT_TEXTS: ScanText[] = collectTsFiles(SRC_ROOT).map((file) => ({
  file,
  text: maskToCommentsOnly(readFileSync(file, "utf-8")),
}));
const MARKDOWN_TEXTS: ScanText[] = [...ROOT_MARKDOWN_FILES, ...collectFiles(DOCS_ROOT, ".md")].map((file) => ({
  file,
  text: readFileSync(file, "utf-8"),
}));

describe("REQ-KIT-03 — `.raw` retirement sweep (S-004)", () => {
  it("Pattern A: zero call-shaped `.raw(` occurrences across src/**'s comments", () => {
    const violations = SRC_COMMENT_TEXTS.flatMap(({ file, text }) => findMatches(text, file, RAW_CALL_PATTERN));
    expect(describeViolations(violations)).toEqual([]);
  });

  it("Pattern B: zero bare `.raw` occurrences across root *.md and docs/**", () => {
    const violations = MARKDOWN_TEXTS.flatMap(({ file, text }) => findMatches(text, file, RAW_BARE_PATTERN));
    expect(describeViolations(violations)).toEqual([]);
  });

  it("[red-proof] Pattern A catches a planted call-shaped `.raw(` occurrence", () => {
    const violations = findMatches('await ts.find("a.ts").raw(ast => {});', "fixture.ts", RAW_CALL_PATTERN);
    expect(violations.length).toBe(1);
  });

  it("[red-proof] Pattern B catches a planted paren-less `.raw` occurrence", () => {
    const violations = findMatches("the L2 `.raw` escape hatch", "fixture.md", RAW_BARE_PATTERN);
    expect(violations.length).toBe(1);
  });

  it("Pattern B does not false-positive on an unrelated `.rawSomething` identifier", () => {
    const violations = findMatches("see `entry.rawValue` for the unparsed field", "fixture.md", RAW_BARE_PATTERN);
    expect(violations.length).toBe(0);
  });

  it("[red-proof] masking excludes live code — only a comment-borne `.raw()` mention is caught", () => {
    const fixture = [
      "function f() { return rawInput.trim(); }", // `raw` as an identifier prefix, live code
      "// TODO: migrate the last .raw() mention here", // genuine comment-borne mention
    ].join("\n");
    const violations = findMatches(maskToCommentsOnly(fixture), "fixture.ts", RAW_CALL_PATTERN);
    expect(violations.length).toBe(1);
    expect(violations[0]!.line).toBe(2); // line 1's code is masked away, only the comment matches
  });
});

describe("REQ-KIT-03 — free `modify(` retirement sweep (S-004)", () => {
  it("zero free `modify(` calls across root *.md, docs/**, src/**'s comments", () => {
    const violations = [
      ...MARKDOWN_TEXTS.flatMap(({ file, text }) => findMatches(text, file, FREE_MODIFY_CALL_PATTERN)),
      ...SRC_COMMENT_TEXTS.flatMap(({ file, text }) => findMatches(text, file, FREE_MODIFY_CALL_PATTERN)),
    ];
    expect(describeViolations(violations)).toEqual([]);
  });

  it("[red-proof] catches a planted free `modify(path, content)` call", () => {
    const violations = findMatches('modify("src/config.json", \'{}\');', "fixture.ts", FREE_MODIFY_CALL_PATTERN);
    expect(violations.length).toBe(1);
  });

  it("excludes `.modify(fn)` — dot-prefixed, never matches the free-call pattern", () => {
    const violations = findMatches("await ts.find(path).modify(ast => {});", "fixture.ts", FREE_MODIFY_CALL_PATTERN);
    expect(violations.length).toBe(0);
  });

  it("excludes `factory.modify(` — the kit-internal DirectiveFactory method", () => {
    const violations = findMatches(
      "session.buffer(factory.modify({ path, content }));",
      "fixture.ts",
      FREE_MODIFY_CALL_PATTERN
    );
    expect(violations.length).toBe(0);
  });

  it("[red-proof] masking excludes real code shapes that merely contain the substring `modify(`", () => {
    const fixture = [
      "  modify(a: ModifyArgs): Directive {", // method SIGNATURE, not a call
      "  DialectWriteOps & { modify(fn: (ast: Ast) => void): Edited },", // type MEMBER
      '  await inv(() => fn(live), `modify() on "${path}" threw`);', // STRING LITERAL content
      "  // still bans a genuine free modify( mention inside a comment",
    ].join("\n");
    const violations = findMatches(maskToCommentsOnly(fixture), "fixture.ts", FREE_MODIFY_CALL_PATTERN);
    // the three CODE lines (signature, type member, string literal) are masked away —
    // only line 4's real comment-borne mention survives.
    expect(violations.length).toBe(1);
    expect(violations[0]!.line).toBe(4);
  });
});
