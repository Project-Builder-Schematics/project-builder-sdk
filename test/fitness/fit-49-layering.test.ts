/**
 * fit-49 (S0a, odd/tasks/hexagonal-layout.md): the dependency rule of project-builder-architecture
 * CODE-LAYOUT.md (origin/main 16c3df0, lines 122-132), enforced over every `.ts` file in `src/`
 * and `bin/`. Every file is classified (target layout from its path, today's folders from the
 * LEGACY table); every edge that breaks a rule must match one EXCEPTIONS row, and every row must
 * still match a violating edge. String literals in domain/ and application/ that name a dialect
 * count as violations too (proposal 3.2). A sibling check keeps `test/` mirroring `src/` by
 * folder (Q9).
 *
 * Red-proofs run the same rule engine over in-memory synthetic graphs, one per rule, so they
 * need no planted files on disk.
 */
import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { buildGraph, type Edge } from "../support/layering/graph.ts";
import { classify, entriesFrom, ClassificationError, type Classified, type Entries, CONTEXTS } from "../support/layering/classify.ts";
import { violation, RULES, LITERAL_RULES, type Rule } from "../support/layering/rules.ts";
import { dialectLiterals, dialectVocabulary, type DialectVocabulary } from "../support/layering/dialects.ts";
import { EXCEPTIONS, CEILING } from "../support/layering/exceptions.ts";
import { collectFiles } from "../support/import-scan.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const ORACLE_FILE = join(ROOT, "test/fitness/fit-49-oracle.txt");

// Floors sit just under today's counts (82 files, 290 edges) so a parser or path change that
// silently drops code fails here instead of passing vacuously.
const MIN_FILES = 75;
const MIN_EDGES = 250;
const KNOWN_EDGE: Edge = { from: "src/transport/stdio-engine-client.ts", to: "src/core/engine-client.ts" };

type Found = { from: string; to: string; rule: Rule };

function classifyGraph(files: readonly string[], entries: Entries): Map<string, Classified> {
  return new Map(files.map((f) => [f, classify(f, entries)]));
}

function findViolations(edges: readonly Edge[], classes: ReadonlyMap<string, Classified>): Found[] {
  const found: Found[] = [];
  for (const { from, to } of edges) {
    const fromClass = classes.get(from)!;
    const isInternal = to.startsWith("src/") || to.startsWith("bin/");
    if (isInternal && !classes.has(to)) throw new Error(`${from} imports ${to}, which is not a file in the graph`);
    const rule = violation(fromClass, to, classes.get(to));
    if (rule !== undefined) found.push({ from, to, rule });
  }
  return found;
}

function findNamedDialects(classes: ReadonlyMap<string, Classified>, vocabulary: DialectVocabulary): Found[] {
  const found: Found[] = [];
  for (const [file, c] of classes) {
    if (c.kind !== "context" || (c.layer !== "domain" && c.layer !== "application")) continue;
    for (const literal of new Set(dialectLiterals(file, readFileSync(join(ROOT, file), "utf-8"), vocabulary))) {
      found.push({ from: file, to: `literal ${JSON.stringify(literal)}`, rule: "noClosedDialectSet" });
    }
  }
  return found;
}

const key = (v: { from: string; to: string }): string => `${v.from} -> ${v.to}`;

const graph = buildGraph(ROOT);
const entries = entriesFrom(PKG, graph.files);
const vocabulary = dialectVocabulary(ROOT);

describe("fit-49 — liveness (the scan reaches the real tree)", () => {
  it(`reads at least ${MIN_FILES} files and ${MIN_EDGES} edges`, () => {
    expect(graph.files.length).toBeGreaterThanOrEqual(MIN_FILES);
    expect(graph.edges.length).toBeGreaterThanOrEqual(MIN_EDGES);
  });

  it("sees the known engine-client edge", () => {
    expect(graph.edges.some((e) => key(e) === key(KNOWN_EDGE))).toBe(true);
  });

  it("finds every public entry and process entry on disk", () => {
    for (const path of [...entries.publicEntries, ...entries.processEntries]) {
      expect(graph.files).toContain(path);
    }
    expect(entries.testKitEntries).toEqual(new Set(["src/testing/index.ts", "src/conformance/index.ts"]));
  });

  it("reads every dialect folder and the extensions the dialects declare", () => {
    for (const name of ["typescript", "react", "json", "yaml", "css", "nestjs", "angular"]) expect(vocabulary.names).toContain(name);
    for (const ext of [".ts", ".tsx", ".jsx", ".json", ".jsonc", ".yaml", ".yml", ".css"]) expect(vocabulary.extensions).toContain(ext);
  });
});

