/**
 * A-16 — an author-defined dialect is named by the package that ships it; the SDK's dialects carry
 * no name. Deriving a dialect keeps the name of the dialect it derives from.
 */
import { describe, it, expect } from "bun:test";
import { defineDialect, overrideOps, withOps, withoutOps } from "../../../../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";

const ast = { parse: (source: string) => ({ source }), print: (tree: { source: string }) => tree.source };
const ops = { noop(_tree: { source: string }) {} };

describe("defineDialect — name (A-16)", () => {
  it("exposes the name it was given", () => {
    expect(defineDialect({ name: "@company/ini-dialect", extensions: [".ini"], ast, ops }).name).toBe("@company/ini-dialect");
  });

  it("leaves a dialect without a name unnamed", () => {
    expect(defineDialect({ extensions: [".ini"], ast, ops }).name).toBeUndefined();
  });

  it("keeps the name through withOps, withoutOps and overrideOps", () => {
    const ini = defineDialect({ name: "@company/ini-dialect", extensions: [".ini"], ast, ops });
    expect(withOps(ini, { other(_tree: { source: string }) {} }).name).toBe("@company/ini-dialect");
    expect(withoutOps(ini, ["noop"], "not here").name).toBe("@company/ini-dialect");
    expect(overrideOps(ini, { noop() {} }).name).toBe("@company/ini-dialect");
  });

  it("keeps an unnamed base unnamed through withOps", () => {
    expect(withOps(defineDialect({ extensions: [".ini"], ast, ops }), {}).name).toBeUndefined();
  });
});
