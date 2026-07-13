// REQ-FSC-07.1 (S-001, design §Test Derivation): `scaffold`'s declared return type is
// EXACTLY `void` — no handle, promise-of-handle, or entry list. Type-level pin,
// `expectTypeOf`-style — never invoked at runtime (handle-types.test.ts precedent).
import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import { scaffold } from "../../src/commons/index.ts";

describe("REQ-FSC-07.1 — scaffold returns exactly void", () => {
  test("scaffold's return type is void, not a WritableHandle or any chainable group", () => {
    expectTypeOf(scaffold).returns.toEqualTypeOf<void>();
  });
});
