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
 * REQ-AEC-10/11 (S-002, design §Test Derivation): the four `source-*` reasons — one
 * fixture per reason, each asserting the EXACT AEC-11 V3 neutral message template (no
 * `"copy failed:"` prefix). `source-unreadable` is exercised via an INJECTED read-failure
 * seam (never chmod — S18: chmod fixtures are unreliable under root-running CI and
 * container umasks). The union arithmetic proof at the bottom now counts twelve.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
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

    // 2 real entries + collection.json > bound of 1
    expectReason(() => walkFolder(dir, 1), "invalid-input");
  });

  it("the compile-time union pin still counts exactly twelve members — none of these modes minted a new reason", () => {
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
        case "source-outside-package":
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

describe("REQ-AEC-10 / REQ-AEC-11 — the four source-* reasons classify exactly and follow the V3 neutral message templates", () => {
  it("REQ-AEC-10.1/REQ-AEC-11.1: source-not-found — an in-ceiling missing source", () => {
    const dir = scratchDir();

    const err = expectReason(
      () => classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "missing.ts", isTemplateMarked: false }),
      "source-not-found"
    );
    expect(err.message).toEqual("source file not found: missing.ts does not exist in the package");
    expect(err.message).not.toContain(dir);
  });

  it("REQ-AEC-10.1/REQ-AEC-11.1: source-outside-package — a source resolving outside the containment ceiling", () => {
    const dir = scratchDir();

    const err = expectReason(
      () =>
        classifyTransport({
          packageDir: dir,
          packageRoot: dir,
          relPath: "../outside.txt",
          isTemplateMarked: false,
        }),
      "source-outside-package"
    );
    expect(err.message).toEqual(
      "source file outside package: ../outside.txt resolves outside the package boundary"
    );
  });

  it("REQ-AEC-10.1/REQ-AEC-11.1: source-not-regular-file — a directory presented as a source", () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "adir"));

    const err = expectReason(
      () => classifyTransport({ packageDir: dir, packageRoot: dir, relPath: "adir", isTemplateMarked: false }),
      "source-not-regular-file"
    );
    expect(err.message).toEqual("source file invalid: adir is not a regular file");
  });

  it("REQ-AEC-10.1/REQ-AEC-11.1: source-unreadable — an injected read-failure (EACCES) seam, never chmod (S18)", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    const target = join(dir, "files", "readable.ts");
    writeFileSync(target, "export const a = 1;", "utf-8");
    const realTarget = realpathSync(target); // classify-transport reads the REALPATH'd form
    const fake = new ContractFake({ seed: {} });

    const originalReadFileSync = fs.readFileSync;
    const readSpy = spyOn(fs, "readFileSync").mockImplementation(((...args: Parameters<typeof fs.readFileSync>) => {
      if (args[0] === realTarget) {
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
