/**
 * FIT-27 (REQ-FTG-05): anti-tautology static scan — the mechanical enforcement of
 * `golden-corpus-contract` REQ-GCC-05's "no in-test update path" guard.
 *
 * Two invariants:
 *  (a) NO module reachable from the test-imported graph (entries: every .ts file under
 *      test/e2e/ and test/support/, followed transitively via relative imports) writes to
 *      the corpus directory (test/e2e/author-emulation/corpus/) — scoped to corpus ONLY,
 *      the reports dir is explicitly excluded.
 *  (b) `scripts/regen-corpus.ts` — the sole corpus-dir writer — is NOT reachable from that
 *      same graph, and does not match `bun test`'s test-file discovery pattern (never
 *      runnable via the CI test command).
 *
 * Mirrors fit-01-commons-no-ast.test.ts's transitive-import-graph-walk idiom (BFS worklist,
 * readFileSync + regex, no AST parser) — reuses `IMPORT_SPECIFIER_RE` from
 * test/support/import-scan.ts for specifier extraction.
 *
 * Red-proof: `test/fixtures/red/author-emulation/corpus-write-in-support.ts` — a
 * test/support-shaped module that writes directly to the corpus dir. Never imported by
 * anything real; the scan FUNCTION is called directly against its source (same idiom as
 * FIT-21's red-proof).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { IMPORT_SPECIFIER_RE } from "../support/import-scan.ts";

const TEST_E2E_DIR = new URL("../e2e", import.meta.url).pathname;
const TEST_SUPPORT_DIR = new URL("../support", import.meta.url).pathname;
const REGEN_SCRIPT = new URL("../../scripts/regen-corpus.ts", import.meta.url).pathname;
const RED_FIXTURE = new URL("../fixtures/red/author-emulation/corpus-write-in-support.ts", import.meta.url)
  .pathname;

function isRelative(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

// A JSDoc @example block quoting a sample import as prose is not a real import edge
// (mirrors fit-01's stripComments guard).
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function extractSpecifiers(source: string): string[] {
  const withoutComments = stripComments(source);
  return [...withoutComments.matchAll(IMPORT_SPECIFIER_RE)].map((m) => m[1]!);
}

function resolveRelativeImport(fromFile: string, specifier: string): string {
  return resolve(dirname(fromFile), specifier);
}

function collectTs(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...collectTs(full));
    } else if (extname(full) === ".ts") {
      files.push(full);
    }
  }
  return files;
}

/** BFS worklist over the relative-import graph, starting at `entryFiles`. Returns every
 * file reached (including the entries themselves). */
function walkReachable(entryFiles: readonly string[]): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [...entryFiles];

  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined || visited.has(file)) continue;
    visited.add(file);

    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue; // An unresolvable edge is not this scanner's concern.
    }

    for (const specifier of extractSpecifiers(source)) {
      if (isRelative(specifier)) {
        queue.push(resolveRelativeImport(file, specifier));
      }
    }
  }

  return visited;
}

// A write call's OWN argument list mentioning the corpus dir path is a violation —
// scoped to the CALL SITE's arguments (paren-depth-aware, not whole-file co-occurrence)
// so a file that legitimately writes elsewhere (e.g. this suite's own report-writing,
// REPORTS_DIR-targeted) while merely also REFERENCING the corpus dir path for an
// unrelated read/compare is never flagged — that used to be a false-positive trigger
// once S-003 added real report-writing to the e2e file (which reads CORPUS_DIR to
// compare AND writes report files in the same module). Scoped to "corpus" ONLY — the
// gitignored reports dir is deliberately excluded (FIT-27 must not over-reach onto it).
const WRITE_CALL_RE = /\bwriteFileSync\s*\(|\.writeFile\s*\(|\bappendFileSync\s*\(|\bBun\.write\s*\(/g;
const CORPUS_PATH_RE = /author-emulation\/corpus/;

interface WriteViolation {
  file: string;
}

/** Paren-depth-aware extraction of a call's full argument-list text, starting at the
 * `(` immediately following the matched call name. */
function extractCallArgs(source: string, callMatchIndex: number): string {
  const openParenIndex = source.indexOf("(", callMatchIndex);
  if (openParenIndex === -1) return "";
  let depth = 0;
  for (let i = openParenIndex; i < source.length; i++) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") {
      depth--;
      if (depth === 0) return source.slice(openParenIndex + 1, i);
    }
  }
  return source.slice(openParenIndex + 1); // unterminated (shouldn't happen in valid TS)
}

function writesToCorpusDir(source: string): boolean {
  const withoutComments = stripComments(source);
  for (const match of withoutComments.matchAll(WRITE_CALL_RE)) {
    const args = extractCallArgs(withoutComments, match.index);
    if (CORPUS_PATH_RE.test(args)) {
      return true;
    }
  }
  return false;
}

function findCorpusWriteViolations(files: Iterable<string>): WriteViolation[] {
  const violations: WriteViolation[] = [];
  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    if (writesToCorpusDir(source)) {
      violations.push({ file });
    }
  }
  return violations;
}

describe("FIT-27 — anti-tautology static scan (no test-reachable corpus writer, REQ-FTG-05)", () => {
  it("no module reachable from test/e2e/ or test/support/ writes to the corpus directory", () => {
    const entries = [...collectTs(TEST_E2E_DIR), ...collectTs(TEST_SUPPORT_DIR)];
    const reachable = walkReachable(entries);

    const violations = findCorpusWriteViolations(reachable);
    expect(violations).toEqual([]);
  });

  it("scripts/regen-corpus.ts is NOT reachable from the test-imported graph", () => {
    const entries = [...collectTs(TEST_E2E_DIR), ...collectTs(TEST_SUPPORT_DIR)];
    const reachable = walkReachable(entries);

    expect(reachable.has(REGEN_SCRIPT)).toBe(false);
  });

  it("scripts/regen-corpus.ts's filename does not match bun test's discovery pattern (not CI-test-runnable)", () => {
    expect(REGEN_SCRIPT.endsWith(".test.ts")).toBe(false);
  });

  // RED-PROOF: a test/support-shaped module writing to the corpus dir is caught.
  it("[red-proof] a test-support-shaped module writing to the corpus dir is detected", () => {
    const source = readFileSync(RED_FIXTURE, "utf-8");
    expect(writesToCorpusDir(source)).toBe(true);
  });

  // RED-PROOF (no false positive): a write call unrelated to the corpus dir is not flagged.
  it("[red-proof] a write call targeting an unrelated path is NOT flagged", () => {
    const source = `import { writeFileSync } from "node:fs";\nwriteFileSync("scratch/foo.txt", "x");`;
    expect(writesToCorpusDir(source)).toBe(false);
  });

  // RED-PROOF (no false positive, S-003): a module that WRITES elsewhere (e.g. the
  // reports dir) while merely REFERENCING the corpus dir path elsewhere in the same file
  // (for an unrelated read/compare) is not flagged — the check is scoped to the write
  // call's OWN argument list, not whole-file co-occurrence.
  it("[red-proof] a write call targeting an unrelated path, in a file that ALSO references the corpus dir path for an unrelated read, is NOT flagged", () => {
    const source = `
import { readFileSync, writeFileSync } from "node:fs";
const CORPUS_DIR = "./author-emulation/corpus/";
const committed = readFileSync(CORPUS_DIR + "m-01.transcript.json", "utf-8");
writeFileSync("test/e2e/author-emulation/reports/m-01.report.md", "report text");
`;
    expect(writesToCorpusDir(source)).toBe(false);
  });
});
