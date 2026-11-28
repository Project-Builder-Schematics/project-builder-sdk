/**
 * CA-13 / A-16 — `pbuilder-conformance --dialect <dir>` runs the conformance fixture a dialect
 * package ships as `<pkg>/conformance` and prints one JSON line. Exit 1 is reserved for a fixture
 * that ran and failed (a missing fixture included); anything else means it could not run. The
 * report never repeats the author's code or values (A-87).
 */
import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkDialectPackage, checkLocalDialect } from "../../../../../src/bounded-contexts/authoring/testing/conformance/run-package.ts";

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
  conformanceTarget?: string;
  conformanceSource?: string;
  rootModule?: false;
}

let packages = 0;
function dialectPackage(shape: PackageShape = {}): string {
  const dir = join(scratch, `pkg-${packages++}`);
  mkdirSync(dir);
  const name = shape.name ?? "@company/ini-dialect";
  const exports: Record<string, string> = shape.rootModule === false ? {} : { ".": "./index.js" };
  if (shape.conformanceExport !== false) exports["./conformance"] = shape.conformanceTarget ?? "./conformance.js";
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "1.2.3", type: "module", exports }));
  if (shape.rootModule !== false) writeFileSync(
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
    shape.conformanceSource ??
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

  it("fails a default export that is not a fixture as fixture_invalid", async () => {
    const report = await checkDialectPackage(dialectPackage({ conformanceSource: "export default 42;" }));
    expect(report.failures.map((failure) => failure.case)).toEqual(["fixture_invalid"]);
  });

  it("fails a fixture whose code throws while it loads as fixture_threw", async () => {
    const report = await checkDialectPackage(dialectPackage({ conformanceSource: `throw new Error(${JSON.stringify(SECRET)});` }));
    expect(report.failures.map((failure) => failure.case)).toEqual(["fixture_threw"]);
    expect(JSON.stringify(report)).not.toContain(SECRET);
  });

  it("fails a ./conformance export that points outside the package as fixture_invalid", async () => {
    const report = await checkDialectPackage(dialectPackage({ conformanceTarget: "../outside.js" }));
    expect(report.failures.map((failure) => failure.case)).toEqual(["fixture_invalid"]);
  });

  it("names the broken check without repeating the author's sample", async () => {
    const report = await checkDialectPackage(dialectPackage({ print: "tree.text + 'x'", samples: [SECRET] }));
    expect(report.passed).toBe(false);
    expect(report.failures.map((failure) => failure.case)).toEqual(["round_trip"]);
    expect(JSON.stringify(report)).not.toContain(SECRET);
  });
});

// Fixture data that builds a Dialect of its own instead of importing the one its base file exports.
const OWN_DIALECT = `import { defineDialect } from ${JSON.stringify(KIT)};
const astLibrary = { parseIni: (text) => ({ text }), printIni: (tree) => tree.text };
const ast = { parse: (text) => astLibrary.parseIni(text), print: (tree) => astLibrary.printIni(tree) };
const ini = defineDialect({ name: "NAME", extensions: [".ini"], ast, ops: {} });
export default {
  dialect: ini,
  samples: ["colour=red\\n"],
  module: { find: (path) => ini.find(path), astLibrary },
  expectedAstLibrary: astLibrary,
  libraryExercise: { path: "settings.ini", seed: "colour=red\\n", expect: "colour=blue\\n", modify: (tree) => { tree.text = "colour=blue\\n"; } },
};
`;

interface LocalShape {
  key?: string;
  dialectName?: string;
  conformanceSource?: string;
  conformanceOutside?: boolean;
  noConformance?: boolean;
}

