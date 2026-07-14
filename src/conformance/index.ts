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
import { deepEqual } from "../core/deep-equal.ts";
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
 * op `chain` (named pack ops and/or the universal `.modify`), and assert the coalesced
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
  /** Ops applied in order: a named pack op (`op` + `args`), or the universal `.modify`. */
  chain: ReadonlyArray<{ readonly op: string; readonly args: readonly unknown[] } | { readonly modify: (ast: unknown) => void }>;
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
      handle = "modify" in step ? handle.modify(step.modify) : handle[step.op](...step.args);
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

// REQ-DC-06 (ADR-0012 amendment clause 1): six mandatory adversarial samples, injected
// ADDITIVELY into every `testDialect` run — `DialectFixture` carries no field capable of
// disabling this (compile-level guarantee, REQ-DC-06.2, see test/conformance/planted/
// opt-out-attempt.test.ts). Each sample is independently verified to round-trip byte-exact
// against the real TypeScript dialect (`ast.ts`'s parse/print pair) — a dialect that fails one
// is a real conformance failure, not a fixture artefact.
const MANDATORY_ADVERSARIAL_SAMPLES: readonly string[] = [
  "", // empty file
  "// just a comment, no statements\n", // comment-only file
  `/*${"a".repeat(4 * 1024 * 1024)}*/\nconst x = 1;\n`, // 4 MiB serialized-boundary sample (REQ-TSD-03.7 precedent)
  "const x = 1;\r\nconst y = 2;\r\n", // CRLF
  "﻿const x = 1;\n", // UTF-8 BOM
  'import { a } from "m";\nimport { b } from "m";\n', // duplicate-target: two import statements sharing one module specifier
];

// Shared by `testDialect` and `testOpPack` (verify-in-loop-4 Finding #1): the round-trip +
// real-base-probe loop is ONE mechanism, run against whichever dialect reference the caller
// holds (`fixture.dialect` for testDialect, `fixture.baseDialect` for testOpPack) — REQ-DC-06's
// chapeau ("into EVERY testDialect/testOpPack run") and REQ-DC-08 (real-base-dialect rule) both
// name a dialect's `ast.parse`/`ast.print` pair, not an op-chain, so no per-op synthesis is
// needed to satisfy either for `testOpPack`. `label` scopes error messages to the caller.
function runRoundTripProbe(
  dialectAst: { parse(source: string): unknown; print(ast: unknown): string },
  samples: readonly string[],
  label: string
): void {
  for (const sample of samples) {
    const ast = dialectAst.parse(sample);
    // REQ-DC-08 (real-base-dialect rule): a stub/mock parse that returns nothing or hands
    // back the input string unchanged would let an identity round-trip pass vacuously —
    // reject before the round-trip assertion can even run.
    if (ast === null || ast === undefined || ast === sample) {
      throw new Error(
        `${label}: REQ-DC-08 real-base-dialect rule — dialect.ast.parse(sample) returned a ` +
          "nullish value or the input string unchanged; a real dialect's parse must produce a distinct AST"
      );
    }
    const roundTripped = dialectAst.print(ast);
    if (roundTripped !== sample) {
      const preview = sample.length > 80 ? `${sample.slice(0, 80)}...` : sample;
      throw new Error(
        `${label}: REQ-DC-01 round-trip fidelity — print(parse(sample)) did not byte-exact match ` +
          `the original sample: ${JSON.stringify(preview)}`
      );
    }
  }
}

/**
 * Runs the conformance suite for a dialect: asserts parse/print no-op round-trip fidelity
 * (REQ-DC-01) — `print(parse(sample)) === sample` BYTE-EXACT, never AST-equal, for every
 * sample in `fixture.samples` PLUS the six mandatory adversarial samples the kit injects on
 * every run (REQ-DC-06 — additive, not opt-out-able). Before each round-trip check, verifies
 * `fixture.dialect.ast.parse` is a REAL parser, not an identity/stub function (REQ-DC-08): a
 * `parse` returning `null`/`undefined`, or the input string unchanged, fails BEFORE the
 * round-trip assertion could vacuously pass.
 *
 * @example
 * await testDialect({
 *   dialect: myTypeScriptDialect,
 *   samples: ["const x = 1;"],
 * });
 */
export async function testDialect(fixture: DialectFixture): Promise<void> {
  const samples = [...fixture.samples, ...MANDATORY_ADVERSARIAL_SAMPLES];
  runRoundTripProbe(fixture.dialect.ast, samples, "testDialect");
}

/**
 * Runs the conformance suite for an op-pack against a REAL base dialect (never a mock,
 * ADR-0012): for each of `fixture.exercises`, asserts single-op fidelity +
 * unchanged-elsewhere (REQ-DC-02) / coalescing-to-one content-verified (REQ-DC-03) via a
 * no-read run, seam-serializability (REQ-DC-04) over every emitted directive, and — for
 * every multi-op exercise — the read-boundary split (REQ-DC-05.2's live counterpart): a
 * mid-chain `read()` must force exactly TWO cumulative modify directives, never one. Finally,
 * asserts `fixture.baseDialect` survives the six mandatory adversarial samples' round-trip +
 * real-base probe (REQ-DC-06/REQ-DC-08 — additive, not opt-out-able, same mechanism
 * `testDialect` runs), unconditionally on every call whose exercises pass.
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

  // REQ-DC-06/REQ-DC-08 (verify-in-loop-4 Finding #1): the six mandatory adversarial
  // samples' round-trip + real-base probe, run against `fixture.baseDialect` — same
  // mechanism `testDialect` runs, independent of `fixture.exercises`. Deliberately LAST
  // (not first, unlike testDialect): a fixture's own exercises target ONE specific
  // REQ-DC-02..05 failure mode against a baseDialect that may be intentionally non-generic
  // (e.g. this repo's own REQ-DC-05 planted-violation fixtures use hand-rolled/identity
  // `ast` pairs to isolate that ONE mode) — ordering the probe last lets that exercise-level
  // failure surface for its own reason first, while still running the probe unconditionally
  // on every call whose exercises pass, exactly as REQ-DC-06's "regardless of what samples
  // the contributor's own fixture supplies" demands.
  runRoundTripProbe(fixture.baseDialect.ast, MANDATORY_ADVERSARIAL_SAMPLES, "testOpPack");
}
