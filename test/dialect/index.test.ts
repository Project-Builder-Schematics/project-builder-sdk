/**
 * A-16 — `@pbuilder/sdk/dialect` is the author-facing dialect kit: a dialect built from it alone
 * gives a handle that chains, drains, flushes and offers `.modify()`, and it must be named.
 */
import { describe, expect, it } from "bun:test";
import * as kit from "../../src/dialect/index.ts";
import { runFactoryForTest } from "../../src/testing/index.ts";

type Text = { text: string };
const ast = { parse: (text: string): Text => ({ text }), print: (tree: Text) => tree.text };

describe("@pbuilder/sdk/dialect (A-16)", () => {
  it("exports the registration kit and nothing else", () => {
    expect(Object.keys(kit).sort()).toEqual(["byExtension", "defineDialect", "defineOpPack", "overrideOps", "query", "withOps", "withoutOps"]);
  });

  it("rejects a dialect without a name", () => {
    const define = kit.defineDialect as (d: unknown) => unknown;
    expect(() => define({ extensions: [".ini"], ast, ops: {} })).toThrow('"name" is required');
    expect(() => define({ name: "", extensions: [".ini"], ast, ops: {} })).toThrow('"name" is required');
  });

  it("gives a declared dialect a handle that chains ops and .modify() and flushes once", async () => {
    const ops = kit.defineOpPack<Text, { setColour(tree: Text, colour: string): void }>({
      setColour(tree: Text, colour: string) {
        tree.text = tree.text.replace(/colour=\w+/, `colour=${colour}`);
      },
    });
    const ini = kit.defineDialect({ name: "@company/ini-dialect", extensions: [".ini"], ast, ops });
    const result = await runFactoryForTest(
      () => {
        ini.find("settings.ini").setColour("blue").modify((tree) => {
          tree.text += "\nsize=1";
        });
      },
      undefined,
      { seed: { "settings.ini": "colour=red" }, declaredDialects: ["@company/ini-dialect"] }
    );
    expect(result.error).toBeUndefined();
    expect(result.tree.get("settings.ini")).toBe("colour=blue\nsize=1");
  });
});
