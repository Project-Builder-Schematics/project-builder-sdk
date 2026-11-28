// CA-13 / CA-18 / A-16: runs the conformance fixture of a dialect, published (`<pkg>/conformance`)
// or local (the file its declaration names). The report names each broken check by a fixed case and reason, never by the fixture's own message,
// which may carry the author's samples or the text of an error their code threw (A-87).

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { testDialect, type DialectFixture } from "./index.ts";

export interface ConformanceFailure {
  case: string;
  reason: string;
}

export interface ConformanceReport {
  passed: boolean;
  dialect: string;
  version: string;
  failures: ConformanceFailure[];
}

const FIXTURE_MISSING: ConformanceFailure = {
  case: "fixture_missing",
  reason: "CA-13: the package exports no ./conformance fixture",
};
const FIXTURE_INVALID: ConformanceFailure = {
  case: "fixture_invalid",
  reason: "CA-13: the default export of ./conformance is not a DialectFixture",
};
const NAME_MISMATCH: ConformanceFailure = {
  case: "name_mismatch",
  reason: "A-16: the dialect's name is not the name of its package",
};
const LOCAL_NAME_MISMATCH: ConformanceFailure = {
  case: "name_mismatch",
  reason: "A-16: the dialect's name is not the key of its declaration",
};
const BASE_MISMATCH: ConformanceFailure = {
  case: "base_mismatch",
  reason: "A-16: the fixture data tests a Dialect other than the one its base file exports",
};

// Matched against testDialect's own message text, first match wins.
const CHECKS: ReadonlyArray<readonly [string, ConformanceFailure]> = [
  ["REQ-DC-08", { case: "real_parse", reason: "A-11: parse must return an AST distinct from the source" }],
  ["REQ-DC-01", { case: "round_trip", reason: "A-11: print(parse(source)) must give back the source byte for byte" }],
  ["stale node", { case: "stale_node", reason: "A-11: a node kept from before a re-parse must fail when used" }],
  ["undeclared extension", { case: "undeclared_extension", reason: "A-11: find must reject an extension the dialect does not declare" }],
  ["library exercise", { case: "library_exercise", reason: "A-11: the library exercise must emit exactly the expected modify" }],
  ["testDialect: module must", { case: "module_shape", reason: "A-11: the module must expose a callable find and its runtime astLibrary" }],
  ["expectedAstLibrary", { case: "module_shape", reason: "A-11: the module must expose a callable find and its runtime astLibrary" }],
  ["astLibrary runtime library mismatch", { case: "module_shape", reason: "A-11: the module's astLibrary must be the adapter's own library" }],
];
const FIXTURE_THREW: ConformanceFailure = { case: "fixture_threw", reason: "A-11: the fixture's own code threw while it ran" };
const BASE_THREW: ConformanceFailure = { case: "fixture_threw", reason: "A-16: the dialect's base file threw while it loaded" };

function classify(err: unknown): ConformanceFailure {
  const message = err instanceof Error ? err.message : "";
  return CHECKS.find(([marker]) => message.includes(marker))?.[1] ?? FIXTURE_THREW;
}

const CONDITIONS = ["bun", "import", "default"] as const;

// The engine's pointer dir (pointerdir.go) picks targets the same way, so the base file the fixture
// checks is the file the Run loads.
function pick(target: unknown): string | undefined {
  if (typeof target === "string") return target;
  if (typeof target !== "object" || target === null || Array.isArray(target)) return undefined;
  for (const condition of CONDITIONS) {
    const picked = pick((target as Record<string, unknown>)[condition]);
    if (picked !== undefined) return picked;
  }
  return undefined;
}

// Only a subpath map can export `./conformance`, so a package with a fixture always picks its base
// file from `exports["."]`; with nothing there it has none and never falls back to `main`.
function exportTarget(pkg: { exports?: unknown }, subpath: "." | "./conformance"): string | undefined {
  const exports = pkg.exports;
  if (typeof exports !== "object" || exports === null || !Object.keys(exports).some((key) => key.startsWith("."))) return undefined;
  return pick((exports as Record<string, unknown>)[subpath]);
}

// A resolution failure says the install is incomplete, not that the dialect is wrong.
function isUnresolvedModule(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { code, name, message } = err as { code?: unknown; name?: unknown; message?: unknown };
  return (
    code === "ERR_MODULE_NOT_FOUND" ||
    name === "ResolveMessage" ||
    (typeof message === "string" && /Cannot find (module|package)/.test(message))
  );
}

function isInside(dir: string, file: string): boolean {
  const path = relative(dir, file);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
}

// As the pointer dir: a "./" target whose real path stays inside the package, with no probing.
function baseFile(dir: string, target: string | undefined): string | undefined {
  if (target === undefined || !target.startsWith("./")) return undefined;
  try {
    const file = realpathSync(resolve(dir, target));
    return isInside(realpathSync(dir), file) ? file : undefined;
  } catch {
    return undefined;
  }
}

function isFixture(value: unknown): value is DialectFixture {
  if (typeof value !== "object" || value === null) return false;
  const fixture = value as Partial<DialectFixture>;
  return typeof fixture.dialect === "object" && fixture.dialect !== null && Array.isArray(fixture.samples);
}

