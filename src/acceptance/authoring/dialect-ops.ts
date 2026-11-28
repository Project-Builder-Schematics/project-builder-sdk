import { expect } from "bun:test";
import type { SourceFile } from "ts-morph";
import * as angular from "../../dialects/angular/index.ts";
import * as aspnet from "../../dialects/aspnet/index.ts";
import * as csharp from "../../dialects/csharp/index.ts";
import * as css from "../../dialects/css/index.ts";
import * as json from "../../dialects/json/index.ts";
import * as msbuild from "../../dialects/msbuild/index.ts";
import * as nestjs from "../../dialects/nestjs/index.ts";
import * as react from "../../dialects/react/index.ts";
import * as typescript from "../../dialects/typescript/index.ts";
import * as yaml from "../../dialects/yaml/index.ts";
import type { StepDefinition, World } from "../runner/steps.ts";
import { AUTHOR_DIALECTS, endedRun, expectSuccess, factoryRun } from "../shared/factory-run.ts";

type DialectModule = { find(path: string): unknown; glob(pattern: string, options?: { ignore?: readonly string[] }): Promise<unknown[]> };

const DIALECTS: Record<string, DialectModule> = {
  angular,
  aspnet,
  csharp,
  css,
  json,
  msbuild,
  nestjs,
  react,
  typescript,
  yaml,
};

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

/** An SDK dialect by its module name, or one a step of the scenario built. */
export function dialectNamed(world: World, name: string): DialectModule {
  const module = DIALECTS[name] ?? (world[AUTHOR_DIALECTS] as Map<string, DialectModule> | undefined)?.get(name);
  if (module === undefined) throw new Error(`no step drives the dialect "${name}" yet`);
  return module;
}

