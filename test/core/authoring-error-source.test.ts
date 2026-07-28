/**
 * REQ-AEC-12 (S-001, design §Test Derivation): scaffold-family failure modes reuse the
 * EXISTING `invalid-input` reason — no new reason is minted. Pins the S-001-introduced
 * modes beyond the ones S-000 already covers (templateFile binary/oversized, missing
 * collection.json ancestor): zero-files-after-filter (folder-scaffold REQ-FSC-04),
 * `.template` sniff-fail inside a scaffold walk (content-classification REQ-CCL-05),
 * intra-scaffold destination collision (folder-scaffold REQ-FSC-08), and the walk
 * entry-count bound (folder-scaffold REQ-FSC-09) — all classify `invalid-input`,
 * `authoring-rejected`.
 *
 * REQ-AEC-10/11 (S-002, design §Test Derivation): the THREE surviving `source-*` reasons
 * — one fixture per reason (plus the `source-not-regular-file` FIFO variant), each
 * asserting the EXACT AEC-11 V3.3 neutral message template (no `"copy failed:"` prefix).
 * `source-unreadable` is exercised via an INJECTED read-failure seam (never chmod — S18:
 * chmod fixtures are unreliable under root-running CI and container umasks). REQ-AEC-11.2
 * (source vs. destination templates driven from their own REQ, never interchangeable) is
 * discharged by `test/scaffold/path-guards.test.ts`'s REQ-IPF-01/REQ-IPF-02 describe
 * blocks — this file does not repeat it. The union arithmetic proof at the bottom now
 * counts eleven (ADR-0077 — `source-outside-package` retired).
 */
import { describe, it, expect, spyOn } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { join } from "node:path";
import { ContractFake } from "../support/contract-fake.ts";
import { scaffold, AuthoringError } from "../../src/commons/index.ts";
import { walkFolder } from "../../src/scaffold/walk.ts";
import { detectDestinationCollisions, type PipelineResult } from "../../src/scaffold/filename-pipeline.ts";
import { classifyTransport } from "../../src/scaffold/classify-transport.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import { rejectedRun } from "../support/rejection-capture.ts";
import { expectAuthoringReason, expectReason } from "../support/expect-reason.ts";

const scratchDir = scratchDirFactory("aec-12-");

describe("REQ-AEC-12.1 — scaffold-family failures map to invalid-input/authoring-rejected", () => {
  it("zero-files-after-filter (REQ-FSC-04.2)", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out", exclude: ["*.ts"] });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
  });

  it(".template sniff-fail inside a scaffold walk (content-classification REQ-CCL-05.1)", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "logo.svg.template"), Buffer.from([0x00, 0x01]));
    const fake = new ContractFake({ seed: {} });

    const caught = await rejectedRun(fake, () => {
      scaffold({ from: "files", to: "out" });
    }, { packageDir: dir });

    expectAuthoringReason(caught, "invalid-input");
  });

  it("intra-scaffold destination collision (folder-scaffold REQ-FSC-08.1)", () => {
    const results: PipelineResult[] = [
      { sourceRelPath: "a.ts", destRelPath: "same.ts", isTemplateMarked: false },
      { sourceRelPath: "a.ts.template", destRelPath: "same.ts", isTemplateMarked: true },
    ];

    expectReason(() => detectDestinationCollisions(results), "invalid-input");
  });

  it("walk entry-count bound exceeded (folder-scaffold REQ-FSC-09.2)", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "a.ts"), "A", "utf-8");
    writeFileSync(join(dir, "b.ts"), "B", "utf-8");

    // 2 real entries > bound of 1
    expectReason(() => walkFolder(dir, 1), "invalid-input");
  });

  it("the compile-time union pin still counts exactly eleven members — none of these modes minted a new reason", () => {
    const _proof = (reason: AuthoringError["reason"]): string => {
      switch (reason) {
        case "path-collision":
        case "path-not-found":
        case "unrepresentable-content":
        case "changes-too-large":
        case "outside-run":
        case "unknown":
        case "invalid-input":
        case "reserved-name":
        case "source-not-found":
        case "source-not-regular-file":
        case "source-unreadable":
          return reason;
        default: {
          const _exhaustive: never = reason;
          return _exhaustive;
        }
      }
    };
    void _proof;
  });
});

