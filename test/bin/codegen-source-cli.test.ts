import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { generateSchema, runCli, GENERATED_FILENAME, SUCCESS_LINE } from "../../bin/pbuilder-codegen.ts";
import { emitInputType } from "../../bin/emit-type.ts";
import { parseSchema } from "../../src/core/schema/schema-parse.ts";
import { computeSchemaDigest } from "../../src/core/schema/schema-digest.ts";

const cli = resolve(import.meta.dir, "../../bin/pbuilder-codegen.ts");
const schema = JSON.stringify({ properties: { port: { type: "number", label: "Port" } } });
const roots: string[] = [];

afterEach(() => {
  mock.restore();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(join(tmpdir(), "codegen-source-"));
  roots.push(root);
  const project = join(root, "project");
  const pkg = join(project, "factory");
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(join(project, "package.json"), "{}");
  fs.writeFileSync(join(pkg, "factory.ts"), "export default () => {};");
  fs.writeFileSync(join(pkg, "schema.json"), schema);
  return { root, project, pkg, output: join(pkg, GENERATED_FILENAME) };
}

function invoke(project: string, pkg: string) {
  const child = Bun.spawnSync([process.execPath, cli, pkg], { cwd: project });
  return {
    code: child.exitCode,
    stdout: child.stdout.toString(),
    stderr: child.stderr.toString(),
  };
}

function captureCli(project: string, pkg: string, platform = process.platform) {
  const cwd = process.cwd();
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const log = spyOn(console, "log").mockImplementation((text) => { stdout.push(String(text)); });
  const error = spyOn(console, "error").mockImplementation((text) => { stderr.push(String(text)); });
  try {
    process.chdir(project);
    Object.defineProperty(process, "platform", { ...descriptor, value: platform });
    return { code: runCli([pkg]), stdout: stdout.join("\n"), stderr: stderr.join("\n") };
  } finally {
    Object.defineProperty(process, "platform", descriptor);
    process.chdir(cwd);
    log.mockRestore();
    error.mockRestore();
  }
}

describe.skipIf(process.platform !== "linux" && process.platform !== "darwin")("source CLI output safety", () => {
  for (const inside of [false, true]) {
    for (const existing of [false, true]) {
      it(`preserves ${inside ? "inside" : "outside"} ${existing ? "existing" : "missing"} link targets for CLI and direct calls`, () => {
        const { root, project, pkg, output } = fixture();
        const target = join(inside ? project : root, "target.ts");
        if (existing) fs.writeFileSync(target, "untouched");
        fs.symlinkSync(target, output);
        const before = fs.lstatSync(output);
        const result = invoke(project, pkg);
        expect(result).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: refusing symbolic-link output\n` });
        expect(() => generateSchema(pkg)).toThrow(`pbuilder-codegen: ${output}: refusing symbolic-link output`);
        expect(fs.readlinkSync(output)).toBe(target);
        expect(fs.lstatSync(output).ino).toBe(before.ino);
        expect(existing ? fs.readFileSync(target, "utf-8") : fs.existsSync(target)).toBe(existing ? "untouched" : false);
      });
    }
  }

  for (const stage of ["openSync", "fstatSync", "ftruncateSync", "writeFileSync", "closeSync"] as const) {
    it(`reports output failure at ${stage} and closes acquired descriptors`, () => {
      const { project, pkg, output } = fixture();
      fs.writeFileSync(output, "old output");
      const realClose = fs.closeSync;
      const realStat = fs.fstatSync;
      let closes = 0;
      let closedFd: number | undefined;
      spyOn(fs, "closeSync").mockImplementation((fd) => {
        closes++;
        closedFd = fd;
        realClose(fd);
        if (stage === "closeSync") throw Object.assign(new Error("private detail"), { code: "EIO" });
      });
      if (stage !== "closeSync") {
        spyOn(fs, stage).mockImplementation(() => {
          throw Object.assign(new Error("private detail"), { code: "ENOENT" });
        });
      }
      const result = captureCli(project, pkg);
      expect(result).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: cannot write output (${stage === "closeSync" ? "EIO" : "ENOENT"})` });
      expect(closes).toBe(stage === "openSync" ? 0 : 1);
      const fd = closedFd;
      if (fd !== undefined) expect(() => realStat(fd)).toThrow("EBADF");
      if (stage === "openSync" || stage === "fstatSync" || stage === "ftruncateSync") {
        expect(fs.readFileSync(output, "utf-8")).toBe("old output");
      }
    });
  }

  it("retains the primary output error when descriptor cleanup also fails", () => {
    const { project, pkg, output } = fixture();
    const realClose = fs.closeSync;
    spyOn(fs, "fstatSync").mockImplementation(() => { throw Object.assign(new Error("primary"), { code: "EIO" }); });
    spyOn(fs, "closeSync").mockImplementation((fd) => {
      realClose(fd);
      throw Object.assign(new Error("cleanup"), { code: "EBADF" });
    });
    expect(captureCli(project, pkg)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: cannot write output (EIO)` });
  });

  it("rejects nonregular descriptors before truncating or writing", () => {
    const { project, pkg, output } = fixture();
    fs.writeFileSync(output, "preserve bytes");
    const directoryStat = fs.statSync(pkg);
    spyOn(fs, "fstatSync").mockReturnValue(directoryStat);
    expect(captureCli(project, pkg)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: output is not a regular file` });
    expect(fs.readFileSync(output, "utf-8")).toBe("preserve bytes");
  });

  it("rejects a directory output without deleting it", () => {
    const { project, pkg, output } = fixture();
    fs.mkdirSync(output);
    expect(captureCli(project, pkg)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: output is not a regular file` });
    expect(fs.lstatSync(output).isDirectory()).toBe(true);
  });

  it("refuses a FIFO leaf without blocking or removing it", () => {
    const { project, pkg, output } = fixture();
    expect(Bun.spawnSync(["mkfifo", output]).exitCode).toBe(0);
    expect(invoke(project, pkg)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: output is not a regular file\n` });
    expect(fs.lstatSync(output).isFIFO()).toBe(true);
  });

  for (const readerPresent of [false, true]) {
    it(`refuses a substituted FIFO ${readerPresent ? "with" : "without"} a reader at the real open`, () => {
      const { project, pkg, output } = fixture();
      const realOpen = fs.openSync;
      let reader: number | undefined;
      let interceptions = 0;
      spyOn(fs, "openSync").mockImplementation((path, flags, mode) => {
        if (path === output) {
          interceptions++;
          expect(Bun.spawnSync(["mkfifo", output]).exitCode).toBe(0);
          if (readerPresent) reader = realOpen(output, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
        }
        return realOpen(path, flags, mode);
      });
      try {
        expect(captureCli(project, pkg)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: ${readerPresent ? "output is not a regular file" : "cannot write output (ENXIO)"}` });
        expect(interceptions).toBe(1);
        expect(fs.lstatSync(output).isFIFO()).toBe(true);
      } finally {
        if (reader !== undefined) fs.closeSync(reader);
      }
    });
  }

  it("attributes leaf-inspection errors to output without exposing internal details", () => {
    const { project, pkg, output } = fixture();
    spyOn(fs, "lstatSync").mockImplementation(() => { throw Object.assign(new Error("private"), { code: "EACCES" }); });
    expect(captureCli(project, pkg)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: cannot write output (EACCES)` });
  });

  it("retains an unknown primary failure even when cleanup also fails", () => {
    const { project, pkg, output } = fixture();
    const realClose = fs.closeSync;
    spyOn(fs, "writeFileSync").mockImplementation(() => { throw undefined; });
    spyOn(fs, "closeSync").mockImplementation((fd) => {
      realClose(fd);
      throw new Error("cleanup");
    });
    expect(captureCli(project, pkg)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: cannot write output (unknown)` });
  });

  for (const flag of ["O_NOFOLLOW", "O_NONBLOCK"] as const) {
    it(`refuses safely when ${flag} is unavailable`, () => {
      const { project, pkg, output } = fixture();
      fs.writeFileSync(output, "keep");
      const descriptor = Object.getOwnPropertyDescriptor(fs.constants, flag)!;
      try {
        Object.defineProperty(fs.constants, flag, { ...descriptor, value: 0 });
        expect(captureCli(project, pkg)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: safe output opening is unavailable` });
        expect(fs.readFileSync(output, "utf-8")).toBe("keep");
      } finally {
        Object.defineProperty(fs.constants, flag, descriptor);
      }
    });
  }
  it("refuses a dangling outside output link without creating its target", () => {
    const { root, project, pkg, output } = fixture();
    const target = join(root, "missing.ts");
    fs.symlinkSync(target, output);
    const before = fs.lstatSync(output);

    const result = invoke(project, pkg);

    expect(fs.existsSync(target)).toBe(false);
    expect(fs.lstatSync(output).ino).toBe(before.ino);
    expect(fs.readlinkSync(output)).toBe(target);
    expect(result).toEqual({
      code: 1,
      stdout: "",
      stderr: `pbuilder-codegen: ${output}: refusing symbolic-link output\n`,
    });
  });

  for (const initial of ["absent", "regular"] as const) {
    for (const existing of [false, true]) {
      it(`refuses a substituted ${initial} leaf targeting ${existing ? "existing" : "missing"} output at the real open`, () => {
        const { root, project, pkg, output } = fixture();
        const target = join(root, "target.ts");
        if (existing) fs.writeFileSync(target, "target must survive");
        if (initial === "regular") fs.writeFileSync(output, "previous output");
        const realOpen = fs.openSync;
        const realWrite = fs.writeFileSync;
        let interceptions = 0;
        let boundary = "";
        let linkInode = 0;
        const open = spyOn(fs, "openSync").mockImplementation((path, flags, mode) => {
          if (path === output) {
            interceptions++;
            boundary = "open";
            if (initial === "regular") fs.unlinkSync(output);
            fs.symlinkSync(target, output);
            linkInode = fs.lstatSync(output).ino;
          }
          return realOpen(path, flags, mode);
        });
        const write = spyOn(fs, "writeFileSync").mockImplementation((path, data, options) => {
          if (path === output) {
            interceptions++;
            boundary = "write";
            if (initial === "regular") fs.unlinkSync(output);
            fs.symlinkSync(target, output);
            linkInode = fs.lstatSync(output).ino;
          }
          return realWrite(path, data, options);
        });
        try {
          const result = captureCli(project, pkg);
          expect(existing ? fs.readFileSync(target, "utf-8") : fs.existsSync(target)).toBe(existing ? "target must survive" : false);
          expect(interceptions).toBe(1);
          expect(boundary).toBe("open");
          expect(fs.lstatSync(output).ino).toBe(linkInode);
          expect(fs.readlinkSync(output)).toBe(target);
          expect(result).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: refusing symbolic-link output` });
        } finally {
          open.mockRestore();
          write.mockRestore();
        }
      });
    }
  }
});

describe("source CLI compatibility controls", () => {
  it("creates only fixed adjacent output and exactly shortens it through a contained directory alias", () => {
    const { project, pkg, output } = fixture();
    const alias = join(project, "alias");
    fs.symlinkSync(pkg, alias, "dir");
    const longer = JSON.stringify({ properties: {
      "../../escape": { type: "string", label: "Path-shaped property", default: "../../elsewhere" },
      port: { type: "number", label: "Server port" },
    } });
    fs.writeFileSync(join(pkg, "schema.json"), longer);
    expect(invoke(project, alias)).toEqual({ code: 0, stdout: `${SUCCESS_LINE}\n`, stderr: "" });
    const first = fs.readFileSync(output, "utf-8");
    expect(first).toBe(emitInputType(parseSchema(longer), computeSchemaDigest(longer)));
    expect(fs.readdirSync(pkg).sort()).toEqual(["factory.ts", GENERATED_FILENAME, "schema.json"].sort());
    fs.writeFileSync(join(pkg, "schema.json"), schema);
    expect(invoke(project, alias)).toEqual({ code: 0, stdout: `${SUCCESS_LINE}\n`, stderr: "" });
    const second = fs.readFileSync(output, "utf-8");
    expect(second.length).toBeLessThan(first.length);
    expect(second).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
    expect(fs.readdirSync(project).sort()).toEqual(["alias", "factory", "package.json"]);
  });

  it("preserves direct generator authorization and ordinary hardlink semantics", () => {
    const { root, pkg, output } = fixture();
    const linked = join(root, "linked.ts");
    fs.writeFileSync(linked, "old ".repeat(1000));
    fs.linkSync(linked, output);
    const inode = fs.statSync(output).ino;
    expect(generateSchema(pkg)).toEqual({ outputPath: output, digest: computeSchemaDigest(schema) });
    expect(fs.statSync(output).ino).toBe(inode);
    expect(fs.statSync(linked).ino).toBe(inode);
    expect(fs.readFileSync(linked, "utf-8")).toBe(emitInputType(parseSchema(schema), computeSchemaDigest(schema)));
  });

  for (const kind of ["absolute", "relative", "directory-link"] as const) {
    it(`refuses an escaping ${kind} package argument`, () => {
      const { root, project } = fixture();
      const outside = join(root, "outside");
      fs.mkdirSync(outside);
      fs.writeFileSync(join(outside, "schema.json"), schema);
      const output = join(outside, GENERATED_FILENAME);
      fs.writeFileSync(output, "preserve");
      const alias = join(project, "outside-alias");
      if (kind === "directory-link") fs.symlinkSync(outside, alias, "dir");
      const argument = kind === "absolute" ? outside : kind === "relative" ? relative(project, outside) : alias;
      expect(invoke(project, argument)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: refusing to write outside the project root: "${argument}"\n` });
      expect(fs.readFileSync(output, "utf-8")).toBe("preserve");
    });
  }

  for (const invalid of ["{", '{"properties":{"bad":{"label":"Missing type"}}}']) {
    for (const existing of [false, true]) {
      it(`preserves ${existing ? "existing" : "absent"} output for invalid schema ${invalid}`, () => {
        const { project, pkg, output } = fixture();
        fs.writeFileSync(join(pkg, "schema.json"), invalid);
        if (existing) fs.writeFileSync(output, "unchanged");
        const result = invoke(project, pkg);
        expect(result.code).toBe(1);
        expect(result.stdout).toBe("");
        expect(result.stderr).toStartWith(`pbuilder-codegen: ${join(pkg, "schema.json")}: `);
        expect(existing ? fs.readFileSync(output, "utf-8") : fs.existsSync(output)).toBe(existing ? "unchanged" : false);
      });
    }
  }

  it("retains the missing input diagnostic without creating output", () => {
    const { project, pkg, output } = fixture();
    fs.unlinkSync(join(pkg, "schema.json"));
    expect(invoke(project, pkg)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${join(pkg, "schema.json")}: schema.json not found\n` });
    expect(fs.existsSync(output)).toBe(false);
  });

  for (const platform of ["win32", "freebsd"] as const) {
    it(`retains creation, shortening, validation and both boundaries on controlled ${platform}`, () => {
      const { root, project, pkg, output } = fixture();
      const realWrite = fs.writeFileSync;
      const paths: fs.PathOrFileDescriptor[] = [];
      const write = spyOn(fs, "writeFileSync").mockImplementation((path, data, options) => {
        paths.push(path);
        return realWrite(path, data, options);
      });
      spyOn(fs, "lstatSync").mockImplementation(() => { throw new Error("unexpected hardened leaf check"); });
      spyOn(fs, "openSync").mockImplementation(() => { throw new Error("unexpected hardened open"); });
      try {
        expect(captureCli(project, pkg, platform)).toEqual({ code: 0, stdout: SUCCESS_LINE, stderr: "" });
        const expected = emitInputType(parseSchema(schema), computeSchemaDigest(schema));
        expect(fs.readFileSync(output, "utf-8")).toBe(expected);
        realWrite(output, "old ".repeat(1000));
        expect(captureCli(project, pkg, platform)).toEqual({ code: 0, stdout: SUCCESS_LINE, stderr: "" });
        expect(fs.readFileSync(output, "utf-8")).toBe(expected);
        expect(paths).toEqual([output, output]);
        for (const invalid of ["{", '{"properties":{"bad":{"label":"Bad"}}}']) {
          realWrite(join(pkg, "schema.json"), invalid);
          expect(captureCli(project, pkg, platform).code).toBe(1);
          expect(fs.readFileSync(output, "utf-8")).toBe(expected);
        }
        realWrite(join(pkg, "schema.json"), schema);
        const outside = join(root, "outside.ts");
        realWrite(outside, "outside");
        fs.unlinkSync(output);
        fs.symlinkSync(outside, output);
        expect(captureCli(project, pkg, platform)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: refusing to write outside the project root: "${pkg}"` });
        expect(fs.readFileSync(outside, "utf-8")).toBe("outside");
        const outsidePkg = join(root, "outside-package");
        fs.mkdirSync(outsidePkg);
        realWrite(join(outsidePkg, "schema.json"), schema);
        fs.symlinkSync(join(pkg, "factory.ts"), join(outsidePkg, GENERATED_FILENAME));
        expect(captureCli(project, outsidePkg, platform)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: refusing to write outside the project root: "${outsidePkg}"` });
        expect(fs.readFileSync(join(pkg, "factory.ts"), "utf-8")).toBe("export default () => {};");
      } finally {
        write.mockRestore();
      }
    });

    it(`preserves absent output for invalid inputs and attributes writer errors on controlled ${platform}`, () => {
      const { project, pkg, output } = fixture();
      for (const invalid of ["{", '{"properties":{"bad":{"label":"Bad"}}}']) {
        fs.writeFileSync(join(pkg, "schema.json"), invalid);
        expect(captureCli(project, pkg, platform).code).toBe(1);
        expect(fs.existsSync(output)).toBe(false);
      }
      fs.writeFileSync(join(pkg, "schema.json"), schema);
      spyOn(fs, "writeFileSync").mockImplementation(() => { throw Object.assign(new Error("internal"), { code: "ENOENT" }); });
      expect(captureCli(project, pkg, platform)).toEqual({ code: 1, stdout: "", stderr: `pbuilder-codegen: ${output}: cannot write output (ENOENT)` });
    });
  }
});
