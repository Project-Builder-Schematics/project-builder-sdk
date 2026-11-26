/**
 * FIT-07: No Map<path,*>/tree field in core (ADR-0008).
 * Scans every file that moved out of src/core into the target layout
 * (test/support/replaced-core.ts; ARCH-1, stage-4-typed-options design §4.7) for prohibited
 * path-keyed collection patterns. src/core itself is gone.
 *
 * ContractFake lives at src/bounded-contexts/authoring/testing/contract-fake.ts (relocated from test/support/ in
 * stage-4b S-000, ADR-0035) — it IS compiled into dist/bounded-contexts/authoring/testing/ now, but its `#tree:
 * Map<string, string>` field is exactly the ADR-0008 shape this guard bans. The glob stays
 * PINNED to the production core, never widened to src/bounded-contexts/authoring/testing/** (ADR-0034 guard 4, SEC-M2
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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPLACED_CORE_FILES } from "../support/replaced-core.ts";

const SRC_DIR = new URL("../../src", import.meta.url).pathname;
// The production core: the files that moved out of src/core.
function getProductionCoreFiles(): readonly string[] {
  return REPLACED_CORE_FILES;
}

// A-7 (ADR-0008 amendment): the Session counts how many buffered directives changed each path.
// A counter is not a mirror: no content is kept, and every read still goes to the engine.
const ALLOWED_LINES: Readonly<Record<string, string>> = {
  "bounded-contexts/authoring/domain/aggregates/session/session.ts": "readonly #versions = new Map<string, number>();",
};

function readCoreFile(relPath: string): string {
  const source = readFileSync(join(SRC_DIR, relPath), "utf-8");
  const allowed = ALLOWED_LINES[relPath];
  return allowed === undefined ? source : source.split("\n").filter((line) => line.trim() !== allowed).join("\n");
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

  // ARCH-1 (stage-4-typed-options design §4.7): the schema services that left
  // src/core/schema/ stay in scope.
  it("covers the schema services that moved out of src/core/schema/", () => {
    expect(files).toContain("bounded-contexts/authoring/domain/services/schema/schema-parse.ts");
    expect(files).toContain("bounded-contexts/authoring/domain/services/schema/input-rejection.ts");
  });

  // SEC-M2 non-regression (ADR-0034 guard 4): the scan stays pinned to the production core, never
  // widened to src/bounded-contexts/authoring/testing/**. ContractFake's own #tree: Map<string, string> field (its
  // legitimate job, not a production-core violation) would trip this detector if the scan
  // were ever widened to reach it.
  it("the glob stays pinned to the production core — src/bounded-contexts/authoring/testing/contract-fake.ts is never scanned", () => {
    expect(files.some((f) => f.includes("testing"))).toBe(false);
  });

  it("[characterization] ContractFake's own Map<string,string> tree field would trip this detector if in scope", () => {
    const fakeSource = readFileSync(new URL("../../src/bounded-contexts/authoring/testing/contract-fake.ts", import.meta.url).pathname, "utf-8");
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

  it("[red-proof] the Session's version counter is the only exemption, and a content map beside it still fires", () => {
    const session = "bounded-contexts/authoring/domain/aggregates/session/session.ts";
    expect(readFileSync(join(SRC_DIR, session), "utf-8")).toContain(ALLOWED_LINES[session]!);
    expect(hasProhibitedPattern("readonly #content = new Map<string, string>();")).toEqual(true);
  });

  // RED-PROOF: a Record<string, X> field is also caught (path-keyed plain-object, same invariant).
  it("[red-proof] a class with Record<string, content> field fires the violation detector", () => {
    const violatingSrc = `class BadHandle {
  readonly index: Record<string, string> = {};
}`;
    expect(hasProhibitedPattern(violatingSrc)).toEqual(true);
  });
});
