// Type-level tests for SEAM-01: the create<S> generic overload (REQ-01).
// Strategy mirrors handle-types.test.ts:
//   - positive proof: a never-invoked arrow whose body exercises the typed call;
//     tsc evaluates it (so a type error here fails `bun run typecheck`), runtime never runs it.
//   - the excess-field NEGATIVE proof (REQ-01.2) lives in permissive-proof.ts (inverted-exit).
//
// REQ-01.1: create<{ name: string }>(…, { options: { name: "x" } }) compiles.
// REQ-01.3: untyped create(…, { options: <any JsonValue> }) still compiles (backward-compat).

import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import { create } from "../../src/commons/index.ts";
import type { WritableHandle } from "../../src/core/handle-state.ts";

describe("create<S> generic overload — type surface (SEAM-01 / REQ-01)", () => {
  test("REQ-01.1 — typed create compiles for a matching single-field schema", () => {
    type S = { name: string };
    const _typedProof = () => {
      const h = create<S>("dst.ts", { template: "t", options: { name: "x" } });
      expectTypeOf(h).toEqualTypeOf<WritableHandle>();
    };
    void _typedProof;
  });

  test("REQ-01.3 — untyped create still compiles for bare JsonValue options", () => {
    const _untypedProof = () => {
      const h = create("dst.ts", { template: "t", options: { anything: true } });
      expectTypeOf(h).toEqualTypeOf<WritableHandle>();
    };
    void _untypedProof;
  });
});
