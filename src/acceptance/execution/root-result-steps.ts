import { expect } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { StepDefinition, World } from "../runner/steps.ts";
import { PROJECT_ROOT, serveRunner, type RunnerRequest } from "../shared/runner-process.ts";

/**
 * A-14, E-39, E-40 from the SDK side: the root schematic runs in the real runner process, and
 * this file stands in for the engine on the wire. It answers `ir.emit`, and `ir.commit` by
 * applying the creates (a Commit) or only acknowledging (a Dry Run). What "Launch receives" is
 * the `result` the runner sent with `ir.commit`; carrying it on to Launch is the engine's half.
 */
interface RootRun {
  readonly creates: Array<{ path: string; text: string }>;
  /** `undefined` declares no Result. */
  declared?: string;
  /** JavaScript source of the returned value; `undefined` returns nothing. */
  returns?: string;
  outcome?: RootOutcome;
}

type Request = RunnerRequest;

interface RootOutcome {
  readonly exitCode: number;
  readonly stderr: string;
  readonly requests: readonly Request[];
  readonly disk: ReadonlyMap<string, string>;
}

function rootRun(world: World): RootRun {
  world.rootRun ??= { creates: [] } satisfies RootRun;
  return world.rootRun as RootRun;
}

function outcome(world: World): RootOutcome {
  const run = rootRun(world).outcome;
  if (run === undefined) throw new Error("the Run was not carried out");
  return run;
}

/** The source of a returned value of the CATALOG's actual type; `function` is not JSON. */
function valueSource(value: string, actual: string): string {
  switch (actual) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return String(Number(value));
    case "function":
      return `() => ${JSON.stringify(value)}`;
    default:
      throw new Error(`no actual type "${actual}"`);
  }
}

let packages = 0;

/**
 * Under this package's node_modules, as the A-16 steps do, so the factory resolves this SDK and
 * the runner's single-instance probe passes. The caller removes the folder.
 */
function writePackage(run: RootRun): string {
  const dir = join(PROJECT_ROOT, "node_modules/.pbuilder-acceptance", `root-${process.pid}-${packages++}`);
  mkdirSync(dir, { recursive: true });
  const commons = pathToFileURL(join(PROJECT_ROOT, "src/commons/index.ts")).href;
  const creates = run.creates.map(({ path, text }) => `  create(${JSON.stringify(path)}, { template: ${JSON.stringify(text)}, options: {} });`);
  const factory = [
    `import { create } from ${JSON.stringify(commons)};`,
    "export default function factory() {",
    ...creates,
    ...(run.returns === undefined ? [] : [`  return ${run.returns};`]),
    "}",
    "",
  ].join("\n");
  writeFileSync(join(dir, "factory.js"), factory);
  const schema = run.declared === undefined ? { properties: {} } : { properties: {}, result: { type: run.declared } };
  writeFileSync(join(dir, "schema.json"), JSON.stringify(schema));
  return dir;
}