interface DialectState {
  /** The dialect each opened file was opened with. */
  readonly dialectOf: Map<string, string>;
  /** The table cells of the last call of each op, by argument name. */
  readonly lastArguments: Map<string, Map<string, string>>;
  /** What the last query returned, once its action ran. */
  queried?: { readonly value: unknown };
  /** What the last `.inspect()` call returned, once its action ran. */
  inspected?: { readonly value: unknown };
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

/** Records the table of one op or query call and returns its arguments in row order. */
function callArguments(world: World, op: string, table: string[][]): unknown[] {
  const cells = new Map(table.slice(1).map(([argument, cell]) => [argument!, cell!]));
  dialectState(world).lastArguments.set(op, cells);
  return [...cells].map(([argument, cell]) => argumentValue(argument, cell));
}

type OpTarget = Record<string, (...args: unknown[]) => PromiseLike<unknown>>;

type Inspectable = { inspect(fn: (ast: never) => unknown): Promise<unknown> };

/** Records an awaited `.inspect()` call, so a rejection fails the factory and a value is kept. */
function inspectOn<Ast>(world: World, handle: string, fn: (ast: Ast) => unknown): void {
  factoryRun(world).actions.push(async (handles) => {
    const value = await (handles.get(handle) as Inspectable).inspect(fn as (ast: never) => unknown);
    dialectState(world).inspected = { value };
  });
}

/** The value the last query returned, after checking the run succeeded and the query ran. */
function queried(world: World): unknown {
  expectSuccess(world);
  const result = dialectState(world).queried;
  if (result === undefined) throw new Error("no query ran");
  return result.value;
}

function parseFailure(world: World, path: string, dialect: string): void {
  expect(dialectState(world).dialectOf.get(path)).toBe(dialect);
  expect(dialectFailure(world)).toContain(`could not parse ${JSON.stringify(path)}`);
}

export const DIALECT_OP_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'the author opens the Dialect handle "{handle}" of the dialect "{dialect}" on the file "{path}"',
    run: (world, [handle, dialect, path]) => {
      const module = dialectNamed(world, dialect as string);
      dialectState(world).dialectOf.set(path as string, dialect as string);
      factoryRun(world).actions.push((handles) => void handles.set(handle as string, module.find(path as string)));
    },
  },
  {
    // The tables list their arguments in the op's own order, so they are passed in row order.
    phrase: 'the author applies the op "{op}" through the Dialect handle "{handle}" with the arguments:',
    run: (world, [op, handle, table]) => {
      const args = callArguments(world, op as string, table as string[][]);
      factoryRun(world).actions.push(async (handles) => {
        await (handles.get(handle as string) as OpTarget)[op as string]!(...args);
      });
    },
  },
  {
    phrase: 'the author applies the query "{op}" through the Dialect handle "{handle}" with the arguments:',
    run: (world, [op, handle, table]) => {
      const args = callArguments(world, op as string, table as string[][]);
      factoryRun(world).actions.push(async (handles) => {
        const value = await (handles.get(handle as string) as OpTarget)[op as string]!(...args);
        dialectState(world).queried = { value };
      });
    },
  },
  {
    phrase: 'the author runs an .inspect() callback that appends the statement "{statement}" on the Dialect handle "{handle}"',
    run: (world, [statement, handle]) =>
      inspectOn<SourceFile>(world, handle as string, (ast) => void ast.addStatements(statement as string)),
  },
  {
    phrase: 'the author runs an .inspect() callback that throws an error with the message "{message}" on the Dialect handle "{handle}"',
    run: (world, [message, handle]) =>
      inspectOn(world, handle as string, () => {
        throw new Error(message as string);
      }),
  },
  {
    phrase: 'the author runs a .modify() callback that throws an error with the message "{message}" on the Dialect handle "{handle}"',
    run: (world, [message, handle]) =>
      void factoryRun(world).actions.push(async (handles) => {
        await (handles.get(handle as string) as { modify(fn: () => void): PromiseLike<void> }).modify(() => {
          throw new Error(message as string);
        });
      }),
  },
  {
    phrase: 'the .inspect() call returned "{value}"',
    run: (world, [value]) => {
      expectSuccess(world);
      const result = dialectState(world).inspected;
      if (result === undefined) throw new Error("no .inspect() call ran");
      expect(String(result.value)).toBe(value as string);
    },
  },
  {
    phrase: 'the factory fails because the .inspect() callback changed the file "{path}"',
    run: (world, [path]) => void expect(dialectFailure(world)).toContain(`inspect() must not change ${JSON.stringify(path)}`),
  },
  {
    phrase: 'the query returned "{value}"',
    run: (world, [value]) => void expect(String(queried(world))).toBe(value as string),
  },
  {
    phrase: 'the factory fails because the query "{query}" changed the file "{path}"',
    run: (world, [query, path]) =>
      void expect(dialectFailure(world)).toContain(`${query as string}() is a query and must not change ${JSON.stringify(path)}`),
  },
  {
    phrase: "the query returned nothing",
    run: (world) => void expect(queried(world)).toBeUndefined(),
  },
  {
    phrase: 'the query returned the declaration "{value}" with importance "{important}"',
    run: (world, [value, important]) => void expect(queried(world)).toEqual({ value, important: important === "true" }),
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
    phrase: "the failure tells the author to look the node up again inside .modify()",
    run: (world) => void expect(dialectFailure(world)).toContain("look the node up again inside .modify()"),
  },
  {
    phrase: "the factory fails because a pending edit would be lost",
    run: (world) => void expect(dialectFailure(world)).toContain("the pending edit would be lost"),
  },
  {
    phrase: "the factory fails because the dialect does not declare the extension of the file",
    // Each dialect words it its own way: the kit speaks of the declared extensions, React may name the rejected
    // one. The quoted path is cut out first, so an unrelated find error that names the file does not count.
    run: (world) => {
      const message = dialectFailure(world);
      expect(message).toContain("find(");
      const paths = [...dialectState(world).dialectOf.keys()];
      const rest = paths.reduce((text, path) => text.replaceAll(JSON.stringify(path), ""), message);
      const extensions = paths.map((path) => /\.[^./]+$/.exec(path)?.[0] ?? path);
      expect(rest.includes("extension") || extensions.some((extension) => rest.includes(extension))).toBe(true);
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
  {
    phrase: 'the factory fails because the file "{path}" is not valid TypeScript',
    run: (world, [path]) => parseFailure(world, path as string, "typescript"),
  },
  {
    phrase: 'the factory fails because the file "{path}" is not valid C#',
    run: (world, [path]) => parseFailure(world, path as string, "csharp"),
  },
  {
    phrase: 'the factory fails because the file "{path}" is not valid XML',
    run: (world, [path]) => parseFailure(world, path as string, "msbuild"),
  },
  {
    phrase: 'the factory fails because the argument "{argument}" is not one the op accepts',
    // "`kind` must be ...", the refused value echoed: "`name` \"await\" is a reserved word ...", or an option
    // that excludes another: "`required` and `initial` cannot be combined".
    run: (world, [argument]) => {
      const message = dialectFailure(world);
      const named = `\`${argument as string}\``;
      const values = [...dialectState(world).lastArguments.values()].flatMap((cells) => {
        const cell = cells.get(argument as string);
        return cell === undefined ? [] : [JSON.stringify(JSON.parse(cell))];
      });
      const refused =
        message.includes(`${named} must `) ||
        values.some((value) => message.includes(`${named} ${value} is `)) ||
        new RegExp(`${RegExp.escape(named)} and \`[^\`]+\` cannot be combined`).test(message);
      expect(refused).toBe(true);
    },
  },
  {
    phrase: 'the factory fails because the op "{op}" is not available for the file',
    run: (world, [op]) => {
      const message = dialectFailure(world);
      const extensions = [...dialectState(world).dialectOf.keys()].map((path) => /\.[^./]+$/.exec(path)?.[0] ?? path);
      expect(extensions.some((extension) => message.includes(`${op as string} is not available for ${extension} files`))).toBe(true);
    },
  },
  {
    phrase: "the factory fails because the target does not match exactly one element",
    run: (world) => {
      const message = dialectFailure(world);
      const tags = [...dialectState(world).lastArguments.values()].flatMap((cells) => {
        const target = cells.get("target");
        if (target === undefined) return [];
        const value = JSON.parse(target) as string | { tag: string };
        return [typeof value === "string" ? value : value.tag];
      });
      // No match: "no element named `Button` was found"; several: "`B` matched 2 elements", props between.
      const named = (tag: string) =>
        message.includes(`no element named \`${tag}\``) || new RegExp(`\`${RegExp.escape(tag)}\`[^—]* matched \\d+ elements`).test(message);
      expect(tags.some(named)).toBe(true);
    },
  },
  {
    phrase: 'the factory fails naming the component "{component}"',
    // "component `Card` has ...", "no component named `Card`", "prop `title` already exists on `Card`".
    run: (world, [component]) =>
      void expect(dialectFailure(world)).toMatch(new RegExp(`(?:component|named|on) \`${RegExp.escape(component as string)}\``)),
  },
];