interface FixtureSource {
  report: ConformanceReport;
  /** The fixture file, or undefined when the dialect ships none. */
  fixture: string | undefined;
  /** The folder the fixture file must sit in, by its real path too. */
  folder: string;
  /** A local fixture file that does not exist is missing; a published one is an incomplete install. */
  absentFile: "missing" | "unresolved";
  /** The dialect's base file, or undefined when it has none. */
  base: string | undefined;
  nameMismatch: ConformanceFailure;
}

async function importModule(file: string): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false }> {
  try {
    return { ok: true, value: (await import(pathToFileURL(file).href)) as Record<string, unknown> };
  } catch (err) {
    if (isUnresolvedModule(err)) throw new Error("pbuilder-conformance: a module the fixture imports could not be resolved");
    return { ok: false };
  }
}

async function runFixture({ report, fixture: file, folder, absentFile, base, nameMismatch }: FixtureSource): Promise<ConformanceReport> {
  if (file === undefined) {
    report.failures.push(FIXTURE_MISSING);
    return report;
  }
  if (!isInside(folder, file)) {
    report.failures.push(FIXTURE_INVALID);
    return report;
  }
  if (!existsSync(file)) {
    if (absentFile === "unresolved") throw new Error("pbuilder-conformance: a module the fixture imports could not be resolved");
    report.failures.push(FIXTURE_MISSING);
    return report;
  }
  // Both checks hold for the file that loads, so a link out of the folder is refused too.
  const real = realpathSync(file);
  if (!isInside(realpathSync(folder), real)) {
    report.failures.push(FIXTURE_INVALID);
    return report;
  }
  // By real path, as the base file: Bun 1.4 can load one file twice under two spellings of its
  // path, and the base check compares the Dialect by reference.
  const loaded = await importModule(real);
  if (!loaded.ok) {
    report.failures.push(FIXTURE_THREW);
    return report;
  }
  const fixture = loaded.value.default;
  if (!isFixture(fixture)) {
    report.failures.push(FIXTURE_INVALID);
    return report;
  }
  if (fixture.dialect.name !== report.dialect) report.failures.push(nameMismatch);
  const baseModule = base !== undefined && existsSync(base) ? await importModule(base) : undefined;
  if (baseModule !== undefined && !baseModule.ok) {
    report.failures.push(BASE_THREW);
    return report;
  }
  if (baseModule === undefined || !Object.values(baseModule.value).includes(fixture.dialect)) report.failures.push(BASE_MISMATCH);
  try {
    await testDialect(fixture);
  } catch (err) {
    report.failures.push(classify(err));
  }
  report.passed = report.failures.length === 0;
  return report;
}

/**
 * Loads the fixture of the dialect package in `dir` and runs it. Throws only when the fixture
 * cannot run: the package.json is unreadable or has no name, or a module the fixture imports
 * cannot be resolved. Every finding about the dialect is a failure in the report.
 *
 * @example
 * const report = await checkDialectPackage("/cache/npm/@company/ini-dialect/1.0.0/package");
 * if (!report.passed) console.log(report.failures.map((failure) => failure.case));
 */
export async function checkDialectPackage(dir: string): Promise<ConformanceReport> {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as { name?: unknown; version?: unknown; exports?: unknown };
  if (typeof pkg.name !== "string" || pkg.name.length === 0) {
    throw new Error(`pbuilder-conformance: the package.json in --dialect has no name`);
  }
  const fixture = exportTarget(pkg, "./conformance");
  return runFixture({
    report: { passed: false, dialect: pkg.name, version: typeof pkg.version === "string" ? pkg.version : "", failures: [] },
    fixture: fixture === undefined ? undefined : resolve(dir, fixture),
    folder: dir,
    absentFile: "unresolved",
    base: baseFile(dir, exportTarget(pkg, ".")),
    nameMismatch: NAME_MISMATCH,
  });
}

export interface LocalDialect {
  /** The key of the dialect's declaration in the Manifest. */
  name: string;
  /** The dialect's base file, the module that exports the Dialect. */
  path: string;
  /** The file that exports the dialect's conformance fixture data. */
  conformance: string;
}

/**
 * Runs the conformance fixture of a local dialect (CA-18). The fixture data must test a Dialect
 * named after the declaration's key and exported by the base file, and sit in the base file's
 * folder. Throws only when a module the fixture imports cannot be resolved.
 *
 * @example
 * const report = await checkLocalDialect({ name: "ini", path: "/ws/dialects/ini/index.ts", conformance: "/ws/dialects/ini/conformance.ts" });
 */
export async function checkLocalDialect({ name, path, conformance }: LocalDialect): Promise<ConformanceReport> {
  return runFixture({
    report: { passed: false, dialect: name, version: "", failures: [] },
    fixture: resolve(conformance),
    folder: dirname(resolve(path)),
    absentFile: "missing",
    base: existsSync(path) ? realpathSync(path) : undefined,
    nameMismatch: LOCAL_NAME_MISMATCH,
  });
}
