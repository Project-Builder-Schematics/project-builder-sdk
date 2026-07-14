/**
 * FIT-16: always-on structural reserved-name scan (SEC-2 hybrid, REQ-RLN-01 structural
 * complement). Walks ONLY `ALWAYS_ON_SCAN_ROOTS` (design §4.6a) reusing
 * `findReservedSibling` (case-insensitive, dir-form) regardless of `packageDir` — the
 * always-on complement to the `packageDir`-gated runtime throw in `context.ts`.
 * Deliberately-red fixtures live under `test/fixtures/red/reserved/**`, NEVER walked; their
 * red-proofs call the check functions directly.
 *
 * bare-factory-migration ADR-A: the former 3rd signal (`hasUntetheredDefineFactory`) is
 * RETIRED here — once every author fixture is bare, there is no wrap-call token left to
 * scan for in author-facing source, so the signal would go vacuously green regardless of
 * whether a run is actually untethered. Its threat model (an untethered run with no
 * `packageDir`) re-homes to the future production runner plan as a registered followup, not
 * this change. The reserved-sibling walk (this file's OTHER signal) is unaffected — it reads
 * the directory, not factory source.
 */
import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { findReservedSibling } from "../../src/core/schema/schema-discovery.ts";
import { ALWAYS_ON_SCAN_ROOTS } from "../support/scan-roots.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const RED_ROOT = join(PROJECT_ROOT, "test/fixtures/red/reserved");

describe("FIT-16 — always-on reserved-name scan (walk over ALWAYS_ON_SCAN_ROOTS)", () => {
  for (const root of ALWAYS_ON_SCAN_ROOTS) {
    it(`${root}: has no reserved-lifecycle-name sibling (green)`, () => {
      const packageDir = join(PROJECT_ROOT, root);

      expect(findReservedSibling(packageDir)).toBeUndefined();
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
});
