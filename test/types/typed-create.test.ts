// Type-level tests for SEAM-01: the create<S> generic overload (REQ-01).
// Strategy mirrors handle-types.test.ts:
//   - positive proof: a never-invoked arrow whose body exercises the typed call;
//     tsc evaluates it (so a type error here fails `bun run typecheck`), runtime never runs it.
//   - the NEGATIVE proofs (REQ-01.2/.6/.7) live in permissive-proof.ts (CI guard, S-03).
//
// These positives CHARACTERIZE the skeleton's homomorphic mapped type `{ [K in keyof S]: S[K] }`:
// because the map is homomorphic (constraint `keyof S`), tsc preserves S's optionality, required-ness,
// and per-key value types — so the positive contract already holds. The value of this matrix is to
// LOCK that contract under `bun run typecheck` before the L1 semver freeze (no source change).
//
// REQ-01.1: create<{ name: string }>(…, { options: { name: "x" } }) compiles.
// REQ-01.3: untyped create(…, { options: <any JsonValue> }) still compiles (backward-compat).
// REQ-01.4: multi-field all-required present compiles (map covers keyof S, not a single hardcoded key).
// REQ-01.5: optional (`?`) key omitted compiles (homomorphic map preserves optionality).

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

  test("REQ-01.4 — multi-field schema with all required keys present compiles (triangulation)", () => {
    type S = { name: string; count: number };
    const _multiFieldProof = () => {
      const h = create<S>("dst.ts", { template: "t", options: { name: "x", count: 2 } });
      expectTypeOf(h).toEqualTypeOf<WritableHandle>();
    };
    void _multiFieldProof;
  });

  test("REQ-01.5 — optional key may be omitted and the call still compiles", () => {
    type S = { name: string; tag?: string };
    const _optionalOmittedProof = () => {
      const h = create<S>("dst.ts", { template: "t", options: { name: "x" } });
      expectTypeOf(h).toEqualTypeOf<WritableHandle>();
    };
    void _optionalOmittedProof;
  });
});
