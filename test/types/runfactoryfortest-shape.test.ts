// Type-level tests for runFactoryForTest<O>'s bare-fn signature (REQ-ATH-01.1/.5,
// REQ-ATH-18.2). Lives in the MAIN tsc --noEmit set (repo precedent:
// test/types/typed-factory-options.test.ts) — a @ts-expect-error directive that goes
// UNUSED turns the build itself RED (TS2578); no separate CI guard is needed here.
//
// Positive proofs: a never-invoked arrow whose body exercises the typed call — tsc
// evaluates it (a type error here fails `tsc --noEmit`), runtime never runs it.

import { describe, test } from "bun:test";
import { runFactoryForTest } from "../../src/testing/index.ts";

describe("runFactoryForTest<O> — bare-fn type surface (REQ-ATH-01.1/.5, REQ-ATH-18.2)", () => {
  test("REQ-ATH-01.1 — a bare (input) => void|Promise<void> function compiles, options bag optional", () => {
    const _bareProof = () => {
      runFactoryForTest<{ name: string }>((input) => {
        void input.name;
      }, { name: "hello" });

      runFactoryForTest<{ name: string }>(
        async (input) => {
          void input.name;
        },
        { name: "hello" },
        { seed: { "a.ts": "x" }, packageDir: "/tmp/example" }
      );
    };
    void _bareProof;
  });

  // REQ-ATH-18.2 pin: a zero-argument factory is a valid `fn` — TS function-type
  // compatibility allows a source with FEWER parameters than the target signature (the
  // extra `input` argument is simply never read).
  test("REQ-ATH-18.2 — a zero-argument factory compiles (arity mismatch in the permissive direction is allowed)", () => {
    const _zeroArgProof = () => {
      runFactoryForTest<{ name: string }>(() => {}, { name: "hello" });
    };
    void _zeroArgProof;
  });

  // REQ-ATH-01.5 [red-proof]: the OLD arity-2 wrapped-runner shape — what `defineFactory`
  // used to hand back for direct harness use — must be REJECTED at compile time. A widened
  // signature accepting both shapes would defeat this check even though the positive proof
  // above still passes.
  test("REQ-ATH-01.5 [red-proof] — the old wrapped-runner shape is rejected at compile time", () => {
    type OldWrappedRunner<O> = (o: O, deps: { client: { emit: unknown } }) => Promise<void>;
    const oldRunner: OldWrappedRunner<{ name: string }> = async () => {};

    const _rejectionProof = () => {
      // @ts-expect-error — the old arity-2 wrapped-runner shape requires MORE parameters
      // than runFactoryForTest's bare-fn type provides at call sites; a dual-shape/widened
      // signature would silently accept this and must not.
      runFactoryForTest(oldRunner, { name: "hello" });
    };
    void _rejectionProof;
  });
});
