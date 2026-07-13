/**
 * REQ-FSC-09 (S-001, design §Test Derivation): `walk.ts`'s enumeration — symlinked
 * directories are never descended (even in-ceiling, REQ-FSC-09.1), and the walk fails
 * loud, naming the bound, once the enumerated entry count exceeds it (REQ-FSC-09.2).
 * Unit level — `walkFolder` is called directly against a real scratch tree.
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync, symlinkSync } from "node:fs";
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
    // scratchDirFactory also seeds collection.json directly in `dir` — walkFolder has no
    // opinion on that marker, but it IS an ordinary file the walk enumerates.
    const entries = walkFolder(dir).map((e) => e.relPath).sort();

    expect(entries).toEqual(["a.ts", "b.ts", "collection.json", "nested/c.ts"]);
  });
});

describe("REQ-FSC-09.1 — in-ceiling symlinked directory is skipped, not descended", () => {
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

    expect(entries).toEqual(["a.ts", "collection.json"]);
    expect(entries.some((p) => p.includes("hidden.ts"))).toBe(false);
    expect(entries).not.toContain("link-to-dir");
  });
});

describe("REQ-FSC-09.2 — entry-count bound exceeded fails loud, naming the bound", () => {
  it("an injected, test-scoped bound of 2 rejects a 3-entry tree", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "a.ts"), "A", "utf-8");
    writeFileSync(join(dir, "b.ts"), "B", "utf-8");
    // collection.json (seeded by scratchDirFactory) makes 3 entries total — over a bound of 2.

    const err = expectReason(() => walkFolder(dir, 2), "invalid-input");
    expect(err.message).toContain("2");
  });

  it("a tree with exactly `bound` entries does not reject", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "a.ts"), "A", "utf-8");
    // + collection.json = 2 entries, bound = 2 (inclusive — `>` not `>=`).
    const entries = walkFolder(dir, 2);

    expect(entries).toHaveLength(2);
  });
});
