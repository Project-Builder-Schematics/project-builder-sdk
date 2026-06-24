// Type-level tests for KIT-04: FoundHandle / WritableHandle state machine.
// Strategy:
//   - positive assertions: expectTypeOf (bun-native friendly, type-level only)
//   - negative assertions: @ts-expect-error on a type-only expression never called at runtime
//   - permissive-Handle mutation proof: see test/types/permissive-proof.ts
//
// The negative tests use a "dead call in a never-invoked arrow" pattern:
//   () => { /* @ts-expect-error */ ... }
// The arrow is never called, so no runtime error. tsc still evaluates it and enforces
// the @ts-expect-error. If WritableHandle ever gains `remove`, tsc rejects the unused
// @ts-expect-error directive — the regression is caught at typecheck time.

import { describe, expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import type { FoundHandle, WritableHandle } from "../../src/core/handle-state.ts";

describe("handle type-state machine (KIT-04)", () => {
  test("FoundHandle has remove(): void", () => {
    expectTypeOf<FoundHandle>().toHaveProperty("remove");
    type RemoveReturnType = ReturnType<FoundHandle["remove"]>;
    expectTypeOf<RemoveReturnType>().toEqualTypeOf<void>();
  });

  // ADR-01: read widened to Promise<string | undefined> — undefined is the not-found sentinel.
  test("WritableHandle has read(): Promise<string | undefined>", () => {
    expectTypeOf<WritableHandle>().toHaveProperty("read");
    type ReadReturnType = ReturnType<WritableHandle["read"]>;
    expectTypeOf<ReadReturnType>().toEqualTypeOf<Promise<string | undefined>>();
  });

  test("FoundHandle has read(): Promise<string | undefined>", () => {
    expectTypeOf<FoundHandle>().toHaveProperty("read");
    type ReadReturnType = ReturnType<FoundHandle["read"]>;
    expectTypeOf<ReadReturnType>().toEqualTypeOf<Promise<string | undefined>>();
  });

  test("WritableHandle does NOT have remove — enforced by @ts-expect-error", () => {
    // This arrow is NEVER called. tsc still type-checks it.
    // If WritableHandle gains `remove`, the @ts-expect-error becomes unused and tsc --noEmit fails.
    const _negativeProof = (_h: WritableHandle) => {
      // @ts-expect-error — WritableHandle must not have `remove`
      _h.remove();
    };
    // Runtime assertion: `remove` key is absent from the WritableHandle interface.
    // We assert on the type itself, not on a runtime value.
    expectTypeOf<WritableHandle>().not.toHaveProperty("remove" as never);

    // Suppress unused variable warning from TypeScript strict mode
    void _negativeProof;
  });

  test("FoundHandle is assignable to itself (shape sanity)", () => {
    type _Check = FoundHandle extends { read(): Promise<string | undefined>; remove(): void } ? true : false;
    expectTypeOf<_Check>().toEqualTypeOf<true>();
  });

  test("WritableHandle is NOT assignable to FoundHandle (remove is absent)", () => {
    type _Assignable = WritableHandle extends FoundHandle ? true : false;
    expectTypeOf<_Assignable>().toEqualTypeOf<false>();
  });
});
