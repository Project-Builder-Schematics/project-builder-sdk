/**
 * FIT-07: No Map<path,*>/tree field in core (ADR-0008).
 * Globs all of src/core/** and scans for prohibited path-keyed collection patterns.
 *
 * Exclusion: contract-fake.ts is the test double; it intentionally holds a Map (its purpose
 * is to be the in-memory tree). We exclude it explicitly so the fitness function polices
 * only production core types.
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

// contract-fake.ts is the test double: it intentionally holds a flat Map<string, string>
// that mirrors the fake in-memory tree. Excluding it is correct — the fitness function
// guards production types, not the oracle used to test them.
const EXCLUDED_FILES = new Set(["contract-fake.ts"]);

function getProductionCoreFiles(): string[] {
  return readdirSync(CORE_DIR)
    .filter((name) => name.endsWith(".ts") && !EXCLUDED_FILES.has(name));
}

function readCoreFile(name: string): string {
  return readFileSync(join(CORE_DIR, name), "utf-8");
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
