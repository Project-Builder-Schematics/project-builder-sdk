// Type-level tests for defineDialect / defineOpPack / withOps — real generics (S-001,
// ADR-0010 / ADR-0037). Covers REQ-DG-01.1/.2, REQ-DG-02.1, REQ-DG-03 (.raw presence), and
// the thenable-handle type.
//
// REQ-DG-02.1 (compile-time intersection pin) is UNCHANGED by S-004: op-pack composition
// still type-checks only through attached ops. REQ-DG-02.2–02.5 (runtime collision +
// reserved-name checks) are NEW, RUNTIME-only load-bearing proof this file cannot express
// (the kit's `any`-erasure means a THIRD-PARTY pack collision evaporates at the type level) —
// see test/core/define-dialect-collision.test.ts, the load-bearing proof for those scenarios.
//
// Negative assertions use the "dead call in a never-invoked arrow" pattern (house
// convention, test/types/handle-types.test.ts): tsc still evaluates and enforces the
// expect-error directive even though the arrow never runs.
import { describe, test } from "bun:test";
import { expectTypeOf } from "expect-type";
import {
  defineDialect,
  defineOpPack,
  withOps,
  type Dialect,
  type OpPack,
  type Handle,
} from "../../src/core/define-dialect.ts";

interface Ast {
  lines: string[];
}

describe("defineDialect / defineOpPack / withOps — real generics (S-001)", () => {
  test("defineDialect is a function", () => {
    expectTypeOf(defineDialect).toBeFunction();
  });

  test("defineOpPack is a function", () => {
    expectTypeOf(defineOpPack).toBeFunction();
  });

  test("withOps is a function", () => {
    expectTypeOf(withOps).toBeFunction();
  });

  test("Dialect type is exported (bare usage resolves via default type params)", () => {
    type _Check = Dialect extends object ? true : false;
    expectTypeOf<_Check>().toEqualTypeOf<true>();
  });

  test("OpPack type is exported (bare usage resolves via default type params)", () => {
    type _Check = OpPack extends object ? true : false;
    expectTypeOf<_Check>().toEqualTypeOf<true>();
  });

  // REQ-DG-01.1: the descriptor shape is FROZEN — exactly extensions/ast/ops. A 5th
  // top-level field is a compile error.
  test("REQ-DG-01.1: a 5th descriptor field is a compile error", () => {
    const _negativeProof = () => {
      defineDialect({
        extensions: [".toy"],
        ast: { parse: (s: string): Ast => ({ lines: s.split("\n") }), print: (a: Ast): string => a.lines.join("\n") },
        ops: {},
        // @ts-expect-error — a 5th top-level field on the dialect descriptor is not allowed.
        extra: "not allowed",
      });
    };
    void _negativeProof;
  });

  // REQ-DG-02.1: a chain type-checks only through ATTACHED ops; an op from an unattached
  // pack (or a typo) does not type-check.
  test("REQ-DG-02.1: chain type-checks only through attached ops", () => {
    const base = defineDialect({
      extensions: [".toy"],
      ast: { parse: (s: string): Ast => ({ lines: s.split("\n") }), print: (a: Ast): string => a.lines.join("\n") },
      ops: {},
    });
    const attachedPack = defineOpPack<Ast, { push: (ast: Ast, line: string) => void }>({
      push(ast, line) {
        ast.lines.push(line);
      },
    });
    const unattachedPack = defineOpPack<Ast, { wipe: (ast: Ast) => void }>({
      wipe(ast) {
        ast.lines = [];
      },
    });
    const composed = withOps(base, attachedPack);

    expectTypeOf(composed.find).parameter(0).toEqualTypeOf<string>();
    // Positive: the attached op is callable on the handle returned by find().
    type ComposedHandle = ReturnType<typeof composed.find>;
    expectTypeOf<ComposedHandle>().toHaveProperty("push");

    const _negativeProof = (h: ComposedHandle) => {
      void unattachedPack;
      // @ts-expect-error — `wipe` belongs to a pack never attached via withOps.
      h.wipe();
    };
    void _negativeProof;
  });

  // REQ-DG-02.3: defineOpPack is usable standalone, before any withOps composition.
  test("REQ-DG-02.3: defineOpPack is usable standalone (not yet composed via withOps)", () => {
    const standalonePack = defineOpPack<Ast, { push: (ast: Ast, line: string) => void }>({
      push(ast, line) {
        ast.lines.push(line);
      },
    });
    expectTypeOf(standalonePack.push).toBeFunction();
    expectTypeOf<Parameters<typeof standalonePack.push>>().toEqualTypeOf<[Ast, string]>();
  });

  // .raw() presence — the universal L2 escape hatch (REQ-DG-03) on every handle.
  test(".raw is present on the handle surface", () => {
    expectTypeOf<Handle<"found", Ast, {}>>().toHaveProperty("raw");
    type RawFn = Handle<"found", Ast, {}>["raw"];
    expectTypeOf<Parameters<RawFn>>().toEqualTypeOf<[(ast: Ast) => void]>();
  });

  // The handle is the first thenable object on the author surface (ADR-0037) —
  // PromiseLike<void>, awaitable directly.
  test("Handle is a thenable (PromiseLike<void>)", () => {
    expectTypeOf<Handle<"found", Ast, {}>>().toHaveProperty("then");
    type _Assignable = Handle<"found", Ast, {}> extends PromiseLike<void> ? true : false;
    expectTypeOf<_Assignable>().toEqualTypeOf<true>();
  });

  // ADR-0004 chaining table (honored on the async dialect handle, ADR-0037 clause 1b):
  // `remove` exists only on the "found" state; an edit flips State to "writable", where
  // `remove` no longer type-checks.
  test("remove() exists on 'found' state only — absent on 'writable'", () => {
    expectTypeOf<Handle<"found", Ast, {}>>().toHaveProperty("remove");

    const _negativeProof = (h: Handle<"writable", Ast, {}>) => {
      // @ts-expect-error — 'writable' state handles do not have remove().
      h.remove();
    };
    void _negativeProof;
  });
});
