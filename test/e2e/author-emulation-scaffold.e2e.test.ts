/**
 * e2e — author-emulation scaffold family (S-000 walking skeleton + S-003 happy-path
 * matrix rows).
 *
 * Drives the SCENARIOS registry through `captureRun`, and compares a FRESH serialization
 * against the committed corpus byte-for-byte — a drift fails the suite, and no code path
 * here writes a new corpus file to make it pass (GCC-05 tautology guard). For every
 * MATRIX row (never `s-00`, design ruling R-B), it also renders and writes the per-run
 * report (`renderReport`/`reportPathFor`) — the report side-output design.md assigns to
 * this file. Edge-case rows (m-08, m-10..m-13, m-15..m-18, m-21) land in S-004.
 *
 * NEVER `scaffold.e2e.test.ts` — that filename is owned upstream by `schematic-local-files`
 * (ITC-04).
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { captureRun, type CaptureResult } from "../support/ir-transcript.ts";
import { buildRecord, serializeCorpus, FORMAT_VERSION, type TranscriptRecord } from "../support/corpus-format.ts";
import { renderReport, reportPathFor, REPORTS_DIR } from "../support/run-report-render.ts";
import { instrumentHarnessIO } from "../support/harness-io-instrumentation.ts";
import { expectReasonAsync } from "../support/expect-reason.ts";
import { SCENARIOS, type ScenarioEntry } from "./author-emulation/scenarios.ts";
import {
  SCAFFOLD_CALL_ARGS,
  runM02MissingFrom,
  runM02MissingTo,
  runM07,
  runM09,
  runWalkOrderDiscriminator,
  M07_HUGE_FILE_NAME,
  M09_FILE_COUNT,
  WALK_ORDER_CREATION_SEQUENCE,
} from "../fixtures/author-emulation/factory.ts";
import type { ScaffoldOptions } from "../../src/commons/index.ts";

const CORPUS_DIR = new URL("./author-emulation/corpus/", import.meta.url).pathname;
const REPORTS_ABS_DIR = join(process.cwd(), REPORTS_DIR);

// R-B: `s-00` is the infra-spine skeleton, not a matrix row — it never gets a report
// (`DryRunEntry.kind` is absent by contract for the six pre-existing ops it exercises).
function isReportableMatrixRow(scenario: ScenarioEntry): boolean {
  return scenario.id !== "s-00";
}

/** Renders and writes scenario's report to its pinned path — the SAME path every call for
 * the same id/slug (RPT-03's "same-scenario re-run leaves exactly one file" property). */
function writeReport(scenario: ScenarioEntry, record: TranscriptRecord, capture: CaptureResult): string {
  const reportText = renderReport(record, capture.rawDirectives);
  const reportPath = join(process.cwd(), reportPathFor(scenario.id, scenario.slug));
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, reportText, "utf-8");
  return reportPath;
}

describe("e2e — author-emulation scaffold family (walking skeleton + matrix rows)", () => {
  for (const scenario of SCENARIOS) {
    // Edge-case rows wait for S-004's landed factory surface.
    if (scenario.gated) continue;

    it(`${scenario.id} (${scenario.slug}) matches the committed corpus byte-for-byte`, async () => {
      const capture = await captureRun(scenario.run, scenario.input, scenario.seed);
      const record = buildRecord(capture, { scenarioId: scenario.id, slug: scenario.slug });
      const fresh = serializeCorpus(record);

      const committedPath = join(CORPUS_DIR, `${scenario.id}.${scenario.slug}.transcript.json`);
      const committed = readFileSync(committedPath, "utf-8");

      expect(fresh).toEqual(committed);
      expect(record.normative.outcome).toEqual(scenario.expected);
      expect(record.formatVersion).toEqual(FORMAT_VERSION);

      if (isReportableMatrixRow(scenario)) {
        writeReport(scenario, record, capture);
      }
    });
  }
});

