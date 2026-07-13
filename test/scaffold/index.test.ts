/**
 * REQ-FSC-01 (S-001, design §Test Derivation): `scaffold`'s mandatory/optional argument
 * shape — `from`/`to` are mandatory and reject fail-loud BEFORE any directory read; every
 * other field defaults per REQ-FSC-01. Exercised through `commons.scaffold` inside a real
 * `defineFactory` run (this leaf's entrypoint needs the active RunContext).
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { scaffold, dryRun, AuthoringError } from "../../src/commons/index.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("scaffold-index-");

describe("REQ-FSC-01.1 — missing mandatory 'from' rejects before any directory read", () => {
  it("rejects fail-loud, never reaching the walk", async () => {
    const dir = scratchDir();
    // A `files/` dir that WOULD produce entries if walked — proves the rejection pre-empts
    // any directory read (its content is irrelevant to the assertion, only that it's unread).
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "content", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ to: "out" } as unknown as Parameters<typeof scaffold>[0]);
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

describe("REQ-FSC-01.3 — missing mandatory 'to' rejects before any directory read", () => {
  it("rejects fail-loud", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "content", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files" } as unknown as Parameters<typeof scaffold>[0]);
    }, { packageDir: dir });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
  });
});

describe("REQ-FSC-01.2 — optional args default correctly", () => {
  it("a call with only from/to scaffolds both files with no filtering, no rename, force: false", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    writeFileSync(join(dir, "files", "b.ts"), "B", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
      const plan = dryRun();
      expect(plan.map((e) => e.path).sort()).toEqual(["out/a.ts", "out/b.ts"]);
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    expect(fake.committedTree()).toEqual(
      new Map([
        ["out/a.ts", "A"],
        ["out/b.ts", "B"],
      ])
    );
  });
});
