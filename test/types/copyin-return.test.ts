// REQ-FEH-04.3 (S-003, file-escape-hatches spec V3): `copyIn`'s declared return type is
// EXACTLY `void`, mirroring `folder-scaffold` REQ-FSC-07.1's `scaffold` pin. Type-level
// pin, `expectTypeOf`-style — never invoked at runtime (scaffold-return.test.ts precedent).
import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import { copyIn } from "../../src/commons/index.ts";

describe("REQ-FEH-04.3 — copyIn returns exactly void", () => {
  test("copyIn's return type is void, not a WritableHandle or any chainable group", () => {
    expectTypeOf(copyIn).returns.toEqualTypeOf<void>();
  });
});
