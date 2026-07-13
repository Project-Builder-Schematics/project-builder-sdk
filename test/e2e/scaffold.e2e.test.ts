/**
 * e2e — walking skeleton for `schematic-local-files` (S-000). Drives
 * `create({ templateFile })` end-to-end through a real `defineFactory({ packageDir })`
 * run against a `ContractFake` — no mocks on the render/commit/dry-run path.
 *
 * Covers (slices.md S-000): REQ-FEH-01.1 (templateFile content becomes the create
 * directive's template), REQ-FEH-02.1/.2 (binary/oversized templateFile fails loud,
 * never silently copies), REQ-DRE-05.3 (create({templateFile}) dry-run entry tagged
 * "rendered").
 *
 * S-001 adds the OUTER LOOP for the folder-scaffold + classifier slice (double-loop TDD
 * ordering, sdd-apply Step 7b): `scaffold({from, to})` walking a package-local folder,
 * mirroring by-value files through the existing `create` IR, and the by-reference verdict
 * throwing fail-loud (temporary — S-003 swaps this for real `copyIn` emission). Covers
 * (slices.md S-001): FSC-01..05, FSC-07..09, CCL-01..06 (through the e2e happy path +
 * fail-loud arms), AEC-12 (remaining fixtures).
 */
import { describe, it, expect } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create, scaffold, dryRun, AuthoringError } from "../../src/commons/index.ts";
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

  it("REQ-FEH-02 family: a templateFile that does not exist rejects invalid-input, naming the package-relative path (ENOENT branch)", async () => {
    const dir = packageDir();
    try {
      const fake = new ContractFake({ seed: {} });

      const run = defineFactory<void>(() => {
        create("dest.ts", { templateFile: "missing.ts.template", options: {} });
      }, { packageDir: dir });

      let caught: unknown;
      try {
        await run(undefined, { client: fake });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AuthoringError);
      expect((caught as AuthoringError).reason).toEqual("invalid-input");
      expect((caught as Error).message).toEqual(
        'invalid input: templateFile "missing.ts.template" does not exist in the package'
      );
      expect((caught as Error).message).not.toContain(dir);
      expect(fake.committedTree().size).toEqual(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("REQ-FEH-02 family: a non-ENOENT stat failure (ENOTDIR — path routed through a regular file) rejects invalid-input as unreadable, never as not-found", async () => {
    const dir = packageDir();
    try {
      // `blocker.txt` is a regular FILE; statting a path that treats it as a directory
      // throws ENOTDIR — a deterministic, chmod-free non-ENOENT errno (S18: chmod
      // fixtures are unreliable under root-running CI).
      writeFileSync(join(dir, "blocker.txt"), "content", "utf-8");
      const fake = new ContractFake({ seed: {} });

      const run = defineFactory<void>(() => {
        create("dest.ts", { templateFile: "blocker.txt/nested.template", options: {} });
      }, { packageDir: dir });

      let caught: unknown;
      try {
        await run(undefined, { client: fake });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AuthoringError);
      expect((caught as AuthoringError).reason).toEqual("invalid-input");
      expect((caught as Error).message).toEqual(
        'invalid input: templateFile "blocker.txt/nested.template" could not be read'
      );
      expect(fake.committedTree().size).toEqual(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("REQ-CCL-02.2 posture: raw bytes under budget but JSON-serialized form over budget rejects invalid-input (kills a raw-bytes-only measurer)", async () => {
    const dir = packageDir();
    try {
      // 3 MiB of "\n": raw size is under BATCH_CAP_BYTES (passes the stat gate and the
      // sniff — newline is valid UTF-8, no null byte), but JSON.stringify escapes each
      // to "\\n" (2 bytes), pushing the serialized form to ~6 MiB — over the cap. Only
      // the serialized-size branch can reject this fixture.
      const rawSize = 3 * 1024 * 1024;
      expect(rawSize).toBeLessThan(BATCH_CAP_BYTES);
      writeFileSync(join(dir, "escapes.ts.template"), "\n".repeat(rawSize), "utf-8");
      const fake = new ContractFake({ seed: {} });

      const run = defineFactory<void>(() => {
        create("dest.ts", { templateFile: "escapes.ts.template", options: {} });
      }, { packageDir: dir });

      let caught: unknown;
      try {
        await run(undefined, { client: fake });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AuthoringError);
      expect((caught as AuthoringError).reason).toEqual("invalid-input");
      expect((caught as Error).message).toEqual(
        'invalid input: templateFile "escapes.ts.template" exceeds the serialized frame budget'
      );
      expect(fake.committedTree().size).toEqual(0);
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

describe("e2e — scaffold({ from, to }) folder walk (S-001)", () => {
  it("FSC-01.2/02.1/07.1 + DRE-05.3: mirrors a nested folder's text files by-value, commits, and dry-run tags every entry 'rendered'", async () => {
    const dir = packageDir();
    try {
      mkdirSync(join(dir, "files", "nested"), { recursive: true });
      writeFileSync(join(dir, "files", "a.ts"), "export const a = 1;", "utf-8");
      writeFileSync(join(dir, "files", "nested", "b.ts"), "export const b = 2;", "utf-8");
      const fake = new ContractFake({ seed: {} });

      const run = defineFactory<void>(() => {
        const result = scaffold({ from: "files", to: "out" });
        expect(result).toBeUndefined(); // REQ-FSC-07.1: scaffold returns void

        const plan = dryRun();
        expect(plan).toEqual([
          { verb: "create", path: "out/a.ts", kind: "rendered" },
          { verb: "create", path: "out/nested/b.ts", kind: "rendered" },
        ]);
      }, { packageDir: dir });

      await run(undefined, { client: fake });

      expect(fake.committedTree()).toEqual(
        new Map([
          ["out/a.ts", "export const a = 1;"],
          ["out/nested/b.ts", "export const b = 2;"],
        ])
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("REQ-FSC-04.1: a truly-empty source folder no-ops — zero directives, no error", async () => {
    const dir = packageDir();
    try {
      mkdirSync(join(dir, "empty"));
      const fake = new ContractFake({ seed: {} });

      const run = defineFactory<void>(() => {
        scaffold({ from: "empty", to: "out" });
        expect(dryRun()).toEqual([]);
      }, { packageDir: dir });

      await run(undefined, { client: fake });

      expect(fake.committedTree().size).toEqual(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("REQ-FSC-04.2: filters eliminating every entry reject fail-loud, naming the filters — AEC-12 owner mapping to invalid-input", async () => {
    const dir = packageDir();
    try {
      mkdirSync(join(dir, "files"));
      writeFileSync(join(dir, "files", "a.ts"), "content", "utf-8");
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
      expect((caught as AuthoringError).origin).toEqual("authoring-rejected");
      expect(fake.committedTree().size).toEqual(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("classifier's by-reference verdict throws fail-loud in this slice (temporary — S-003 swaps this for real copyIn emission)", async () => {
    const dir = packageDir();
    try {
      mkdirSync(join(dir, "files"));
      writeFileSync(join(dir, "files", "asset.png"), Buffer.from([0x89, 0x00, 0x50, 0x4e]));
      const fake = new ContractFake({ seed: {} });

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
      expect((caught as AuthoringError).reason).toEqual("invalid-input");
      expect(fake.committedTree().size).toEqual(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("REQ-CCL-05.1: a binary .template source inside a scaffold walk fails loud, naming the offending source — never silently by-reference", async () => {
    const dir = packageDir();
    try {
      mkdirSync(join(dir, "files"));
      writeFileSync(join(dir, "files", "logo.svg.template"), Buffer.from([0x00, 0x01, 0x02]));
      const fake = new ContractFake({ seed: {} });

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
      expect((caught as AuthoringError).reason).toEqual("invalid-input");
      expect((caught as Error).message).toContain("logo.svg.template");
      expect(fake.committedTree().size).toEqual(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("REQ-FSC-01.1/.3: scaffold missing 'from' or 'to' rejects fail-loud before any directory read", async () => {
    const dir = packageDir();
    try {
      const fake = new ContractFake({ seed: {} });

      const runNoFrom = defineFactory<void>(() => {
        scaffold({ to: "out" } as unknown as Parameters<typeof scaffold>[0]);
      }, { packageDir: dir });
      let caughtNoFrom: unknown;
      try {
        await runNoFrom(undefined, { client: fake });
      } catch (err) {
        caughtNoFrom = err;
      }
      expect(caughtNoFrom).toBeInstanceOf(AuthoringError);
      expect((caughtNoFrom as AuthoringError).reason).toEqual("invalid-input");

      const runNoTo = defineFactory<void>(() => {
        scaffold({ from: "files" } as unknown as Parameters<typeof scaffold>[0]);
      }, { packageDir: dir });
      let caughtNoTo: unknown;
      try {
        await runNoTo(undefined, { client: fake });
      } catch (err) {
        caughtNoTo = err;
      }
      expect(caughtNoTo).toBeInstanceOf(AuthoringError);
      expect((caughtNoTo as AuthoringError).reason).toEqual("invalid-input");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("design §Data Model 'no resolution anchor': scaffold inside a bare defineFactory(fn) run fails loud, never falls back to cwd", async () => {
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    });

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
