/**
 * REQ-BRC-04.1 (S-005, design §Test Derivation / §Fitness Functions "New/relied-on"):
 * architectural scan — no test in the suite asserts `result.tree`/`fake.committedTree()`/
 * `fake.stagingTree()` content for a by-reference (`copyIn`) DESTINATION. Simulation ends
 * at directive acceptance/rejection (REQ-ATH-15.1, Q21): no fake/vehicle surface ever
 * materializes by-reference bytes, so a test asserting them would be pinning behaviour the
 * production contract explicitly forbids — a review-reject, not a passing characterization
 * (slices.md's own Tripwires section names this scan as S-005.5's fitness function).
 *
 * Deliberately SIMPLE substring/regex scan (FIT-10/FIT-16 precedent) — no AST parsing. Scope
 * is per-`it()`-BLOCK, not per-file: a file legitimately asserting by-VALUE content for one
 * destination string in one test, then reusing the SAME literal as a copyIn destination in a
 * DIFFERENT test (e.g. `scaffold-fake.test.ts`'s CCL-04 pair — "out/literal.txt" is a real
 * by-value `scaffold` target in one `it()` and a `copyIn` by-reference target in the next),
 * must not false-positive — block-scoping is what makes that distinction possible. The
 * `it(` split relies on this codebase's consistent 2-space test-body indentation.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const PROJECT_ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const TEST_ROOT = join(PROJECT_ROOT, "test");

function toRelPath(filePath: string): string {
  return filePath.replace(PROJECT_ROOT, "").replace(/^\//, "");
}

/** Collects every `.test.ts` file under `test/`, recursively. */
function collectTestFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...collectTestFiles(full));
    } else if (extname(full) === ".ts" && full.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

/** Splits a test file's source into per-`it()`-block chunks (2-space-indented `it(` calls —
 * this codebase's consistent formatting convention). The header/imports/describe wrapper
 * lands in the first chunk, which never contains a `copyIn(` call in practice. */
function splitIntoTestBlocks(source: string): string[] {
  return source.split(/\n(?=  it\()/);
}

// `copyIn(from, to, opts?)` — positional (commons §13). Captures the literal `to` argument
// when BOTH `from`/`to` are string literals (the only shape a hardcoded destination string
// can appear in); a computed/variable `to` (e.g. `undefined as unknown as string`) is not
// captured — nothing to compare against a tree-read literal in that case anyway.
const COPY_IN_CALL = /copyIn\(\s*["'`][^"'`]*["'`]\s*,\s*["'`]([^"'`]+)["'`]/g;

function copyInDestinations(block: string): string[] {
  return [...block.matchAll(COPY_IN_CALL)].map((match) => match[1]!);
}

/**
 * Flags a read of `destination` off a tree-shaped accessor (`result.tree` /
 * `fake.committedTree()` / `fake.stagingTree()`) whose result is asserted `.toEqual(` a
 * DEFINED value. The sanctioned absence-proof shapes — `.toEqual(undefined)`,
 * `.toBe(false)` (via `.has(...)`), `.toBeUndefined()`, `.size` checks — are never flagged;
 * only a content-equality assertion is evidence of a materialized by-reference byte.
 */
function assertsTreeContentFor(block: string, destination: string): boolean {
  const escaped = destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:\\.tree|committedTree\\(\\)|stagingTree\\(\\))\\.get\\(\\s*["'\`]${escaped}["'\`]\\s*\\)[\\s\\S]{0,10}\\)\\s*\\.toEqual\\(\\s*(?!undefined\\b)`
  );
  return pattern.test(block);
}

interface Violation {
  file: string;
  destination: string;
}

function scanForEvidenceBoundaryViolations(files: readonly string[]): Violation[] {
  const violations: Violation[] = [];
  for (const filePath of files) {
    const source = readFileSync(filePath, "utf-8");
    if (!source.includes("copyIn(")) continue; // no by-reference destinations in this file
    for (const block of splitIntoTestBlocks(source)) {
      for (const destination of copyInDestinations(block)) {
        if (assertsTreeContentFor(block, destination)) {
          violations.push({ file: toRelPath(filePath), destination });
        }
      }
    }
  }
  return violations;
}

describe("REQ-BRC-04.1 — evidence boundary: no test asserts by-reference bytes in result.tree/disk", () => {
  it("[permanent-fixture][red-proof] a planted violation fixture (never a committed file) is caught", () => {
    const fixtureSource = `
describe("planted", () => {
  it("BAD: asserts by-reference content", async () => {
    const run = defineFactory<void>(() => {
      copyIn("asset.svg", "dest/asset.svg");
    }, { packageDir: dir });
    const result = await runFactoryForTest(run, undefined);
    expect(result.tree.get("dest/asset.svg")).toEqual("<svg/>");
  });
});
`;
    const violations = [];
    for (const block of splitIntoTestBlocks(fixtureSource)) {
      for (const destination of copyInDestinations(block)) {
        if (assertsTreeContentFor(block, destination)) violations.push({ destination });
      }
    }
    expect(violations).toEqual([{ destination: "dest/asset.svg" }]);
  });

  it("negative control: the sanctioned absence-proof shape (.has(...)).toBe(false)) is NOT flagged", () => {
    const fixtureSource = `
describe("planted", () => {
  it("GOOD: asserts absence, never content", async () => {
    const run = defineFactory<void>(() => {
      copyIn("asset.svg", "dest/asset.svg");
    }, { packageDir: dir });
    const result = await runFactoryForTest(run, undefined);
    expect(result.tree.has("dest/asset.svg")).toBe(false);
  });
});
`;
    const violations = [];
    for (const block of splitIntoTestBlocks(fixtureSource)) {
      for (const destination of copyInDestinations(block)) {
        if (assertsTreeContentFor(block, destination)) violations.push({ destination });
      }
    }
    expect(violations).toEqual([]);
  });

  it("negative control: the SAME destination literal used as a by-VALUE target in one test and a copyIn target in another is NOT flagged (block-scoping proof)", () => {
    const fixtureSource = `
describe("planted", () => {
  it("by-value scaffold entry: content assertion is legitimate here", async () => {
    const result = await runFactoryForTest(run, undefined);
    expect(result.tree.get("out/literal.txt")).toEqual(content);
  });

  it("by-reference copyIn entry: SAME literal, different test, never asserted for content", async () => {
    const run = defineFactory<void>(() => {
      copyIn("literal.txt", "out/literal.txt");
    }, { packageDir: dir });
    const result = await runFactoryForTest(run, undefined);
    expect(result.tree.has("out/literal.txt")).toBe(false);
  });
});
`;
    const violations = [];
    for (const block of splitIntoTestBlocks(fixtureSource)) {
      for (const destination of copyInDestinations(block)) {
        if (assertsTreeContentFor(block, destination)) violations.push({ destination });
      }
    }
    expect(violations).toEqual([]);
  });

  it("production scan — the full test suite is free of evidence-boundary violations", () => {
    // Excludes THIS file: its own planted-violation/negative-control fixtures above are
    // string literals containing deliberately-bad example patterns for the scanner to
    // catch — real source text the raw scan would (correctly, for those strings) flag,
    // same self-referential exclusion FIT-16's red-fixture convention avoids by walking a
    // never-scanned directory instead.
    const selfPath = new URL(import.meta.url).pathname;
    const files = collectTestFiles(TEST_ROOT).filter((f) => f !== selfPath);
    const violations = scanForEvidenceBoundaryViolations(files);
    expect(violations).toEqual([]);
  });
});
