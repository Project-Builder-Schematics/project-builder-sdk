/**
 * FIT-07: No Map<path,*>/tree field in core (ADR-0008).
 * Scans core source files for prohibited patterns: Map<string, or `tree` field names.
 * ContractFake is EXEMPT — it is the test double and explicitly holds a Map (its purpose is
 * to be the in-memory tree). We police production core types: Session and DirectiveFactory.
 *
 * Red-proof: introduce a Map field into a synthetic class → the check fires red.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../src/core", import.meta.url).pathname;

// Files that represent production core (excluded: contract-fake.ts is the test double)
const PRODUCTION_CORE_FILES = [
  "session.ts",
  "directive-factory.ts",
  "context.ts",
  "engine-client.ts",
  "wire.ts",
];

function readCoreFile(name: string): string {
  return readFileSync(join(ROOT, name), "utf-8");
}

// Patterns that indicate a path-keyed map or tree field in production core.
// The contract-fake's Map is intentional; Session must NOT hold one.
const PROHIBITED_PATTERNS = [
  /\bMap\s*<\s*string\s*,/,  // Map<string, ...>
  /\btree\b\s*[:=]/,          // `tree` field declaration
  /#tree\b/,                  // private class field named tree
];

function hasProhibitedPattern(source: string): boolean {
  return PROHIBITED_PATTERNS.some((re) => re.test(source));
}

describe("FIT-07 — no Map<path,*>/tree field in production core", () => {
  for (const filename of PRODUCTION_CORE_FILES) {
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
});
