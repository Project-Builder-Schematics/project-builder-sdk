import { expect, mock } from "bun:test";
import * as fs from "node:fs";
import { dirname, join } from "node:path";
import * as commons from "../../commons/index.ts";
import type { StepDefinition, World } from "../runner/steps.ts";
import { endedRun, expectSuccess, factoryRun, ranRun } from "../shared/factory-run.ts";
import { scratchDirectory } from "../shared/scratch.ts";

// CATALOG: the forbidden characters, by the names the steps and the SDK's rejections use.
const NAMED_CHARACTERS: Record<string, string> = {
  "vertical bar": "|",
  "double quote": '"',
  "less-than sign": "<",
  "greater-than sign": ">",
  colon: ":",
  "question mark": "?",
  asterisk: "*",
  backslash: "\\",
};

function character(name: string): string {
  const control = /^control character 0x([0-9A-F]{2})$/.exec(name);
  if (control) return String.fromCharCode(Number.parseInt(control[1]!, 16));
  const named = NAMED_CHARACTERS[name];
  if (named === undefined) throw new Error(`no character is named "${name}"`);
  return named;
}

interface FilesDirectory {
  readonly packageDir: string;
  /** The planted files, relative to `files/`. */
  readonly files: string[];
  /** Names the file system cannot store, presented in `files/` as if it could. */
  readonly presented: string[];
}

function filesDirectory(world: World): FilesDirectory {
  if (world.filesDirectory === undefined) {
    const packageDir = scratchDirectory("package-");
    fs.mkdirSync(join(packageDir, "files"));
    world.filesDirectory = { packageDir, files: [], presented: [] } satisfies FilesDirectory;
    factoryRun(world).packageDir = packageDir;
  }
  return world.filesDirectory as FilesDirectory;
}

function plant(world: World, path: string): void {
  const directory = filesDirectory(world);
  directory.files.push(path);
  if (path.includes("\0")) {
    // CATALOG: where the file system cannot store a name, the harness presents it as if it could.
    if (path.includes("/")) throw new Error(`only a top-level file name can be presented: ${JSON.stringify(path)}`);
    directory.presented.push(path);
    return;
  }
  const file = join(directory.packageDir, "files", path);
  fs.mkdirSync(dirname(file), { recursive: true });
  fs.writeFileSync(file, "content");
}

/** Reads the files directory, listing each presented name in `files/` while the read runs. */
function readFilesDirectory(directory: FilesDirectory): void {
  if (directory.presented.length === 0) return void commons.scaffold({ from: "files", to: "." });
  const original = { ...fs };
  const filesPath = join(directory.packageDir, "files");
  const standIn = join(directory.packageDir, "stand-in");
  original.writeFileSync(standIn, "content");
  const presented = new Set(directory.presented.map((name) => join(filesPath, name)));
  mock.module("node:fs", () => ({
    ...original,
    readdirSync: (path: fs.PathLike, ...rest: unknown[]) => {
      const names = (original.readdirSync as (...args: unknown[]) => string[])(path, ...rest);
      return String(path) === filesPath ? [...names, ...directory.presented] : names;
    },
    lstatSync: (path: fs.PathLike, ...rest: unknown[]) =>
      (original.lstatSync as (...args: unknown[]) => fs.Stats)(presented.has(String(path)) ? standIn : path, ...rest),
  }));
  try {
    commons.scaffold({ from: "files", to: "." });
  } finally {
    mock.module("node:fs", () => original);
  }
}

/** The read's rejection: a typed AuthoringError, with nothing of the files directory staged. */
async function rejection(world: World): Promise<string> {
  await ranRun(world);
  factoryRun(world).failureExpected = true;
  const error = endedRun(world).error;
  expect(error).toBeInstanceOf(commons.AuthoringError);
  return (error as Error).message;
}

export const FILES_DIRECTORY_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'the files directory of the schematic holds the file "{path}"',
    run: (world, [path]) => plant(world, path as string),
  },
  {
    phrase: 'the files directory of the schematic holds a file whose name contains the character "{character}"',
    run: (world, [name]) => plant(world, `widget${character(name as string)}.ts`),
  },
  {
    phrase: 'the files directory of the schematic holds a directory whose name contains the character "{character}"',
    run: (world, [name]) => plant(world, `bad${character(name as string)}dir/a.ts`),
  },
  {
    phrase: "the files directory of the schematic is read",
    run: (world) => {
      const directory = filesDirectory(world);
      factoryRun(world).actions.push(() => readFilesDirectory(directory));
    },
  },
  {
    phrase: 'the path template of the file "{path}" is "{template}"',
    // Each scenario plants one file, so the read's only create is that file's.
    run: async (world, [path, template]) => {
      await ranRun(world);
      expectSuccess(world);
      expect(filesDirectory(world).files).toEqual([path as string]);
      const creates = endedRun(world)
        .emitted.flatMap((batch) => batch.instructions)
        .flatMap((directive) => (directive.op === "create" ? [directive.create.pathTemplate] : []));
      expect(creates).toEqual([template as string]);
    },
  },
  {
    phrase: 'reading the files directory fails naming the path "{path}"',
    run: async (world, [path]) => void expect(await rejection(world)).toContain(`scaffold file name "${path as string}": `),
  },
  {
    phrase: 'reading the files directory fails naming the character "{character}"',
    run: async (world, [name]) =>
      void expect(await rejection(world)).toContain(`breaks the rule "forbidden character" (${name as string})`),
  },
  {
    phrase: 'reading the files directory fails because the name "{name}" breaks the rule "{rule}"',
    run: async (world, [name, rule]) =>
      void expect(await rejection(world)).toContain(`the name "${name as string}" breaks the rule "${rule as string}"`),
  },
  {
    phrase: "no file of the files directory is staged",
    run: async (world) => {
      await rejection(world);
      expect(endedRun(world).emitted.flatMap((batch) => batch.instructions)).toEqual([]);
    },
  },
];
