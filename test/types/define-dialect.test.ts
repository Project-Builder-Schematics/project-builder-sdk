// Type-level tests for defineDialect / defineOpPack / withOps (S-003 — types + thin sigs only).
// Real generics and dialect resolution are deferred to T-M2.

import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import {
  defineDialect,
  defineOpPack,
  withOps,
  type Dialect,
  type OpPack,
} from "../../src/core/define-dialect.ts";

describe("defineDialect / defineOpPack / withOps — type surface (S-003)", () => {
  test("defineDialect is a function", () => {
    expectTypeOf(defineDialect).toBeFunction();
  });

  test("defineOpPack is a function", () => {
    expectTypeOf(defineOpPack).toBeFunction();
  });

  test("withOps is a function", () => {
    expectTypeOf(withOps).toBeFunction();
  });

  test("Dialect type is exported", () => {
    type _Check = Dialect extends object ? true : false;
    expectTypeOf<_Check>().toEqualTypeOf<true>();
  });

  test("OpPack type is exported", () => {
    type _Check = OpPack extends object ? true : false;
    expectTypeOf<_Check>().toEqualTypeOf<true>();
  });
});