describe("REQ-AEC-10 / REQ-AEC-11 — the three surviving source-* reasons classify exactly and follow the V3.3 neutral message templates", () => {
  it("REQ-AEC-10.1/REQ-AEC-11.1: source-not-found — a missing source", () => {
    const dir = scratchDir();

    const err = expectReason(
      () =>
        classifyTransport({
          packageDir: dir,
          relPath: "missing.ts",
          isTemplateMarked: false,
          destPath: "missing.ts",
          options: {},
        }),
      "source-not-found"
    );
    expect(err.message).toEqual("source file not found: missing.ts does not exist in the package");
    expect(err.message).not.toContain(dir);
  });

  // ADR-0077: `source-outside-package` retired along with `package-root-containment`
  // (S-002.1's union shrink) — its fixture is gone from this file. A lexically-escaping
  // relPath is now `path-guards.ts#validateSourceLexical`'s job, called by
  // classifyTransport's CALLERS before classifyTransport ever runs — not something
  // classifyTransport itself classifies anymore.

  it("REQ-AEC-10.1/REQ-AEC-11.1: source-not-regular-file — a FIFO (non-directory, non-regular) presented as a source, generic form", () => {
    const dir = scratchDir();
    const fifoPath = join(dir, "pipe");
    execFileSync("mkfifo", [fifoPath]);

    const err = expectReason(
      () =>
        classifyTransport({
          packageDir: dir,
          relPath: "pipe",
          isTemplateMarked: false,
          destPath: "pipe",
          options: {},
        }),
      "source-not-regular-file"
    );
    expect(err.message).toEqual("source file invalid: pipe is not a regular file");
  });

  it("REQ-AEC-10.1/REQ-AEC-11.1: source-not-regular-file — a directory presented as a source", () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "adir"));

    const err = expectReason(
      () =>
        classifyTransport({
          packageDir: dir,
          relPath: "adir",
          isTemplateMarked: false,
          destPath: "adir",
          options: {},
        }),
      "source-not-regular-file"
    );
    expect(err.message).toEqual(
      "source file invalid: adir is a directory, not a regular file — use scaffold() to copy a folder"
    );
  });

  it("REQ-AEC-10.1/REQ-AEC-11.1: source-unreadable — an injected read-failure (EACCES) seam, never chmod (S18)", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    const target = join(dir, "files", "readable.ts");
    writeFileSync(target, "export const a = 1;", "utf-8");
    // ADR-0077 (design V2 amendment): path-guards.ts resolves the LEXICAL absolute path
    // (`resolve(join(packageDir, relPath))`), never a realpath'd one — `target` above IS
    // already that lexical form, so it (not `realpathSync(target)`) is what
    // classify-transport.ts's own post-stat `readFileSync` is actually called with.
    const fake = new ContractFake({ seed: {} });

    const originalReadFileSync = fs.readFileSync;
    const readSpy = spyOn(fs, "readFileSync").mockImplementation(((...args: Parameters<typeof fs.readFileSync>) => {
      if (args[0] === target) {
        throw Object.assign(new Error("EACCES: permission denied, open"), { code: "EACCES" });
      }
      return originalReadFileSync(...(args as Parameters<typeof readFileSync>));
    }) as typeof fs.readFileSync);

    try {
      const caught = await rejectedRun(fake, () => {
        scaffold({ from: "files", to: "out" });
      }, { packageDir: dir });

      const err = expectAuthoringReason(caught, "source-unreadable");
      expect(err.message).toEqual("source file unreadable: files/readable.ts could not be read");
      expect(fake.committedTree().size).toEqual(0);
    } finally {
      readSpy.mockRestore();
    }
  });
});
