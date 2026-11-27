import { expect } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StepDefinition, World } from "../runner/steps.ts";
import { PROJECT_ROOT } from "../shared/runner-process.ts";
import { scratchDirectory } from "../shared/scratch.ts";

/** A-15: the codegen bin, run on a schematic package, as an author runs `pbuilder-codegen <dir>`. */
const CODEGEN = join(PROJECT_ROOT, "bin/pbuilder-codegen.ts");

function packages(world: World): Map<string, string> {
  world.codegenPackages ??= new Map<string, string>();
  return world.codegenPackages as Map<string, string>;
}

function declare(world: World, name: string, input: string, type: string, result: string | undefined): void {
  const dir = scratchDirectory("codegen-");
  const schema = { properties: { [input]: { type, label: input } }, ...(result === undefined ? {} : { result: { type: result } }) };
  writeFileSync(join(dir, "schema.json"), JSON.stringify(schema));
  packages(world).set(name, dir);
}

function generated(world: World): string {
  if (typeof world.generated !== "string") throw new Error("the codegen has not run");
  return world.generated;
}

export const CODEGEN_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'a schematic "{name}" declaring the input "{input}" of type "{type}" and the Result of type "{result}"',
    run: (world, [name, input, type, result]) => declare(world, name as string, input as string, type as string, result as string),
  },
  {
    phrase: 'a schematic "{name}" declaring the input "{input}" of type "{type}" and no Result',
    run: (world, [name, input, type]) => declare(world, name as string, input as string, type as string, undefined),
  },
  {
    phrase: 'the codegen runs for the schematic "{name}"',
    run: (world, [name]) => {
      const dir = packages(world).get(name as string);
      if (dir === undefined) throw new Error(`no schematic "${name as string}" was declared`);
      const ran = Bun.spawnSync(["bun", CODEGEN, "."], { cwd: dir, stdout: "pipe", stderr: "pipe" });
      expect(ran.exitCode).toBe(0);
      world.generated = readFileSync(join(dir, "schema.generated.ts"), "utf-8");
    },
  },
  {
    phrase: 'the generated Input type has the property "{input}" of type "{type}"',
    run: (world, [input, type]) => void expect(generated(world)).toContain(`  ${input as string}: ${type as string};`),
  },
  {
    phrase: 'the generated Result type is "{type}"',
    run: (world, [type]) => void expect(generated(world)).toContain(`export type Result = ${type as string};`),
  },
  {
    // The Input type must be there, so a file that failed to generate cannot pass.
    phrase: 'no Result type is generated for the schematic "{name}"',
    run: (world) => {
      expect(generated(world)).toContain("export type Input = {");
      expect(generated(world)).not.toContain("export type Result");
    },
  },
];
