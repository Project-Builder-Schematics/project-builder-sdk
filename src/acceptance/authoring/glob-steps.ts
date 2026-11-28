import { expect } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import * as commons from "../../commons/index.ts";
import type { StepDefinition, World } from "../runner/steps.ts";
import { endedRun, expectSuccess, factoryRun, ranRun } from "../shared/factory-run.ts";
import { PROJECT_ROOT } from "../shared/runner-process.ts";
import { scratchDirectory } from "../shared/scratch.ts";
import { composition, identifier } from "./composition-steps.ts";
import { dialectNamed } from "./dialect-ops.ts";

const GLOBBED = "the handles of the glob";

/**
 * A handle shows no path, so the action reads every handle the glob returned, in order: the reads
 * the engine served then name the paths, and a read the scenario made before would show up too.
 */
function globs(world: World, glob: () => Promise<unknown[]>): void {
  factoryRun(world).actions.push(async (handles) => {
    const found = await glob();
    for (const handle of found) await (handle as { read(): Promise<unknown> }).read();
    handles.set(GLOBBED, found);
  });
}

async function globbed(world: World): Promise<{ readonly found: readonly unknown[]; readonly paths: readonly string[] }> {
  const run = await ranRun(world);
  expectSuccess(world);
  return { found: run.handles.get(GLOBBED) as unknown[], paths: [...endedRun(world).reads.keys()] };
}

/**
 * Compiles the scenario's composition with the SDK's own `tsc`, in a scratch package outside the
 * worktree, and returns the errors in that file only. The runtime's type packages are left out,
 * so errors they cause in the SDK's sources do not count; the handle types use none of them.
 */
function typeErrors(source: string): string[] {
  const dir = scratchDirectory("glob-types-");
  writeFileSync(join(dir, "check.ts"), source);
  const compilerOptions = {
    strict: true,
    target: "ESNext",
    module: "Preserve",
    moduleResolution: "bundler",
    allowImportingTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    lib: ["ESNext"],
  };
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions, files: ["check.ts"] }));
  const ran = Bun.spawnSync([join(PROJECT_ROOT, "node_modules/.bin/tsc"), "-p", dir, "--pretty", "false"], { stdout: "pipe", stderr: "pipe" });
  const output = `${ran.stdout.toString()}${ran.stderr.toString()}`;
  return output.split("\n").filter((line) => line.includes("check.ts("));
}

function expectedType(dialect: string, type: string): string {
  const route = /^the handle of the route (\S+)$/.exec(type)?.[1];
  if (route !== undefined) return `ReturnType<typeof ${dialect}.find<${JSON.stringify(`file${route}`)}>>`;
  if (type === "the union of every routed handle") return `ReturnType<typeof ${dialect}.find<string>>`;
  throw new Error(`no handle type "${type}"`);
}

export const GLOB_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'the author globs "{pattern}" through commons',
    run: (world, [pattern]) => globs(world, () => commons.glob(pattern as string)),
  },
  {
    phrase: 'the author globs "{pattern}" through the dialect "{dialect}"',
    run: (world, [pattern, dialect]) => globs(world, () => dialectNamed(world, dialect as string).glob(pattern as string)),
  },
  {
    phrase: 'the author globs "{pattern}" through the dialect "{dialect}", ignoring "{ignore}"',
    run: (world, [pattern, dialect, ignore]) =>
      globs(world, () => dialectNamed(world, dialect as string).glob(pattern as string, { ignore: [ignore as string] })),
  },
  {
    phrase: 'the glob returned the handles of exactly "{paths}"',
    run: async (world, [paths]) => {
      const expected = (paths as string).split(",").map((path) => path.trim());
      const { found, paths: read } = await globbed(world);
      expect(read).toEqual(expected);
      expect(found.length).toBe(expected.length);
    },
  },
  {
    phrase: "the glob returned an empty array",
    run: async (world) => void expect((await globbed(world)).found).toEqual([]),
  },
  {
    phrase: 'the handle the glob returned for "{path}" carries the extension "{extension}"',
    run: async (world, [path, extension]) => {
      const { found, paths } = await globbed(world);
      const index = paths.indexOf(path as string);
      expect(index).toBeGreaterThanOrEqual(0);
      expect((found[index] as { extension?: unknown }).extension).toBe(extension);
    },
  },
  {
    phrase: 'the Dialect handle "{handle}" carries the extension "{extension}"',
    run: async (world, [handle, extension]) => {
      const run = await ranRun(world);
      expectSuccess(world);
      expect((run.handles.get(handle as string) as { extension?: unknown }).extension).toBe(extension);
    },
  },
  {
    // The route and the union must differ, or every expectation would hold for either of them.
    phrase: 'the type of the handles the dialect "{dialect}" globs for "{pattern}" is "{type}"',
    run: (world, [dialect, pattern, type]) => {
      const name = identifier(dialect as string);
      const source = [
        `import { byExtension, defineDialect, withOps } from ${JSON.stringify(join(PROJECT_ROOT, "src/bounded-contexts/authoring/domain/services/define-dialect.ts"))};`,
        "type Text = { text: string };",
        "const TEXT_AST = { parse: (text: string): Text => ({ text }), print: (tree: Text): string => tree.text };",
        ...composition(world).source,
        "type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;",
        `type Globbed = Awaited<ReturnType<typeof ${name}.glob<${JSON.stringify(pattern)}>>>[number];`,
        `export const matches: Equal<Globbed, ${expectedType(name, type as string)}> = true;`,
        `export const distinct: Equal<${expectedType(name, `the handle of the route ${(dialectNamed(world, dialect as string) as unknown as { extensions: readonly string[] }).extensions[0]}`)}, ${expectedType(name, "the union of every routed handle")}> = false;`,
      ].join("\n");
      expect(typeErrors(source)).toEqual([]);
    },
  },
];
