import { expect } from "bun:test";
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
  result?: RunResult;
  /** How many actions ran, so a "leaves the file as it is" scenario cannot pass with none run. */
  ran: number;
  /** Set by a failure step, so `has its original content` cannot pass on an unexpected failure. */
  failureExpected: boolean;
}

export function factoryRun(world: World): FactoryRun {
  world.run ??= { seed: {}, actions: [], ran: 0, failureExpected: false } satisfies FactoryRun;
  return world.run as FactoryRun;
}

export function endedRun(world: World): RunResult {
  const result = factoryRun(world).result;
  if (result === undefined) throw new Error("the factory has not ended yet");
  return result;
}

/** Committed writes only reach `tree`, so an unchanged file reads as its seed. */
function contentOf(world: World, path: string): string | undefined {
  return endedRun(world).tree.get(path) ?? factoryRun(world).seed[path];
}

function expectSuccess(world: World): void {
  expect(endedRun(world).error).toBeUndefined();
  expect(factoryRun(world).ran).toBe(factoryRun(world).actions.length);
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
    run: async (world) => {
      const run = factoryRun(world);
      run.result = await runFactoryForTest(
        async () => {
          const handles = new Map<string, unknown>();
          for (const action of run.actions) {
            await action(handles);
            run.ran += 1;
          }
        },
        {},
        { seed: run.seed }
      );
    },
  },
  {
    phrase: 'the file "{path}" has the content:',
    run: (world, [path, content]) => {
      expectSuccess(world);
      expect(contentOf(world, path as string)).toBe(`${content as string}\n`);
    },
  },
  {
    phrase: 'the file "{path}" has the content, without a final newline:',
    run: (world, [path, content]) => {
      expectSuccess(world);
      expect(contentOf(world, path as string)).toBe(content as string);
    },
  },
  {
    phrase: 'the file "{path}" has its original content',
    run: (world, [path]) => {
      if (!factoryRun(world).failureExpected) expectSuccess(world);
      expect(contentOf(world, path as string)).toBe(factoryRun(world).seed[path as string]);
    },
  },
];
