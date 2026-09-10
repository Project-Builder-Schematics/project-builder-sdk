import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";
import { GENERATED_FILENAME, runCli, USAGE, SUCCESS_LINE } from "../../bin/pbuilder-codegen.ts";
import { emitInputType } from "../../bin/emit-type.ts";
import { parseSchema } from "../../src/core/schema/schema-parse.ts";
import { computeSchemaDigest } from "../../src/core/schema/schema-digest.ts";

const cli = resolve(import.meta.dir, "../../bin/pbuilder-codegen.ts");
const schema = JSON.stringify({ properties: { port: { type: "number", label: "Port" } } });
const roots: string[] = [];
afterEach(() => { mock.restore(); for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const root = fs.mkdtempSync(join(tmpdir(), "codegen-project-"));
  roots.push(root);
  const project = join(root, "project");
  const pkg = join(project, "widget");
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(join(pkg, "schema.json"), schema);
  const sentinel = join(root, "executed");
  fs.writeFileSync(join(pkg, "factory.ts"), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(sentinel)}, 'executed'); throw new Error('factory executed');`);
  const config = join(project, "project-builder.json");
  fs.writeFileSync(config, JSON.stringify({ collections: { local: { widget: { path: "./widget" } } } }));
  return { root, project, pkg, config, sentinel, output: join(pkg, GENERATED_FILENAME) };
}

function invoke(cwd: string, args: string[] = []) {
  const child = Bun.spawnSync([process.execPath, cli, ...args], { cwd });
  return { code: child.exitCode, stdout: child.stdout.toString(), stderr: child.stderr.toString() };
}

it("generates a direct schematic named path", () => {
  const f = fixture();
  fs.writeFileSync(f.config, JSON.stringify({ collections: { local: { path: { path: "./widget" } } } }));
  expect(invoke(f.project)).toEqual({ code: 0, stdout: "pbuilder-codegen: generated 1, failed 0, duplicates 0\n", stderr: "" });
  expect(fs.readFileSync(f.output, "utf8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
  expect(fs.existsSync(f.sentinel)).toBe(false);
});

for (const sibling of [false, true]) {
  it(`reports a scalar path registration ${sibling ? "and completes its valid sibling" : "without silently succeeding"}`, () => {
    const f = fixture();
    fs.writeFileSync(f.config, JSON.stringify({ collections: { local: { path: 42, ...(sibling ? { widget: { path: "./widget" } } : {}) } } }));
    expect(invoke(f.project)).toEqual({
      code: 1,
      stdout: `pbuilder-codegen: generated ${sibling ? 1 : 0}, failed 1, duplicates 0\n`,
      stderr: 'pbuilder-codegen: "local/path": schematic must name a directory path\n',
    });
    if (sibling) expect(fs.readFileSync(f.output, "utf8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
    else expect(fs.existsSync(f.output)).toBe(false);
    expect(fs.existsSync(f.sentinel)).toBe(false);
  });
}

it("keeps string manifest precedence over direct and inline collection members", () => {
  const f = fixture();
  fs.writeFileSync(join(f.project, "collection.json"), JSON.stringify({ schematics: { widget: { factory: "./widget/factory.ts#run" } } }));
  fs.writeFileSync(f.config, JSON.stringify({ collections: { local: { path: "./collection.json", invalid: 42, schematics: { inline: {} } } } }));
  expect(invoke(f.project)).toEqual({ code: 0, stdout: "pbuilder-codegen: generated 1, failed 0, duplicates 0\n", stderr: "" });
  expect(fs.readFileSync(f.output, "utf8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
  expect(fs.existsSync(f.sentinel)).toBe(false);
});

it("authorizes descendants when the selected canonical project is the filesystem root", () => {
  const f = fixture();
  const realpath = fs.realpathSync;
  const stat = fs.statSync;
  const read = fs.readFileSync;
  const rootConfig = join(resolve("/"), "project-builder.json");
  fs.writeFileSync(f.config, JSON.stringify({ collections: { all: { widget: { path: f.pkg } } } }));
  spyOn(fs, "realpathSync").mockImplementation(Object.assign((path: fs.PathLike) => path === f.project ? resolve("/") : realpath(path), { native: realpath.native }) as typeof fs.realpathSync);
  spyOn(fs, "statSync").mockImplementation(((path: fs.PathLike) => stat(path === rootConfig ? f.config : path)) as typeof fs.statSync);
  spyOn(fs, "readFileSync").mockImplementation(((path: fs.PathOrFileDescriptor) => read(path === rootConfig ? f.config : path, "utf8")) as typeof fs.readFileSync);
  const out: string[] = [];
  const err: string[] = [];
  spyOn(console, "log").mockImplementation((text) => { out.push(String(text)); });
  spyOn(console, "error").mockImplementation((text) => { err.push(String(text)); });
  expect(runCli(["--project", f.project])).toBe(0);
  expect(out).toEqual(["pbuilder-codegen: generated 1, failed 0, duplicates 0"]);
  expect(err).toEqual([]);
  expect(read(f.output, "utf8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
});

for (const invalid of ["malformed", "directory", "dangling", "collections", "array"] as const) {
  it(`stops at the first ${invalid} marker without higher fallback or writes`, () => {
    const { project, pkg, output } = fixture();
    const marker = join(pkg, "project-builder.json");
    if (invalid === "directory") fs.mkdirSync(marker);
    else if (invalid === "dangling") fs.symlinkSync(join(pkg, "missing"), marker);
    else fs.writeFileSync(marker, invalid === "malformed" ? "{PRIVATE" : invalid === "array" ? "[]" : '{"collections":[]}');
    const result = invoke(pkg);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("cannot load project configuration");
    expect(result.stderr).not.toContain("PRIVATE");
    expect(fs.existsSync(output)).toBe(false);
    expect(fs.existsSync(join(project, GENERATED_FILENAME))).toBe(false);
  });
}

it("reports missing discovery without writing", () => {
  const { root, output } = fixture();
  expect(invoke(root)).toEqual({ code: 1, stdout: "", stderr: "pbuilder-codegen: project-builder.json not found\n" });
  expect(fs.existsSync(output)).toBe(false);
});

for (const config of [{}, { collections: {} }, { collections: { empty: { path: "./empty.json" } } }]) {
  it(`succeeds with no work for ${JSON.stringify(config)}`, () => {
    const f = fixture();
    fs.writeFileSync(f.config, JSON.stringify(config));
    fs.writeFileSync(join(f.project, "empty.json"), "{}");
    expect(invoke(f.project)).toEqual({ code: 0, stdout: "pbuilder-codegen: generated 0, failed 0, duplicates 0\n", stderr: "" });
    expect(fs.existsSync(f.output)).toBe(false);
  });
}

it("resolves manifest-relative compiled pointers at the last fragment without execution", () => {
  const f = fixture();
  const compiled = join(f.project, "manifests", "dist#part");
  fs.mkdirSync(compiled, { recursive: true });
  fs.copyFileSync(join(f.pkg, "factory.ts"), join(compiled, "widget.js"));
  fs.writeFileSync(join(compiled, "schema.json"), schema);
  fs.writeFileSync(join(f.project, "manifests", "collection.json"), '\uFEFF' + JSON.stringify({ schematics: { compiled: { factory: "./dist#part/widget.js#createWidget" } } }));
  fs.writeFileSync(f.config, '\uFEFF' + JSON.stringify({ collections: { one: { widget: { path: "./widget" } }, two: { path: "./manifests/collection.json" } } }));
  expect(invoke(f.pkg)).toEqual({ code: 0, stdout: "pbuilder-codegen: generated 2, failed 0, duplicates 0\n", stderr: "" });
  expect(fs.readFileSync(join(compiled, GENERATED_FILENAME), "utf8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
  expect(fs.existsSync(f.sentinel)).toBe(false);
});

for (const failed of [false, true]) {
  it(`deduplicates canonical aliases including ${failed ? "failed" : "successful"} generation`, () => {
    const f = fixture();
    fs.symlinkSync(f.pkg, join(f.project, "alias"), "dir");
    if (failed) fs.writeFileSync(join(f.pkg, "schema.json"), "{PRIVATE");
    fs.writeFileSync(f.config, JSON.stringify({ collections: { all: { a: { path: "./widget" }, b: { path: "./alias" } } } }));
    const result = invoke(f.project);
    expect(result.code).toBe(failed ? 1 : 0);
    expect(result.stdout).toBe(`pbuilder-codegen: generated ${failed ? 0 : 1}, failed ${failed ? 1 : 0}, duplicates 1\n`);
    expect(result.stderr.trim().split("\n").filter(Boolean).length).toBe(failed ? 1 : 0);
    expect(result.stderr).not.toContain("PRIVATE");
  });
}

for (const kind of ["outside", "output-link", "output-directory", "schema-directory", "ambiguous-factory"] as const) {
  it(`continues after ${kind} refusals without treating unsafe outputs as duplicates`, () => {
    const f = fixture();
    const bad = join(kind === "outside" ? f.root : f.project, "bad");
    fs.mkdirSync(bad);
    fs.writeFileSync(join(bad, "factory.ts"), "throw new Error('must not execute');");
    fs.writeFileSync(join(bad, "schema.json"), schema);
    const output = join(bad, GENERATED_FILENAME);
    if (kind === "output-link") fs.symlinkSync(f.output, output);
    if (kind === "output-directory") fs.mkdirSync(output);
    if (kind === "schema-directory") { fs.unlinkSync(join(bad, "schema.json")); fs.mkdirSync(join(bad, "schema.json")); }
    if (kind === "ambiguous-factory") fs.writeFileSync(join(bad, "factory.js"), "throw 1;");
    fs.writeFileSync(f.config, JSON.stringify({ collections: { all: { a: { path: bad }, b: { path: bad }, z: { path: "./widget" } } } }));
    const result = invoke(f.project);
    const generationFailure = kind === "schema-directory";
    expect(result.code).toBe(1);
    expect(result.stdout).toBe(`pbuilder-codegen: generated 1, failed ${generationFailure ? 1 : 2}, duplicates ${generationFailure ? 1 : 0}\n`);
    expect(fs.readFileSync(f.output, "utf8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
    if (kind === "outside") expect(fs.existsSync(output)).toBe(false);
    if (kind === "output-link") expect(fs.lstatSync(output).isSymbolicLink()).toBe(true);
  });
}

it("keeps config-symlink authority at its containing project rather than its target", () => {
  const f = fixture();
  const remote = join(f.root, "remote.json");
  fs.renameSync(f.config, remote);
  fs.symlinkSync(remote, f.config);
  expect(invoke(f.root, ["--project", f.project])).toEqual({ code: 0, stdout: "pbuilder-codegen: generated 1, failed 0, duplicates 0\n", stderr: "" });
  expect(fs.existsSync(join(f.root, "widget", GENERATED_FILENAME))).toBe(false);
});

it("enumerates prototype names safely and counts inline/dual and malformed entries independently", () => {
  const f = fixture();
  fs.writeFileSync(f.config, '{"collections":{"__proto__":{"constructor":{"path":"./widget"},"prototype":{"path":"./widget"},"dual":{"path":"./widget"},"schematics":{"dual":{},"inline":{}}},"broken":null,"last":{"bad":null}}}');
  const result = invoke(f.project);
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("pbuilder-codegen: generated 1, failed 4, duplicates 1\n");
  expect(result.stderr.trim().split("\n").length).toBe(4);
});

for (const pointer of ["./widget/factory.ts", "#run", "./widget/factory.ts#", "./widget/factory.ts#bad-name", "./missing.js#run"]) {
  it(`rejects unsupported manifest pointer ${pointer} and preserves siblings`, () => {
    const f = fixture();
    fs.writeFileSync(join(f.project, "collection.json"), JSON.stringify({ schematics: { bad: { factory: pointer }, good: { factory: "./widget/factory.ts#run" } } }));
    fs.writeFileSync(f.config, JSON.stringify({ collections: { manifest: { path: "./collection.json" } } }));
    const result = invoke(f.project);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("pbuilder-codegen: generated 1, failed 1, duplicates 0\n");
    expect(fs.existsSync(f.sentinel)).toBe(false);
  });
}

for (const mode of ["auto", "absolute", "relative"] as const) {
  it(`generates inert registered work with ${mode} selection`, () => {
    const { root, project, pkg, output, sentinel } = fixture();
    const cwd = mode === "auto" ? pkg : root;
    const args = mode === "auto" ? [] : ["--project", mode === "absolute" ? project : relative(cwd, project)];
    expect(invoke(cwd, args)).toEqual({ code: 0, stdout: "pbuilder-codegen: generated 1, failed 0, duplicates 0\n", stderr: "" });
    expect(fs.readFileSync(output, "utf8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
    expect(fs.existsSync(sentinel)).toBe(false);
  });
}

describe("project safety regression controls", () => {
  for (const input of ["config", "manifest", "schema", "output"] as const) {
    it.skipIf(process.platform === "win32")(`rejects a static ${input} FIFO without opening it`, () => {
      const f = fixture();
      const path = input === "config" ? f.config : input === "manifest" ? join(f.project, "collection.json") : join(f.pkg, input === "schema" ? "schema.json" : GENERATED_FILENAME);
      if (fs.existsSync(path)) fs.unlinkSync(path);
      if (input === "manifest") fs.writeFileSync(f.config, JSON.stringify({ collections: { all: { path: "./collection.json" } } }));
      expect(Bun.spawnSync(["mkfifo", path]).exitCode).toBe(0);
      const canonical = fs.realpathSync(path);
      const read = fs.readFileSync;
      const readSpy = spyOn(fs, "readFileSync").mockImplementation(((file: fs.PathOrFileDescriptor) => {
        if (file === path || file === canonical) throw new Error("FIFO read attempted");
        return read(file, "utf8");
      }) as typeof fs.readFileSync);
      const log = spyOn(console, "log").mockImplementation(() => {});
      const error = spyOn(console, "error").mockImplementation(() => {});
      expect(runCli(["--project", f.project])).toBe(1);
      expect(readSpy.mock.calls.some(([file]) => file === path || file === canonical)).toBe(false);
      expect(fs.lstatSync(path).isFIFO()).toBe(true);
      expect(log.mock.calls.map(([line]) => line)).toEqual(input === "config" ? [] : ["pbuilder-codegen: generated 0, failed 1, duplicates 0"]);
      expect(error.mock.calls.length).toBe(1);
      expect(String(error.mock.calls[0]?.[0])).toContain(input === "config" ? "cannot load project configuration" : input === "manifest" ? "all" : "local/widget");
    });
  }

  it("does not deduplicate distinct hardlinked output filenames", () => {
    const f = fixture();
    const second = join(f.project, "second");
    fs.mkdirSync(second);
    fs.writeFileSync(join(second, "factory.js"), "throw 1;");
    fs.writeFileSync(join(second, "schema.json"), schema);
    fs.writeFileSync(f.output, "old");
    fs.linkSync(f.output, join(second, GENERATED_FILENAME));
    fs.writeFileSync(f.config, JSON.stringify({ collections: { all: { a: { path: "./widget" }, b: { path: "./second" } } } }));
    expect(invoke(f.project)).toEqual({ code: 0, stdout: "pbuilder-codegen: generated 2, failed 0, duplicates 0\n", stderr: "" });
    expect(fs.statSync(f.output).ino).toBe(fs.statSync(join(second, GENERATED_FILENAME)).ino);
  });

  it("follows the actual manifest module directory, not its symlink's directory", () => {
    const f = fixture();
    const modules = join(f.project, "modules");
    fs.mkdirSync(modules);
    fs.symlinkSync(join(f.pkg, "factory.ts"), join(modules, "linked.js"));
    fs.writeFileSync(join(f.project, "collection.json"), JSON.stringify({ schematics: { widget: { factory: "./modules/linked.js#run" } } }));
    fs.writeFileSync(f.config, JSON.stringify({ collections: { all: { path: "./collection.json" } } }));
    expect(invoke(f.project)).toEqual({ code: 0, stdout: "pbuilder-codegen: generated 1, failed 0, duplicates 0\n", stderr: "" });
    expect(fs.readFileSync(f.output, "utf8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
    expect(fs.existsSync(join(modules, GENERATED_FILENAME))).toBe(false);
    expect(fs.existsSync(f.sentinel)).toBe(false);
  });

  for (const invalid of ["{PRIVATE", '{"schematics":[]}', "[]"]) {
    it(`isolates malformed collection manifests (${invalid})`, () => {
      const f = fixture();
      fs.writeFileSync(join(f.project, "bad.json"), invalid);
      fs.writeFileSync(f.config, JSON.stringify({ collections: { bad: { path: "./bad.json" }, good: { widget: { path: "./widget" } } } }));
      const result = invoke(f.project);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe("pbuilder-codegen: generated 1, failed 1, duplicates 0\n");
      expect(result.stderr).not.toContain("PRIVATE");
    });
  }

  for (const stage of ["config", "schema"] as const) {
    it(`sanitizes unexpected ${stage} read errors without mutation`, () => {
      const f = fixture();
      fs.writeFileSync(f.output, "preserve");
      const read = fs.readFileSync;
      spyOn(fs, "readFileSync").mockImplementation(((path: fs.PathOrFileDescriptor) => {
        if (path === (stage === "config" ? fs.realpathSync(f.config) : join(fs.realpathSync(f.pkg), "schema.json"))) throw new Error("PRIVATE OS STACK");
        return read(path, "utf8");
      }) as typeof fs.readFileSync);
      spyOn(console, "log").mockImplementation(() => {});
      const error = spyOn(console, "error").mockImplementation(() => {});
      expect(runCli(["--project", f.project])).toBe(1);
      expect(error.mock.calls.length).toBe(1);
      expect(String(error.mock.calls[0]?.[0])).not.toContain("PRIVATE");
      expect(String(error.mock.calls[0]?.[0])).toContain(stage === "config" ? "cannot load project configuration" : "cannot read or generate schema.json");
      expect(read(f.output, "utf8")).toBe("preserve");
    });
  }

  for (const args of [["--project"], ["--project", "--help"], ["--project", "missing"], ["--project", "project-builder.json"]]) {
    it(`rejects invalid explicit selection ${args.join(" ")}`, () => {
      const f = fixture();
      const result = invoke(f.project, args);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe("");
      expect(fs.existsSync(f.output)).toBe(false);
      expect(result.stderr).toContain(args[1] === undefined || args[1] === "--help" ? "Usage:" : "cannot load project configuration");
    });
  }
});

it("counts a failed destination once while completing an independent destination", () => {
  const f = fixture();
  const bad = join(f.project, "bad");
  fs.mkdirSync(bad);
  fs.writeFileSync(join(bad, "factory.ts"), "throw 1;");
  fs.writeFileSync(join(bad, "schema.json"), "{PRIVATE");
  fs.writeFileSync(join(bad, GENERATED_FILENAME), "preserve");
  fs.writeFileSync(f.config, JSON.stringify({ collections: { all: { a: { path: "./bad" }, b: { path: "./bad" }, z: { path: "./widget" } } } }));
  const result = invoke(f.project);
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("pbuilder-codegen: generated 1, failed 1, duplicates 1\n");
  expect(result.stderr.trim().split("\n").length).toBe(1);
  expect(fs.readFileSync(join(bad, GENERATED_FILENAME), "utf8")).toBe("preserve");
  expect(fs.readFileSync(f.output, "utf8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
});

it("escapes warning labels and schema keys without leaking values or stack traces", () => {
  const f = fixture();
  const key = "bad\n\r\t\u001b[31m";
  fs.writeFileSync(join(f.pkg, "schema.json"), JSON.stringify({ properties: { [key]: { type: "PRIVATE_SCHEMA_PAYLOAD", label: "Port" } } }));
  fs.writeFileSync(f.config, JSON.stringify({ collections: { [key]: { [key]: { path: "./widget" } } } }));
  const result = invoke(f.project);
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("pbuilder-codegen: generated 0, failed 1, duplicates 0\n");
  expect(result.stderr).toContain(JSON.stringify(`${key}/${key}`));
  expect(result.stderr.trim().split("\n").length).toBe(1);
  expect(result.stderr).not.toMatch(/[\r\t\u001b]/);
  expect(result.stderr).not.toContain("PRIVATE_SCHEMA_PAYLOAD");
  expect(result.stderr).not.toContain(" at ");
  expect(fs.existsSync(f.output)).toBe(false);
});

for (const kind of ["directory", "module"] as const) {
  it(`refuses an external ${kind} symlink while generating an internal sibling`, () => {
    const f = fixture();
    const outside = join(f.root, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(join(outside, "factory.ts"), "throw new Error('must not execute');");
    fs.writeFileSync(join(outside, "schema.json"), schema);
    fs.writeFileSync(join(outside, GENERATED_FILENAME), "preserve");
    fs.symlinkSync(kind === "directory" ? outside : join(outside, "factory.ts"), join(f.project, "alias"), kind === "directory" ? "dir" : "file");
    fs.writeFileSync(join(f.project, "collection.json"), JSON.stringify({ schematics: { bad: { factory: "./alias#run" } } }));
    fs.writeFileSync(f.config, JSON.stringify({ collections: { bad: kind === "directory" ? { bad: { path: "./alias" } } : { path: "./collection.json" }, good: { widget: { path: "./widget" } } } }));
    const result = invoke(f.project);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("pbuilder-codegen: generated 1, failed 1, duplicates 0\n");
    expect(result.stderr).toContain("refusing to write outside the selected project root");
    expect(fs.readFileSync(join(outside, GENERATED_FILENAME), "utf8")).toBe("preserve");
    expect(fs.readFileSync(f.output, "utf8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
  });
}

for (const kind of ["link", "directory"] as const) {
  it(`applies batch ${kind} leaf refusal on controlled win32 without changing the legacy writer`, () => {
    const f = fixture();
    if (kind === "directory") fs.mkdirSync(f.output);
    else fs.symlinkSync(join(f.root, "missing.ts"), f.output);
    const descriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
    const out = spyOn(console, "log").mockImplementation(() => {});
    const err = spyOn(console, "error").mockImplementation(() => {});
    const write = spyOn(fs, "writeFileSync");
    try {
      Object.defineProperty(process, "platform", { ...descriptor, value: "win32" });
      expect(runCli(["--project", f.project])).toBe(1);
      expect(out.mock.calls.map(([line]) => line)).toEqual(["pbuilder-codegen: generated 0, failed 1, duplicates 0"]);
      expect(String(err.mock.calls[0]?.[0])).toContain("cannot write a regular, non-symbolic-link output");
      expect(write.mock.calls.length).toBe(0);
      expect(fs.existsSync(join(f.root, "missing.ts"))).toBe(false);
    } finally {
      Object.defineProperty(process, "platform", descriptor);
    }
  });
}

for (const args of [["--help"], ["-h"], ["--unknown"]]) {
  it(`preserves positional-era usage for ${args[0]}`, () => {
    const f = fixture();
    const help = args[0] !== "--unknown";
    expect(invoke(f.project, args)).toEqual({ code: help ? 0 : 1, stdout: help ? `${USAGE}\n` : "", stderr: help ? "" : `${USAGE}\n` });
    expect(fs.existsSync(f.output)).toBe(false);
  });
}

it("retains positional trailing-argument behavior instead of switching to project mode", () => {
  const f = fixture();
  fs.writeFileSync(join(f.project, "package.json"), "{}");
  fs.writeFileSync(f.config, "{INVALID");
  expect(invoke(f.project, [f.pkg, "--project", "missing"])).toEqual({ code: 0, stdout: `${SUCCESS_LINE}\n`, stderr: "" });
  expect(fs.readFileSync(f.output, "utf8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
});
