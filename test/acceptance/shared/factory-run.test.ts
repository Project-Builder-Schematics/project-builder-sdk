import { describe, expect, it } from "bun:test";
import type { PickleStep } from "@cucumber/messages";
import { DIALECT_OP_STEPS } from "../../../src/acceptance/authoring/dialect-ops.ts";
import { matchStep, type World } from "../../../src/acceptance/runner/steps.ts";
import { FACTORY_RUN_STEPS, factoryRun } from "../../../src/acceptance/shared/factory-run.ts";
import type { RunResult } from "../../../src/testing/index.ts";

async function runStep(world: World, text: string, table?: string[][]): Promise<void> {
  const match = matchStep([...DIALECT_OP_STEPS, ...FACTORY_RUN_STEPS], text);
  if (match.kind !== "defined") throw new Error(`no single definition for: ${text}`);
  await match.definition.run(world, table === undefined ? match.args : [...match.args, table], { text } as PickleStep);
}

const reads = (n: number) => `the number of reads of the file "a.ts" served by the engine is "${n}"`;

/** A run that adds two imports through one typescript handle, ended by the factory. */
async function chainedRun(): Promise<World> {
  const world: World = {};
  await runStep(world, 'a workspace containing the file "a.ts" with content "const a = 1;"');
  await runStep(world, 'the author opens the Dialect handle "a" of the dialect "typescript" on the file "a.ts"');
  for (const name of ["x", "y"]) {
    await runStep(world, 'the author applies the op "addImport" through the Dialect handle "a" with the arguments:', [
      ["argument", "value"],
      ["name", JSON.stringify(name)],
      ["from", JSON.stringify(`./${name}`)],
    ]);
  }
  await runStep(world, "the factory ends");
  return world;
}

describe("the read-count step", () => {
  it("passes on the number of reads the engine served", async () => {
    await runStep(await chainedRun(), reads(1));
  });

  it("fails on another number", async () => {
    const world = await chainedRun();
    await expect(runStep(world, reads(0))).rejects.toThrow();
    await expect(runStep(world, reads(2))).rejects.toThrow();
  });

  it("fails when the run failed unexpectedly", async () => {
    const world = await chainedRun();
    factoryRun(world).result = { ...factoryRun(world).result!, error: new Error("boom") } as RunResult;
    await expect(runStep(world, reads(1))).rejects.toThrow();
  });
});
