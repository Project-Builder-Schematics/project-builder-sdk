/**
 * P-IR (S0c, proposal section 5): the batches recorded by runFactoryForTest for every runnable
 * fixture factory, every runnable docs example and the verb matrix, compared as JSON with the
 * committed goldens under goldens/. The layout migration moves the code between a verb call and
 * its batch, so any diff here is an IR change. Rewrite the goldens with P_IR_WRITE=1 only for an
 * intended change.
 *
 * Each list is closed: a new frame-runner fixture, author-emulation `run*` export, runnable docs
 * example or commons verb without a golden fails, and so does a golden without a scenario.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { runFactoryForTest, type RunResult } from "../../src/testing/index.ts";
import { AuthoringError } from "../../src/commons/index.ts";
import * as commons from "../../src/commons/index.ts";
import * as authorEmulation from "../fixtures/author-emulation/factory.ts";
import { PACKAGE_DIR as TYPED_FACTORY_DIR, run as typedFactory } from "../fixtures/typed-factory/factory.ts";
import { queuedTests, recordedRuns } from "./docs-example-shim.ts";
import {
  NOT_VERBS,
  VERB_MATRIX_PACKAGE_DIR,
  VERB_MATRIX_SEED,
  calledHandleMethods,
  calledVerbs,
  handleMethods,
  observed,
  verbMatrix,
} from "./verb-matrix.ts";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const GOLDENS = join(import.meta.dir, "goldens");
const FRAME_RUNNER = join(ROOT, "test/fixtures/frame-runner");
const SHIM = join(import.meta.dir, "docs-example-shim.ts");
const WRITE = process.env.P_IR_WRITE === "1";
const LONG_STRING = 256;

// Frame-runner fixtures runFactoryForTest cannot run in-process.
const FRAME_RUNNER_EXCLUDED: Readonly<Record<string, string>> = {
  "import-crash": "throws at import, before any factory runs",
  sabotage: "rebinds process.stdout, which would break the test process",
};

type Scenario = { id: string; run: () => Promise<unknown> };

function scrub(text: string): string {
  return text.split(ROOT).join("<repo>").replace(new RegExp(`${tmpdir().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^/\\s'"]+`, "g"), "<tmp>");
}

function digestLong(value: unknown): unknown {
  if (typeof value === "string") {
    const text = scrub(value);
    return text.length > LONG_STRING ? `<sha256:${createHash("sha256").update(text).digest("hex")}:${text.length}>` : text;
  }
  if (Array.isArray(value)) return value.map(digestLong);
  if (value instanceof Map) return digestLong(Object.fromEntries(value));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, digestLong(field)]));
  }
  return value;
}

function describeError(error: unknown): unknown {
  if (error === undefined) return undefined;
  if (error instanceof AuthoringError) {
    const { verb, path, reason, origin, appliedCount, message } = error;
    return { name: error.name, verb, path, reason, origin, appliedCount, message };
  }
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { thrown: typeof error, value: String(error) };
}

function recorded(result: RunResult): unknown {
  return { emitted: result.emitted, error: describeError(result.error) };
}

async function frameRunnerScenarios(): Promise<Scenario[]> {
  const inputs: Record<string, Array<{ suffix: string; input: unknown; seed?: Record<string, string>; packageDir?: string }>> = {
    happy: [{ suffix: "", input: {}, seed: { "seed.txt": "feh-01" } }],
    schema: [{ suffix: "", input: { name: "pir" }, seed: { "seed.txt": "s" }, packageDir: join(FRAME_RUNNER, "schema") }],
    "unc-path-leak": ["unc", "wsl"].map((style) => ({ suffix: `-${style}`, input: { canary: "pir", style } })),
    "canary-path-leak": ["posix", "windows", "posix-space", "windows-space", "project-glued"].map((style) => ({
      suffix: `-${style}`,
      input: { canary: "pir", style },
    })),
  };
  const scenarios: Scenario[] = [];
  for (const dir of readdirSync(FRAME_RUNNER).sort()) {
    if (dir in FRAME_RUNNER_EXCLUDED) continue;
    const factory = (await import(join(FRAME_RUNNER, dir, "factory.ts"))).default as (input: never) => unknown;
    for (const { suffix, input, seed, packageDir } of inputs[dir] ?? [{ suffix: "", input: {} }]) {
      scenarios.push({
        id: `frame-runner/${dir}${suffix}`,
        run: async () => recorded(await runFactoryForTest(factory as (input: unknown) => void, input, { seed, packageDir })),
      });
    }
  }
  return scenarios;
}

function authorEmulationScenarios(): Scenario[] {
  return Object.entries(authorEmulation)
    .filter(([name, value]) => name.startsWith("run") && typeof value === "function")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, factory]) => ({
      id: `author-emulation/${name}`,
      run: async () =>
        recorded(
          await runFactoryForTest(factory as (input: unknown) => void, { name: "user-profile" }, { packageDir: authorEmulation.PACKAGE_DIR }),
        ),
    }));
}

const DOCS_SPECIFIERS: Record<string, string> = {
  "bun:test": SHIM,
  "@pbuilder/sdk/testing": SHIM,
  "@pbuilder/sdk/commons": join(ROOT, "src/commons/index.ts"),
  "@pbuilder/sdk": join(ROOT, "src/index.ts"),
};

/**
 * The ```ts blocks of README.md and docs/*.md that import the SDK and pass runFactoryForTest a
 * factory they define themselves; the rest are fragments of a larger program.
 */
