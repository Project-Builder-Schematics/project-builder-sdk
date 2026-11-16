import { expect } from "bun:test";
import * as json from "../../dialects/json/index.ts";
import * as nestjs from "../../dialects/nestjs/index.ts";
import * as react from "../../dialects/react/index.ts";
import * as typescript from "../../dialects/typescript/index.ts";
import * as yaml from "../../dialects/yaml/index.ts";
import type { StepDefinition, World } from "../runner/steps.ts";
import { endedRun, factoryRun } from "../shared/factory-run.ts";

const DIALECTS: Record<string, { find(path: string): unknown }> = { json, nestjs, react, typescript, yaml };

// CATALOG: the values JSON text cannot hold, and the functions an `fn` argument names.
const NAMED_FUNCTIONS: Record<string, (current: unknown) => unknown> = {
  increment: (current) => (typeof current === "number" ? current + 1 : 1),
  "return undefined": () => undefined,
};

function argumentValue(argument: string, cell: string): unknown {
  if (cell === "a Date") return new Date();
  if (cell === "NaN") return Number.NaN;
  if (argument === "fn") {
    const fn = NAMED_FUNCTIONS[cell];
    if (fn === undefined) throw new Error(`fn names no known function: ${cell}`);
    return fn;
  }
  return JSON.parse(cell);
}

interface DialectState {
  /** The dialect each opened file was opened with. */
  readonly dialectOf: Map<string, string>;
  /** The table cells of the last call of each op, by argument name. */
  readonly lastArguments: Map<string, Map<string, string>>;
}

function dialectState(world: World): DialectState {
  world.dialects ??= { dialectOf: new Map(), lastArguments: new Map() } satisfies DialectState;
  return world.dialects as DialectState;
}

/** The message of the run's dialect error; every dialect failure is a plain Error with this prefix. */
export function dialectFailure(world: World): string {
  factoryRun(world).failureExpected = true;
  const error = endedRun(world).error;
  expect(error).toBeInstanceOf(Error);
  const message = (error as Error).message;
  expect(message).toStartWith("dialect operation failed: ");
  return message;
}

function parseFailure(world: World, path: string, dialect: string): void {
  expect(dialectState(world).dialectOf.get(path)).toBe(dialect);
  expect(dialectFailure(world)).toContain(`could not parse ${JSON.stringify(path)}`);
}

export const DIALECT_OP_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'the author opens the Dialect handle "{handle}" of the dialect "{dialect}" on the file "{path}"',
    run: (world, [handle, dialect, path]) => {
      const module = DIALECTS[dialect as string];
      if (module === undefined) throw new Error(`no step drives the dialect "${dialect as string}" yet`);
      dialectState(world).dialectOf.set(path as string, dialect as string);
      factoryRun(world).actions.push((handles) => void handles.set(handle as string, module.find(path as string)));
    },
  },
  {
    // The tables list their arguments in the op's own order, so they are passed in row order.
    phrase: 'the author applies the op "{op}" through the Dialect handle "{handle}" with the arguments:',
    run: (world, [op, handle, table]) => {
      const cells = new Map((table as string[][]).slice(1).map(([argument, cell]) => [argument!, cell!]));
      dialectState(world).lastArguments.set(op as string, cells);
      const args = [...cells].map(([argument, cell]) => argumentValue(argument, cell));
      factoryRun(world).actions.push(async (handles) => {
        const target = handles.get(handle as string) as Record<string, (...args: unknown[]) => PromiseLike<unknown>>;
        await target[op as string]!(...args);
      });
    },
  },
  {
    phrase: 'the factory fails with a dialect error naming the op "{op}"',
    run: (world, [op]) => void expect(dialectFailure(world)).toContain(op as string),
  },
  {
    phrase: 'the factory fails with a dialect error naming the op "{op}" and the path in the argument "{argument}"',
    run: (world, [op, argument]) => {
      const cell = dialectState(world).lastArguments.get(op as string)?.get(argument as string);
      if (cell === undefined) throw new Error(`the op "${op as string}" was never applied with the argument "${argument as string}"`);
      const message = dialectFailure(world);
      expect(message).toContain(op as string);
      expect(message).toContain(JSON.stringify(JSON.parse(cell)));
    },
  },
  {
    phrase: 'the factory fails with a dialect error naming the op "{op}" and the alias "{alias}"',
    run: (world, [op, alias]) => {
      const message = dialectFailure(world);
      expect(message).toContain(op as string);
      expect(message).toContain(`*${alias as string}`);
    },
  },
  {
    phrase: 'the factory fails naming the binding "{name}"',
    run: (world, [name]) => void expect(dialectFailure(world)).toContain(`binding named ${JSON.stringify(name)}`),
  },
  {
    phrase: 'the factory fails naming the file "{path}"',
    run: (world, [path]) => void expect(dialectFailure(world)).toContain(JSON.stringify(path)),
  },
  {
    phrase: "the factory fails because a pending edit would be lost",
    run: (world) => void expect(dialectFailure(world)).toContain("the pending edit would be lost"),
  },
  {
    phrase: "the factory fails because the dialect does not declare the extension of the file",
    // Each dialect words it its own way, so the step checks that find rejected the opened file's extension.
    run: (world) => {
      const message = dialectFailure(world);
      expect(message).toContain("find(");
      const extensions = [...dialectState(world).dialectOf.keys()].map((path) => /\.[^./]+$/.exec(path)?.[0] ?? path);
      expect(extensions.some((extension) => message.includes(extension))).toBe(true);
    },
  },
  {
    phrase: 'the factory fails because the value holds "{kind}", which JSON cannot represent',
    run: (world, [kind]) => void expect(dialectFailure(world)).toContain(`${kind as string}, which JSON cannot represent`),
  },
  {
    phrase: 'the factory fails because the file "{path}" is not valid JSON',
    run: (world, [path]) => parseFailure(world, path as string, "json"),
  },
  {
    phrase: 'the factory fails because the file "{path}" is not valid YAML',
    run: (world, [path]) => parseFailure(world, path as string, "yaml"),
  },
];
