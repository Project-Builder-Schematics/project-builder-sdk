/**
 * REQ-FSC-02/04/06 (S-001, design §Test Derivation): the expander's fan-out — mirrored
 * structure under `to` (REQ-FSC-02), the zero-entries-no-op vs filters-eliminate-all
 * distinction (REQ-FSC-04), and `force` pass-through to every emitted directive
 * (REQ-FSC-06.1 only — no by-reference fixture exists yet in this slice, REQ-FSC-06.2's
 * mixed by-value/by-reference collision scenario is S-003 scope). Integration level
 * (design): drives `runScaffold` through a real `defineFactory` run against a
 * `ContractFake`.
 *
 * REQ-PRC-09 (S-002): the destination lexical guard is unit-tested directly against
 * `validateDestinationLexical` in `test/scaffold/containment.test.ts` (design's Test
 * Derivation assignment) — the block below additionally proves the WIRING into
 * `expander.ts`'s computed-destination emit path, via a `rename` map value that smuggles
 * a `../` segment into the FINAL destination (design §Data Model S3: the guard applies
 * post-rename, post-token-translation).
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { scaffold, dryRun, AuthoringError } from "../../src/commons/index.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("expander-");

describe("REQ-FSC-02.1 — nested folder structure mirrors exactly under `to`", () => {
  it("a.ts and nested/b.ts under `from` target out/a.ts and out/nested/b.ts", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files", "nested"), { recursive: true });
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    writeFileSync(join(dir, "files", "nested", "b.ts"), "B", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    expect(fake.committedTree()).toEqual(
      new Map([
        ["out/a.ts", "A"],
        ["out/nested/b.ts", "B"],
      ])
    );
  });
});

describe("REQ-FSC-04 — zero-files-after-filter vs empty-source-folder are distinct outcomes", () => {
  it("REQ-FSC-04.1: a truly empty source folder no-ops — zero directives, no error", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "empty"));
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ from: "empty", to: "out" });
      expect(dryRun()).toEqual([]);
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    expect(fake.committedTree().size).toEqual(0);
  });

  it("REQ-FSC-04.2: filters eliminating every entry reject fail-loud, naming the filters", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    writeFileSync(join(dir, "files", "b.ts"), "B", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out", exclude: ["*.ts"] });
    }, { packageDir: dir });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
    expect((caught as Error).message).toContain("*.ts");
    expect(fake.committedTree().size).toEqual(0);
  });
});

describe("REQ-FSC-06.1 — force: true passes to every emitted directive", () => {
  it("a 3-file scaffold with force: true overwrites every pre-existing destination", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A2", "utf-8");
    writeFileSync(join(dir, "files", "b.ts"), "B2", "utf-8");
    writeFileSync(join(dir, "files", "c.ts"), "C2", "utf-8");
    const fake = new ContractFake({ seed: { "out/a.ts": "A1", "out/b.ts": "B1", "out/c.ts": "C1" } });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out", force: true });
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    expect(fake.committedTree()).toEqual(
      new Map([
        ["out/a.ts", "A2"],
        ["out/b.ts", "B2"],
        ["out/c.ts", "C2"],
      ])
    );
  });

  it("without force, scaffolding onto a pre-existing destination rejects (collision) — force off by default", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A2", "utf-8");
    const fake = new ContractFake({ seed: { "out/a.ts": "A1" } });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("path-collision");
  });
});

describe("REQ-PRC-09.1 — destination lexical guard wiring: a rename map value smuggling '../' into the FINAL destination is caught pre-emit", () => {
  it("a rename value escaping past the workspace root (more '..' levels than `to`'s own depth) rejects invalid-input before any directive is emitted", async () => {
    // `to: "out"` is ONE segment deep — a rename value with only ONE ".." cancels exactly
    // against it (`posix.join("out", "../escape.ts")` === "escape.ts", still workspace-root-
    // relative, not a PRC-09 violation). TWO ".." levels overshoot past the workspace root,
    // surfacing as a literal leading ".." in the joined result — that IS the escape PRC-09
    // guards against.
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out", rename: { "a.ts": "../../escape.ts" } });
    }, { packageDir: dir });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
    expect((caught as AuthoringError).origin).toEqual("authoring-rejected");
    expect(fake.committedTree().size).toEqual(0);
  });
});