export function runnableDocsExamples(files: ReadonlyArray<{ path: string; text: string }>): Array<{ id: string; source: string }> {
  const examples: Array<{ id: string; source: string }> = [];
  for (const { path, text } of files) {
    let ordinal = 0;
    for (const match of text.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)) {
      const source = match[1]!;
      const factories = [...source.matchAll(/runFactoryForTest\(\s*(\w+)/g)].map((call) => call[1]!);
      const defines = (name: string): boolean => new RegExp(`\\b(?:const|let|function)\\s+${name}\\b`).test(source);
      if (!/from "@pbuilder\/sdk[^"]*"/.test(source) || factories.length === 0 || !factories.every(defines)) continue;
      examples.push({ id: `docs-examples/${path.replace(/\.md$/, "")}-${++ordinal}`, source });
    }
  }
  return examples;
}

function docsScenarios(): Scenario[] {
  const files = ["README.md", ...readdirSync(join(ROOT, "docs")).filter((f) => f.endsWith(".md")).sort().map((f) => `docs/${f}`)].map((path) => ({
    path,
    text: readFileSync(join(ROOT, path), "utf-8"),
  }));
  return runnableDocsExamples(files).map(({ id, source }) => ({
    id,
    run: async () => {
      const rewritten = source.replace(/from "(bun:test|@pbuilder\/sdk(?:\/\w+)?)"/g, (_whole, specifier: string) => {
        const target = DOCS_SPECIFIERS[specifier];
        if (target === undefined) throw new Error(`${id}: no P-IR mapping for "${specifier}"`);
        return `from ${JSON.stringify(target)}`;
      });
      const scratch = mkdtempSync(join(tmpdir(), "p-ir-docs-"));
      recordedRuns.length = 0;
      queuedTests.length = 0;
      try {
        const file = join(scratch, "example.ts");
        writeFileSync(file, rewritten);
        await import(file);
        for (const body of queuedTests) await body();
        return recordedRuns.map(recorded);
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
  }));
}

const typedFactoryScenario: Scenario = {
  id: "typed-factory",
  run: async () => recorded(await runFactoryForTest(typedFactory, { port: 8080 }, { packageDir: TYPED_FACTORY_DIR })),
};

const verbMatrixScenario: Scenario = {
  id: "verb-matrix",
  run: async () => {
    const result = await runFactoryForTest(verbMatrix, { name: "orders" }, { seed: VERB_MATRIX_SEED, packageDir: VERB_MATRIX_PACKAGE_DIR });
    return { ...(recorded(result) as object), observed };
  },
};

function goldenFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? goldenFiles(join(dir, entry.name)) : [relative(GOLDENS, join(dir, entry.name))],
  );
}