describe("fit-49 — every file is classified", () => {
  it("no file in src/ or bin/ is unclassified", () => {
    const unclassified: string[] = [];
    for (const f of graph.files) {
      try {
        classify(f, entries);
      } catch (err) {
        if (err instanceof ClassificationError) unclassified.push(err.message);
        else throw err;
      }
    }
    expect(unclassified).toEqual([]);
  });
});

describe("fit-49 — the dependency rule holds, up to the shrinking EXCEPTIONS table", () => {
  const classes = classifyGraph(graph.files, entries);
  const found = [...findViolations(graph.edges, classes), ...findNamedDialects(classes, vocabulary)];
  const foundRule = new Map(found.map((v) => [key(v), v.rule]));

  it("every violating edge has an EXCEPTIONS row with the rule it breaks", () => {
    const missing = found.filter((v) => !EXCEPTIONS.some((x) => key(x) === key(v) && x.rule === v.rule));
    expect(missing.map((v) => `${key(v)} breaks ${v.rule}: ${RULES[v.rule]}`)).toEqual([]);
  });

  it("every EXCEPTIONS row still matches a violating edge (stale rows must be deleted)", () => {
    const stale = EXCEPTIONS.filter((x) => foundRule.get(key(x)) !== x.rule);
    expect(stale.map((x) => `stale exception ${key(x)} (${x.rule}) — delete the row`)).toEqual([]);
  });

  it("EXCEPTIONS has no duplicate rows and stays within CEILING", () => {
    expect(new Set(EXCEPTIONS.map(key)).size).toBe(EXCEPTIONS.length);
    expect(EXCEPTIONS.length).toBeLessThanOrEqual(CEILING);
  });
});

// Q9: unit tests mirror src/ by folder. These test-only folders hold no unit tests of one
// source folder; `fake` tests src/testing/ until S7 moves both.
const TEST_ONLY_FOLDERS = new Set(["fitness", "fixtures", "support", "skeleton", "e2e", "types", "docs", "golden-ir", "security", "pyramid", "build"]);
const TEST_FOLDER_ALIASES: Record<string, string> = { fake: "testing" };

