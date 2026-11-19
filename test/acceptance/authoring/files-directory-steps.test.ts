import { afterAll, describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { PickleStep } from "@cucumber/messages";
import { FILES_DIRECTORY_STEPS } from "../../../src/acceptance/authoring/files-directory-steps.ts";
import { matchStep, type World } from "../../../src/acceptance/runner/steps.ts";
import { removeScratch } from "../../../src/acceptance/shared/scratch.ts";

afterAll(removeScratch);

async function runStep(world: World, text: string): Promise<void> {
  const match = matchStep(FILES_DIRECTORY_STEPS, text);
  if (match.kind !== "defined") throw new Error(`no single definition for: ${text}`);
  await match.definition.run(world, match.args, { text } as PickleStep);
}

/** A world whose files directory holds the planted step's file and has been read. */
async function read(planting: string): Promise<World> {
  const world: World = {};
  await runStep(world, planting);
  await runStep(world, "the files directory of the schematic is read");
  return world;
}

const holds = (path: string) => `the files directory of the schematic holds the file "${path}"`;

describe("the files-directory steps", () => {
  it("read the path template of a planted file", async () => {
    await runStep(await read(holds("__name__.ts")), 'the path template of the file "__name__.ts" is "{= .name =}.ts"');
  });

  it("refuse another path template", async () => {
    const world = await read(holds("__name__.ts"));
    await expect(runStep(world, 'the path template of the file "__name__.ts" is "__name__.ts"')).rejects.toThrow();
  });

  it("refuse a failure step when the read succeeded", async () => {
    const world = await read(holds("plain.ts"));
    await expect(runStep(world, 'reading the files directory fails naming the path "plain.ts"')).rejects.toThrow();
    await expect(runStep(world, "no file of the files directory is staged")).rejects.toThrow();
  });

  it("refuse a path the rejection does not name", async () => {
    const world = await read(holds("{= .name =}.ts"));
    await runStep(world, 'reading the files directory fails naming the path "{= .name =}.ts"');
    await expect(runStep(world, 'reading the files directory fails naming the path "name.ts"')).rejects.toThrow();
  });

  it("refuse a rule the name does not break", async () => {
    const world = await read(holds("{= .name =}.ts"));
    await runStep(world, 'reading the files directory fails because the name "{= .name =}.ts" breaks the rule "template syntax"');
    const step = 'reading the files directory fails because the name "{= .name =}.ts" breaks the rule "reserved device name"';
    await expect(runStep(world, step)).rejects.toThrow();
  });

  it("refuse a character the rejection does not name", async () => {
    const world = await read('the files directory of the schematic holds a file whose name contains the character "vertical bar"');
    await runStep(world, 'reading the files directory fails naming the character "vertical bar"');
    await expect(runStep(world, 'reading the files directory fails naming the character "colon"')).rejects.toThrow();
  });

  it("present a name the file system cannot store, and leave the real listing untouched", async () => {
    const step = 'the files directory of the schematic holds a file whose name contains the character "control character 0x00"';
    const world = await read(step);
    await runStep(world, 'reading the files directory fails naming the character "control character 0x00"');
    await runStep(world, "no file of the files directory is staged");
    const { packageDir } = world.filesDirectory as { packageDir: string };
    expect(readdirSync(join(packageDir, "files"))).toEqual([]);
  });
});