describe("S-003 — matrix-row assertions beyond the generic corpus-compare", () => {
  it("REQ-AEG-01.2 — every one of the seven ScaffoldArgs fields is exercised with an explicit non-default value at least once, fixture-wide", () => {
    const isNonDefault = {
      from: (a: ScaffoldOptions) => typeof a.from === "string" && a.from.length > 0,
      to: (a: ScaffoldOptions) => typeof a.to === "string" && a.to.length > 0,
      options: (a: ScaffoldOptions) =>
        a.options !== undefined && typeof a.options === "object" && a.options !== null && Object.keys(a.options).length > 0,
      include: (a: ScaffoldOptions) => Array.isArray(a.include) && a.include.length > 0,
      exclude: (a: ScaffoldOptions) => Array.isArray(a.exclude) && a.exclude.length > 0,
      rename: (a: ScaffoldOptions) => a.rename !== undefined && Object.keys(a.rename).length > 0,
      force: (a: ScaffoldOptions) => a.force === true,
    };

    const coverage = Object.fromEntries(
      Object.entries(isNonDefault).map(([field, predicate]) => [
        field,
        SCAFFOLD_CALL_ARGS.some((args) => predicate(args)),
      ])
    );

    expect(coverage).toEqual({
      from: true,
      to: true,
      options: true,
      include: true,
      exclude: true,
      rename: true,
      force: true,
    });
  });

  it("REQ-AEG-02.1 — zero `modify` directives anywhere across the fixture's captured transcripts", async () => {
    for (const scenario of SCENARIOS) {
      if (scenario.gated || scenario.id === "s-00") continue;
      const capture = await captureRun(scenario.run, scenario.input, scenario.seed);
      const modifyDirectives = capture.rawDirectives.filter((d) => (d.op as string) === "modify");
      expect({ scenario: scenario.id, modifyDirectives }).toEqual({ scenario: scenario.id, modifyDirectives: [] });
    }
  });

  describe("M-02 — ScaffoldArgs mandatory-arg rejections (REQ-FSC-01.1/.3)", () => {
    it("missing `from` rejects fail-loud before any directory read", async () => {
      await expectReasonAsync(async () => {
        await runM02MissingFrom({ name: "Widgets" }, { client: undefined as never });
      }, "invalid-input");
    });

    it("missing `to` rejects fail-loud before any directory read", async () => {
      await expectReasonAsync(async () => {
        await runM02MissingTo({ name: "Widgets" }, { client: undefined as never });
      }, "invalid-input");
    });
  });

  it("M-07 / REQ-CCL-06.1 / REQ-ATH-14.1 — oversized-by-stat file classifies by-reference with ZERO content reads", async () => {
    const io = instrumentHarnessIO();
    const capture = await captureRun(runM07, { name: "Widgets" });
    io.restore();

    expect(capture.error).toBeUndefined();
    expect(capture.record.normative.outcome).toEqual("committed");

    const readFileSyncCalls = io
      .events()
      .filter((e) => e.surface === "node:fs" && e.key === "readFileSync")
      .filter((e) => typeof e.arg === "string" && e.arg.endsWith(M07_HUGE_FILE_NAME));
    expect(readFileSyncCalls).toEqual([]);

    // The by-reference verdict still emits a real copyIn directive — zero content reads
    // does not mean zero directive.
    const copyInDirectives = capture.rawDirectives.filter((d) => d.op === "copyIn");
    expect(copyInDirectives).toHaveLength(1);
  });

  it("M-09 / batch-cap REQ-04.1 — aggregate-over-cap scaffold completes with exactly one directive per file, none dropped/duplicated/reordered, across >1 flushed group", async () => {
    const capture = await captureRun(runM09, { name: "Widgets" });

    expect(capture.error).toBeUndefined();
    expect(capture.emitted.length).toBeGreaterThan(1); // proves chunking actually happened
    for (const batch of capture.emitted) {
      const size = Buffer.byteLength(JSON.stringify(batch), "utf8");
      expect(size).toBeLessThanOrEqual(4 * 1024 * 1024);
    }

    expect(capture.rawDirectives).toHaveLength(M09_FILE_COUNT);
    const paths = capture.rawDirectives.map((d) => (d.op === "create" ? d.create.pathTemplate : undefined));
    expect(paths).toEqual(["out/big-0.txt", "out/big-1.txt", "out/big-2.txt", "out/big-3.txt", "out/big-4.txt", "out/big-5.txt"]);
  });

  it("GCC-07.1 — walk order is walk.ts's SORTED order, not filesystem creation order (design §4.6 M-01 sorted-order discriminator)", async () => {
    const capture = await captureRun(runWalkOrderDiscriminator, { name: "Widgets" });

    expect(capture.error).toBeUndefined();
    // The fixture CREATES its files in the non-alphabetical sequence b, a, c
    // (WALK_ORDER_CREATION_SEQUENCE) — the emitted directive order below is the
    // HARDCODED sorted sequence, deliberately different from creation order, so a walk
    // enumerating in creation/readdir-insertion order fails this assert while the
    // spec-pinned sorted order (GCC-07: walk order is NORMATIVE) passes.
    expect([...WALK_ORDER_CREATION_SEQUENCE]).not.toEqual([...WALK_ORDER_CREATION_SEQUENCE].sort());
    const paths = capture.rawDirectives.map((d) => (d.op === "create" ? d.create.pathTemplate : undefined));
    expect(paths).toEqual(["out/a.ts", "out/b.ts", "out/c.ts"]);
  });

  describe("M-04 — rename + chained-token translation + `.template` strip, PINNED order (REQ-FSC-05.1, REQ-SCM-03.1)", () => {
    it("chained-token fixture's pathTemplate matches the HARDCODED literal below — NEVER read from the committed corpus (anti-green-by-capture, REQ-SCM-03)", async () => {
      const scenario = SCENARIOS.find((s) => s.id === "m-04")!;
      const capture = await captureRun(scenario.run, scenario.input, scenario.seed);
      const paths = capture.rawDirectives.map((d) => (d.op === "create" ? d.create.pathTemplate : undefined));

      // Hardcoded literal, written directly in THIS test source — if the landed
      // REQ-FSC-05 pipeline does not chain multi-filter tokens, this assertion goes RED
      // and STAYS RED; the gap escalates via the `PC-SPEC-FSC-TOKENS` row (registered in
      // S-001's `openspec/pending-changes.md`), never a weakened assertion.
      expect(paths).toContain("m04-out/{= name | singular | dasherize =}.entity.ts");
    });

    it("renamed fixture proves the PINNED order — rename (original name) -> token translation -> `.template` strip", async () => {
      const scenario = SCENARIOS.find((s) => s.id === "m-04")!;
      const capture = await captureRun(scenario.run, scenario.input, scenario.seed);
      const paths = capture.rawDirectives.map((d) => (d.op === "create" ? d.create.pathTemplate : undefined));

      // Mirrors the spec's own worked example (`.service.` -> `.svc.`): had rename NOT
      // run first, the ORIGINAL "controller" segment (not "svc") would still be present
      // post-translation — this pins the ORDER, not merely the end result.
      expect(paths).toContain("m04-out/{= name | dasherize =}.svc.ts");
    });
  });

  describe("RPT-03 — concurrent named reports, same-scenario re-run leaves exactly one file", () => {
    it("at least two distinct matrix-row reports exist simultaneously as distinctly named files", () => {
      // The generic loop above already wrote a report per matrix row it captured;
      // sanity-check at least two distinct <matrix-id>.<slug>.report.md files coexist.
      const files = readdirSync(REPORTS_ABS_DIR).filter((f) => f.endsWith(".report.md"));
      const distinctMatrixIds = new Set(files.map((f) => f.split(".")[0]));
      expect(distinctMatrixIds.size).toBeGreaterThanOrEqual(2);
    });

    it("re-running the SAME scenario's report write leaves exactly one file at its pinned path", async () => {
      const scenario = SCENARIOS.find((s) => s.id === "m-01")!;
      const capture1 = await captureRun(scenario.run, scenario.input, scenario.seed);
      const record1 = buildRecord(capture1, { scenarioId: scenario.id, slug: scenario.slug });
      writeReport(scenario, record1, capture1);

      const capture2 = await captureRun(scenario.run, scenario.input, scenario.seed);
      const record2 = buildRecord(capture2, { scenarioId: scenario.id, slug: scenario.slug });
      writeReport(scenario, record2, capture2);

      const matchingFiles = readdirSync(REPORTS_ABS_DIR).filter((f) => f.startsWith(`${scenario.id}.${scenario.slug}.`));
      expect(matchingFiles).toHaveLength(1);
    });
  });
});
