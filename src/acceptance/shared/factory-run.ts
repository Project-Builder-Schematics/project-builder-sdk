import { expect } from "bun:test";
import { pendingDirectives } from "../../commons/index.ts";
import { runFactoryForTest, type RunResult } from "../../testing/index.ts";
import type { StepDefinition, World } from "../runner/steps.ts";

/**
 * One scenario is one factory run (CATALOG "One run per scenario"). The `the author ...` steps
 * only record actions; `the factory ends` replays them inside the run, because a handle needs the
 * running factory's session and an error thrown there must land in the run's result.
 */
export interface FactoryRun {
  readonly seed: Record<string, string>;
  readonly actions: Array<(handles: Map<string, unknown>) => unknown>;
  /** The handles the last replay opened, kept so a step can inspect one after the run. */
  readonly handles: Map<string, unknown>;
  result?: RunResult;
  /** How many actions ran, so a "leaves the file as it is" scenario cannot pass with none run. */
  ran: number;
  /** The second run of `the same factory runs again`. */
  again?: { readonly result: RunResult; readonly ran: number };
  /** Set by a failure step, so `has its original content` cannot pass on an unexpected failure. */
  failureExpected: boolean;
  /** The pending Directives, written `verb path`, once the last action of the last replay ran. */
  pending?: readonly string[];
  /** The schematic's package, for the verbs that read package files. */
  packageDir?: string;
  /** The author-defined dialects the workspace Manifest declares (A-16). */
  declaredDialects?: string[];
  /** The library the schematic belongs to, whose own Manifest is its resolution scope (CA-5). */
  library?: { readonly name: string; readonly declares: readonly string[] };
}

/** The world key of the author-defined dialects a scenario built, by name. */
export const AUTHOR_DIALECTS = "authorDialects";

export function factoryRun(world: World): FactoryRun {
  world.run ??= { seed: {}, actions: [], handles: new Map(), ran: 0, failureExpected: false } satisfies FactoryRun;
  return world.run as FactoryRun;
}

/** Replays every recorded action in a new run on a copy of the seed. */
async function replay(run: FactoryRun): Promise<{ result: RunResult; ran: number }> {
  let ran = 0;
  const result = await runFactoryForTest(
    async () => {
      run.handles.clear();
      run.pending = undefined;
      for (const action of run.actions) {
        await action(run.handles);
        ran += 1;
      }
      // A pure copy of the Session buffer, so reading it here changes nothing the steps check.
      run.pending = pendingDirectives().map((entry) => `${entry.verb} ${entry.path}`);
    },
    {},
    { seed: { ...run.seed }, packageDir: run.packageDir, declaredDialects: run.library?.declares ?? run.declaredDialects }
  );
  return { result, ran };
}

/**
 * Runs the factory if no step ended it yet: assertions about the Session come before `the factory
 * ends`, and a scenario that never ends the factory still runs its author steps (CATALOG).
 */
export async function ranRun(world: World): Promise<FactoryRun> {
  const run = factoryRun(world);
  if (run.result === undefined) ({ result: run.result, ran: run.ran } = await replay(run));
  return run;
}

export function endedRun(world: World): RunResult {
  const result = factoryRun(world).result;
  if (result === undefined) throw new Error("the factory has not ended yet");
  return result;
}

/** Committed writes only reach `tree`, so an unchanged file reads as its seed. */
function contentOf(world: World, path: string, result: RunResult = endedRun(world)): string | undefined {
  return result.tree.get(path) ?? factoryRun(world).seed[path];
}

/** The run succeeded and every recorded action ran. */
export function expectSuccess(world: World): void {
  expect(endedRun(world).error).toBeUndefined();
  expect(factoryRun(world).ran).toBe(factoryRun(world).actions.length);
}

/** The content of a file the run committed, after checking the run succeeded. */
function committed(world: World, path: string): string {
  expectSuccess(world);
  const content = contentOf(world, path);
  if (content === undefined) throw new Error(`the file "${path}" does not exist`);
  return content;
}

