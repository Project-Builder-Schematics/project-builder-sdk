/**
 * REQ-AEC-12 (S-001, design §Test Derivation): scaffold-family failure modes reuse the
 * EXISTING `invalid-input` reason — no new reason is minted, union arithmetic stays at
 * eight (the four `source-*` members land in S-002). Pins the S-001-introduced modes
 * beyond the ones S-000 already covers (templateFile binary/oversized, missing
 * collection.json ancestor): zero-files-after-filter (folder-scaffold REQ-FSC-04),
 * `.template` sniff-fail inside a scaffold walk (content-classification REQ-CCL-05),
 * intra-scaffold destination collision (folder-scaffold REQ-FSC-08), and the walk
 * entry-count bound (folder-scaffold REQ-FSC-09) — all classify `invalid-input`,
 * `authoring-rejected`.
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { scaffold, AuthoringError } from "../../src/commons/index.ts";
import { walkFolder } from "../../src/scaffold/walk.ts";
import { detectDestinationCollisions, type PipelineResult } from "../../src/scaffold/filename-pipeline.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("aec-12-");

function expectInvalidInputAuthoringRejected(err: unknown): void {
  expect(err).toBeInstanceOf(AuthoringError);
  expect((err as AuthoringError).reason).toEqual("invalid-input");
  expect((err as AuthoringError).origin).toEqual("authoring-rejected");
}

describe("REQ-AEC-12.1 — scaffold-family failures map to invalid-input/authoring-rejected", () => {
  it("zero-files-after-filter (REQ-FSC-04.2)", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "a.ts"), "A", "utf-8");
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

    expectInvalidInputAuthoringRejected(caught);
  });

  it(".template sniff-fail inside a scaffold walk (content-classification REQ-CCL-05.1)", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"));
    writeFileSync(join(dir, "files", "logo.svg.template"), Buffer.from([0x00, 0x01]));
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

    expectInvalidInputAuthoringRejected(caught);
  });

  it("intra-scaffold destination collision (folder-scaffold REQ-FSC-08.1)", () => {
    const results: PipelineResult[] = [
      { sourceRelPath: "a.ts", destRelPath: "same.ts", isTemplateMarked: false },
      { sourceRelPath: "a.ts.template", destRelPath: "same.ts", isTemplateMarked: true },
    ];

    let caught: unknown;
    try {
      detectDestinationCollisions(results);
    } catch (err) {
      caught = err;
    }

    expectInvalidInputAuthoringRejected(caught);
  });

  it("walk entry-count bound exceeded (folder-scaffold REQ-FSC-09.2)", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "a.ts"), "A", "utf-8");
    writeFileSync(join(dir, "b.ts"), "B", "utf-8");

    let caught: unknown;
    try {
      walkFolder(dir, 1); // 2 real entries + collection.json > bound of 1
    } catch (err) {
      caught = err;
    }

    expectInvalidInputAuthoringRejected(caught);
  });

  it("the compile-time union pin still counts exactly eight members — none of these modes minted a new reason", () => {
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
