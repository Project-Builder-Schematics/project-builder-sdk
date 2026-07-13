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
 *
 * S-003 swaps the by-reference fail-loud throw for real `copyIn` emission and adds the
 * `copyIn(from, to, {force})` escape-hatch OUTER LOOP (Flow Changes table): a mixed
 * by-value/by-reference scaffold commits both, and a standalone `copyIn` call always
 * copies verbatim, never renders (FEH-03/04/05, BRC-*, PRC-*).
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create, scaffold, copyIn, dryRun, AuthoringError } from "../../src/commons/index.ts";
import { BATCH_CAP_BYTES } from "../../src/core/wire.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { rejectedRun } from "../support/rejection-capture.ts";
import { expectAuthoringReason } from "../support/expect-reason.ts";

const scratchDir = scratchDirFactory("scaffold-e2e-");

describe("e2e — create({ templateFile }) walking skeleton", () => {
  it("REQ-FEH-01.1 + REQ-DRE-05.3: renders templateFile content through the create IR, commits, and dry-run tags it 'rendered'", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "tpl.ts.template"), "export const x = {= x =};", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      create("dest.ts", { templateFile: "tpl.ts.template", options: { x: 1 } });

      expect(dryRun()).toEqual([{ verb: "create", path: "dest.ts", kind: "rendered" }]);
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    expect(fake.committedTree()).toEqual(new Map([["dest.ts", "export const x = {= x =};"]]));
  });

  it("REQ-FEH-02.1: a templateFile containing a null byte rejects fail-loud with reason invalid-input, never silently copies", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "asset.png"), Buffer.from([0x89, 0x00, 0x50, 0x4e]));
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create("dest.png", { templateFile: "asset.png", options: {} });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
    expect(fake.stagingTree().size).toEqual(0);
  });

  it("REQ-FEH-02.2: an over-budget templateFile rejects fail-loud with reason invalid-input", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "huge.ts.template"), "a".repeat(BATCH_CAP_BYTES + 1), "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create("dest.ts", { templateFile: "huge.ts.template", options: {} });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });

  it("a package with NO collection.json ancestor fails loud pre-body, before create() ever runs (RBV-06.1 sentinel ordering)", async () => {
    const dir = scratchDir();
    rmSync(join(dir, "collection.json")); // remove the factory-seeded marker for this negative case
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      throw new Error("body-ran");
    }, { packageDir: dir });

    const err = expectAuthoringReason(caught, "invalid-input");
    expect(err.message).not.toEqual("body-ran");
  });

  it("S-005 (containment-routed): a templateFile that does not exist rejects source-not-found, naming the package-relative path (ENOENT branch)", async () => {
    const dir = scratchDir();
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create("dest.ts", { templateFile: "missing.ts.template", options: {} });
    }, { packageDir: dir });

    // Routed through `validateSourceContainment` (S-005, verify-in-loop-4 Deviation #1
    // ruling): a missing-but-in-ceiling source now mints the neutral AEC-11 `source-*`
    // reason/template, same machinery `copyIn`/`scaffold` already use — not a
    // parallel, templateFile-only `invalid-input` message.
    const err = expectAuthoringReason(caught, "source-not-found");
    expect(err.message).toEqual(
      "source file not found: missing.ts.template does not exist in the package"
    );
    expect(err.message).not.toContain(dir);
    expect(fake.committedTree().size).toEqual(0);
  });

  it("S-005 (containment-routed): a non-ENOENT realpath failure (ENOTDIR — path routed through a regular file) rejects source-unreadable, never source-not-found", async () => {
    const dir = scratchDir();
    // `blocker.txt` is a regular FILE; resolving a path that treats it as a directory
    // throws ENOTDIR — a deterministic, chmod-free non-ENOENT errno (S18: chmod
    // fixtures are unreliable under root-running CI).
    writeFileSync(join(dir, "blocker.txt"), "content", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create("dest.ts", { templateFile: "blocker.txt/nested.template", options: {} });
    }, { packageDir: dir });

    const err = expectAuthoringReason(caught, "source-unreadable");
    expect(err.message).toEqual(
      "source file unreadable: blocker.txt/nested.template could not be read"
    );
    expect(fake.committedTree().size).toEqual(0);
  });

  describe("REQ-PRC-04/07 — create({templateFile}) source containment (S-005 routed fix, verify-in-loop-4 Deviation #1)", () => {
    it("the verify-in-loop-4 exploit fixture: a relPath escaping via '../../../' to a file entirely outside packageRoot rejects source-outside-package, content is NEVER returned", async () => {
      const dir = scratchDir();
      const secretDir = scratchDir();
      writeFileSync(join(secretDir, "secret.txt"), "TOP SECRET OUTSIDE THE CEILING", "utf-8");
      const escapingRelPath = relative(dir, join(secretDir, "secret.txt"));
      const fake = new ContractFake({ seed: {} });

      const caught = await rejectedRun(fake, () => {
        create("dest.ts", { templateFile: escapingRelPath, options: {} });
      }, { packageDir: dir });

      const err = expectAuthoringReason(caught, "source-outside-package");
      expect(err.message).not.toContain("TOP SECRET");
      expect(fake.committedTree().size).toEqual(0);
      expect(fake.stagingTree().size).toEqual(0);
    });

    it("in-ceiling happy path is unaffected by the containment routing (REQ-FEH-01.1 unchanged)", async () => {
      const dir = scratchDir();
      writeFileSync(join(dir, "tpl.ts.template"), "export const x = {= x =};", "utf-8");
      const fake = new ContractFake({ seed: {} });

      const run = defineFactory<void>(() => {
        create("dest.ts", { templateFile: "tpl.ts.template", options: { x: 1 } });
      }, { packageDir: dir });

      await run(undefined, { client: fake });

      expect(fake.committedTree()).toEqual(new Map([["dest.ts", "export const x = {= x =};"]]));
    });

    it("PRC-07.2 broken-symlink oracle, out-of-ceiling target: rejects source-outside-package, never source-not-found", async () => {
      const dir = scratchDir();
      const external = scratchDir();
      // Target never created — the symlink is broken by construction, and its target
      // lives entirely outside packageRoot.
      symlinkSync(join(external, "never-created.txt"), join(dir, "broken-outside.template"));
      const fake = new ContractFake({ seed: {} });

      const caught = await rejectedRun(fake, () => {
        create("dest.ts", { templateFile: "broken-outside.template", options: {} });
      }, { packageDir: dir });

      expectAuthoringReason(caught, "source-outside-package");
      expect(fake.committedTree().size).toEqual(0);
    });

    it("PRC-07.2 broken-symlink oracle, in-ceiling target: rejects source-not-found, never source-outside-package", async () => {
      const dir = scratchDir();
      // Target never created, but its lexical location is INSIDE packageRoot — the S1
      // ENOENT-ordering fix (verify-in-loop-4 CRITICAL regression) must classify this
      // as source-not-found, not a false source-outside-package.
      symlinkSync(join(dir, "sub", "never-created.txt"), join(dir, "broken-inside.template"));
      const fake = new ContractFake({ seed: {} });

      const caught = await rejectedRun(fake, () => {
        create("dest.ts", { templateFile: "broken-inside.template", options: {} });
      }, { packageDir: dir });

      expectAuthoringReason(caught, "source-not-found");
      expect(fake.committedTree().size).toEqual(0);
    });
  });

  it("REQ-CCL-02.2 posture: raw bytes under budget but JSON-serialized form over budget rejects invalid-input (kills a raw-bytes-only measurer)", async () => {
    const dir = scratchDir();
    // 3 MiB of "\n": raw size is under BATCH_CAP_BYTES (passes the stat gate and the
    // sniff — newline is valid UTF-8, no null byte), but JSON.stringify escapes each
    // to "\\n" (2 bytes), pushing the serialized form to ~6 MiB — over the cap. Only
    // the serialized-size branch can reject this fixture.
    const rawSize = 3 * 1024 * 1024;
    expect(rawSize).toBeLessThan(BATCH_CAP_BYTES);
    writeFileSync(join(dir, "escapes.ts.template"), "\n".repeat(rawSize), "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      create("dest.ts", { templateFile: "escapes.ts.template", options: {} });
    }, { packageDir: dir });

    const err = expectAuthoringReason(caught, "invalid-input");
    expect(err.message).toEqual(
      'invalid input: templateFile "escapes.ts.template" is too large to render inline (over the 4 MiB limit)'
    );
    expect(fake.committedTree().size).toEqual(0);
  });

  it("design §Data Model 'no resolution anchor': create({templateFile}) inside a bare defineFactory(fn) run fails loud, never falls back to cwd", async () => {
    const fake = new ContractFake({ seed: {} });

    // No { packageDir } — the untyped opt-out (REQ-TFO-02). There is nothing to resolve
    // `templateFile` against; it must reject rather than silently reading against cwd.
    const caught = await rejectedRun(fake, () => {
      create("dest.ts", { templateFile: "tpl.ts.template", options: {} });
    });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });
});