export const FACTORY_RUN_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'a workspace containing the file "{path}" with content "{text}"',
    run: (world, [path, text]) => void (factoryRun(world).seed[path as string] = text as string),
  },
  {
    phrase: 'a workspace containing the file "{path}" with the content:',
    run: (world, [path, content]) => void (factoryRun(world).seed[path as string] = `${content as string}\n`),
  },
  {
    phrase: 'a workspace containing the file "{path}" without a final newline, with the content:',
    run: (world, [path, content]) => void (factoryRun(world).seed[path as string] = content as string),
  },
  {
    phrase: "the factory ends",
    run: async (world) => void (await ranRun(world)),
  },
  {
    phrase: "the same factory runs again on the workspace as it was at the start",
    run: async (world) => {
      const run = factoryRun(world);
      run.again = await replay(run);
    },
  },
  {
    phrase: 'the file "{path}" has the content:',
    run: (world, [path, content]) => void expect(committed(world, path as string)).toBe(`${content as string}\n`),
  },
  {
    phrase: 'the file "{path}" has the content, without a final newline:',
    run: (world, [path, content]) => void expect(committed(world, path as string)).toBe(content as string),
  },
  {
    phrase: 'the file "{path}" has content "{text}"',
    run: (world, [path, text]) => void expect(committed(world, path as string)).toBe(text as string),
  },
  {
    phrase: 'the file "{path}" contains "{text}"',
    run: (world, [path, text]) => void expect(committed(world, path as string)).toContain(text as string),
  },
  {
    phrase: 'the file "{path}" does not contain "{text}"',
    run: (world, [path, text]) => void expect(committed(world, path as string)).not.toContain(text as string),
  },
  {
    phrase: 'the number of times "{text}" appears in the file "{path}" is "{n}"',
    run: (world, [text, path, n]) =>
      void expect(committed(world, path as string).split(text as string).length - 1).toBe(Number(n)),
  },
  {
    phrase: 'the import of "{module}" in the file "{path}" is written with "{style}" quotes',
    run: (world, [module, path, style]) => {
      const quote = { double: '"', single: "'" }[style as string];
      if (quote === undefined) throw new Error(`no quote style "${style as string}"`);
      expect(committed(world, path as string)).toContain(`from ${quote}${module as string}${quote}`);
    },
  },
  {
    phrase: 'the content of the file "{path}" is the same after both runs',
    run: (world, [path]) => {
      const again = factoryRun(world).again;
      if (again === undefined) throw new Error("the factory did not run again");
      expect(again.result.error).toBeUndefined();
      expect(again.ran).toBe(factoryRun(world).actions.length);
      expect(contentOf(world, path as string, again.result)).toBe(committed(world, path as string));
    },
  },
  {
    phrase: 'the number of content writes sent for the file "{path}" is "{n}"',
    run: (world, [path, n]) => {
      if (!factoryRun(world).failureExpected) expectSuccess(world);
      const writes = endedRun(world)
        .emitted.flatMap((batch) => batch.instructions)
        .filter((directive) => directive.op === "modify" && directive.modify.path === path);
      expect(writes.length).toBe(Number(n));
    },
  },
  {
    phrase: 'the number of reads of the file "{path}" served by the engine is "{n}"',
    run: (world, [path, n]) => {
      if (!factoryRun(world).failureExpected) expectSuccess(world);
      expect(endedRun(world).reads.get(path as string) ?? 0).toBe(Number(n));
    },
  },
  {
    phrase: 'the file "{path}" has its original content',
    run: (world, [path]) => {
      if (!factoryRun(world).failureExpected) expectSuccess(world);
      expect(contentOf(world, path as string)).toBe(factoryRun(world).seed[path as string]);
    },
  },
  {
    phrase: 'the failure of the factory contains "{text}"',
    run: (world, [text]) => {
      factoryRun(world).failureExpected = true;
      const error = endedRun(world).error;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(text as string);
    },
  },
  {
    phrase: 'the failure of the factory does not contain "{text}"',
    run: (world, [text]) => {
      factoryRun(world).failureExpected = true;
      const error = endedRun(world).error;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(text as string);
      expect((error as Error).cause).toBeUndefined();
    },
  },
];
