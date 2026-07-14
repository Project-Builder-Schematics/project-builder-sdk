/**
 * SEAM-03 cross-boundary: all-or-nothing commit contract (REQ-06, REQ-02, REQ-07, REQ-09).
 * Fake unmocked on both sides — real Session, real ContractFake, real defineFactory.
 * Success path: a write-only typed factory commits its full batch; the committed tree
 * (not a trailing .read()) is the assertion surface so the write-only path stays write-only.
 */
import { readFileSync } from "node:fs";
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create, replaceContent } from "../../src/commons/index.ts";

describe("SEAM-03 — all-or-nothing commit (success)", () => {
  it("REQ-06.1 / REQ-02.1 / REQ-02.2 — write-only typed factory commits the created path", async () => {
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      create<{ name: string }>("src/generated.ts", {
        template: "export const x = 1;",
        options: { name: "x" },
      });
    });

    await run(undefined, { client: fake });

    // Committed tree contains the created path (commit fired on success).
    const committed = fake.committedTree();
    expect(committed.get("src/generated.ts")).toEqual("export const x = 1;");
    // Staging is cleared after commit (no uncommitted residue).
    expect(fake.stagingTree().size).toEqual(0);
  });

  it("REQ-06.2 — multi-directive success commits all directives in order", async () => {
    const fake = new ContractFake({ seed: { "src/existing.ts": "original" } });

    const run = defineFactory<void>(() => {
      create("src/new.ts", { template: "new-content", options: {} });
      replaceContent("src/existing.ts", "modified-content");
    });

    await run(undefined, { client: fake });

    const committed = fake.committedTree();
    expect(committed.get("src/new.ts")).toEqual("new-content");
    expect(committed.get("src/existing.ts")).toEqual("modified-content");
    expect(fake.stagingTree().size).toEqual(0);
  });
});

describe("SEAM-03 — all-or-nothing commit (throw path)", () => {
  it("REQ-07.2 — factory buffering two directives before throwing commits nothing", async () => {
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      create("src/first.ts", { template: "first", options: {} });
      create("src/second.ts", { template: "second", options: {} });
      throw new Error("factory error");
    });

    await expect(run(undefined, { client: fake })).rejects.toThrow("factory error");

    // Neither directive was committed.
    expect(fake.committedTree().size).toEqual(0);
    // Staging was discarded.
    expect(fake.stagingTree().size).toEqual(0);
  });
});

describe("SEAM-03 — JSDoc contract (REQ-09)", () => {
  it("REQ-09.1 — context.ts JSDoc states all-or-nothing; no partial-write sentence present", () => {
    const contextSource = readFileSync(
      new URL("../../src/core/context.ts", import.meta.url).pathname,
      "utf-8"
    );
    // The all-or-nothing contract must be stated.
    expect(contextSource).toContain("All-or-nothing");
    // The old partial-write sentence must not exist.
    expect(contextSource).not.toMatch(/partial.write/i);
    expect(contextSource).not.toMatch(/partial write/i);
  });
});
