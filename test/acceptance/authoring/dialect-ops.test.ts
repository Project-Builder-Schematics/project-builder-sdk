import { describe, expect, it } from "bun:test";
import type { PickleStep } from "@cucumber/messages";
import { DIALECT_OP_STEPS } from "../../../src/acceptance/authoring/dialect-ops.ts";
import { matchStep, type World } from "../../../src/acceptance/runner/steps.ts";
import { factoryRun } from "../../../src/acceptance/shared/factory-run.ts";
import type { RunResult } from "../../../src/testing/index.ts";

async function runStep(world: World, text: string): Promise<void> {
  const match = matchStep(DIALECT_OP_STEPS, text);
  if (match.kind !== "defined") throw new Error(`no single definition for: ${text}`);
  await match.definition.run(world, match.args, { text } as PickleStep);
}

async function failedWith(path: string, message: string): Promise<World> {
  const world: World = {};
  await runStep(world, `the author opens the Dialect handle "a" of the dialect "typescript" on the file "${path}"`);
  factoryRun(world).result = { error: new Error(`dialect operation failed: ${message}`) } as unknown as RunResult;
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
