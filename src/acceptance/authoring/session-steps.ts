import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as commons from "../../commons/index.ts";
import type { StepDefinition, World } from "../runner/steps.ts";
import { expectSuccess, factoryRun, ranRun } from "../shared/factory-run.ts";

const PACKAGE_ROOT = join(import.meta.dir, "../../..");

/** CATALOG: a list is written `verb path`, separated by a comma and a space. */
const listed = (entries: readonly string[]): string => entries.join(", ");

function snapshots(world: World): Map<string, readonly string[]> {
  world.snapshots ??= new Map<string, readonly string[]>();
  return world.snapshots as Map<string, readonly string[]>;
}

/** The pending Directives after a successful run in which every recorded action ran. */
async function pendingAtEnd(world: World): Promise<readonly string[]> {
  const run = await ranRun(world);
  expectSuccess(world);
  if (run.pending === undefined) throw new Error("the run never reached the end of its actions");
  return run.pending;
}

/** Every name the published entries export, from the source each `exports` entry is built from. */
async function publicSurface(): Promise<Set<string>> {
  const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf-8")) as {
    exports: Record<string, { import: string }>;
  };
  const names = new Set<string>();
  for (const { import: built } of Object.values(manifest.exports)) {
    const source = join(PACKAGE_ROOT, built.replace(/^\.\/dist\//, "src/").replace(/\.js$/, ".ts"));
    for (const name of Object.keys(await import(source))) names.add(name);
  }
  return names;
}

function surface(world: World): Set<string> {
  if (world.surface === undefined) throw new Error("the public surface of the SDK was never listed");
  return world.surface as Set<string>;
}

export const SESSION_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'the author creates the file "{path}" with content "{text}"',
    run: (world, [path, text]) =>
      void factoryRun(world).actions.push(() => {
        commons.create(path as string, { template: text as string, options: {} });
      }),
  },
  {
    phrase: 'the author removes the file "{path}"',
    run: (world, [path]) => void factoryRun(world).actions.push(() => commons.remove(path as string)),
  },
  {
    phrase: 'the author takes the snapshot "{snapshot}" of the pending Directives',
    run: (world, [snapshot]) =>
      void factoryRun(world).actions.push(() => {
        snapshots(world).set(snapshot as string, commons.pendingDirectives().map((entry) => `${entry.verb} ${entry.path}`));
      }),
  },
  {
    phrase: 'the pending Directives are exactly "{list}"',
    run: async (world, [list]) => void expect(listed(await pendingAtEnd(world))).toBe(list as string),
  },
  {
    phrase: 'the snapshot "{snapshot}" holds exactly "{list}"',
    run: async (world, [snapshot, list]) => {
      await pendingAtEnd(world);
      const taken = snapshots(world).get(snapshot as string);
      if (taken === undefined) throw new Error(`no snapshot named "${snapshot as string}" was taken`);
      expect(listed(taken)).toBe(list as string);
    },
  },
  {
    phrase: "no Directive is pending",
    run: async (world) => void expect(await pendingAtEnd(world)).toEqual([]),
  },
  {
    phrase: "the public surface of the SDK is listed",
    run: async (world) => {
      world.surface = await publicSurface();
    },
  },
  {
    phrase: 'the SDK offers the accessor named "{name}"',
    run: (world, [name]) => void expect(surface(world).has(name as string)).toBe(true),
  },
  {
    // The listing must hold the accessors every author uses, so an empty one cannot pass.
    phrase: 'the SDK offers no accessor named "{name}"',
    run: (world, [name]) => {
      const names = surface(world);
      expect(["create", "find", "pendingDirectives"].every((known) => names.has(known))).toBe(true);
      expect(names.has(name as string)).toBe(false);
    },
  },
];
