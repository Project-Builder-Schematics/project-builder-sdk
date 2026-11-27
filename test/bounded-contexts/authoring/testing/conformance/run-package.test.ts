/**
 * CA-13 / A-16 — `pbuilder-conformance --dialect <dir>` runs the conformance fixture a dialect
 * package ships as `<pkg>/conformance` and prints one JSON line. Exit 1 is reserved for a fixture
 * that ran and failed (a missing fixture included); anything else means it could not run. The
 * report never repeats the author's code or values (A-87).
 */
import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkDialectPackage } from "../../../../../src/bounded-contexts/authoring/testing/conformance/run-package.ts";

const ROOT = resolve(import.meta.dir, "../../../../..");
const KIT = pathToFileURL(join(ROOT, "src/dialect/index.ts")).href;
const BIN = join(ROOT, "src/bin/pbuilder-conformance.ts");
const scratch = mkdtempSync(join(tmpdir(), "pbuilder-conformance-"));
const SECRET = "secret-sample-value";

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

interface PackageShape {
  name?: string;
  dialectName?: string;
  conformanceExport?: boolean;
  print?: string;
  samples?: string[];
  noise?: boolean;
}

let packages = 0;
function dialectPackage(shape: PackageShape = {}): string {
  const dir = join(scratch, `pkg-${packages++}`);
  mkdirSync(dir);
  const name = shape.name ?? "@company/ini-dialect";
  const exports: Record<string, string> = { ".": "./index.js" };
  if (shape.conformanceExport !== false) exports["./conformance"] = "./conformance.js";
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "1.2.3", type: "module", exports }));
  writeFileSync(
    join(dir, "index.js"),
    `import { defineDialect } from ${JSON.stringify(KIT)};
export const astLibrary = { parseIni: (text) => ({ text }), printIni: (tree) => ${shape.print ?? "tree.text"} };
export const ini = defineDialect({
  name: ${JSON.stringify(shape.dialectName ?? name)},
  extensions: [".ini"],
  ast: { parse: (text) => astLibrary.parseIni(text), print: (tree) => astLibrary.printIni(tree) },
  ops: {},
});
export const find = (path) => ini.find(path);
`
  );
  writeFileSync(
    join(dir, "conformance.js"),
    `import { ini, astLibrary, find } from "./index.js";
${shape.noise === true ? 'console.log("noise"); process.stdout.write("more noise\\n");' : ""}
export default {
  dialect: ini,
  samples: ${JSON.stringify(shape.samples ?? ["colour=red\n"])},
  module: { find, astLibrary },
  expectedAstLibrary: astLibrary,
  libraryExercise: { path: "settings.ini", seed: "colour=red\\n", expect: "colour=blue\\n", modify: (tree) => { tree.text = "colour=blue\\n"; } },
};
`
  );
  return dir;
}

describe("checkDialectPackage (CA-13, A-16)", () => {
  it("passes a conforming dialect package", async () => {
    expect(await checkDialectPackage(dialectPackage())).toEqual({
      passed: true,
      dialect: "@company/ini-dialect",
      version: "1.2.3",
      failures: [],
    });
  });

  it("fails a package that exports no ./conformance fixture as fixture_missing", async () => {
    const report = await checkDialectPackage(dialectPackage({ conformanceExport: false }));
    expect(report.passed).toBe(false);
    expect(report.failures.map((failure) => failure.case)).toEqual(["fixture_missing"]);
  });

  it("fails a dialect whose name is not its package's name", async () => {
    const report = await checkDialectPackage(dialectPackage({ dialectName: "@company/other" }));
    expect(report.passed).toBe(false);
    expect(report.failures.map((failure) => failure.case)).toEqual(["name_mismatch"]);
  });

  it("names the broken check without repeating the author's sample", async () => {
    const report = await checkDialectPackage(dialectPackage({ print: "tree.text + 'x'", samples: [SECRET] }));
    expect(report.passed).toBe(false);
    expect(report.failures.map((failure) => failure.case)).toEqual(["round_trip"]);
    expect(JSON.stringify(report)).not.toContain(SECRET);
  });
});

describe("pbuilder-conformance (CA-13)", () => {
  function run(...args: string[]) {
    const result = Bun.spawnSync(["bun", BIN, ...args], { stdout: "pipe", stderr: "pipe" });
    return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  }

  it("exits 0 with one JSON line for a conforming dialect", () => {
    const { exitCode, stdout } = run("--dialect", dialectPackage());
    expect(exitCode).toBe(0);
    expect(stdout.endsWith("\n")).toBe(true);
    expect(JSON.parse(stdout)).toEqual({ passed: true, dialect: "@company/ini-dialect", version: "1.2.3", failures: [] });
  });

  it("keeps stdout to the one JSON line when the fixture's code prints", () => {
    const { exitCode, stdout, stderr } = run("--dialect", dialectPackage({ noise: true }));
    expect(exitCode).toBe(0);
    expect(stdout.split("\n")).toEqual([JSON.stringify({ passed: true, dialect: "@company/ini-dialect", version: "1.2.3", failures: [] }), ""]);
    expect(stderr).toContain("noise");
  });

  it("exits 1 with one JSON line when the fixture is missing", () => {
    const { exitCode, stdout } = run("--dialect", dialectPackage({ conformanceExport: false }));
    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout).failures[0].case).toBe("fixture_missing");
  });

  it("exits 2 and prints nothing on stdout without --dialect", () => {
    const { exitCode, stdout, stderr } = run();
    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain("--dialect");
  });

  it("exits 2 when the directory holds no package", () => {
    const { exitCode, stdout } = run("--dialect", join(scratch, "missing"));
    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
  });
});
