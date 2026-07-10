/**
 * FIT-07: No Map<path,*>/tree field in core (ADR-0008).
 * RECURSIVELY globs all of src/core/** (ARCH-1, stage-4-typed-options design §4.7 — a
 * non-recursive scan would silently exempt the src/core/schema/ subdirectory) and scans
 * for prohibited path-keyed collection patterns.
 *
 * ContractFake has been moved to test/support/contract-fake.ts (not compiled into dist/).
 * All files in src/core/** are production types — no exclusions needed.
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

const CORE_DIR = new URL("../../src/core", import.meta.url).pathname;

// Returns every .ts file under CORE_DIR, recursively, as CORE_DIR-relative posix paths
// (e.g. "schema/schema-model.ts") — never truncated to top-level-only.
function getProductionCoreFiles(dir: string = CORE_DIR, prefix = ""): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relPath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...getProductionCoreFiles(join(dir, entry.name), relPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(relPath);
    }
  }
  return files;
}

function readCoreFile(relPath: string): string {
  return readFileSync(join(CORE_DIR, relPath), "utf-8");
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
  it("recursively covers nested subdirectories (src/core/schema/**), not just top-level files", () => {
    expect(files).toContain("schema/schema-model.ts");
    expect(files).toContain("schema/input-rejection.ts");
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