function mirrorViolation(testFile: string, srcDirExists: (dir: string) => boolean): string | undefined {
  const segments = posix.dirname(testFile.replace(/^test\//, "")).split("/");
  if (segments[0] === ".") return `${testFile}: test files belong in a folder that mirrors src/`;
  if (TEST_ONLY_FOLDERS.has(segments[0]!) || segments.includes("planted") || segments.includes("fixtures")) return undefined;
  segments[0] = TEST_FOLDER_ALIASES[segments[0]!] ?? segments[0]!;
  const dir = segments.join("/");
  return srcDirExists(dir) ? undefined : `${testFile}: test/${dir}/ mirrors no src/${dir}/`;
}

const srcDirExists = (dir: string): boolean => {
  const abs = join(ROOT, "src", dir);
  return existsSync(abs) && statSync(abs).isDirectory();
};

describe("fit-49 — test/ mirrors src/ by folder (Q9)", () => {
  it("every test file sits in a folder that mirrors src/ or in a test-only folder", () => {
    const testFiles = collectFiles(join(ROOT, "test"), ".ts").map((abs) => relative(ROOT, abs).split(sep).join("/"));
    expect(testFiles.length).toBeGreaterThan(300);
    expect(testFiles.map((f) => mirrorViolation(f, srcDirExists)).filter(Boolean)).toEqual([]);
  });

  it("[red-proof] a test folder whose src/ folder is gone fails; a fitness test passes", () => {
    expect(mirrorViolation("test/core/x.test.ts", () => false)).toContain("mirrors no src/core/");
    expect(mirrorViolation("test/fitness/x.test.ts", () => false)).toBeUndefined();
    expect(mirrorViolation("test/fake/x.test.ts", (d) => d === "testing")).toBeUndefined();
  });
});

const SYNTHETIC_ENTRIES: Entries = {
  publicEntries: new Set(["src/commons/index.ts", "src/testing/index.ts", "src/dialects/css/index.ts", "src/dialects/react/index.ts"]),
  testKitEntries: new Set(["src/testing/index.ts"]),
  processEntries: new Set(["src/bin/pbuilder-runner.ts"]),
};
const A = "src/bounded-contexts/authoring";
const R = "src/bounded-contexts/runner-hosting";
const at = (path: string): Classified => classify(path, SYNTHETIC_ENTRIES);

describe("fit-49 — [red-proof] each rule fires on a planted edge", () => {
  const cases: Array<[Rule, string, string]> = [
    ["noRuntimeIo", `${A}/domain/services/x.ts`, "node:fs"],
    ["noRuntimeIo", `${A}/application/usecases/x.ts`, "process.env"],
    ["testingImporters", `${A}/application/usecases/x.ts`, `${A}/testing/contract-fake.ts`],
    ["testingImporters", "src/commons/index.ts", `${A}/testing/contract-fake.ts`],
    ["compositionImporters", `${A}/infrastructure/in/x.ts`, `${A}/composition.ts`],
    ["crossContext", `${R}/infrastructure/in/x.ts`, `${A}/domain/valueobjects/x.ts`],
    ["platformImporters", `${A}/domain/services/x.ts`, "src/platform/x.ts"],
    ["platformImports", "src/platform/x.ts", `${A}/domain/services/x.ts`],
    ["sharedKernelImports", "src/shared-kernel/x.ts", `${A}/domain/services/x.ts`],
    ["domainImports", `${A}/domain/services/x.ts`, `${A}/application/usecases/x.ts`],
    ["applicationImports", `${A}/application/usecases/x.ts`, `${A}/infrastructure/out/x.ts`],
    ["infrastructureImports", `${A}/infrastructure/out/x.ts`, "src/commons/index.ts"],
    ["aclImports", "src/acl/irwire/index.ts", `${A}/infrastructure/out/x.ts`],
    ["targetNeverImportsLegacy", `${A}/domain/services/x.ts`, "src/core/session.ts"],
    ["dialectIsolation", `${A}/application/usecases/x.ts`, `${A}/infrastructure/out/dialects/css/ops.ts`],
    ["dialectIsolation", `${A}/infrastructure/out/dialects/css/ops.ts`, `${A}/infrastructure/out/dialects/typescript/ast.ts`],
    ["dialectIsolation", "src/dialects/json/ops.ts", "src/dialects/yaml/ast.ts"],
    ["dialectIsolation", `${A}/infrastructure/out/dialects/css/ops.ts`, `${A}/application/usecases/x.ts`],
    ["dialectIsolation", `${A}/infrastructure/out/dialects/css/ops.ts`, `${A}/infrastructure/out/fs/x.ts`],
    ["dialectIsolation", `${A}/infrastructure/out/dialects/css/ops.ts`, "node:fs"],
    ["dialectIsolation", "src/commons/index.ts", `${A}/infrastructure/out/dialects/css/ops.ts`],
    ["dialectIsolation", "src/dialects/react/index.ts", `${A}/infrastructure/out/dialects/css/ops.ts`],
  ];
  it.each(cases)("%s: %s -> %s", (rule, from, to) => {
    const toClass = to.startsWith("src/") ? at(to) : undefined;
    expect(violation(at(from), to, toClass)).toBe(rule);
  });

  it("allowed edges stay allowed", () => {
    expect(violation(at("src/testing/index.ts"), `${A}/testing/contract-fake.ts`, at(`${A}/testing/contract-fake.ts`))).toBeUndefined();
    expect(violation(at(`${R}/infrastructure/in/x.ts`), `${A}/application/usecases/run-factory.ts`, at(`${A}/application/usecases/run-factory.ts`))).toBeUndefined();
    expect(violation(at(`${A}/domain/services/x.ts`), "node:path", undefined)).toBeUndefined();
    expect(violation(at(`${A}/infrastructure/out/fs/x.ts`), "node:fs", undefined)).toBeUndefined();
  });

  it.each([
    ["the sibling fit-02 allows", `${A}/infrastructure/out/dialects/react/ops.ts`, `${A}/infrastructure/out/dialects/typescript/ast.ts`],
    ["its own folder", `${A}/infrastructure/out/dialects/css/adapter.ts`, `${A}/infrastructure/out/dialects/css/ops.ts`],
    ["the domain kit", `${A}/infrastructure/out/dialects/css/adapter.ts`, `${A}/domain/ports/dialect-contract.ts`],
    ["platform/", `${A}/infrastructure/out/dialects/json/ops.ts`, "src/platform/deep-equal.ts"],
    ["shared-kernel/", `${A}/infrastructure/out/dialects/json/ops.ts`, "src/shared-kernel/x.ts"],
    ["its parser library", `${A}/infrastructure/out/dialects/css/ast.ts`, "postcss"],
    ["composition", `${A}/composition.ts`, `${A}/infrastructure/out/dialects/css/adapter.ts`],
    ["its public barrel", "src/dialects/css/index.ts", `${A}/infrastructure/out/dialects/css/adapter.ts`],
    ["a public barrel's allowed sibling", "src/dialects/react/index.ts", `${A}/infrastructure/out/dialects/typescript/pack.ts`],
  ])("a dialect adapter may reach %s", (_, from, to) => {
    expect(violation(at(from), to, to.startsWith("src/") ? at(to) : undefined)).toBeUndefined();
  });

  it("every rule has at least one red-proof", () => {
    expect(new Set([...cases.map(([rule]) => rule), ...LITERAL_RULES])).toEqual(new Set(Object.keys(RULES) as Rule[]));
  });
});

describe("fit-49 — [red-proof] noClosedDialectSet: the core names no dialect", () => {
  const planted: DialectVocabulary = { names: new Set(["css", "yaml"]), extensions: new Set([".css", ".yml"]) };

  it("a dialect name or extension as a value, a case label or a literal type is caught", () => {
    const source = 'const a = "css";\nswitch (ext) { case ".yml": break; }\ntype D = "yaml" | `.css`;\n';
    expect(dialectLiterals(`${A}/domain/services/x.ts`, source, planted)).toEqual(["css", ".yml", "yaml", ".css"]);
  });

  it("module specifiers and other strings are not", () => {
    const source = 'import { parse } from "yaml";\nexport * from "yaml";\ntype T = import("yaml").Document;\nconst m = import("yaml");\nconst s = "schema.css.ts";\n';
    expect(dialectLiterals(`${A}/domain/services/x.ts`, source, planted)).toEqual([]);
  });

  it("the vocabulary follows the dialect folders: a dialect added on disk is named without editing the guard", () => {
    const withCssx: DialectVocabulary = { names: new Set([...vocabulary.names, "cssx"]), extensions: new Set([...vocabulary.extensions, ".cssx"]) };
    expect(dialectLiterals(`${A}/application/usecases/x.ts`, 'const d = "cssx";', withCssx)).toEqual(["cssx"]);
  });
});

describe("fit-49 — [red-proof] the classifier fails closed", () => {
  it.each([
    [`src/bounded-contexts/billing/domain/services/x.ts`, "unknown bounded context"],
    [`${A}/domain/helpers/x.ts`, "not a CODE-LAYOUT slot"],
    [`${A}/infrastructure/sideways/x.ts`, "not a CODE-LAYOUT slot"],
    [`${A}/infrastructure/out/dialects/x.ts`, "belongs in infrastructure/out/dialects/<name>/"],
    ["src/acl/engine/index.ts", "unknown acl counterpart"],
    ["src/brand-new-folder/x.ts", "unclassified"],
  ])("%s", (path, message) => {
    expect(() => at(path)).toThrow(message);
  });
});

// The oracle: the verdict for every pair of representative classes, committed so any change
// to the rules shows up as a reviewed diff. Rewrite with FIT49_WRITE_ORACLE=1.
const REPRESENTATIVES: Record<string, string> = Object.fromEntries([
  ...CONTEXTS.flatMap((ctx) => [
    [`${ctx}/domain`, `src/bounded-contexts/${ctx}/domain/services/x.ts`],
    [`${ctx}/application`, `src/bounded-contexts/${ctx}/application/usecases/x.ts`],
    [`${ctx}/infrastructure-in`, `src/bounded-contexts/${ctx}/infrastructure/in/x.ts`],
    [`${ctx}/infrastructure-out`, `src/bounded-contexts/${ctx}/infrastructure/out/x.ts`],
    [`${ctx}/composition`, `src/bounded-contexts/${ctx}/composition.ts`],
    [`${ctx}/testing`, `src/bounded-contexts/${ctx}/testing/x.ts`],
  ]),
  ["acl", "src/acl/irwire/index.ts"],
  ["shared-kernel", "src/shared-kernel/x.ts"],
  ["platform", "src/platform/x.ts"],
  ["public-entry", "src/commons/index.ts"],
  ["public-test-entry", "src/testing/index.ts"],
  ["process-entry", "src/bin/pbuilder-runner.ts"],
  ["legacy-domain", "src/core/session.ts"],
  ["dialect-css", `${A}/infrastructure/out/dialects/css/ops.ts`],
  ["dialect-typescript", `${A}/infrastructure/out/dialects/typescript/ast.ts`],
  ["dialect-react", `${A}/infrastructure/out/dialects/react/ops.ts`],
  ["dialect-css-barrel", "src/dialects/css/index.ts"],
]);
const EXTERNALS = ["node:fs", "process.env", "node:path", "ts-morph"];

function oracle(): string {
  const lines: string[] = [];
  for (const [fromName, fromPath] of Object.entries(REPRESENTATIVES)) {
    for (const [toName, toPath] of Object.entries(REPRESENTATIVES)) {
      lines.push(`${fromName} -> ${toName}: ${violation(at(fromPath), toPath, at(toPath)) ?? "ok"}`);
    }
    for (const ext of EXTERNALS) lines.push(`${fromName} -> ${ext}: ${violation(at(fromPath), ext, undefined) ?? "ok"}`);
  }
  return `${lines.join("\n")}\n`;
}

describe("fit-49 — oracle matrix", () => {
  it("matches test/fitness/fit-49-oracle.txt", () => {
    if (process.env.FIT49_WRITE_ORACLE === "1") writeFileSync(ORACLE_FILE, oracle());
    expect(oracle()).toEqual(readFileSync(ORACLE_FILE, "utf-8"));
  });
});
