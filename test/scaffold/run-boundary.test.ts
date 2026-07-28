/**
 * REQ-MFB-01.1 / REQ-RBV-06.2 (S-000, ADR-0077 §C): `packageDir` is the SOLE run anchor —
 * the `collection.json` ancestor walk (`resolvePackageRoot`) is DELETED. A factory body now
 * runs regardless of whether a `collection.json` marker exists anywhere on the ancestor
 * chain. Integration level (design §Test Derivation): drives `defineFactory` end-to-end
 * against scratch package dirs — distinct from `test/scaffold/inline-collection.test.ts`,
 * which owns the AUTHORITATIVE full-ancestor-chain REQ-MFB-01.1/.2 scenario with its own
 * `mkdtemp`. `scratchDirFactory` (S-003) never fabricates a marker at all — a
 * `collection.json` is a plain file this file plants EXPLICITLY where a scenario needs one
 * present.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { join } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create } from "../../src/commons/index.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("run-boundary-");

describe("REQ-MFB-01.1 — a missing collection.json ancestor no longer pre-empts the factory body", () => {
  it("the factory body's sentinel throw propagates unchanged — no ancestor-marker rejection precedes it", async () => {
    const dir = scratchDir(); // no collection.json anywhere — scratchDirFactory never seeds one
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      throw new Error("body-ran");
    }, { packageDir: dir });

    await expect(run(undefined, { client: fake })).rejects.toThrow("body-ran");
  });
});

describe("REQ-MFB-01 — positive control: a run proceeds identically whether or not collection.json exists anywhere", () => {
  it("a collection.json directly at packageDir does not block (and is never required for) the run", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "collection.json"), "{}", "utf-8"); // explicitly planted for THIS case only
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      create("dest.ts", { template: "content", options: {} });
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    expect(fake.committedTree().get("dest.ts")).toEqual("content");
  });

  it("no collection.json anywhere on the ancestor chain — the run still commits identically", async () => {
    const dir = scratchDir();
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      create("dest.ts", { template: "content", options: {} });
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    expect(fake.committedTree().get("dest.ts")).toEqual("content");
  });
});

describe("REQ-RBV-06.2 — no ancestor-marker read exists anywhere in the bootstrap read-set", () => {
  it("existsSync is never called against a collection.json path, regardless of how many read verbs the run performs", async () => {
    const dir = scratchDir();
    const existsSpy = spyOn(fs, "existsSync");

    try {
      const fake = new ContractFake({ seed: {} });
      const run = defineFactory<void>(() => {
        create("a.ts", { template: "A", options: {} });
        create("b.ts", { template: "B", options: {} });
      }, { packageDir: dir });

      await run(undefined, { client: fake });

      const markerProbes = existsSpy.mock.calls.filter(
        (call) => typeof call[0] === "string" && (call[0] as string).endsWith("collection.json")
      );
      expect(markerProbes).toEqual([]);
    } finally {
      existsSpy.mockRestore();
    }
  });
});
