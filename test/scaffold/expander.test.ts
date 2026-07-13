/**
 * REQ-FSC-02/04/06 (S-001/S-003, design §Test Derivation): the expander's fan-out —
 * mirrored structure under `to` (REQ-FSC-02), the zero-entries-no-op vs
 * filters-eliminate-all distinction (REQ-FSC-04), and `force` pass-through to every
 * emitted directive: REQ-FSC-06.1 (by-value only) plus REQ-FSC-06.2 (S-003 — mixed
 * by-value/by-reference collision, now that `copyIn` emission exists). Integration level
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
import { describe, it, expect, spyOn } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { scaffold, dryRun, AuthoringError } from "../../src/commons/index.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { rejectedRun } from "../support/rejection-capture.ts";
import { expectAuthoringReason } from "../support/expect-reason.ts";

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

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out", exclude: ["*.ts"] });
    }, { packageDir: dir });

    const err = expectAuthoringReason(caught, "invalid-input");
    expect(err.message).toContain("*.ts");
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

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("path-collision");
  });
});

describe("REQ-FSC-06.2 — scaffold-level collision: mixed by-value/by-reference, with and without force", () => {
  it("a binary (by-reference) destination collision rejects without force; the same scaffold with force: true overwrites both entries", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "text.ts"), "export const a = 1;", "utf-8");
    writeFileSync(join(dir, "files", "binary.png"), Buffer.from([0x89, 0x00, 0x50, 0x4e]));
    const fakeNoForce = new ContractFake({ seed: { "out/binary.png": "pre-existing" } });

    const caught = await rejectedRun(fakeNoForce, () => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("path-collision");
    expect((caught as AuthoringError).verb).toEqual("copyIn");
    expect(fakeNoForce.committedTree().size).toEqual(0);

    const fakeForce = new ContractFake({ seed: { "out/binary.png": "pre-existing", "out/text.ts": "stale" } });
    const runForce = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out", force: true });
    }, { packageDir: dir });

    await runForce(undefined, { client: fakeForce });

    // The by-value entry overwrote its stale seed (force wiring, REQ-FSC-06.1); the
    // by-reference entry's collision was force-overwritten too (no rejection) but never
    // lands bytes in result.tree (BRC-04/Q21, emit-only — REQ-FSC-06.2's own point: BOTH
    // entries are overwrite-eligible under the single scaffold-level flag, even though
    // only the by-value one is byte-observable here).
    expect(fakeForce.committedTree().get("out/text.ts")).toEqual("export const a = 1;");
    expect(fakeForce.committedTree().has("out/binary.png")).toBe(false);
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

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out", rename: { "a.ts": "../../escape.ts" } });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });
});

describe("SEC (owner-ratified final-verify remediation) — scaffold's walk ROOT is containment-checked before any enumeration", () => {
  it("a lexically escaping `from` ('../<out-of-ceiling>') rejects source-outside-package and never enumerates the escaping tree", async () => {
    const dir = scratchDir();
    const external = mkdtempSync(join(tmpdir(), "expander-external-"));
    try {
      mkdirSync(join(external, "nested"), { recursive: true });
      writeFileSync(join(external, "top-secret.txt"), "nope", "utf-8");
      writeFileSync(join(external, "nested", "also-secret.txt"), "nope", "utf-8");
      const relFrom = relative(dir, external);
      const fake = new ContractFake({ seed: {} });

      const readdirSpy = spyOn(fs, "readdirSync");
      const lstatSpy = spyOn(fs, "lstatSync");
      try {
        const caught = await rejectedRun(fake, () => {
          scaffold({ from: relFrom, to: "out" });
        }, { packageDir: dir });

        const err = expectAuthoringReason(caught, "source-outside-package");
        expect(err.message).toContain(relFrom);
        // The whole point: containment rejects the walk ROOT before `walkFolder` ever
        // enumerates it — no readdirSync/lstatSync call may ever target the escaping
        // subtree (an unrelated readdirSync against `packageDir` itself, from the run's
        // own pre-existing reserved-lifecycle-name scan, is expected and fine).
        for (const call of readdirSpy.mock.calls) {
          expect(String(call[0])).not.toContain(external);
        }
        for (const call of lstatSpy.mock.calls) {
          expect(String(call[0])).not.toContain(external);
        }
        expect(fake.committedTree().size).toEqual(0);
      } finally {
        readdirSpy.mockRestore();
        lstatSpy.mockRestore();
      }
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  });

  it("a `from` that is lexically in-ceiling but whose realpath escapes (a symlinked directory pointing out) rejects source-outside-package before any enumeration", async () => {
    const dir = scratchDir();
    const external = mkdtempSync(join(tmpdir(), "expander-external-"));
    try {
      writeFileSync(join(external, "top-secret.txt"), "nope", "utf-8");
      symlinkSync(external, join(dir, "link-out"));
      const fake = new ContractFake({ seed: {} });

      const readdirSpy = spyOn(fs, "readdirSync");
      try {
        const caught = await rejectedRun(fake, () => {
          scaffold({ from: "link-out", to: "out" });
        }, { packageDir: dir });

        expectAuthoringReason(caught, "source-outside-package");
        // The symlinked ROOT's TARGET is never enumerated — containment rejects it via
        // realpath before `walkFolder` (and its readdirSync) ever runs. (The unrelated
        // readdirSync(packageDir) from the run's reserved-lifecycle-name scan is fine.)
        for (const call of readdirSpy.mock.calls) {
          expect(String(call[0])).not.toContain(external);
        }
        expect(fake.committedTree().size).toEqual(0);
      } finally {
        readdirSpy.mockRestore();
      }
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  });

  it("a legitimately absent in-ceiling `from` is unaffected by the new root check — existing not-found behavior is preserved", async () => {
    const dir = scratchDir();
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "does-not-exist", to: "out" });
    }, { packageDir: dir });

    // Not an AuthoringError — walkFolder's own readdirSync ENOENT propagates unchanged,
    // exactly as it did before this remediation (no new source-not-found behavior invented
    // for the scaffold root, per the owner-ratified scope).
    expect(caught).not.toBeInstanceOf(AuthoringError);
    expect(fake.committedTree().size).toEqual(0);
  });
});
