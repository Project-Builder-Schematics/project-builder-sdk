/**
 * REQ-PRC-02.1 / REQ-PRC-03.1 / REQ-RBV-06.1 (S-000, design §4.2/§Data Model): the
 * `packageRoot` containment-ceiling walk — resolved ONCE at the pre-`als.run` chokepoint
 * `defineFactory` already uses for schema/reserved-name validation (mirroring the
 * ADR-0037 `dialects` pattern, per ADR-0046). Integration level (design §Test Derivation):
 * drives `defineFactory` end-to-end against scratch package dirs — distinct from a
 * unit-level direct call into the (currently unexported) walk helper.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import * as fs from "node:fs";
import { join, relative } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { create } from "../../src/commons/index.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("run-boundary-");

describe("REQ-PRC-03.1 / REQ-RBV-06.1 — missing collection.json ancestor fails loud pre-body", () => {
  it("REQ-RBV-06.1: the missing-ancestor rejection pre-empts a factory-body sentinel throw", async () => {
    const dir = scratchDir();
    rmSync(join(dir, "collection.json")); // scratchDirFactory seeds a marker by default — remove it for this negative case
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      throw new Error("body-ran");
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
    expect((caught as Error).message).not.toEqual("body-ran");
  });

  it("REQ-PRC-03.1: the rejection message is project-relative, never an absolute filesystem path", async () => {
    const dir = scratchDir();
    rmSync(join(dir, "collection.json"));
    const fake = new ContractFake({ seed: {} });
    const run = defineFactory<void>(() => {}, { packageDir: dir });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    const message = (caught as Error).message;
    expect(message).toContain(relative(process.cwd(), dir));
    expect(message.startsWith("/")).toBe(false);
  });
});

describe("REQ-PRC-03.1 — positive control: an ancestor collection.json is found", () => {
  it("a collection.json directly at packageDir allows the run to proceed", async () => {
    const dir = scratchDir(); // scratchDirFactory seeds the marker directly in the dir
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      create("dest.ts", { template: "content", options: {} });
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    expect(fake.committedTree().get("dest.ts")).toEqual("content");
  });

  it("a collection.json two levels above packageDir is found by walking ancestors", async () => {
    const root = scratchDir(); // scratchDirFactory seeds the marker directly in root
    const nested = join(root, "packages", "foo");
    mkdirSync(nested, { recursive: true });
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      create("dest.ts", { template: "content", options: {} });
    }, { packageDir: nested });

    await run(undefined, { client: fake });

    expect(fake.committedTree().get("dest.ts")).toEqual("content");
  });
});

describe("REQ-PRC-02.1 — ceiling resolved once, reused across multiple calls in one run", () => {
  it("the ancestor walk does not scale with the number of create({templateFile}) calls in the same run", async () => {
    const dir = scratchDir(); // scratchDirFactory seeds the marker directly in the dir
    writeFileSync(join(dir, "a.ts.template"), "A", "utf-8");
    writeFileSync(join(dir, "b.ts.template"), "B", "utf-8");
    const existsSpy = spyOn(fs, "existsSync");

    try {
      const fakeOne = new ContractFake({ seed: {} });
      const runOne = defineFactory<void>(() => {
        create("a.ts", { templateFile: "a.ts.template", options: {} });
      }, { packageDir: dir });
      await runOne(undefined, { client: fakeOne });
      const callsForOneCreate = existsSpy.mock.calls.filter(
        (call) => call[0] === join(dir, "collection.json")
      ).length;

      existsSpy.mockClear();

      const fakeTwo = new ContractFake({ seed: {} });
      const runTwo = defineFactory<void>(() => {
        create("a.ts", { templateFile: "a.ts.template", options: {} });
        create("b.ts", { templateFile: "b.ts.template", options: {} });
      }, { packageDir: dir });
      await runTwo(undefined, { client: fakeTwo });
      const callsForTwoCreates = existsSpy.mock.calls.filter(
        (call) => call[0] === join(dir, "collection.json")
      ).length;

      expect(callsForOneCreate).toBeGreaterThan(0);
      expect(callsForTwoCreates).toEqual(callsForOneCreate);
    } finally {
      existsSpy.mockRestore();
    }
  });
});