describe("e2e — scaffold({ from, to }) folder walk (S-001)", () => {
  it("FSC-01.2/02.1/07.1 + DRE-05.3: mirrors a nested folder's text files by-value, commits, and dry-run tags every entry 'rendered'", async () => {
    const dir = scratchDir();
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
  });

  it("REQ-FSC-04.1: a truly-empty source folder no-ops — zero directives, no error", async () => {
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

  it("REQ-FSC-04.2: filters eliminating every entry reject fail-loud, naming the filters — AEC-12 owner mapping to invalid-input", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "content", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out", exclude: ["*.ts"] });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });

  it("S-003: classifier's by-reference verdict emits a real copyIn directive — mixed scaffold commits the by-value file and dry-run tags each entry with its own kind", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "text.ts"), "export const a = 1;", "utf-8");
    writeFileSync(join(dir, "files", "asset.png"), Buffer.from([0x89, 0x00, 0x50, 0x4e]));
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      const result = scaffold({ from: "files", to: "out" });
      expect(result).toBeUndefined(); // REQ-FSC-07.1: scaffold still returns void

      const plan = dryRun();
      expect(plan).toEqual([
        { verb: "copyIn", path: "files/asset.png", kind: "copied" },
        { verb: "create", path: "out/text.ts", kind: "rendered" },
      ]);
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    // REQ-BRC-04/Q21: the by-reference entry's bytes never land in result.tree — only
    // the by-value file is byte-observable.
    expect(fake.committedTree()).toEqual(new Map([["out/text.ts", "export const a = 1;"]]));
  });

  it("REQ-CCL-05.1: a binary .template source inside a scaffold walk fails loud, naming the offending source — never silently by-reference", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "logo.svg.template"), Buffer.from([0x00, 0x01, 0x02]));
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
    expect((caught as Error).message).toContain("logo.svg.template");
    expect(fake.committedTree().size).toEqual(0);
  });

  it("REQ-FSC-01.1/.3: scaffold missing 'from' or 'to' rejects fail-loud before any directory read", async () => {
    const dir = scratchDir();
    const fake = new ContractFake({ seed: {} });

    const caughtNoFrom = await rejectedRun(fake, () => {
      scaffold({ to: "out" } as unknown as Parameters<typeof scaffold>[0]);
    }, { packageDir: dir });
    expect(caughtNoFrom).toBeInstanceOf(AuthoringError);
    expect((caughtNoFrom as AuthoringError).reason).toEqual("invalid-input");

    const caughtNoTo = await rejectedRun(fake, () => {
      scaffold({ from: "files" } as unknown as Parameters<typeof scaffold>[0]);
    }, { packageDir: dir });
    expect(caughtNoTo).toBeInstanceOf(AuthoringError);
    expect((caughtNoTo as AuthoringError).reason).toEqual("invalid-input");
  });

  it("design §Data Model 'no resolution anchor': scaffold inside a bare defineFactory(fn) run fails loud, never falls back to cwd", async () => {
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out" });
    });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });
});

