// CONF-01: the conformance kit — testDialect / testOpPack (ADR-0012).
//
// S-004 (ADR-0012 amendment): real CORE bodies against the REAL TypeScript dialect — byte-
// exact round-trip (REQ-DC-01), single-op fidelity + unchanged-elsewhere (REQ-DC-02),
// coalescing-to-one content-verified (REQ-DC-03), seam-serializability (REQ-DC-04), and the
// read-boundary-split live counterpart (REQ-DC-05.2). Both functions are now
// `Promise<void>` (rev 3, Q3): observing DC-03/DC-04 requires awaiting a REAL async
// coalescing run (the handle's `#tail`, the run-boundary join, and `Session.flush` are all
// async) — a synchronous body could only inspect the emitted batch via a mock/bypass, which
// ADR-0012 and REQ-TSD-07 (ContractFake-only) forbid. Every failure REJECTS the returned
// promise with a descriptive Error (never a sync throw) — planted violations (REQ-DC-05)
// surface through an expect-reject wrapper at the call site.
//
// Drives real runs via `defineFactory` + the kit-internal `run-vehicle.ts` transport —
// imported for INTERNAL use only, never re-exported (FIT-08 bans re-export of kit symbols
// from this path, not internal use of them).

import type { Dialect, OpPack } from "../core/define-dialect.ts";
import type { Directive } from "../core/wire.ts";
import { defineFactory } from "../core/context.ts";
import { createRunVehicle } from "./run-vehicle.ts";

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

// Object.is-based structural equality (not `===`): JSON.stringify silently OMITS keys
// holding function/undefined/Symbol values (the closure-smuggle failure mode, REQ-DC-04.1)
// rather than throwing, so only a structural compare against the original catches a missing
// key. src/testing/contract-fake.ts (also shipped, ADR-0035) carries its own copy —
// duplicated deliberately: `./conformance` must not import `./testing` (the dev-only bundle
// boundary, FIT-17). Extraction into a kit-internal shared module is registered as a
// stage-5b followup (it has pkg-surface baseline implications).
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  if (a !== null && typeof a === "object" && b !== null && typeof b === "object") {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    const bKeys = Object.keys(bRecord);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => key in bRecord && deepEqual(aRecord[key], bRecord[key]));
  }
  return false;
}

// REQ-DC-04 (seam-serializability): `JSON.parse(JSON.stringify(directive))` must deep-equal
// `directive` for EVERY emitted directive. Two DISTINCT failure modes a planted `.raw()` can
// trigger (REQ-DC-04.1/.2): a closure attached to directive content is silently DROPPED by
// JSON.stringify (caught by the deepEqual mismatch below); a live AST node with circular
// parent pointers makes JSON.stringify itself THROW (caught by the try/catch below).
function assertSerializable(directives: readonly Directive[], label: string): void {
  for (const directive of directives) {
    let roundTripped: unknown;
    try {
      roundTripped = JSON.parse(JSON.stringify(directive));
    } catch (err) {
      throw new Error(
        `testOpPack: REQ-DC-04 seam-serializability (${label}) — a directive failed JSON.stringify, ` +
          `likely a live AST node with circular references attached to directive content: ` +
          `${err instanceof Error ? err.message : String(err)}`
      );
    }
    if (!deepEqual(directive, roundTripped)) {
      throw new Error(
        `testOpPack: REQ-DC-04 seam-serializability (${label}) — JSON.parse(JSON.stringify(directive)) ` +
          `did not deep-equal the original directive; a non-serializable value (e.g. a closure) was ` +
          `silently dropped`
      );
    }
  }
}

interface ExerciseRun {
  modifies: Array<{ path: string; content: string }>;
  directives: Directive[];
}

// Runs ONE exercise through a fresh, isolated run-vehicle (§4.4c): seeds `path` with `seed`,
// chains the exercise's ops on `baseDialect.find(path)` (`{op,args}` -> `handle[op](...args)`;
// `{raw}` -> `handle.raw(fn)`), optionally injects `handle.read()` right after the FIRST op
// (the read-boundary-split re-run), awaits, and returns every modify directive observed
// across the whole run, in emission order.
async function runExercise(
  dialect: Dialect,
  exercise: Pick<OpExercise, "seed" | "path" | "chain">,
  opts: { injectReadAfterFirstOp: boolean }
): Promise<ExerciseRun> {
  const path = exercise.path ?? `op-exercise${dialect.extensions[0] ?? ""}`;
  const { client, emitted } = createRunVehicle({ [path]: exercise.seed });

  const runner = defineFactory<void>(async () => {
    // `any`: fixtures span arbitrary op-packs, so the exercised handle's op-derived members
    // are not known at this generic boundary (mirrors OpPackFixture's own `unknown`-at-the-
    // boundary posture, design §4.3).
    let handle = dialect.find(path) as any;
    for (const [index, step] of exercise.chain.entries()) {
      handle = "raw" in step ? handle.raw(step.raw) : handle[step.op](...step.args);
      if (opts.injectReadAfterFirstOp && index === 0) {
        await handle.read();
      }
    }
    await handle;
  });
  await runner(undefined, { client });

  const directives = emitted.flatMap((b) => b.instructions);
  const modifies = directives
    .filter((d): d is Extract<Directive, { op: "modify" }> => d.op === "modify")
    .map((d) => d.modify);
  return { modifies, directives };
}