const actual = new Map<string, string>();
let scenarioIds: string[] = [];

beforeAll(async () => {
  const scenarios = [...(await frameRunnerScenarios()), ...authorEmulationScenarios(), typedFactoryScenario, ...docsScenarios(), verbMatrixScenario];
  scenarioIds = scenarios.map((s) => s.id);
  for (const scenario of scenarios) {
    actual.set(scenario.id, `${JSON.stringify(digestLong(await scenario.run()), null, 2)}\n`);
  }
  if (WRITE) {
    rmSync(GOLDENS, { recursive: true, force: true });
    for (const [id, text] of actual) {
      mkdirSync(dirname(join(GOLDENS, `${id}.golden.json`)), { recursive: true });
      writeFileSync(join(GOLDENS, `${id}.golden.json`), text);
    }
  }
}, 120_000);

describe("P-IR — recorded batches match the goldens", () => {
  it("every scenario has a golden and every golden has a scenario", () => {
    expect(scenarioIds.length).toBeGreaterThan(40);
    expect(goldenFiles(GOLDENS).sort()).toEqual(scenarioIds.map((id) => `${id}.golden.json`).sort());
  });

  it("each scenario's batches are byte-identical to its golden", () => {
    const diffs = scenarioIds.filter((id) => {
      const path = join(GOLDENS, `${id}.golden.json`);
      return !existsSync(path) || readFileSync(path, "utf-8") !== actual.get(id);
    });
    expect(diffs).toEqual([]);
  });

  it("the docs examples run and are found", () => {
    expect(scenarioIds.filter((id) => id.startsWith("docs-examples/"))).toEqual(["docs-examples/README-1", "docs-examples/README-2", "docs-examples/docs/pending-directives-1"]);
  });

  it("the verb matrix commits", async () => {
    expect(JSON.parse(actual.get("verb-matrix")!).error).toBeUndefined();
  });
});

describe("P-IR — the verb matrix covers the whole commons surface", () => {
  const publicFunctions = Object.entries(commons).filter(([, value]) => typeof value === "function").map(([name]) => name);

  it("calls every public commons verb", () => {
    expect([...calledVerbs].sort()).toEqual(publicFunctions.filter((name) => !(name in NOT_VERBS)).sort());
  });

  it("exempts only functions that exist", () => {
    for (const name of Object.keys(NOT_VERBS)) expect(publicFunctions).toContain(name);
  });

  it("calls every method of both handle kinds", () => {
    expect(handleMethods.found.size).toBeGreaterThan(0);
    expect(handleMethods.writable.size).toBeGreaterThan(0);
    expect([...calledHandleMethods.found].sort()).toEqual([...handleMethods.found].sort());
    expect([...calledHandleMethods.writable].sort()).toEqual([...handleMethods.writable].sort());
  });

  it("[red-proof] only a block that defines the factory it runs is a scenario", () => {
    const text = [
      '```ts\nimport { create } from "@pbuilder/sdk/commons";\n```',
      '```ts\nimport { runFactoryForTest } from "@pbuilder/sdk/testing";\nawait runFactoryForTest(run, {});\n```',
      '```ts\nimport { runFactoryForTest } from "@pbuilder/sdk/testing";\nconst run = () => {};\nawait runFactoryForTest(run, {});\n```',
    ].join("\n");
    expect(runnableDocsExamples([{ path: "docs/x.md", text }]).map((e) => e.id)).toEqual(["docs-examples/docs/x-1"]);
  });
});
