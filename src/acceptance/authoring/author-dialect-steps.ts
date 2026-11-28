import { expect } from "bun:test";
import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { checkDialectPackage, checkLocalDialect, type DialectFixture } from "../../conformance/index.ts";
import { defineDialect, type Dialect } from "../../dialect/index.ts";
import { astLibrary as tsMorph } from "../../dialects/typescript/index.ts";
import type { StepDefinition, World } from "../runner/steps.ts";
import { AUTHOR_DIALECTS, factoryRun } from "../shared/factory-run.ts";
import { scratchDirectory } from "../shared/scratch.ts";
import { greeting, PROJECT_ROOT, RUNNER } from "../shared/runner-process.ts";
import { dialectFailure } from "./dialect-ops.ts";

/**
 * A-16: an author-defined dialect built from `@pbuilder/sdk/dialect` alone. The `ini` dialect edits
 * text; a `ts` one shares the SDK's TypeScript AST, so `.modify()` steps written for TypeScript
 * work on it. Its package is the dialect's own name unless a step ships it in another one, or a
 * step declares it locally (CA-18). Its base file exports the Dialect the fixture data tests,
 * unless a step makes it export another one.
 */
type Text = { text: string };
const textLibrary = { parseText: (text: string): Text => ({ text }), printText: (tree: Text): string => tree.text };
const tsLibrary = {
  parseTs: (source: string) => new tsMorph.Project({ useInMemoryFileSystem: true }).createSourceFile("a.ts", source, { overwrite: true }),
  printTs: (tree: { getFullText(): string }) => tree.getFullText(),
};

/** Fixtures the written dialect packages load back by key, so they run the very dialect a step built. */
export const PACKAGED_FIXTURES = new Map<string, DialectFixture>();
const SELF = pathToFileURL(import.meta.path).href;
const SUBJECT = "conformanceSubject";

function scratch(prefix: string): string {
  return realpathSync(scratchDirectory(prefix));
}

function authorDialect(name: string, extension: string): { dialect: Dialect; fixture: DialectFixture } {
  const isTs = extension === "ts";
  const library = isTs ? tsLibrary : textLibrary;
  const ast = isTs
    ? { parse: (source: string) => tsLibrary.parseTs(source), print: (tree: unknown) => tsLibrary.printTs(tree as never) }
    : { parse: (source: string) => textLibrary.parseText(source), print: (tree: unknown) => textLibrary.printText(tree as Text) };
  const dialect = defineDialect({ name, extensions: [`.${extension}`], ast, ops: {} });
  const sample = isTs ? "const x = 1;\n" : "colour=red\n";
  const fixture: DialectFixture = {
    dialect,
    samples: [sample],
    module: { find: (path: string) => dialect.find(path), astLibrary: library },
    expectedAstLibrary: library,
    libraryExercise: isTs
      ? { path: "a.ts", seed: sample, expect: "const x = 1;\nconst y = 2;\n", modify: (tree) => void (tree as { addStatements(s: string): void }).addStatements("const y = 2;") }
      : { path: "settings.ini", seed: sample, expect: "colour=blue\n", modify: (tree) => void ((tree as Text).text = "colour=blue\n") },
  };
  return { dialect, fixture };
}

const OTHER_BASE = "baseExportsOtherDialect";

/** Keeps the fixture data and the Dialect the base file exports, so the written files load them back. */
function stash(fixture: DialectFixture, base: Dialect): { fixture: string; base: string } {
  const key = `fixture#${PACKAGED_FIXTURES.size}`;
  PACKAGED_FIXTURES.set(key, fixture);
  PACKAGED_FIXTURES.set(`${key}#base`, { ...fixture, dialect: base });
  const load = (entry: string, member: string) =>
    `import { PACKAGED_FIXTURES } from ${JSON.stringify(SELF)};\nexport default PACKAGED_FIXTURES.get(${JSON.stringify(entry)})${member};\n`;
  return { fixture: load(key, ""), base: load(`${key}#base`, ".dialect") };
}

/** Writes the dialect's package as the cache holds it: its package.json, its root module and a `./conformance` export. */
function writePackage(packageName: string, fixture: DialectFixture, base: Dialect): string {
  const dir = scratch("pbuilder-acceptance-dialect-");
  const sources = stash(fixture, base);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: packageName, version: "1.0.0", type: "module", exports: { ".": "./index.js", "./conformance": "./conformance.js" } })
  );
  writeFileSync(join(dir, "index.js"), sources.base);
  writeFileSync(join(dir, "conformance.js"), sources.fixture);
  return dir;
}

/** Writes a local dialect's folder in a workspace: its base file and its conformance file beside it. */
function writeLocal(fixture: DialectFixture, base: Dialect): { path: string; conformance: string } {
  const folder = join(scratch("pbuilder-acceptance-workspace-"), "dialects", "ini");
  mkdirSync(folder, { recursive: true });
  const sources = stash(fixture, base);
  writeFileSync(join(folder, "index.js"), sources.base);
  writeFileSync(join(folder, "conformance.js"), sources.fixture);
  return { path: join(folder, "index.js"), conformance: join(folder, "conformance.js") };
}

function registerAuthorDialect(world: World, name: string, extension: string, declaration: { package: string } | { local: string }): void {
  const { dialect, fixture } = authorDialect(name, extension);
  ((world[AUTHOR_DIALECTS] ??= new Map()) as Map<string, Dialect>).set(name, dialect);
  world[SUBJECT] = {
    run: async () => {
      const base = world[OTHER_BASE] === true ? authorDialect(name, extension).dialect : dialect;
      const report =
        "package" in declaration
          ? await checkDialectPackage(writePackage(declaration.package, fixture, base))
          : await checkLocalDialect({ name: declaration.local, ...writeLocal(fixture, base) });
      if (!report.passed) throw new Error(report.failures.map((failure) => failure.case).join(", "));
    },
  };
}

