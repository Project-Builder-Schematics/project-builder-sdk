import { expect } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StepDefinition, World } from "../runner/steps.ts";
import { PROJECT_ROOT } from "../shared/runner-process.ts";
import { scratchDirectory } from "../shared/scratch.ts";
import { declaredRoles } from "./evaluation-steps.ts";

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

type Codegen = { readonly exitCode: number; readonly stderr: string; readonly generated?: string };

function codegen(world: World): Codegen {
  if (world.codegen === undefined) throw new Error("the codegen has not run");
  return world.codegen as Codegen;
}

function generated(world: World): string {
  const ran = codegen(world);
  expect(ran.exitCode).toBe(0);
  return ran.generated!;
}

/** The codegen failed, and its diagnostic is returned. */
function failure(world: World): string {
  const ran = codegen(world);
  expect(ran.exitCode).not.toBe(0);
  return ran.stderr;
}

/** The TypeScript a JSON type is emitted as. */
const EMITTED: Record<string, string> = { string: "string", number: "number", boolean: "boolean", array: "string[]" };

/**
 * A schematic with a role is registered in a Manifest beside it, as the Collection definition
 * entry codegen reads the role from (CA-14), and codegen runs over that project.
 */
function runCodegen(dir: string, role: string | undefined): Codegen {
  if (role !== undefined) {
    writeFileSync(join(dir, "factory.ts"), "export default () => {};\n");
    writeFileSync(join(dir, "project-builder.json"), JSON.stringify({ collections: { app: { schematic: { path: ".", role } } } }));
  }
  const ran = Bun.spawnSync(["bun", CODEGEN, ...(role === undefined ? ["."] : ["--project", "."])], { cwd: dir, stdout: "pipe", stderr: "pipe" });
  const output = join(dir, "schema.generated.ts");
  return { exitCode: ran.exitCode, stderr: ran.stderr.toString(), ...(ran.exitCode === 0 ? { generated: readFileSync(output, "utf-8") } : {}) };
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
      world.codegen = runCodegen(dir, declaredRoles(world).get(name as string));
    },
  },
  {
    phrase: 'the generated Input type has the property "{input}" of type "{type}"',
    run: (world, [input, type]) => {
      const emitted = EMITTED[type as string];
      if (emitted === undefined) throw new Error(`no emitted form for the type "${type as string}"`);
      const lines = generated(world).split("\n");
      expect(lines.some((line) => line === `  ${input as string}: ${emitted};` || line === `  ${input as string}?: ${emitted};`)).toBe(true);
    },
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
  {
    phrase: "the generated Result type is Findings",
    run: (world) => {
      expect(generated(world)).toContain("export type Result = Findings;");
      expect(generated(world)).toMatch(/^export type Findings = \{ items: Array<\{ rule: string; message: string; severity: "error" \| "warning";/m);
    },
  },
  {
    phrase: 'the codegen fails naming the input "{input}"',
    run: (world, [input]) => {
      const diagnostic = failure(world);
      expect(diagnostic).toContain("declares the input");
      expect(diagnostic).toContain(input as string);
    },
  },
  {
    phrase: "the codegen fails because an evaluation schematic declares a Result",
    run: (world) => void expect(failure(world)).toContain("an evaluation schematic declares a Result"),
  },
];
