/**
 * Pyramid REQ-01/02/03: the test-pyramid doc-table + CI-coverage structural contract
 * (test-pyramid-codification spec, contributor half of O2 row 11).
 *
 * Strategy: static text-scan over `CONTRIBUTING.md` and `.github/workflows/ci.yml` —
 * same convention as FIT-08/FIT-09 (readFileSync + regex, no markdown/yaml parser
 * dependency). Naturally red until `CONTRIBUTING.md` carries both tables.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
const CONTRIBUTING_PATH = join(ROOT, "CONTRIBUTING.md");
const CI_PATH = join(ROOT, ".github/workflows/ci.yml");

const LAYER_HEADER = /^\|\s*Layer\s*\|\s*Directory\s*\|\s*Runs without engine\?\s*\|\s*Example test\s*\|\s*$/;
const DECISION_HEADER = /^\|\s*Contribution type\s*\|\s*Layer\(s\)\s*\|\s*Home\s*\|\s*$/;

/**
 * Extracts a markdown table's data rows (cells trimmed, pipes stripped) given the exact
 * header line. Assumes the standard `header / --- separator / rows` markdown table shape.
 */
function extractTable(doc: string, headerPattern: RegExp): string[][] {
  const lines = doc.split("\n");
  const headerIdx = lines.findIndex((line) => headerPattern.test(line));
  if (headerIdx === -1) return [];

  const rows: string[][] = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim().startsWith("|")) break;
    rows.push(
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim())
    );
  }
  return rows;
}

/**
 * Finds the `run:` command of the named CI step. Throws (not returns undefined) so a
 * missing step fails the test for the right reason — an assertion on a real value, not
 * a silent pass.
 */
function findCiStepCommand(ciYaml: string, stepName: string): string {
  const lines = ciYaml.split("\n");
  const stepIdx = lines.findIndex((line) => new RegExp(`name:\\s*${stepName}\\s*$`).test(line));
  if (stepIdx === -1) throw new Error(`ci.yml: no "${stepName}" step found`);
  for (let i = stepIdx + 1; i < lines.length; i++) {
    const match = lines[i]!.match(/run:\s*(.+)$/);
    if (match) return match[1]!.trim();
    if (/^\s*-\s*name:/.test(lines[i]!)) break;
  }
  throw new Error(`ci.yml: "${stepName}" step has no run command`);
}

/**
 * A `bun test` invocation with no positional path argument runs the whole `test/` tree,
 * so no mapped directory under `test/` can be excluded from it. A scoped invocation must
 * name the directory explicitly to cover it.
 */
function ciCommandExcludesDirectory(command: string, directory: string): boolean {
  const wholeTreeInvocation = /^bun test(\s+--\S+)*$/.test(command);
  if (wholeTreeInvocation) return false;
  return !command.includes(directory);
}

describe("pyramid REQ-01 — four-layer table maps to real directories", () => {
  it("the table exists with exactly unit/fitness/integration/e2e, each naming an existing directory with ≥1 test file", () => {
    const doc = readFileSync(CONTRIBUTING_PATH, "utf-8");
    const rows = extractTable(doc, LAYER_HEADER);

    expect(rows.length).toEqual(4);

    const layers = rows.map((row) => row[0]?.toLowerCase() ?? "");
    expect(new Set(layers)).toEqual(new Set(["unit", "fitness", "integration", "e2e"]));

    for (const row of rows) {
      const dir = (row[1] ?? "").replace(/`/g, "").trim();
      const fullDir = join(ROOT, dir);
      expect(existsSync(fullDir)).toBe(true);
      const testFiles = readdirSync(fullDir).filter((f) => f.endsWith(".test.ts"));
      expect(testFiles.length).toBeGreaterThan(0);
    }
  });
});

describe("pyramid REQ-02 — contribution decision table covers the four change kinds", () => {
  it("has a row for new verb, new fitness invariant, cross-module behavior, and full author story", () => {
    const doc = readFileSync(CONTRIBUTING_PATH, "utf-8");
    const rows = extractTable(doc, DECISION_HEADER);

    expect(rows.length).toEqual(4);

    const subjects = rows.map((row) => (row[0] ?? "").toLowerCase());
    for (const keyword of ["verb", "fitness invariant", "cross-module", "author"]) {
      expect(subjects.some((subject) => subject.includes(keyword))).toBe(true);
    }
  });
});

describe("pyramid REQ-03 — CI's test step covers every mapped directory", () => {
  it("no directory named in the doc's layer table is excluded from CI's test invocation", () => {
    const doc = readFileSync(CONTRIBUTING_PATH, "utf-8");
    const rows = extractTable(doc, LAYER_HEADER);
    // Ties this check to the doc's mapping actually existing — an empty table must not
    // make this pass vacuously.
    expect(rows.length).toEqual(4);
    const dirs = rows.map((row) => (row[1] ?? "").replace(/`/g, "").trim());

    const ciYaml = readFileSync(CI_PATH, "utf-8");
    const command = findCiStepCommand(ciYaml, "Run tests");

    const excluded = dirs.filter((dir) => ciCommandExcludesDirectory(command, dir));
    expect(excluded).toEqual([]);
  });

  // Red-proof (FIT-08/FIT-09 style): a scoped invocation that omits a mapped directory
  // must be caught — kills the "always vacuously passes" mutant.
  it("[red-proof] a scoped bun test invocation that omits a mapped directory is detected as excluding it", () => {
    const scoped = "bun test test/fake test/fitness";
    expect(ciCommandExcludesDirectory(scoped, "test/golden-ir")).toBe(true);
    expect(ciCommandExcludesDirectory(scoped, "test/fake")).toBe(false);
  });
});
