import { expect } from "bun:test";
import type { FunctionDeclaration, SourceFile } from "ts-morph";
import * as commons from "../../commons/index.ts";
import type { StepDefinition, World } from "../runner/steps.ts";
import { factoryRun, ranRun } from "../shared/factory-run.ts";

/** A Dialect handle: thenable, with one method per op plus read, replaceContent and modify. */
type DialectHandle = PromiseLike<unknown> & {
  addImport(name: string, from: string): DialectHandle;
  replaceContent(content: string): DialectHandle;
  read(): Promise<string | undefined>;
  modify(edit: (ast: SourceFile) => void): DialectHandle;
};

type Outcome = { readonly value: unknown } | { readonly rejection: unknown };

function handleIn(handles: Map<string, unknown>, name: string): DialectHandle {
  const handle = handles.get(name);
  if (handle === undefined) throw new Error(`no handle "${name}" is open`);
  return handle as DialectHandle;
}

/** Adds an action on a handle. A Dialect handle is thenable, so an action that must not wait returns nothing. */
function onHandle(world: World, name: string, act: (handle: DialectHandle, handles: Map<string, unknown>) => unknown): void {
  factoryRun(world).actions.push((handles) => act(handleIn(handles, name), handles));
}

/** `and records the outcome` never aborts the factory; the outcome replaces any earlier one. */
function recordOutcome(world: World, name: string, outcomeOf: (handle: DialectHandle) => PromiseLike<unknown>): void {
  onHandle(world, name, async (handle) => {
    try {
      world.outcome = { value: await outcomeOf(handle) } satisfies Outcome;
    } catch (rejection) {
      world.outcome = { rejection } satisfies Outcome;
    }
  });
}

/**
 * The handle the run opened under this name, after running the factory if no step ended it.
 * Wrapped, because returning a thenable Dialect handle from an async function would await it.
 */
async function openedHandle(world: World, name: string): Promise<{ readonly handle: object }> {
  return { handle: handleIn((await ranRun(world)).handles, name) };
}

export const HANDLE_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'the author adds the import "{name}" from "{module}" through the Dialect handle "{handle}" and waits for it',
    run: (world, [name, module, handle]) => onHandle(world, handle as string, (h) => h.addImport(name as string, module as string)),
  },
  {
    phrase: 'the author adds the import "{name}" from "{module}" through the Dialect handle "{handle}" without waiting',
    run: (world, [name, module, handle]) =>
      onHandle(world, handle as string, (h) => {
        h.addImport(name as string, module as string);
      }),
  },
  {
    phrase: 'the author replaces the content through the Dialect handle "{handle}" with "{text}"',
    run: (world, [handle, text]) =>
      onHandle(world, handle as string, (h) => {
        h.replaceContent(text as string);
      }),
  },
  {
    phrase: 'the author reads through the Dialect handle "{handle}"',
    run: (world, [handle]) => onHandle(world, handle as string, (h) => h.read()),
  },
  {
    phrase: 'the author appends the statement "{text}" through .modify() on the Dialect handle "{handle}"',
    run: (world, [text, handle]) =>
      onHandle(world, handle as string, (h) => {
        h.modify((ast) => void ast.addStatements(text as string));
      }),
  },
  {
    phrase: 'the author keeps the function "{name}" as the node "{node}" through .modify() on the Dialect handle "{handle}"',
    run: (world, [name, node, handle]) =>
      onHandle(world, handle as string, (h, handles) => {
        h.modify((ast) => void handles.set(`node ${node as string}`, ast.getFunctionOrThrow(name as string)));
      }),
  },
  {
    phrase: 'the author renames the kept node "{node}" to "{newName}" through .modify() on the Dialect handle "{handle}"',
    run: (world, [node, newName, handle]) =>
      onHandle(world, handle as string, (h, handles) => {
        h.modify(() => void (handles.get(`node ${node as string}`) as FunctionDeclaration).rename(newName as string));
      }),
  },
  {
    phrase: 'the author waits for the Dialect handle "{handle}" and records the outcome',
    run: (world, [handle]) => recordOutcome(world, handle as string, (h) => h),
  },
  {
    phrase: 'the author reads through the Dialect handle "{handle}" and records the outcome',
    run: (world, [handle]) => recordOutcome(world, handle as string, (h) => h.read()),
  },
  {
    phrase: 'the recorded outcome is a rejection naming the binding "{name}"',
    run: async (world, [name]) => {
      await ranRun(world);
      const outcome = world.outcome as Outcome | undefined;
      if (outcome === undefined) throw new Error("no outcome was recorded");
      expect("rejection" in outcome).toBe(true);
      const rejection = (outcome as { rejection: unknown }).rejection;
      expect(rejection).toBeInstanceOf(Error);
      expect((rejection as Error).message).toStartWith("dialect operation failed: ");
      expect((rejection as Error).message).toContain(`binding named ${JSON.stringify(name)}`);
    },
  },
  {
    phrase: 'the Dialect handle "{handle}" offers .modify()',
    run: async (world, [handle]) => {
      const { handle: opened } = await openedHandle(world, handle as string);
      expect(typeof (opened as { modify?: unknown }).modify).toBe("function");
    },
  },
  {
    phrase: 'the author opens the commons handle "{handle}" on the file "{path}"',
    run: (world, [handle, path]) =>
      void factoryRun(world).actions.push((handles) => void handles.set(handle as string, commons.find(path as string))),
  },
  {
    phrase: 'the commons handle "{handle}" offers no .modify()',
    run: async (world, [handle]) => {
      const { handle: opened } = await openedHandle(world, handle as string);
      expect(typeof (opened as { read?: unknown }).read).toBe("function");
      expect("modify" in opened).toBe(false);
    },
  },
  {
    phrase: 'the author reads the file "{path}" through the commons handle',
    run: (world, [path]) => void factoryRun(world).actions.push(() => commons.find(path as string).read()),
  },
  {
    phrase: 'the author replaces the content of the file "{path}" through the commons handle with "{text}"',
    run: (world, [path, text]) =>
      void factoryRun(world).actions.push(() => {
        commons.replaceContent(path as string, text as string);
      }),
  },
];