/**
 * Runs the conformance suite for a dialect: asserts parse/print no-op round-trip fidelity
 * (REQ-DC-01) — `print(parse(sample)) === sample` BYTE-EXACT, never AST-equal, for every
 * sample in `fixture.samples`.
 *
 * @example
 * await testDialect({
 *   dialect: myTypeScriptDialect,
 *   samples: ["const x = 1;"],
 * });
 */
export async function testDialect(fixture: DialectFixture): Promise<void> {
  for (const sample of fixture.samples) {
    const roundTripped = fixture.dialect.ast.print(fixture.dialect.ast.parse(sample));
    if (roundTripped !== sample) {
      const preview = sample.length > 80 ? `${sample.slice(0, 80)}...` : sample;
      throw new Error(
        `testDialect: REQ-DC-01 round-trip fidelity — print(parse(sample)) did not byte-exact match ` +
          `the original sample: ${JSON.stringify(preview)}`
      );
    }
  }
}

/**
 * Runs the conformance suite for an op-pack against a REAL base dialect (never a mock,
 * ADR-0012): for each of `fixture.exercises`, asserts single-op fidelity +
 * unchanged-elsewhere (REQ-DC-02) / coalescing-to-one content-verified (REQ-DC-03) via a
 * no-read run, seam-serializability (REQ-DC-04) over every emitted directive, and — for
 * every multi-op exercise — the read-boundary split (REQ-DC-05.2's live counterpart): a
 * mid-chain `read()` must force exactly TWO cumulative modify directives, never one.
 *
 * @example
 * await testOpPack({
 *   opPack: myInsertImportOps,
 *   baseDialect: myTypeScriptDialect,
 *   exercises: [
 *     {
 *       seed: "export const x = 1;",
 *       chain: [{ op: "addImport", args: ["readFileSync", "node:fs"] }],
 *       expect: 'import { readFileSync } from "node:fs";\nexport const x = 1;',
 *     },
 *   ],
 * });
 */
export async function testOpPack(fixture: OpPackFixture): Promise<void> {
  if (fixture.exercises.length === 0) {
    throw new Error(
      "testOpPack: fixture.exercises must include at least one exercise — REQ-DC-02..04 are untestable without one"
    );
  }
  const hasMultiOpExercise = fixture.exercises.some((exercise) => exercise.chain.length >= 2);
  if (!hasMultiOpExercise) {
    throw new Error(
      "testOpPack: fixture.exercises must include at least one multi-op exercise (>=2 ops) — " +
        "REQ-DC-03 (coalescing-to-one, >=2 distinguishable ops) is mandatory"
    );
  }

  for (const exercise of fixture.exercises) {
    // REQ-DC-02 (single-op exercises) / REQ-DC-03 (multi-op exercises): a no-read run must
    // coalesce to EXACTLY ONE modify for `path`, byte-exact `expect` — a FULL-output
    // comparison proves BOTH the op's intended effect AND that every other region stayed
    // byte-stable (never a `contains` substring, Theatre Criteria).
    const direct = await runExercise(fixture.baseDialect, exercise, { injectReadAfterFirstOp: false });
    // Serializability checked FIRST (REQ-DC-04) — a directive whose content isn't even a
    // proper serializable string makes a byte-exact comparison moot, and ordering it first
    // proves DC-04's own assertion is what fails a closure-/live-node-smuggle fixture,
    // rather than an incidental content mismatch masking it.
    assertSerializable(direct.directives, "no-read exercise");
    if (direct.modifies.length !== 1) {
      throw new Error(
        `testOpPack: REQ-DC-02/03 — expected exactly ONE modify directive for a no-read chain, got ${direct.modifies.length}`
      );
    }
    if (direct.modifies[0]?.content !== exercise.expect) {
      throw new Error(
        "testOpPack: REQ-DC-02/03 — the coalesced modify's content did not byte-exact match the fixture's expect value"
      );
    }

    if (exercise.chain.length >= 2) {
      // Read-boundary split (fifth core assertion, self-derived — the live counterpart of
      // the planted REQ-DC-05.2). Re-run injecting `handle.read()` right after the FIRST
      // op: the GLOBAL flush-before-read (ADR-0015) forces exactly TWO modify directives
      // whose cumulative content equals `expect`; directive #1's expected content is
      // SELF-DERIVED by running the first op ALONE — no extra fixture field.
      const firstOpOnly: Pick<OpExercise, "seed" | "path" | "chain"> = {
        seed: exercise.seed,
        path: exercise.path,
        chain: exercise.chain.slice(0, 1),
      };
      const firstOnly = await runExercise(fixture.baseDialect, firstOpOnly, { injectReadAfterFirstOp: false });
      const expectedFirst = firstOnly.modifies[0]?.content;
      if (expectedFirst === undefined) {
        throw new Error(
          "testOpPack: REQ-DC-05.2 — could not self-derive directive #1's expected content (the first op alone produced no modify)"
        );
      }

      const split = await runExercise(fixture.baseDialect, exercise, { injectReadAfterFirstOp: true });
      assertSerializable(split.directives, "read-split exercise");
      if (split.modifies.length !== 2) {
        throw new Error(
          `testOpPack: REQ-DC-05.2 read-boundary split — expected exactly TWO modify directives after a mid-chain read, got ${split.modifies.length}`
        );
      }
      if (split.modifies[0]?.content !== expectedFirst) {
        throw new Error(
          "testOpPack: REQ-DC-05.2 — the first split directive's content did not match the self-derived first-op-alone content"
        );
      }
      if (split.modifies[1]?.content !== exercise.expect) {
        throw new Error(
          "testOpPack: REQ-DC-05.2 — the cumulative (second) split directive's content did not byte-exact match the fixture's expect value"
        );
      }
    }
  }
}
