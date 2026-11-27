import { expect } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkDialectPackage, type DialectFixture } from "../../conformance/index.ts";
import { defineDialect, type Dialect } from "../../dialect/index.ts";
import { astLibrary as tsMorph } from "../../dialects/typescript/index.ts";
import type { StepDefinition, World } from "../runner/steps.ts";
import { AUTHOR_DIALECTS, factoryRun } from "../shared/factory-run.ts";
import { dialectFailure } from "./dialect-ops.ts";

/**
 * A-16: an author-defined dialect built from `@pbuilder/sdk/dialect` alone. The `ini` dialect edits
 * text; a `ts` one shares the SDK's TypeScript AST, so `.modify()` steps written for TypeScript
 * work on it. Its package is the dialect's own name unless a step ships it in another one.
 */
type Text = { text: string };
const textLibrary = { parseText: (text: string): Text => ({ text }), printText: (tree: Text): string => tree.text };
const tsLibrary = {
  parseTs: (source: string) => new tsMorph.Project({ useInMemoryFileSystem: true }).createSourceFile("a.ts", source, { overwrite: true }),
  printTs: (tree: { getFullText(): string }) => tree.getFullText(),
};
const PROJECT_ROOT = resolve(import.meta.dir, "../../..");
const RUNNER = join(PROJECT_ROOT, "src/bin/pbuilder-runner.ts");

/** Fixtures the written dialect packages load back by key, so they run the very dialect a step built. */
export const PACKAGED_FIXTURES = new Map<string, DialectFixture>();
const SELF = pathToFileURL(import.meta.path).href;
const SUBJECT = "conformanceSubject";

function scratch(prefix: string): string {
  return realpathSync(mkdtempSync(join(tmpdir(), prefix)));
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

/** Writes the dialect's package as the cache holds it: its package.json and a `./conformance` export. */
function writePackage(packageName: string, fixture: DialectFixture): string {
  const dir = scratch("pbuilder-acceptance-dialect-");
  const key = `${packageName}#${PACKAGED_FIXTURES.size}`;
  PACKAGED_FIXTURES.set(key, fixture);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: packageName, version: "1.0.0", type: "module", exports: { "./conformance": "./conformance.js" } }));
  writeFileSync(join(dir, "conformance.js"), `import { PACKAGED_FIXTURES } from ${JSON.stringify(SELF)};\nexport default PACKAGED_FIXTURES.get(${JSON.stringify(key)});\n`);
  return dir;
}

function registerAuthorDialect(world: World, name: string, extension: string, packageName: string): void {
  const { dialect, fixture } = authorDialect(name, extension);
  ((world[AUTHOR_DIALECTS] ??= new Map()) as Map<string, Dialect>).set(name, dialect);
  world[SUBJECT] = {
    run: async () => {
      const report = await checkDialectPackage(writePackage(packageName, fixture));
      if (!report.passed) throw new Error(report.failures.map((failure) => failure.case).join(", "));
    },
  };
}

interface Pin {
  readonly name: string;
  readonly factory: string;
  readonly root: string;
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
  return { name, factory: join(factoryDir, "factory.js"), root: join(cache, "1.0.0"), dirs: [cache, factoryDir] };
}

/** A `ready` greeting, framed as the engine frames it: a 4-byte length, then the JSON body. */
function greeting(): Buffer {
  const body = Buffer.from(JSON.stringify({ method: "ready", protocolVersion: 1 }));
  const frame = Buffer.alloc(4 + body.length);
  frame.writeUInt32BE(body.length, 0);
  body.copy(frame, 4);
  return frame;
}

export const AUTHOR_DIALECT_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'an author-defined dialect "{dialect}" for the extension "{extension}"',
    run: (world, [name, extension]) => registerAuthorDialect(world, name as string, extension as string, name as string),
  },
  {
    phrase: 'an author-defined dialect "{dialect}" for the extension "{extension}", shipped in the package "{package}"',
    run: (world, [name, extension, packageName]) =>
      registerAuthorDialect(world, name as string, extension as string, packageName as string),
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
    // The runner process, given the Frame's declared dialect, as the engine starts it.
    phrase: "the factory is started",
    run: (world) => {
      const pin = world.pin as Pin;
      const dialects = JSON.stringify([{ name: pin.name, version: "1.0.0", root: pin.root }]);
      try {
        const started = Bun.spawnSync(
          ["bun", RUNNER, "--factory", pathToFileURL(pin.factory).href, "--input", "{}", "--dialects", dialects],
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
  {
    phrase: 'the factory does not start because the dialect "{dialect}" resolves outside the package the Lock pins',
    run: (world, [name]) => {
      const run = factoryRun(world);
      run.failureExpected = true;
      expect(run.ran).toBe(0);
      expect((run.result?.error as Error).message).toBe(
        `the factory does not start because the dialect "${name as string}" resolves outside the package the Lock pins`
      );
    },
  },
];
