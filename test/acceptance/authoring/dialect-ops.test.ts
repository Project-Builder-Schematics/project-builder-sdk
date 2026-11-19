import { describe, expect, it } from "bun:test";
import type { PickleStep } from "@cucumber/messages";
import { DIALECT_OP_STEPS } from "../../../src/acceptance/authoring/dialect-ops.ts";
import { matchStep, type World } from "../../../src/acceptance/runner/steps.ts";
import { factoryRun } from "../../../src/acceptance/shared/factory-run.ts";
import type { RunResult } from "../../../src/testing/index.ts";

async function runStep(world: World, text: string, table?: string[][]): Promise<void> {
  const match = matchStep(DIALECT_OP_STEPS, text);
  if (match.kind !== "defined") throw new Error(`no single definition for: ${text}`);
  await match.definition.run(world, table === undefined ? match.args : [...match.args, table], { text } as PickleStep);
}

async function failedWith(path: string, message: string, dialect = "typescript"): Promise<World> {
  const world: World = {};
  await runStep(world, `the author opens the Dialect handle "a" of the dialect "${dialect}" on the file "${path}"`);
  factoryRun(world).result = { error: new Error(`dialect operation failed: ${message}`) } as unknown as RunResult;
  return world;
}

/** A React run whose setJsxProp call targeted `tag`, then failed with `message`. */
async function targetFailedWith(tag: string, message: string): Promise<World> {
  const world = await failedWith("a.tsx", message, "react");
  await runStep(world, 'the author applies the op "setJsxProp" through the Dialect handle "a" with the arguments:', [
    ["argument", "value"],
    ["target", JSON.stringify(tag)],
  ]);
  return world;
}

const UNDECLARED = "the factory fails because the dialect does not declare the extension of the file";

describe("the undeclared-extension failure step", () => {
  it("passes on the dialect kit's rejection, which names the extension only through the path", async () => {
    const world = await failedWith("a.js", `find("a.js") — the file's extension is not one this dialect declares (.ts).`);
    await runStep(world, UNDECLARED);
  });

  it("passes on a rejection that names the extension outside the path", async () => {
    const world = await failedWith("a.ts", "find(path) — .ts is not a React file; use @pbuilder/sdk/typescript for TypeScript sources.");
    await runStep(world, UNDECLARED);
  });

  it("fails on another find error whose only mention of the extension is the quoted path", async () => {
    const world = await failedWith("a.ts", 'find("a.ts") — the file could not be read');
    await expect(runStep(world, UNDECLARED)).rejects.toThrow();
  });
});

describe("the invalid-TypeScript failure step", () => {
  const STEP = 'the factory fails because the file "a.ts" is not valid TypeScript';

  it("passes on the parse failure of the file", async () => {
    await runStep(await failedWith("a.ts", 'could not parse "a.ts": syntactically invalid TypeScript source'), STEP);
  });

  it("fails on another error that names the file", async () => {
    const world = await failedWith("a.ts", 'addImport("X") on "a.ts" — the binding is already claimed');
    await expect(runStep(world, STEP)).rejects.toThrow();
  });
});

describe("the refused-argument failure step", () => {
  const STEP = 'the factory fails because the argument "name" is not one the op accepts';

  it("passes when the op refuses the argument's value", async () => {
    const message = "`name` must be a valid JavaScript identifier — fix the name, or use `.modify()` to make this edit directly.";
    await runStep(await failedWith("a.ts", message), STEP);
  });

  it("passes when the op echoes the refused value it was given", async () => {
    const message = '`name` "await" is a reserved word and cannot be used as an import binding — fix the name, or use `.modify()` to make this edit directly.';
    const world = await failedWith("a.ts", message);
    await runStep(world, 'the author applies the op "addImport" through the Dialect handle "a" with the arguments:', [
      ["argument", "value"],
      ["name", '"await"'],
      ["from", '"m"'],
    ]);
    await runStep(world, STEP);
  });

  it("fails on another error that only mentions the argument", async () => {
    const world = await failedWith("a.ts", "the binding `name` is already claimed in a.ts");
    await expect(runStep(world, STEP)).rejects.toThrow();
  });
});

describe("the op-not-available failure step", () => {
  const STEP = 'the factory fails because the op "addTypeImport" is not available for the file';

  it("passes when the dialect withholds the op for the file's extension", async () => {
    const message =
      "addTypeImport is not available for .jsx files — they write TypeScript type syntax, which a .jsx file cannot hold. Use .modify() to make this edit directly.";
    await runStep(await failedWith("a.jsx", message, "react"), STEP);
  });

  it("fails on another rejection of the op", async () => {
    const world = await failedWith("a.jsx", 'addTypeImport("X") on "a.jsx" — the binding is already claimed', "react");
    await expect(runStep(world, STEP)).rejects.toThrow();
  });
});

describe("the target-match failure step", () => {
  const STEP = "the factory fails because the target does not match exactly one element";

  it("passes when no element matches the target", async () => {
    const message = "no element named `Button` was found — use `.modify()` to inspect the file and edit it directly.";
    await runStep(await targetFailedWith("Button", message), STEP);
  });

  it("passes when several elements match the target", async () => {
    const message = "`B` matched 2 elements — setJsxProp requires exactly one match; use `.modify()` to disambiguate.";
    await runStep(await targetFailedWith("B", message), STEP);
  });

  it("fails on another error that names the tag", async () => {
    const world = await targetFailedWith("Button", "`Button` has no closing tag");
    await expect(runStep(world, STEP)).rejects.toThrow();
  });
});

describe("the component failure step", () => {
  const STEP = 'the factory fails naming the component "Card"';

  it("passes on each way the React dialect names the component", async () => {
    for (const message of [
      "component `Card` has an expression body, so there is no statement list to add to — give it a block body, or use `.modify()` to make this edit directly.",
      "no component named `Card` (a top-level function, or a const holding an arrow or function expression) — use `.modify()` to edit it directly.",
      "prop `title` already exists on `Card` with a different type — change it with `.modify()`.",
    ]) {
      await runStep(await failedWith("a.tsx", message, "react"), STEP);
    }
  });

  it("fails on another error that only mentions the name", async () => {
    const world = await failedWith("a.tsx", "the binding `Card` is already claimed in a.tsx", "react");
    await expect(runStep(world, STEP)).rejects.toThrow();
  });
});
