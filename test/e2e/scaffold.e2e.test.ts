/**
 * e2e — walking skeleton for `schematic-local-files` (S-000). Drives
 * `create({ templateFile })` end-to-end through a real `defineFactory({ packageDir })`
 * run against a `ContractFake` — no mocks on the render/commit/dry-run path.
 *
 * Covers (slices.md S-000): REQ-FEH-01.1 (templateFile content becomes the create
 * directive's template), REQ-FEH-02.1/.2 (binary/oversized templateFile fails loud,
 * never silently copies), REQ-DRE-05.3 (create({templateFile}) dry-run entry tagged
 * "rendered").
 */
import { describe, it, expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create, dryRun, AuthoringError } from "../../src/commons/index.ts";
import { BATCH_CAP_BYTES } from "../../src/core/wire.ts";

function packageDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "scaffold-e2e-"));
  writeFileSync(join(dir, "collection.json"), "{}", "utf-8");
  return dir;
}

describe("e2e — create({ templateFile }) walking skeleton", () => {
  it("REQ-FEH-01.1 + REQ-DRE-05.3: renders templateFile content through the create IR, commits, and dry-run tags it 'rendered'", async () => {
    const dir = packageDir();
    try {
      writeFileSync(join(dir, "tpl.ts.template"), "export const x = {= x =};", "utf-8");
      const fake = new ContractFake({ seed: {} });

      const run = defineFactory<void>(() => {
        create("dest.ts", { templateFile: "tpl.ts.template", options: { x: 1 } });

        expect(dryRun()).toEqual([{ verb: "create", path: "dest.ts", kind: "rendered" }]);
      }, { packageDir: dir });

      await run(undefined, { client: fake });

      expect(fake.committedTree()).toEqual(new Map([["dest.ts", "export const x = {= x =};"]]));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("REQ-FEH-02.1: a templateFile containing a null byte rejects fail-loud with reason invalid-input, never silently copies", async () => {
    const dir = packageDir();
    try {
      writeFileSync(join(dir, "asset.png"), Buffer.from([0x89, 0x00, 0x50, 0x4e]));
      const fake = new ContractFake({ seed: {} });

      const run = defineFactory<void>(() => {
        create("dest.png", { templateFile: "asset.png", options: {} });
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
      expect(fake.stagingTree().size).toEqual(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("REQ-FEH-02.2: an over-budget templateFile rejects fail-loud with reason invalid-input", async () => {
    const dir = packageDir();
    try {
      writeFileSync(join(dir, "huge.ts.template"), "a".repeat(BATCH_CAP_BYTES + 1), "utf-8");
      const fake = new ContractFake({ seed: {} });

      const run = defineFactory<void>(() => {
        create("dest.ts", { templateFile: "huge.ts.template", options: {} });
      }, { packageDir: dir });

      let caught: unknown;
      try {
        await run(undefined, { client: fake });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AuthoringError);
      expect((caught as AuthoringError).reason).toEqual("invalid-input");
      expect(fake.committedTree().size).toEqual(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a package with NO collection.json ancestor fails loud pre-body, before create() ever runs (RBV-06.1 sentinel ordering)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "scaffold-e2e-noroot-"));
    try {
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
      expect((caught as Error).message).not.toEqual("body-ran");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("design §Data Model 'no resolution anchor': create({templateFile}) inside a bare defineFactory(fn) run fails loud, never falls back to cwd", async () => {
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      create("dest.ts", { templateFile: "tpl.ts.template", options: {} });
    });
    // No { packageDir } — the untyped opt-out (REQ-TFO-02). There is nothing to resolve
    // `templateFile` against; it must reject rather than silently reading against cwd.

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
