/**
 * FIT-07: No Map<path,*>/tree field in core (ADR-0008).
 * RECURSIVELY globs src/core/** and scans every file that moved out of it into the target layout
 * (test/support/replaced-core.ts; ARCH-1, stage-4-typed-options design §4.7 — a non-recursive
 * scan would silently exempt the schema/ subdirectory) for prohibited path-keyed collection
 * patterns.
 *
 * ContractFake lives at src/testing/contract-fake.ts (relocated from test/support/ in
 * stage-4b S-000, ADR-0035) — it IS compiled into dist/testing/ now, but its `#tree:
 * Map<string, string>` field is exactly the ADR-0008 shape this guard bans. The glob stays
 * PINNED to the production core, never widened to src/testing/** (ADR-0034 guard 4, SEC-M2
 * non-regression note): the fake's own path-keyed tree is its legitimate job, not a
 * production-core violation, and widening the scan would wrongly flag it.
 * Every file in the production core is a production type — no exclusions needed.
 *
 * Prohibited patterns:
 *   Map<string, ...>  — path-keyed map in production core (ADR-0008 violation)
 *   Record<string, *> — path-keyed plain-object collection (same invariant, different shape)
 *   tree field decl   — `tree` named field or private field
 *
 * Red-proof: a class with Map<string,> or Record<string,> fields fires the detector.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPLACED_CORE_FILES } from "../support/replaced-core.ts";

const SRC_DIR = new URL("../../src", import.meta.url).pathname;
// The production core: what is left of src/core, plus the files that moved out of it.
const CORE_ROOT = "core";

// Returns every .ts file under dir, recursively, as src-relative posix paths
// (e.g. "bounded-contexts/authoring/domain/services/schema/schema-parse.ts") — never truncated
// to top-level-only.
function walk(dir: string, prefix: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relPath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...walk(join(dir, entry.name), relPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(relPath);
    }
  }
  return files;
}

function getProductionCoreFiles(): string[] {
  return [...walk(join(SRC_DIR, CORE_ROOT), CORE_ROOT), ...REPLACED_CORE_FILES];
}

function readCoreFile(relPath: string): string {
  return readFileSync(join(SRC_DIR, relPath), "utf-8");
}

// Patterns that indicate a path-keyed stored collection in production core.
//
// Map<string, ...>  — the original ADR-0008 invariant; any usage in a stored field/value.
// Record<string, *> — path-keyed plain-object stored field/variable (same invariant).
//   NOTE: `type Foo = Record<string, X>` is a type alias, not a stored value — excluded
//   by requiring the match to appear in a context that is not a pure `type X =` line.
// `tree` field decl / private field named tree.
const MAP_PATTERN = /\bMap\s*<\s*string\s*,/;
const TREE_PATTERNS = [
  /\btree\b\s*[:=]/,
  /#tree\b/,
];

// Match `Record<string,` only in stored-value positions (field or variable declaration),
// not in pure type alias lines (`type Foo = ...`).
function hasRecordStringField(source: string): boolean {
  return source.split("\n").some((line) => {
    const t = line.trim();
    // Skip pure type alias definitions — these name a type, not a stored field.
    if (/^(?:export\s+)?type\s+\w+/.test(t)) return false;
    return /\bRecord\s*<\s*string\s*,/.test(t);
  });
}

function hasProhibitedPattern(source: string): boolean {
  return MAP_PATTERN.test(source) ||
    TREE_PATTERNS.some((re) => re.test(source)) ||
    hasRecordStringField(source);
}

describe("FIT-07 — no Map<path,*>/tree field in production core", () => {
  const files = getProductionCoreFiles();

  // ARCH-1 (stage-4-typed-options design §4.7): a non-recursive scan silently exempts the
  // whole src/core/schema/ subdirectory from this guard. Recursion must actually reach it.
  it("covers the schema services that moved out of src/core/schema/", () => {
    expect(files).toContain("bounded-contexts/authoring/domain/services/schema/schema-parse.ts");
    expect(files).toContain("bounded-contexts/authoring/domain/services/schema/input-rejection.ts");
  });

  // SEC-M2 non-regression (ADR-0034 guard 4): the glob stays pinned to src/core/**, never
  // widened to src/testing/**. ContractFake's own #tree: Map<string, string> field (its
  // legitimate job, not a production-core violation) would trip this detector if the scan
  // were ever widened to reach it.
  it("the glob stays pinned to the production core — src/testing/contract-fake.ts is never scanned", () => {
    expect(CORE_ROOT).toBe("core");
    expect(files.some((f) => f.includes("testing"))).toBe(false);
  });

  it("[characterization] ContractFake's own Map<string,string> tree field would trip this detector if in scope", () => {
    const fakeSource = readFileSync(new URL("../../src/testing/contract-fake.ts", import.meta.url).pathname, "utf-8");
    expect(hasProhibitedPattern(fakeSource)).toEqual(true);
  });

  for (const filename of files) {
    it(`${filename} contains no path-keyed map or tree field`, () => {
      const source = readCoreFile(filename);
      expect(hasProhibitedPattern(source)).toEqual(false);
    });
  }

  // RED-PROOF: a synthetic source with a Map<string, ...> field triggers the check.
  it("[red-proof] a class with Map<string, content> field fires the violation detector", () => {
    const violatingSrc = `class BadSession {
  readonly #tree: Map<string, string> = new Map();
}`;
    expect(hasProhibitedPattern(violatingSrc)).toEqual(true);
  });

  it("[red-proof] a class with a #tree private field fires the violation detector", () => {
    const violatingSrc = `class BadSession {
  #tree = new Map();
}`;
    expect(hasProhibitedPattern(violatingSrc)).toEqual(true);
  });

  // RED-PROOF: a Record<string, X> field is also caught (path-keyed plain-object, same invariant).
  it("[red-proof] a class with Record<string, content> field fires the violation detector", () => {
    const violatingSrc = `class BadHandle {
  readonly index: Record<string, string> = {};
}`;
    expect(hasProhibitedPattern(violatingSrc)).toEqual(true);
  });
});