let workspaces = 0;
function localDialect(shape: LocalShape = {}): { name: string; path: string; conformance: string } {
  const folder = join(scratch, `ws-${workspaces++}`, "dialects", "ini");
  mkdirSync(folder, { recursive: true });
  const name = shape.key ?? "ini";
  const path = join(folder, "index.js");
  writeFileSync(
    path,
    `import { defineDialect } from ${JSON.stringify(KIT)};
export const astLibrary = { parseIni: (text) => ({ text }), printIni: (tree) => tree.text };
export const ini = defineDialect({
  name: ${JSON.stringify(shape.dialectName ?? name)},
  extensions: [".ini"],
  ast: { parse: (text) => astLibrary.parseIni(text), print: (tree) => astLibrary.printIni(tree) },
  ops: {},
});
export const find = (path) => ini.find(path);
`
  );
  const conformance = shape.conformanceOutside === true ? join(folder, "..", "conformance.js") : join(folder, "conformance.js");
  if (shape.noConformance !== true) {
    writeFileSync(
      conformance,
      shape.conformanceSource ??
        `import { ini, astLibrary, find } from ${JSON.stringify(shape.conformanceOutside === true ? "./ini/index.js" : "./index.js")};
export default {
  dialect: ini,
  samples: ["colour=red\\n"],
  module: { find, astLibrary },
  expectedAstLibrary: astLibrary,
  libraryExercise: { path: "settings.ini", seed: "colour=red\\n", expect: "colour=blue\\n", modify: (tree) => { tree.text = "colour=blue\\n"; } },
};
`
    );
  }
  return { name, path, conformance };
}

describe("checkDialectPackage — base file (A-16)", () => {
  it("fails fixture data that tests a Dialect other than the one the package's root module exports", async () => {
    const report = await checkDialectPackage(dialectPackage({ conformanceSource: OWN_DIALECT.replace("NAME", "@company/ini-dialect") }));
    expect(report.passed).toBe(false);
    expect(report.failures.map((failure) => failure.case)).toEqual(["base_mismatch"]);
  });

  it("fails a package without a root module as base_mismatch", async () => {
    const report = await checkDialectPackage(
      dialectPackage({ rootModule: false, conformanceSource: OWN_DIALECT.replace("NAME", "@company/ini-dialect") })
    );
    expect(report.failures.map((failure) => failure.case)).toEqual(["base_mismatch"]);
  });
});

// A package whose Dialect lives in dialect.js, with the root export written as given.
function rootExport(root: unknown, extra: Record<string, unknown> = {}): string {
  const dir = dialectPackage({ conformanceSource: CONFORMANCE_OF("./dialect.js") });
  writeFileSync(join(dir, "dialect.js"), DIALECT_MODULE("@company/ini-dialect"));
  writeFileSync(join(dir, "elsewhere.js"), DIALECT_MODULE("@company/ini-dialect"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "@company/ini-dialect", version: "1.2.3", type: "module", exports: { ".": root, "./conformance": "./conformance.js" }, ...extra })
  );
  return dir;
}

const DIALECT_MODULE = (name: string) => `import { defineDialect } from ${JSON.stringify(KIT)};
export const astLibrary = { parseIni: (text) => ({ text }), printIni: (tree) => tree.text };
export const ini = defineDialect({
  name: ${JSON.stringify(name)},
  extensions: [".ini"],
  ast: { parse: (text) => astLibrary.parseIni(text), print: (tree) => astLibrary.printIni(tree) },
  ops: {},
});
export const find = (path) => ini.find(path);
`;

const CONFORMANCE_OF = (specifier: string) => `import { ini, astLibrary, find } from ${JSON.stringify(specifier)};
export default {
  dialect: ini,
  samples: ["colour=red\\n"],
  module: { find, astLibrary },
  expectedAstLibrary: astLibrary,
  libraryExercise: { path: "settings.ini", seed: "colour=red\\n", expect: "colour=blue\\n", modify: (tree) => { tree.text = "colour=blue\\n"; } },
};
`;

describe("checkDialectPackage — which file is the base file (A-16, as the engine's pointer dir)", () => {
  async function cases(dir: string): Promise<string[]> {
    return (await checkDialectPackage(dir)).failures.map((failure) => failure.case);
  }

  it("picks the first of bun, import and default, through nested conditions", async () => {
    expect(await cases(rootExport({ node: "./elsewhere.js", import: { bun: "./dialect.js", default: "./elsewhere.js" } }))).toEqual([]);
  });

  it("has no base file when the root export picks nothing, even with a main", async () => {
    expect(await cases(rootExport({ require: "./dialect.js" }, { main: "./dialect.js" }))).toEqual(["base_mismatch"]);
  });

  it("has no base file when the root target does not start with ./", async () => {
    expect(await cases(rootExport("dialect.js"))).toEqual(["base_mismatch"]);
  });

  it("has no base file when the root target links out of the package", async () => {
    const dir = rootExport("./linked.js");
    const outside = join(scratch, `outside-${packages}.js`);
    writeFileSync(outside, DIALECT_MODULE("@company/ini-dialect"));
    symlinkSync(outside, join(dir, "linked.js"));
    writeFileSync(join(dir, "conformance.js"), CONFORMANCE_OF("./linked.js"));
    expect(await cases(dir)).toEqual(["base_mismatch"]);
  });

  it("reports a base file that throws while it loads as fixture_threw, naming the base file", async () => {
    const dir = rootExport("./dialect.js");
    writeFileSync(join(dir, "conformance.js"), CONFORMANCE_OF("./elsewhere.js"));
    writeFileSync(join(dir, "dialect.js"), `throw new Error(${JSON.stringify(SECRET)});`);
    const report = await checkDialectPackage(dir);
    expect(report.failures).toEqual([{ case: "fixture_threw", reason: "A-16: the dialect's base file threw while it loaded" }]);
    expect(JSON.stringify(report)).not.toContain(SECRET);
  });

  it("cannot run when the ./conformance export names a file the package does not hold", async () => {
    const dir = dialectPackage();
    rmSync(join(dir, "conformance.js"));
    await expect(checkDialectPackage(dir)).rejects.toThrow("a module the fixture imports could not be resolved");
  });
});