interface Pin {
  readonly factory: string;
  /** The `--dialects` value the engine would hand the runner. */
  readonly dialects: string;
  readonly dirs: readonly string[];
}

/**
 * The cache holds the pinned copy and another one; the factory's own node_modules links the
 * other. The factory folder sits under this package's node_modules, a folder `bun test` never
 * scanned, so the runner's single-instance check finds this SDK and the dialect check runs next.
 */
function resolvesOutsidePin(name: string): Pin {
  const cache = scratch("pbuilder-acceptance-pin-");
  for (const version of ["1.0.0", "2.0.0"]) {
    mkdirSync(join(cache, version), { recursive: true });
    writeFileSync(join(cache, version, "package.json"), JSON.stringify({ name, version, main: "./index.js" }));
    writeFileSync(join(cache, version, "index.js"), "");
  }
  const factoryDir = join(PROJECT_ROOT, "node_modules/.pbuilder-acceptance", `pin-${process.pid}-${Date.now()}`);
  mkdirSync(join(factoryDir, "node_modules"), { recursive: true });
  symlinkSync(join(cache, "2.0.0"), join(factoryDir, "node_modules", name), "dir");
  writeFileSync(join(factoryDir, "factory.js"), "export default function factory() {}\n");
  const dialects = JSON.stringify([{ name, version: "1.0.0", root: join(cache, "1.0.0") }]);
  return { factory: join(factoryDir, "factory.js"), dialects, dirs: [cache, factoryDir] };
}

/** A local dialect whose base file links to a copy outside the folder the engine hashed. */
function localOutsideFolder(name: string): Pin {
  const workspace = scratch("pbuilder-acceptance-local-");
  const folder = join(workspace, "dialects", name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(workspace, "elsewhere.js"), "");
  symlinkSync(join(workspace, "elsewhere.js"), join(folder, "index.js"));
  const factoryDir = join(PROJECT_ROOT, "node_modules/.pbuilder-acceptance", `local-${process.pid}-${Date.now()}`);
  mkdirSync(factoryDir, { recursive: true });
  writeFileSync(join(factoryDir, "factory.js"), "export default function factory() {}\n");
  const dialects = JSON.stringify([{ kind: "local", name, root: folder, path: join(folder, "index.js") }]);
  return { factory: join(factoryDir, "factory.js"), dialects, dirs: [workspace, factoryDir] };
}

export const AUTHOR_DIALECT_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'an author-defined dialect "{dialect}" for the extension "{extension}"',
    run: (world, [name, extension]) => registerAuthorDialect(world, name as string, extension as string, { package: name as string }),
  },
  {
    phrase: 'an author-defined dialect "{dialect}" for the extension "{extension}", shipped in the package "{package}"',
    run: (world, [name, extension, packageName]) =>
      registerAuthorDialect(world, name as string, extension as string, { package: packageName as string }),
  },
  {
    phrase: 'an author-defined dialect "{dialect}" for the extension "{extension}", declared locally as "{key}"',
    run: (world, [name, extension, key]) =>
      registerAuthorDialect(world, name as string, extension as string, { local: key as string }),
  },
  {
    phrase: 'the conformance fixture data of the dialect "{dialect}" tests a Dialect other than the one its base file exports',
    run: (world) => void (world[OTHER_BASE] = true),
  },
  {
    phrase: 'the dialect "{dialect}" is declared in the Manifest',
    run: (world, [name]) => void (factoryRun(world).declaredDialects ??= []).push(name as string),
  },
  {
    phrase: 'the factory is a schematic of the library "{library}", whose own Manifest does not declare the dialect "{dialect}"',
    run: (world, [library]) => void (factoryRun(world).library = { name: library as string, declares: [] }),
  },
  {
    phrase: 'the factory fails because the dialect "{dialect}" is not declared in the Manifest',
    run: (world, [name]) =>
      void expect(dialectFailure(world)).toContain(`the dialect "${name as string}" is not declared in the Manifest`),
  },
  {
    phrase: 'the dialect "{dialect}" resolves from the factory outside the package the Lock pins',
    run: (world, [name]) => void (world.pin = resolvesOutsidePin(name as string)),
  },
  {
    phrase: 'the local dialect "{dialect}" resolves from the factory outside the folder of its base file',
    run: (world, [name]) => void (world.pin = localOutsideFolder(name as string)),
  },
  {
    // The runner process, given the Frame's declared dialect, as the engine starts it.
    phrase: "the factory is started",
    run: (world) => {
      const pin = world.pin as Pin;
      try {
        const started = Bun.spawnSync(
          ["bun", RUNNER, "--factory", pathToFileURL(pin.factory).href, "--input", "{}", "--dialects", pin.dialects],
          { stdin: greeting(), stdout: "pipe", stderr: "pipe" }
        );
        expect(started.exitCode).toBe(1);
        const message = started.stderr.toString().trim().replace(/^pbuilder-runner: /, "");
        factoryRun(world).result = { error: new Error(message), tree: new Map(), emitted: [], reads: new Map() } as never;
      } finally {
        for (const dir of pin.dirs) rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  ...(["the package the Lock pins", "the folder of its base file"] as const).map((place) => ({
    phrase: `the factory does not start because the dialect "{dialect}" resolves outside ${place}`,
    run: (world: World, [name]: readonly unknown[]) => {
      const run = factoryRun(world);
      run.failureExpected = true;
      expect(run.ran).toBe(0);
      expect((run.result?.error as Error).message).toBe(
        `the factory does not start because the dialect "${name as string}" resolves outside ${place}`
      );
    },
  })),
];
