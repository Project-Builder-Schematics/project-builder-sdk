// ADR-04 (stdio-engine-client, REQ-RUN-06): `defineFactory`'s returned wrapper carries a
// non-enumerable brand marker, checked via `isDefineFactoryWrapped` — arity-independent
// double-wrap detection (RUN-06.2 rejects V1's arity-sniffing mechanism).

import { describe, it, expect } from "bun:test";
import { defineFactory, isDefineFactoryWrapped } from "../../src/core/context.ts";

describe("ADR-04 — defineFactory brand marker", () => {
  it("a value returned by defineFactory() is recognized as wrapped", () => {
    const wrapped = defineFactory<void>(() => {});
    expect(isDefineFactoryWrapped(wrapped)).toBe(true);
  });

  it("a bare arity-1 function (never passed through defineFactory) is NOT recognized as wrapped", () => {
    const bare = (_o: unknown) => {};
    expect(isDefineFactoryWrapped(bare)).toBe(false);
  });

  it("REQ-RUN-06.2 negative triangulation: a bare arity-2 function is NOT misclassified as wrapped (proves the check is brand-based, not arity-based)", () => {
    const bareArityTwo = (_o: unknown, _unused: unknown) => {};
    expect(isDefineFactoryWrapped(bareArityTwo)).toBe(false);
  });

  it("the brand is non-enumerable — it does not appear in Object.keys or a for..in scan of the wrapper", () => {
    const wrapped = defineFactory<void>(() => {});
    expect(Object.keys(wrapped)).toEqual([]);
    const seen: string[] = [];
    for (const key in wrapped) seen.push(key);
    expect(seen).toEqual([]);
  });

  it("non-function values (null, plain object, string) are never recognized as wrapped", () => {
    expect(isDefineFactoryWrapped(null)).toBe(false);
    expect(isDefineFactoryWrapped(undefined)).toBe(false);
    expect(isDefineFactoryWrapped({})).toBe(false);
    expect(isDefineFactoryWrapped("defineFactory")).toBe(false);
  });

  it("two independently-wrapped factories both carry the SAME brand (module-level marker, not per-call)", () => {
    const wrappedA = defineFactory<void>(() => {});
    const wrappedB = defineFactory<void>(async () => {});
    expect(isDefineFactoryWrapped(wrappedA)).toBe(true);
    expect(isDefineFactoryWrapped(wrappedB)).toBe(true);
  });
});