describe("checkLocalDialect (CA-18, A-16)", () => {
  it("passes a conforming local dialect, reported under its key with no version", async () => {
    expect(await checkLocalDialect(localDialect())).toEqual({ passed: true, dialect: "ini", version: "", failures: [] });
  });

  it("fails a local dialect whose name is not the key of its declaration", async () => {
    const report = await checkLocalDialect(localDialect({ key: "settings", dialectName: "ini" }));
    expect(report).toEqual({
      passed: false,
      dialect: "settings",
      version: "",
      failures: [{ case: "name_mismatch", reason: "A-16: the dialect's name is not the key of its declaration" }],
    });
  });

  it("fails fixture data that tests a Dialect other than the one the base file exports", async () => {
    const report = await checkLocalDialect(localDialect({ conformanceSource: OWN_DIALECT.replace("NAME", "ini") }));
    expect(report.failures.map((failure) => failure.case)).toEqual(["base_mismatch"]);
  });

  it("fails a local dialect whose conformance file does not exist as fixture_missing", async () => {
    const report = await checkLocalDialect(localDialect({ noConformance: true }));
    expect(report.failures.map((failure) => failure.case)).toEqual(["fixture_missing"]);
  });

  it("fails a conformance file that links out of the base file's folder as fixture_invalid", async () => {
    const local = localDialect({ conformanceOutside: true });
    const linked = join(local.path, "..", "linked-conformance.js");
    symlinkSync(local.conformance, linked);
    const report = await checkLocalDialect({ ...local, conformance: linked });
    expect(report.failures.map((failure) => failure.case)).toEqual(["fixture_invalid"]);
  });

  it("fails a conformance file outside the base file's folder as fixture_invalid", async () => {
    const report = await checkLocalDialect(localDialect({ conformanceOutside: true }));
    expect(report.failures.map((failure) => failure.case)).toEqual(["fixture_invalid"]);
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

  it("exits 2 when a module the fixture imports cannot be resolved", () => {
    const { exitCode, stdout } = run("--dialect", dialectPackage({ conformanceSource: 'import "@company/not-installed";\nexport default {};' }));
    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
  });

  it("exits once the report is written even when the fixture leaves a timer running", () => {
    const { exitCode, stdout } = run("--dialect", dialectPackage({ conformanceSource: "setInterval(() => {}, 1000);\nexport default 42;" }));
    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout).failures[0].case).toBe("fixture_invalid");
  }, 10_000);

  it("exits 0 with the local dialect's report for --local", () => {
    const { name, path, conformance } = localDialect();
    const { exitCode, stdout } = run("--local", name, "--conformance", conformance, "--path", path);
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ passed: true, dialect: "ini", version: "", failures: [] });
  });

  it("exits 1 for a local dialect whose name is not its key", () => {
    const { name, path, conformance } = localDialect({ key: "settings", dialectName: "ini" });
    const { exitCode, stdout } = run("--local", name, "--conformance", conformance, "--path", path);
    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout).failures[0].case).toBe("name_mismatch");
  });

  it("exits 2 when --local lacks --path", () => {
    const { name, conformance } = localDialect();
    const { exitCode, stdout, stderr } = run("--local", name, "--conformance", conformance);
    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain("--local");
  });

  it("exits 2 when the directory holds no package", () => {
    const { exitCode, stdout } = run("--dialect", join(scratch, "missing"));
    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
  });
});