describe("e2e — copyIn(from, to, { force }) escape hatch (S-003)", () => {
  it("REQ-FEH-03.1 + REQ-DRE-05.2: copies a text file verbatim, unrendered — dry-run tags it 'copied', never lands in result.tree", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "literal.txt"), "{= this looks like a token =}", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      const result = copyIn("literal.txt", "dest/literal.txt");
      expect(result).toBeUndefined(); // REQ-FEH-04.3: copyIn returns void

      expect(dryRun()).toEqual([{ verb: "copyIn", path: "literal.txt", kind: "copied" }]);
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    // REQ-BRC-04/Q21: never materialized, even though the source is plain text.
    expect(fake.committedTree().size).toEqual(0);
  });

  it("REQ-BRC-06.1: a missing package-local source rejects fail-loud with reason source-not-found", async () => {
    const dir = scratchDir();
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      copyIn("missing.svg", "dest/missing.svg");
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("source-not-found");
    expect(fake.committedTree().size).toEqual(0);
  });

  it("REQ-FEH-04.1/.2: missing 'to' or 'from' rejects fail-loud before any emission", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "asset.svg"), "<svg/>", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caughtNoTo = await rejectedRun(fake, () => {
      copyIn("asset.svg", undefined as unknown as string);
    }, { packageDir: dir });
    expect(caughtNoTo).toBeInstanceOf(AuthoringError);
    expect((caughtNoTo as AuthoringError).reason).toEqual("invalid-input");

    const caughtNoFrom = await rejectedRun(fake, () => {
      copyIn(undefined as unknown as string, "dest/asset.svg");
    }, { packageDir: dir });
    expect(caughtNoFrom).toBeInstanceOf(AuthoringError);
    expect((caughtNoFrom as AuthoringError).reason).toEqual("invalid-input");
  });

  it("design §Data Model 'no resolution anchor': copyIn inside a bare defineFactory(fn) run fails loud, never falls back to cwd", async () => {
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      copyIn("asset.svg", "dest/asset.svg");
    });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });
});
