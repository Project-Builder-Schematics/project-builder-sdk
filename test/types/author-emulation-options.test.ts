// Type-level tests for the author-emulation fixture's typed options (REQ-AEG-03.1). Lives
// in the MAIN tsc --noEmit set (repo precedent: test/types/typed-create.test.ts,
// test/types/typed-factory-options.test.ts) — a @ts-expect-error directive that goes UNUSED
// turns the build itself RED (TS2578); no separate CI guard is needed here.
//
// Positive proof: a never-invoked arrow whose body exercises the generated `Input` type
// against `create`'s existing generic overload (SEAM-01) — tsc evaluates it (a type error
// here fails `bun run typecheck`), runtime never runs it. This proves REQ-AEG-03.1's
// compile-time guarantee without depending on the fixture's factory (S-003 territory).

import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import { create } from "../../src/commons/index.ts";
import type { WritableHandle } from "../../src/core/handle-state.ts";
import type { Input } from "../fixtures/author-emulation/schema.generated.ts";

describe("author-emulation fixture — typed options compile against the generated Input (REQ-AEG-03.1)", () => {
  test("REQ-AEG-03.1 — an options object matching schema.json's shape compiles", () => {
    const _typedProof = () => {
      const h = create<Input>("dst.ts", {
        template: "t",
        options: { name: "widget", withTests: true, visibility: "public" },
      });
      expectTypeOf(h).toEqualTypeOf<WritableHandle>();
    };
    void _typedProof;
  });

  // Mutation-resistant proof #1: `name` is `required: true` in schema.json — omitting it
  // must fail to compile. If codegen ever regressed to marking it optional (or `any`),
  // this @ts-expect-error would go UNUSED and tsc itself would turn RED (TS2578).
  test("REQ-AEG-03.1 mutation-resistant — omitting the required `name` field is rejected", () => {
    const _requiredFieldProof = () => {
      create<Input>("dst.ts", {
        template: "t",
        // @ts-expect-error — `name` is required per schema.json; omitting it must not compile.
        options: { withTests: true },
      });
    };
    void _requiredFieldProof;
  });

  // Mutation-resistant proof #2 (triangulation — a distinct failure mode from #1): `name`
  // is typed `string`, not `number` — a type mismatch on a PRESENT field must also be
  // rejected, proving the generated type isn't `any`/untyped.
  test("REQ-AEG-03.1 mutation-resistant — a type-mismatched `name` value is rejected", () => {
    const _typeMismatchProof = () => {
      create<Input>("dst.ts", {
        template: "t",
        // @ts-expect-error — `name` must be a string per schema.json, not a number.
        options: { name: 42 },
      });
    };
    void _typeMismatchProof;
  });
});
