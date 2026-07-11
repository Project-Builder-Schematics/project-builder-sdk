// CONF-01: conformance scaffold — testDialect / testOpPack (ADR-0012).
// Signatures and types are frozen; full dialect-testing implementation is deferred to T-M2
// (no real dialect exists yet). The meta-tests in test/conformance/ assert this surface.

import type { Dialect, OpPack } from "../core/define-dialect.ts";

/**
 * Fixture passed to `testDialect` to drive the conformance suite.
 * The fixture supplies the dialect under test plus representative source samples.
 *
 * @example
 * const fixture: DialectFixture = {
 *   dialect: myTypeScriptDialect,
 *   samples: ["const x = 1;", "export default {};"],
 * };
 */
export interface DialectFixture {
  /** The dialect instance to exercise. */
  dialect: Dialect;
  /** Representative source strings the dialect's parse/print round-trip must survive byte-exact. */
  samples: string[];
}

/**
 * One op-invocation recipe `testOpPack` applies to a seeded target: seed the file, run the
 * op `chain` (named pack ops and/or the universal `.raw`), and assert the coalesced
 * `modify`'s content is BYTE-EXACT `expect` — a full-output comparison, never a substring,
 * so one assertion proves both the op's intended effect AND that every other region is
 * byte-stable (REQ-DC-02's unchanged-elsewhere).
 *
 * @example
 * const exercise: OpExercise = {
 *   seed: "export const x = 1;",
 *   chain: [{ op: "addImport", args: ["readFileSync", "node:fs"] }],
 *   expect: 'import { readFileSync } from "node:fs";\nexport const x = 1;',
 * };
 */
export interface OpExercise {
  /** Initial content seeded at `path` (flush-seed-rule, REQ-MC-04) — never a `create()` target. */
  seed: string;
  /** Optional target path; the kit defaults to a stable name using `baseDialect.extensions[0]`. */
  path?: string;
  /** Ops applied in order: a named pack op (`op` + `args`), or the universal `.raw`. */
  chain: ReadonlyArray<{ readonly op: string; readonly args: readonly unknown[] } | { readonly raw: (ast: unknown) => void }>;
  /** BYTE-EXACT printed content of the coalesced `modify` directive after the chain runs. */
  expect: string;
}

/**
 * Fixture passed to `testOpPack` to drive the conformance suite.
 * The fixture supplies the op-pack under test, the base dialect it augments, and the
 * op-invocation recipes (`exercises`) the kit needs to actually apply each op and assert
 * byte-exact effects — REQUIRED at the type level so an exercise-less fixture cannot
 * silently skip `testOpPack`'s load-bearing per-op assertions (REQ-DC-02..04).
 *
 * @example
 * const fixture: OpPackFixture = {
 *   opPack: myInsertImportOps,
 *   baseDialect: myTypeScriptDialect,
 *   exercises: [
 *     {
 *       seed: "export const x = 1;",
 *       chain: [{ op: "addImport", args: ["readFileSync", "node:fs"] }],
 *       expect: 'import { readFileSync } from "node:fs";\nexport const x = 1;',
 *     },
 *   ],
 * };
 */
export interface OpPackFixture {
  /** The op-pack to exercise against a real base dialect (not a mock). */
  opPack: OpPack;
  /** The base dialect that holds the live AST — required by ADR-0012 (op-packs tested against real dialects). */
  baseDialect: Dialect;
  /** The op-invocation recipes `testOpPack` applies — REQUIRED (rev 5, ADR-0012 amendment). */
  exercises: readonly OpExercise[];
}

/**
 * Runs the conformance suite for a dialect.
 * Asserts parse/print no-op round-trip fidelity, single-op fidelity,
 * serializable-bytes invariant, and leaf-rule compliance (ADR-0012).
 *
 * Full implementation is deferred to T-M2 — the first real dialect must exist
 * before the adversarial cases can be instantiated and validated.
 *
 * @example
 * testDialect({
 *   dialect: myTypeScriptDialect,
 *   samples: ["const x = 1;"],
 * });
 */
export function testDialect(_fixture: DialectFixture): void {
  // Full implementation arrives when the first dialect exists (deferred — see T-M2 milestone).
  throw new Error("testDialect: full conformance implementation is not yet available — no dialect exists yet");
}

/**
 * Runs the conformance suite for an op-pack.
 * Asserts single-op fidelity, unchanged-elsewhere invariant, coalescing to one `modify`,
 * and that the op-pack is exercised against a real base dialect (not a mock — ADR-0012).
 *
 * Full implementation is deferred to T-M2.
 *
 * @example
 * testOpPack({
 *   opPack: myInsertImportOps,
 *   baseDialect: myTypeScriptDialect,
 * });
 */
export function testOpPack(_fixture: OpPackFixture): void {
  // Full implementation arrives when the first dialect exists (deferred — see T-M2 milestone).
  throw new Error("testOpPack: full conformance implementation is not yet available — no dialect exists yet");
}
