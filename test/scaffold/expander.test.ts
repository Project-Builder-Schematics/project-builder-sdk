/**
 * REQ-FSC-02/04/06 (S-001/S-003, design §Test Derivation): the expander's fan-out —
 * mirrored structure under `to` (REQ-FSC-02), the zero-entries-no-op vs
 * filters-eliminate-all distinction (REQ-FSC-04), and `force` pass-through to every
 * emitted directive: REQ-FSC-06.1 (by-value only) plus REQ-FSC-06.2 (S-003 — mixed
 * by-value/by-reference collision, now that `copyIn` emission exists). Integration level
 * (design): drives `runScaffold` through a real `defineFactory` run against a
 * `ContractFake`.
 *
 * REQ-IPF-02 (ADR-0077, retiring REQ-PRC-09): the destination lexical guard is
 * unit-tested directly against `validateDestinationLexical` in
 * `test/scaffold/path-guards.test.ts` (design's Test Derivation assignment) — the block
 * below additionally proves the WIRING into `expander.ts`'s computed-destination emit
 * path, via a `rename` map value that smuggles a `../` segment into the FINAL destination
 * (design §Data Model S3: the guard applies post-rename, post-token-translation).
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
import { expectAuthoringReason, expectReason } from "../support/expect-reason.ts";

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

describe("judgment-day round 2 (F2) — scaffold `to`/`rename` validated at entry, never a raw TypeError", () => {
  it("F2(a): a non-string `to` rejects AuthoringError invalid-input, never a raw TypeError", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: 42 as unknown as string });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });

  it("F2(a): a non-string `rename` value rejects AuthoringError invalid-input, never a raw TypeError", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out", rename: { "a.ts": 5 as unknown as string } });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });

  it("F2(b): an empty `from` folder with an ABSOLUTE `to` still rejects — REQ-IPF-02 is a pre-emit mandate, not conditional on the source folder having contents", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "empty"));
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "empty", to: "/abs" });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
  });

  it("F2(b): an empty `from` folder with an escaping (`../`) `to` still rejects", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "empty"));
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "empty", to: "../escape" });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
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

describe("judgment-day round 3 (F2) — rename '../' collapse: a per-entry destRelPath carrying a literal '..' rejects BEFORE the join that would otherwise normalize it away", () => {
  it("F2: a shallow rename escape ('../evil.ts' under a one-segment `to`) rejects invalid-input — previously `posix.join(\"out\", \"../evil.ts\")` collapsed to workspace-root-relative 'evil.ts' with NO rejection", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out", rename: { "a.ts": "../evil.ts" } });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
    expect(fake.committedTree().has("evil.ts")).toBe(false);
  });

  it("F2: a deep rename escape ('../../../pwned.ts' under a three-segment `to`) rejects invalid-input — previously the join collapsed all three '..' levels against `to`'s own depth, landing the file at the workspace root with no rejection", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "x.ts"), "X", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "a/b/c", rename: { "x.ts": "../../../pwned.ts" } });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
    expect(fake.committedTree().size).toEqual(0);
    expect(fake.committedTree().has("pwned.ts")).toBe(false);
  });
});

describe("judgment-day round 3 (F1) — scaffold include/exclude are shape-validated at entry, never reach isIncluded raw", () => {
  it("F1: a non-array `include` (a bare glob string) rejects invalid-input naming the option, never a raw TypeError", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out", include: "**" as unknown as string[] });
    }, { packageDir: dir });

    const err = expectAuthoringReason(caught, "invalid-input");
    expect(err.message).toContain("include");
    expect(fake.committedTree().size).toEqual(0);
  });

  it("F1: a non-array `exclude` (a bare glob string) rejects invalid-input naming the option, never a raw TypeError", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out", exclude: "*.md" as unknown as string[] });
    }, { packageDir: dir });

    const err = expectAuthoringReason(caught, "invalid-input");
    expect(err.message).toContain("exclude");
    expect(fake.committedTree().size).toEqual(0);
  });

  it("F1: an `include` array carrying a non-string element rejects invalid-input naming the option, instead of silently compiling it into an always-empty-matching pattern", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out", include: [42] as unknown as string[] });
    }, { packageDir: dir });

    // Distinguished from REQ-FSC-04.2's "filters eliminated every entry" rejection (which
    // ALSO mentions "include" in its message, and which the OLD unguarded `isIncluded`
    // would reach instead — a non-string element silently compiles to an always-empty
    // `/^$/` pattern that matches nothing, filtering every entry out rather than raising
    // the shape error this fix introduces): assert the SHAPE-specific wording.
    const err = expectAuthoringReason(caught, "invalid-input");
    expect(err.message).toContain('"include" must be an array of strings');
    expect(fake.committedTree().size).toEqual(0);
  });
});

describe("judgment-day round 3 (F4) — scaffold's destination guard runs AFTER context resolution: outside-run wins over invalid-input", () => {
  it("F4: scaffold called with NO active run and an escaping `to` rejects outside-run, never invalid-input", () => {
    expectReason(() => scaffold({ from: "files", to: "../escape" }), "outside-run");
  });
});

describe("judgment-day round 3 (F7) — owner ruling 17 (2026-07-29): a degenerate `from` (the package root itself) rejects instead of enumerating the whole packageDir", () => {
  const degenerateForms: Array<[label: string, from: string]> = [
    ["empty string", ""],
    ["a bare dot", "."],
    ["dot-slash", "./"],
  ];

  for (const [label, from] of degenerateForms) {
    it(`F7: from: ${JSON.stringify(from)} (${label}) rejects invalid-input naming "from", never a silent whole-package enumeration`, async () => {
      const dir = scratchDir();
      writeFileSync(join(dir, "secret.ts"), "top secret", "utf-8");
      const fake = new ContractFake({ seed: {} });

      const caught = await rejectedRun(fake, () => {
        scaffold({ from, to: "out" });
      }, { packageDir: dir });

      const err = expectAuthoringReason(caught, "invalid-input");
      expect(err.message).toContain("from");
      expect(fake.committedTree().size).toEqual(0);
    });
  }
});

describe("REQ-BRC-02.1 — no SDK-resolved root value appears on the wire as authoritative [SEAM]", () => {
  it("a copyIn directive's wire shape carries only the package-relative from/to — no root, ceiling, or anchor field", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "binary.png"), Buffer.from([0x89, 0x00, 0x50, 0x4e]));
    const fake = new ContractFake({ seed: {} });
    const emitSpy = spyOn(fake, "emit");

    const run = defineFactory<void>(() => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    await run(undefined, { client: fake });

    // The engine independently re-derives its own ceiling (REQ-BRC-02) — the SDK places
    // no resolved anchor on the wire. `toEqual` is exact: any extra field (a root/
    // ceiling/anchor the SDK might regrow) would fail this alongside a real `from`/`to`.
    const copyInDirectives = emitSpy.mock.calls
      .flatMap(([batch]) => batch.instructions)
      .filter((instruction) => instruction.op === "copyIn");
    expect(copyInDirectives).toEqual([
      { op: "copyIn", copyIn: { from: "files/binary.png", to: "out/binary.png" } },
    ]);
    emitSpy.mockRestore();
  });
});

describe("SEC (ADR-0077) — scaffold's walk ROOT: lexical escape still rejects, a symlink-target escape is an accepted residual", () => {
  it("a lexically escaping `from` ('../<out-of-ceiling>') rejects invalid-input and never enumerates the escaping tree", async () => {
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

        // ADR-0077: `validateSourceLexical` (the walk ROOT's ONLY screen) rejects a
        // literal `..` segment lexically — `invalid-input`, not the retired
        // `source-outside-package` reason.
        const err = expectAuthoringReason(caught, "invalid-input");
        expect(err.message).toContain(relFrom);
        // The lexical screen still runs BEFORE `walkFolder` ever enumerates the root —
        // no readdirSync/lstatSync call may ever target the escaping subtree (an
        // unrelated readdirSync against `packageDir` itself, from the run's own
        // pre-existing reserved-lifecycle-name scan, is expected and fine).
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

  it("a `from` that is itself a symlinked directory rejects invalid-input — owner ruling 16 (2026-07-29) supersedes the prior ADR-0077 walk-root residual", async () => {
    // Prior to ruling 16, this scenario asserted the walk ROOT was FOLLOWED transparently
    // (a residual, alongside the per-entry symlink residual REQ-PSH-04.1 still documents).
    // The owner ruled the walk ROOT specifically gets a stricter, explicit rejection
    // instead — a symlinked root is too easy to construct and too silent a way to read
    // content the author never named; the per-entry residual (a symlink DISCOVERED by an
    // otherwise-real walk) is unaffected and still documented in SECURITY.md point 4.
    const dir = scratchDir();
    const external = mkdtempSync(join(tmpdir(), "expander-external-"));
    try {
      writeFileSync(join(external, "top-secret.txt"), "nope", "utf-8");
      symlinkSync(external, join(dir, "link-out"));
      const fake = new ContractFake({ seed: {} });

      const caught = await rejectedRun(fake, () => {
        scaffold({ from: "link-out", to: "out" });
      }, { packageDir: dir });

      const err = expectAuthoringReason(caught, "invalid-input");
      expect(err.message).toContain("link-out");
      expect(err.message).not.toContain(external);
      expect(fake.committedTree().size).toEqual(0);
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  });

  it("judgment-day round 2 (F1): a trailing slash on a symlinked `from` ('link-out/') still rejects invalid-input, never followed", async () => {
    // `path.join` PRESERVES a trailing separator, and POSIX `lstat` on a path ending in "/"
    // FOLLOWS the final symlink — without normalization this bypassed ruling 16's rejection
    // entirely and enumerated `external`'s content.
    const dir = scratchDir();
    const external = mkdtempSync(join(tmpdir(), "expander-external-"));
    try {
      writeFileSync(join(external, "top-secret.txt"), "nope", "utf-8");
      symlinkSync(external, join(dir, "link-out"));
      const fake = new ContractFake({ seed: {} });

      const caught = await rejectedRun(fake, () => {
        scaffold({ from: "link-out/", to: "out" });
      }, { packageDir: dir });

      const err = expectAuthoringReason(caught, "invalid-input");
      expect(err.message).not.toContain(external);
      expect(fake.committedTree().size).toEqual(0);
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  });

  it("REQ-PRC-10.3 (owner-ratified V4 → V5 amendment, judgment-day iteration 2 fix): a legitimately absent in-ceiling `from` rejects AuthoringError naming the package-relative path — never a raw ENOENT leaking an absolute path", async () => {
    const dir = scratchDir();
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "does-not-exist", to: "out" });
    }, { packageDir: dir });

    // V5: walkFolder's own readdirSync ENOENT no longer propagates raw — it is caught at
    // the walk ROOT and routed through AuthoringError (reason invalid-input), package-
    // relative path only, same no-echo posture every other scaffold-family rejection holds.
    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
    expect((caught as Error).message).toContain("does-not-exist");
    expect((caught as Error).message).not.toContain(dir);
    expect(fake.committedTree().size).toEqual(0);
  });

  it("REQ-PRC-10.3 (owner-ratified V4 → V5 amendment, judgment-day iteration 2 fix): a `from` that resolves to a regular file rejects AuthoringError naming the package-relative path — never a raw ENOTDIR leaking an absolute path", async () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "not-a-folder.json"), "{}", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "not-a-folder.json", to: "out" });
    }, { packageDir: dir });

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
    expect((caught as Error).message).toContain("not-a-folder.json");
    expect((caught as Error).message).not.toContain(dir);
    expect(fake.committedTree().size).toEqual(0);
  });
});

describe("REQ-TES-09.3 — scaffold missing-packageDir rejection is rewritten (bare-shape contract)", () => {
  it("names the caller-supplied-packageDir remedy, zero defineFactory tokens", async () => {
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out" });
    });

    const err = expectAuthoringReason(caught, "invalid-input");
    expect(err.message).not.toContain("defineFactory");
    expect(err.message).toContain("scaffold");
    expect(err.message).toContain("packageDir");
    expect(err.message).toContain("invalid input: ");
  });
});
