/**
 * A-16 — a factory may open a handle of an author-defined dialect only when the dialect is declared
 * in the Manifest of the schematic's resolution scope; otherwise the factory fails at its end and no
 * file changes. The SDK's dialects carry no name and are never declared. A-7: handles of two
 * Dialects on one file keep both edits.
 */
import { describe, expect, it } from "bun:test";
import { defineDialect } from "../../../../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";
import { runFactoryForTest } from "../../../../../src/bounded-contexts/authoring/testing/harness/index.ts";

type Text = { text: string };
const ast = { parse: (text: string): Text => ({ text }), print: (tree: Text) => tree.text };
const ini = defineDialect({ name: "@company/ini-dialect", extensions: [".ini"], ast, ops: {} });
const sdkLike = defineDialect({ extensions: [".ini"], ast, ops: {} });
const seed = { "settings.ini": "colour=red" };
const NOT_DECLARED = 'the dialect "@company/ini-dialect" is not declared in the Manifest';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

describe("find — declared dialects (A-16)", () => {
  it("fails the factory when only a handle of an undeclared dialect is opened", async () => {
    const result = await runFactoryForTest(() => {
      ini.find("settings.ini");
    }, undefined, { seed });
    expect(errorMessage(result.error)).toContain(NOT_DECLARED);
    expect(result.tree.get("settings.ini")).toBeUndefined();
  });

  it("fails the factory and keeps the file when an undeclared dialect edits it", async () => {
    const result = await runFactoryForTest(async () => {
      await ini.find("settings.ini").modify((tree) => {
        tree.text = "colour=blue";
      });
    }, undefined, { seed });
    expect(errorMessage(result.error)).toContain(NOT_DECLARED);
    expect(result.tree.get("settings.ini")).toBeUndefined();
  });

  it("fails the factory when a handle opened outside the run edits through an undeclared dialect", async () => {
    const handle = ini.find("settings.ini");
    const result = await runFactoryForTest(async () => {
      await handle.modify((tree) => {
        tree.text = "colour=blue";
      });
    }, undefined, { seed });
    expect(errorMessage(result.error)).toContain(NOT_DECLARED);
    expect(result.tree.get("settings.ini")).toBeUndefined();
  });

  it("fails the factory when an undeclared dialect only inspects the file", async () => {
    const result = await runFactoryForTest(async () => {
      await ini.find("settings.ini").inspect((tree) => tree.text);
    }, undefined, { seed });
    expect(errorMessage(result.error)).toContain(NOT_DECLARED);
  });

  it("edits through a declared dialect", async () => {
    const result = await runFactoryForTest(async () => {
      await ini.find("settings.ini").modify((tree) => {
        tree.text = "colour=blue";
      });
    }, undefined, { seed, declaredDialects: ["@company/ini-dialect"] });
    expect(result.error).toBeUndefined();
    expect(result.tree.get("settings.ini")).toBe("colour=blue");
  });

  it("edits through a dialect without a name with nothing declared", async () => {
    const result = await runFactoryForTest(async () => {
      await sdkLike.find("settings.ini").modify((tree) => {
        tree.text = "colour=blue";
      });
    }, undefined, { seed });
    expect(result.error).toBeUndefined();
    expect(result.tree.get("settings.ini")).toBe("colour=blue");
  });

  it("keeps the edits of two dialects' handles on one file (A-7)", async () => {
    const result = await runFactoryForTest(async () => {
      await sdkLike.find("settings.ini").modify((tree) => {
        tree.text += "\nsize=1";
      });
      await ini.find("settings.ini").modify((tree) => {
        tree.text += "\nshape=round";
      });
    }, undefined, { seed, declaredDialects: ["@company/ini-dialect"] });
    expect(result.error).toBeUndefined();
    expect(result.tree.get("settings.ini")).toBe("colour=red\nsize=1\nshape=round");
  });
});
