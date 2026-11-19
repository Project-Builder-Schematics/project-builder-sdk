import { describe, it, expect } from "bun:test";
import { chmodSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { PackageReadFailure } from "../../../../../../src/bounded-contexts/authoring/domain/ports/package-files.ts";
import { nodePackageFiles, reservedSiblingIn } from "../../../../../../src/bounded-contexts/authoring/infrastructure/out/fs/package-files.ts";
import { requireNonRoot, scratchDirFactory } from "../../../../../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("package-files-");


function failureOf(read: () => unknown): unknown {
  try {
    read();
  } catch (err) {
    return err;
  }
  return undefined;
}

describe("nodePackageFiles.readText", () => {
  it("returns the file's text", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "a.txt"), "héllo", "utf-8");
    expect(nodePackageFiles.readText(join(dir, "a.txt"))).toEqual("héllo");
  });

  it("returns undefined when nothing exists at the path", () => {
    expect(nodePackageFiles.readText(join(scratchDir(), "missing.txt"))).toBeUndefined();
  });

  it("names a permission failure", () => {
    requireNonRoot();
    const dir = scratchDir();
    writeFileSync(join(dir, "a.txt"), "x", "utf-8");
    chmodSync(join(dir, "a.txt"), 0o000);
    const err = failureOf(() => nodePackageFiles.readText(join(dir, "a.txt")));
    expect(err).toBeInstanceOf(PackageReadFailure);
    expect((err as PackageReadFailure).problem).toEqual("permission denied");
  });

  it("names a directory read as a file", () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "folder"));
    expect((failureOf(() => nodePackageFiles.readText(join(dir, "folder"))) as PackageReadFailure).problem).toEqual(
      "is a directory, not a file"
    );
  });

  it("calls any other failure unreadable, never echoing the errno message", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "file"), "x", "utf-8");
    const err = failureOf(() => nodePackageFiles.readText(join(dir, "file", "child.txt"))) as PackageReadFailure;
    expect(err.problem).toEqual("unreadable");
    expect(err.message).toEqual("unreadable");
  });
});

describe("reservedSiblingIn", () => {
  it.each([
    [["factory.ts", "schema.json"], undefined],
    [["factory.ts", "pre-execute.ts"], "pre-execute"],
    [["post-execute.js"], "post-execute"],
    [["pre-execute"], "pre-execute"],
    [["PRE-EXECUTE.TS"], "pre-execute"],
    [["pre-execute.md"], undefined],
    [[], undefined],
  ] as const)("%p -> %p", (names, expected) => {
    expect(reservedSiblingIn(names)).toEqual(expected);
  });
});

describe("nodePackageFiles.findReservedSibling", () => {
  it("names the reserved sibling in the package folder", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "factory.ts"), "", "utf-8");
    mkdirSync(join(dir, "post-execute"));
    expect(nodePackageFiles.findReservedSibling(dir)).toEqual("post-execute");
  });

  it("returns undefined for a clean package and for a folder that does not exist", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "factory.ts"), "", "utf-8");
    expect(nodePackageFiles.findReservedSibling(dir)).toBeUndefined();
    expect(nodePackageFiles.findReservedSibling(join(dir, "missing"))).toBeUndefined();
  });

  it("names a folder that cannot be listed", () => {
    requireNonRoot();
    const dir = scratchDir();
    chmodSync(dir, 0o300);
    expect((failureOf(() => nodePackageFiles.findReservedSibling(dir)) as PackageReadFailure).problem).toEqual("permission denied");
  });
});

describe("nodePackageFiles.relativeToCwd", () => {
  it("is the path relative to the working directory", () => {
    const dir = scratchDir();
    expect(nodePackageFiles.relativeToCwd(dir)).toEqual(relative(process.cwd(), dir));
  });
});

// The adapter joins the path and lets the operating system resolve it, where path-guards used
// `resolve(join(packageDir, relPath))`. Both name the same file: `join` already normalises `..`
// and never lets an absolute second argument win, and `resolve` only anchored the result to
// the working directory, which the operating system does for a relative path anyway.
describe("nodePackageFiles source paths match the former resolve(join(...))", () => {
  const formerSize = (packageDir: string, relPath: string): number | undefined => {
    const path = resolve(join(packageDir, relPath));
    return existsSync(path) ? statSync(path).size : undefined;
  };
  const sizeOf = (packageDir: string, relPath: string): number | undefined => {
    const source = nodePackageFiles.statSource(packageDir, relPath);
    return source.kind === "file" ? source.size : undefined;
  };

  it("a relative package folder", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "a.txt"), "hello", "utf-8");
    const relativeDir = relative(process.cwd(), dir);
    expect(sizeOf(relativeDir, "a.txt")).toEqual(5);
    expect(sizeOf(relativeDir, "a.txt")).toEqual(formerSize(relativeDir, "a.txt"));
    expect(new TextDecoder().decode(nodePackageFiles.readBytes(relativeDir, "a.txt"))).toEqual("hello");
  });

  it("a .. segment inside the source path", () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "a.txt"), "hello", "utf-8");
    expect(sizeOf(dir, "sub/../a.txt")).toEqual(5);
    expect(sizeOf(dir, "sub/../a.txt")).toEqual(formerSize(dir, "sub/../a.txt"));
    expect(new TextDecoder().decode(nodePackageFiles.readBytes(dir, "sub/../a.txt"))).toEqual("hello");
  });

  it("an absolute source path stays under the package folder", () => {
    const dir = scratchDir();
    const outside = scratchDir();
    writeFileSync(join(outside, "secret.txt"), "outside", "utf-8");
    const absolute = join(outside, "secret.txt");
    expect(nodePackageFiles.statSource(dir, absolute)).toEqual({ kind: "missing" });
    expect(formerSize(dir, absolute)).toBeUndefined();
    expect(() => nodePackageFiles.readBytes(dir, absolute)).toThrow(PackageReadFailure);
  });
});
