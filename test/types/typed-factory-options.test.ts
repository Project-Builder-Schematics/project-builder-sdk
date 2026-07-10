// Type-level tests for defineFactory<O> (REQ-TFO-01/02). Lives in the MAIN tsc --noEmit
// set (repo precedent: test/types/typed-create.test.ts) — a @ts-expect-error directive
// that goes UNUSED turns the build itself RED (TS2578); no separate CI guard is needed
// here (contrast test/types/permissive-proof.ts, which is excluded from the main set and
// needs its own spawn-based guard because its proofs are deliberately-invalid code).
//
// Positive proofs: a never-invoked arrow whose body exercises the typed call — tsc
// evaluates it (a type error here fails `tsc --noEmit`), runtime never runs it.

import { describe, test } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";

describe("defineFactory<O> — type surface (REQ-TFO-01/02)", () => {
  test("REQ-TFO-02.1 — untyped defineFactory(fn), no type parameter supplied, still compiles", () => {
    const _untypedProof = () => {
      defineFactory(() => {});
    };
    void _untypedProof;
  });

  // REQ-TFO-01.2 — mutation-resistant single-source proof (Gap 7). Simulates the
  // POST-regeneration generated type (schema.json's `port` changed string -> number and
  // the bin re-run): the factory body's use of a string-only method on the now-`number`
  // `options.port` must FAIL to compile. If the generated type ever stopped reflecting
  // schema.json faithfully (a second, independently-maintained declaration crept back in,
  // or codegen regressed to `any`), this directive would go UNUSED and tsc itself would
  // turn RED (TS2578) — that reddening IS the proof.
  test("REQ-TFO-01.2 — a schema-mutated (string -> number) generated type breaks the old factory body", () => {
    type MutatedInput = { port: number };
    const _mutationResistantProof = () => {
      defineFactory<MutatedInput>((options) => {
        // @ts-expect-error — `port` is now `number` post-regeneration; a string-only
        // method call on it must be rejected (TS2339), proving no second, independently
        // -maintained type declaration survives the schema change.
        options.port.toUpperCase();
      });
    };
    void _mutationResistantProof;
  });
});
