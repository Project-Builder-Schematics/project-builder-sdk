/**
 * REQ-FSC-09 (S-001, design §Test Derivation): `walk.ts`'s enumeration — symlinked
 * directories are never descended, regardless of where their target resolves
 * (enumeration determinism and cycle-safety are the rationale — a symlinked directory
 * could point anywhere, including into a cycle; never descending is the simplest
 * invariant that is safe under all targets, REQ-FSC-09.1), and the walk fails loud,
 * naming the bound, once the enumerated entry count exceeds it (REQ-FSC-09.2).
 * Unit level — `walkFolder` is called directly against a real scratch tree.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import * as fs from "node:fs";
import { join } from "node:path";
import { walkFolder } from "../../src/scaffold/walk.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { expectReason } from "../support/expect-reason.ts";

const scratchDir = scratchDirFactory("walk-");

describe("walkFolder — nested enumeration", () => {
  it("mirrors nested directory structure into sorted, posix-separated relPaths", () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "nested"), { recursive: true });
    writeFileSync(join(dir, "b.ts"), "B", "utf-8");
    writeFileSync(join(dir, "a.ts"), "A", "utf-8");
    writeFileSync(join(dir, "nested", "c.ts"), "C", "utf-8");
    const entries = walkFolder(dir).map((e) => e.relPath).sort();

    expect(entries).toEqual(["a.ts", "b.ts", "nested/c.ts"]);
  });
});

describe("REQ-FSC-09.1 — a symlinked directory is skipped, not descended (enumeration determinism/cycle-safety)", () => {
  it("a symlinked directory (target inside the walked tree) contributes zero entries and raises no error", () => {
    const dir = scratchDir();
    // The real target lives OUTSIDE `dir` — the ONLY path back to `hidden.ts` from the walk
    // root is through the symlink, isolating "descends the symlink" from "walks the real
    // directory via its own direct path" (which would legitimately surface hidden.ts too).
    const target = scratchDir();
    mkdirSync(join(target, "real-target"));
    writeFileSync(join(target, "real-target", "hidden.ts"), "hidden", "utf-8");
    writeFileSync(join(dir, "a.ts"), "A", "utf-8");
    symlinkSync(join(target, "real-target"), join(dir, "link-to-dir"), "dir");

    const entries = walkFolder(dir).map((e) => e.relPath).sort();

    expect(entries).toEqual(["a.ts"]);
    expect(entries.some((p) => p.includes("hidden.ts"))).toBe(false);
    expect(entries).not.toContain("link-to-dir");
  });
});

describe("REQ-FSC-09.2 — entry-count bound exceeded fails loud, naming the bound", () => {
  it("an injected, test-scoped bound of 2 rejects a 3-entry tree", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "a.ts"), "A", "utf-8");
    writeFileSync(join(dir, "b.ts"), "B", "utf-8");
    writeFileSync(join(dir, "c.ts"), "C", "utf-8");
    // 3 real entries — over a bound of 2.

    const err = expectReason(() => walkFolder(dir, 2), "invalid-input");
    expect(err.message).toContain("2");
  });

  it("a tree with exactly `bound` entries does not reject", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "a.ts"), "A", "utf-8");
    writeFileSync(join(dir, "b.ts"), "B", "utf-8");
    // 2 real entries, bound = 2 (inclusive — `>` not `>=`).
    const entries = walkFolder(dir, 2);

    expect(entries).toHaveLength(2);
  });
});

describe("REQ-FSC-10.1 — missing walk root rejects invalid-input, relative only [preservation-pin]", () => {
  it("a walk root that does not exist rejects, naming the package-relative from and never an absolute path", () => {
    const dir = scratchDir();
    const missing = join(dir, "does-not-exist");

    const err = expectReason(() => walkFolder(missing, undefined, "does-not-exist"), "invalid-input");
    expect(err.message).toContain("does-not-exist");
    expect(err.message).not.toContain(dir);
  });
});

describe("REQ-FSC-10.2 — walk root is a regular file rejects invalid-input [preservation-pin]", () => {
  it("a walk root that resolves to a regular file rejects, naming the package-relative from", () => {
    const dir = scratchDir();
    const filePath = join(dir, "a-file.ts");
    writeFileSync(filePath, "content", "utf-8");

    const err = expectReason(() => walkFolder(filePath, undefined, "a-file.ts"), "invalid-input");
    expect(err.message).toContain("a-file.ts");
    expect(err.message).not.toContain(dir);
  });
});

describe("REQ-FSC-10.3 — walk root EACCES rejects invalid-input via an injected seam [preservation-pin]", () => {
  it("a readdirSync failure on the ROOT (injected, non-ENOENT/ENOTDIR) rejects the generic unreadable form", () => {
    const dir = scratchDir();
    const readdirSpy = spyOn(fs, "readdirSync").mockImplementation(() => {
      throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    });

    try {
      const err = expectReason(() => walkFolder(dir, undefined, "walk-root"), "invalid-input");
      expect(err.message).toEqual('invalid input: scaffold "from" folder (walk-root) could not be read');
    } finally {
      readdirSpy.mockRestore();
    }
  });
});

describe("REQ-FSC-10.4 — recursive readdirSync/lstatSync failure rejects invalid-input, entry-specific, no absolute-path echo [red-today]", () => {
  it("a nested sub-directory readdirSync EACCES failure names the entry and never an absolute path", () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "sub"), { recursive: true });
    writeFileSync(join(dir, "sub", "a.ts"), "A", "utf-8");
    const originalReaddirSync = fs.readdirSync;
    const readdirSpy = spyOn(fs, "readdirSync").mockImplementation(((...args: Parameters<typeof fs.readdirSync>) => {
      if (String(args[0]).endsWith(join("sub"))) {
        throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      }
      return (originalReaddirSync as (...a: Parameters<typeof fs.readdirSync>) => ReturnType<typeof fs.readdirSync>)(...args);
    }) as typeof fs.readdirSync);

    try {
      const err = expectReason(() => walkFolder(dir, undefined, "root"), "invalid-input");
      expect(err.message).toEqual("invalid input: scaffold entry (root/sub) could not be read");
      expect(err.message).not.toContain(dir);
    } finally {
      readdirSpy.mockRestore();
    }
  });

  it("a nested sub-directory readdirSync ENOENT failure (the entry vanished) uses the disappeared-during-the-walk template", () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "sub"), { recursive: true });
    writeFileSync(join(dir, "sub", "a.ts"), "A", "utf-8");
    const originalReaddirSync = fs.readdirSync;
    const readdirSpy = spyOn(fs, "readdirSync").mockImplementation(((...args: Parameters<typeof fs.readdirSync>) => {
      if (String(args[0]).endsWith(join("sub"))) {
        throw Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
      }
      return (originalReaddirSync as (...a: Parameters<typeof fs.readdirSync>) => ReturnType<typeof fs.readdirSync>)(...args);
    }) as typeof fs.readdirSync);

    try {
      const err = expectReason(() => walkFolder(dir, undefined, "root"), "invalid-input");
      expect(err.message).toEqual("invalid input: scaffold entry (root/sub) disappeared during the walk");
      expect(err.message).not.toContain(dir);
    } finally {
      readdirSpy.mockRestore();
    }
  });

  it("a per-entry lstatSync EACCES failure names the entry and never an absolute path", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "locked.ts"), "content", "utf-8");
    const originalLstatSync = fs.lstatSync;
    const lstatSpy = spyOn(fs, "lstatSync").mockImplementation(((...args: Parameters<typeof fs.lstatSync>) => {
      if (String(args[0]).endsWith(join("locked.ts"))) {
        throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      }
      return (originalLstatSync as (...a: Parameters<typeof fs.lstatSync>) => ReturnType<typeof fs.lstatSync>)(...args);
    }) as typeof fs.lstatSync);

    try {
      const err = expectReason(() => walkFolder(dir, undefined, "root"), "invalid-input");
      expect(err.message).toEqual("invalid input: scaffold entry (root/locked.ts) could not be read");
      expect(err.message).not.toContain(dir);
    } finally {
      lstatSpy.mockRestore();
    }
  });

  it("no rootRelPath threaded (direct unit-test callers) falls back to locator-free phrasing for a recursive failure", () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "sub"), { recursive: true });
    writeFileSync(join(dir, "sub", "a.ts"), "A", "utf-8");
    const originalReaddirSync = fs.readdirSync;
    const readdirSpy = spyOn(fs, "readdirSync").mockImplementation(((...args: Parameters<typeof fs.readdirSync>) => {
      if (String(args[0]).endsWith(join("sub"))) {
        throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      }
      return (originalReaddirSync as (...a: Parameters<typeof fs.readdirSync>) => ReturnType<typeof fs.readdirSync>)(...args);
    }) as typeof fs.readdirSync);

    try {
      const err = expectReason(() => walkFolder(dir), "invalid-input");
      expect(err.message).toEqual("invalid input: scaffold entry could not be read");
    } finally {
      readdirSpy.mockRestore();
    }
  });
});