async function carryOut(world: World, commit: boolean): Promise<void> {
  const run = rootRun(world);
  const dir = writePackage(run);
  try {
    run.outcome = await serve(dir, commit);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function serve(dir: string, commit: boolean): Promise<RootOutcome> {
  const staged = new Map<string, string>();
  const disk = new Map<string, string>();
  const answer = (request: Request): unknown => {
    switch (request.method) {
      case "ir.emit": {
        const instructions = request.params.batch?.instructions ?? [];
        for (const { create } of instructions) if (create !== undefined) staged.set(create.pathTemplate, create.template);
        return { appliedCount: instructions.length };
      }
      case "ir.commit":
        if (commit) for (const [path, text] of staged) disk.set(path, text);
        return {};
      case "tree.read":
        return null;
      default:
        return {};
    }
  };
  const served = await serveRunner(["--factory", pathToFileURL(join(dir, "factory.js")).href, "--input", "{}"], answer);
  return { ...served, disk };
}

const commitRequest = (world: World): Request | undefined => outcome(world).requests.find((request) => request.method === "ir.commit");

function receivedResult(world: World): unknown {
  const params = commitRequest(world)?.params;
  if (params === undefined || !Object.hasOwn(params, "result")) throw new Error("Launch received no Result");
  return params.result;
}

function expectFailure(world: World, text: string): void {
  const run = outcome(world);
  expect(run.exitCode).toBe(1);
  expect(run.stderr).toContain(text);
  expect(commitRequest(world)).toBeUndefined();
}

export const ROOT_RESULT_STEPS: readonly StepDefinition[] = [
  {
    // The stand-in engine's disk starts empty for every Run.
    phrase: 'a workspace without the file "{path}"',
    run: (world, [path]) => void expect(rootRun(world).creates.some((create) => create.path === path)).toBe(false),
  },
  {
    phrase: 'a Run whose root schematic creates the file "{path}" with content "{text}"',
    run: (world, [path, text]) => void rootRun(world).creates.push({ path: path as string, text: text as string }),
  },
  {
    phrase: 'the root schematic declares a Result of type "{type}" and returns the value "{value}" of type "{actual}"',
    run: (world, [type, value, actual]) => {
      rootRun(world).declared = type as string;
      rootRun(world).returns = valueSource(value as string, actual as string);
    },
  },
  {
    phrase: 'the root schematic declares a Result of type "{type}" and returns null',
    run: (world, [type]) => {
      rootRun(world).declared = type as string;
      rootRun(world).returns = "null";
    },
  },
  {
    // A JSON string of n bytes holds n - 2 ASCII characters between its quotes.
    phrase: 'the root schematic declares a Result of type "{type}" and returns a value whose JSON encoding is "{n}" bytes',
    run: (world, [type, n]) => {
      if (type !== "string") throw new Error(`a value of ${String(n)} bytes is built only as a string, not ${String(type)}`);
      rootRun(world).declared = type;
      rootRun(world).returns = `"a".repeat(${Number(n) - 2})`;
    },
  },
  {
    phrase: "the root schematic declares no Result",
    run: (world) => void (rootRun(world).declared = undefined),
  },
  {
    phrase: 'the root schematic declares no Result and returns the value "{value}" of type "{actual}"',
    run: (world, [value, actual]) => void (rootRun(world).returns = valueSource(value as string, actual as string)),
  },
  { phrase: "the Run is committed", run: (world) => carryOut(world, true) },
  { phrase: "the Run is performed as a Dry Run", run: (world) => carryOut(world, false) },
  {
    phrase: "the Commit succeeds",
    run: (world) => {
      const run = outcome(world);
      expect(run.exitCode).toBe(0);
      for (const { path, text } of rootRun(world).creates) expect(run.disk.get(path)).toBe(text);
    },
  },
  {
    phrase: "the Run fails because the Result of the root schematic is invalid",
    run: (world) => {
      expectFailure(world, "invalid Result: ");
      expect(outcome(world).stderr).not.toContain("ceiling");
    },
  },
  {
    phrase: "the Run fails because the Result ceiling was crossed",
    run: (world) => expectFailure(world, "past the 1 MiB ceiling (1048576 bytes)"),
  },
  {
    phrase: 'Launch receives the Result "{value}"',
    run: (world, [value]) => {
      expect(outcome(world).exitCode).toBe(0);
      expect(receivedResult(world)).toBe(value as string);
    },
  },
  {
    phrase: "Launch receives the Result null",
    run: (world) => {
      expect(outcome(world).exitCode).toBe(0);
      expect(receivedResult(world)).toBeNull();
    },
  },
  {
    phrase: 'Launch receives a Result whose JSON encoding is "{n}" bytes',
    run: (world, [n]) => {
      expect(outcome(world).exitCode).toBe(0);
      expect(Buffer.byteLength(JSON.stringify(receivedResult(world)), "utf8")).toBe(Number(n));
    },
  },
  {
    phrase: "Launch receives no Result",
    run: (world) => {
      const params = commitRequest(world)?.params;
      expect(params !== undefined && Object.hasOwn(params, "result")).toBe(false);
    },
  },
  {
    phrase: "no write is attempted on the disk",
    run: (world) => {
      const methods = outcome(world).requests.map((request) => request.method);
      expect(methods).not.toContain("ir.emit");
      expect(methods).not.toContain("ir.commit");
    },
  },
  {
    phrase: 'the file "{path}" does not exist',
    run: (world, [path]) => void expect(outcome(world).disk.has(path as string)).toBe(false),
  },
  {
    phrase: 'the Plan creates exactly the files "{paths}"',
    run: (world, [paths]) => {
      expect(commitRequest(world)).toBeDefined();
      const created = outcome(world)
        .requests.flatMap((request) => request.params.batch?.instructions ?? [])
        .flatMap((instruction) => (instruction.create === undefined ? [] : [instruction.create.pathTemplate]));
      expect(created.join(", ")).toBe(paths as string);
    },
  },
  {
    phrase: "no Plan is obtained",
    run: (world) => void expect(commitRequest(world)).toBeUndefined(),
  },
  {
    phrase: "the workspace is unchanged",
    run: (world) => void expect(outcome(world).disk.size).toBe(0),
  },
];
