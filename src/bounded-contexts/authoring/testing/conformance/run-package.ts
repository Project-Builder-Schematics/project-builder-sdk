// CA-13 / A-16: runs the conformance fixture a dialect package ships as `<pkg>/conformance`. The
// report names each broken check by a fixed case and reason, never by the fixture's own message,
// which may carry the author's samples or the text of an error their code threw (A-87).

import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
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

function classify(err: unknown): ConformanceFailure {
  const message = err instanceof Error ? err.message : "";
  return CHECKS.find(([marker]) => message.includes(marker))?.[1] ?? FIXTURE_THREW;
}

function conformanceTarget(exports: unknown): string | undefined {
  if (typeof exports !== "object" || exports === null) return undefined;
  const entry = (exports as Record<string, unknown>)["./conformance"];
  if (typeof entry === "string") return entry;
  if (typeof entry !== "object" || entry === null) return undefined;
  const conditions = entry as Record<string, unknown>;
  const target = conditions.bun ?? conditions.import ?? conditions.default;
  return typeof target === "string" ? target : undefined;
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

function isFixture(value: unknown): value is DialectFixture {
  if (typeof value !== "object" || value === null) return false;
  const fixture = value as Partial<DialectFixture>;
  return typeof fixture.dialect === "object" && fixture.dialect !== null && Array.isArray(fixture.samples);
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
  const report: ConformanceReport = {
    passed: false,
    dialect: pkg.name,
    version: typeof pkg.version === "string" ? pkg.version : "",
    failures: [],
  };
  const target = conformanceTarget(pkg.exports);
  if (target === undefined) {
    report.failures.push(FIXTURE_MISSING);
    return report;
  }
  const file = resolve(dir, target);
  if (!isInside(dir, file)) {
    report.failures.push(FIXTURE_INVALID);
    return report;
  }
  let fixture: unknown;
  try {
    fixture = ((await import(pathToFileURL(file).href)) as { default?: unknown }).default;
  } catch (err) {
    if (isUnresolvedModule(err)) throw new Error("pbuilder-conformance: a module the fixture imports could not be resolved");
    report.failures.push(FIXTURE_THREW);
    return report;
  }
  if (!isFixture(fixture)) {
    report.failures.push(FIXTURE_INVALID);
    return report;
  }
  if (fixture.dialect.name !== pkg.name) report.failures.push(NAME_MISMATCH);
  try {
    await testDialect(fixture);
  } catch (err) {
    report.failures.push(classify(err));
  }
  report.passed = report.failures.length === 0;
  return report;
}
