/**
 * FIT-16: always-on structural reserved-name scan (SEC-2 hybrid, REQ-RLN-01 structural
 * complement). Walks ONLY `ALWAYS_ON_SCAN_ROOTS` (design §4.6a) reusing
 * `findReservedSibling` (case-insensitive, dir-form) regardless of `packageDir` — the
 * always-on complement to the `packageDir`-gated runtime throw in `context.ts`. Also flags
 * a package that ships `schema.json` but whose `defineFactory(` call never threads
 * `packageDir` (3rd signal, SEC-2c, Gap 10): a deliberately SIMPLE substring check over the
 * allowlisted factory source — no general/AST parsing. Deliberately-red fixtures live under
 * `test/fixtures/red/reserved/**`, NEVER walked; their red-proofs call the check functions
 * directly.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findReservedSibling } from "../../src/core/schema/schema-discovery.ts";
import { ALWAYS_ON_SCAN_ROOTS } from "../support/scan-roots.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const RED_ROOT = join(PROJECT_ROOT, "test/fixtures/red/reserved");

// 3rd signal (Gap 10, SEC-2c): a deliberately SIMPLE substring check — does this source call
// `defineFactory` at all, and if so, does it ever mention `packageDir` anywhere in the
// file? Anchored on the bare identifier, NOT `defineFactory(` — the real calling
// convention is generic (`defineFactory<Input>(fn, {packageDir})`, see
// test/fixtures/typed-factory/factory.ts), so a literal `defineFactory(` substring would
// never match a typed call and silently never flag anything. Applied ONLY to files inside
// ALWAYS_ON_SCAN_ROOTS (known, allowlisted files) — never general/AST parsing of arbitrary
// source.
function hasUntetheredDefineFactory(source: string): boolean {
  return source.includes("defineFactory") && !source.includes("packageDir");
}

describe("FIT-16 — always-on reserved-name scan (walk over ALWAYS_ON_SCAN_ROOTS)", () => {
  for (const root of ALWAYS_ON_SCAN_ROOTS) {
    it(`${root}: has no reserved-lifecycle-name sibling (green)`, () => {
      const packageDir = join(PROJECT_ROOT, root);

      expect(findReservedSibling(packageDir)).toBeUndefined();
    });

    it(`${root}: defineFactory( threads packageDir (3rd-signal green)`, () => {
      const factorySource = readFileSync(join(PROJECT_ROOT, root, "factory.ts"), "utf-8");

      expect(hasUntetheredDefineFactory(factorySource)).toBe(false);
    });
  }
});

describe("FIT-16 — red-proofs (direct check-function call against test/fixtures/red/reserved/**, never walked)", () => {
  it("REQ-RLN-01.1: a pre-execute.ts sibling is flagged, naming pre-execute", () => {
    expect(findReservedSibling(join(RED_ROOT, "pre-execute-file"))).toEqual("pre-execute");
  });

  it("REQ-RLN-01.3: a post-execute.ts sibling is flagged independently, naming post-execute (pair triangulation)", () => {
    expect(findReservedSibling(join(RED_ROOT, "post-execute-file"))).toEqual("post-execute");
  });

  it("dir-form: a pre-execute/ directory sibling is flagged (ADR-0028)", () => {
    expect(findReservedSibling(join(RED_ROOT, "pre-execute-dir"))).toEqual("pre-execute");
  });

  it("case-insensitive: a PRE-EXECUTE.TS sibling is flagged (TW-M2)", () => {
    expect(findReservedSibling(join(RED_ROOT, "pre-execute-case"))).toEqual("pre-execute");
  });

  it("3rd signal: a defineFactory( call with no packageDir token anywhere in the file is flagged as untethered", () => {
    const source = readFileSync(join(RED_ROOT, "untethered-factory.ts"), "utf-8");

    expect(hasUntetheredDefineFactory(source)).toBe(true);
  });

  it("3rd-signal negative control: a defineFactory( call that DOES thread packageDir is NOT flagged", () => {
    const source = 'defineFactory(fn, { packageDir: import.meta.dir })';

    expect(hasUntetheredDefineFactory(source)).toBe(false);
  });
});
