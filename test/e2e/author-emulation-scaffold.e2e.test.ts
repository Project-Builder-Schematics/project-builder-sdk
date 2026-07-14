/**
 * e2e — author-emulation scaffold family (S-000 walking skeleton + S-003 happy-path
 * matrix rows + S-004 batch-cap/containment/rejection-boundary rows).
 *
 * Drives the SCENARIOS registry through `captureRun`, and compares a FRESH serialization
 * against the committed corpus byte-for-byte — a drift fails the suite, and no code path
 * here writes a new corpus file to make it pass (GCC-05 tautology guard). For every
 * MATRIX row (never `s-00`, design ruling R-B), it also renders and writes the per-run
 * report (`renderReport`/`reportPathFor`) — the report side-output design.md assigns to
 * this file.
 *
 * NEVER `scaffold.e2e.test.ts` — that filename is owned upstream by `schematic-local-files`
 * (ITC-04).
 */
import { describe, it, expect } from "bun:test";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { captureRun, type CaptureResult } from "../support/ir-transcript.ts";
import {
  buildRecord,
  corpusFileNameFor,
  serializeCorpus,
  FORMAT_VERSION,
  type TranscriptRecord,
} from "../support/corpus-format.ts";
import { renderReport, reportPathFor, REPORTS_DIR } from "../support/run-report-render.ts";
import { instrumentHarnessIO } from "../support/harness-io-instrumentation.ts";
import { expectReasonAsync } from "../support/expect-reason.ts";
import { SCENARIOS, type ScenarioEntry } from "./author-emulation/scenarios.ts";
import {
  SCAFFOLD_CALL_ARGS,
  runM02MissingFrom,
  runM02MissingTo,
  runM07,
  runM11OverCap,
  runM12Oversized,
  runM16Absolute,
  runM17Existing,
  runWalkOrderDiscriminator,
  M07_HUGE_FILE_NAME,
  M09_FILE_COUNT,
  M21_COLLISION_SEED_PATH,
  WALK_ORDER_CREATION_SEQUENCE,
} from "../fixtures/author-emulation/factory.ts";
import type { ScaffoldOptions } from "../../src/commons/index.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";

const CORPUS_DIR = new URL("./author-emulation/corpus/", import.meta.url).pathname;
const REPORTS_ABS_DIR = join(process.cwd(), REPORTS_DIR);

// R-B: `s-00` is the infra-spine skeleton, not a matrix row — it never gets a report
// (`DryRunEntry.kind` is absent by contract for the six pre-existing ops it exercises).
function isReportableMatrixRow(scenario: ScenarioEntry): boolean {
  return scenario.id !== "s-00";
}

// Lazy per-scenario capture cache: every assertion block below that only inspects a
// scenario's RESULT (corpus content, directive shape, rejection triple, report content)
// shares ONE `captureRun` per scenario id rather than re-materializing its fixtures
// (some, e.g. M-07/M-09/M-21, are multi-MiB scratch dirs) on every re-run. Safe because
// FIT-23 independently certifies `captureRun` is byte-identical across re-runs of the
// SAME scenario — reusing the result changes nothing about what gets asserted.
// EXCEPTION: the M-07 block below wraps its OWN `captureRun` in `instrumentHarnessIO()`
// to observe fs calls DURING that exact invocation — routing it through this cache would
// make the instrumentation observe nothing (a resolved promise, not a live call), so it
// deliberately keeps its own uncached call.
const captureCache = new Map<string, Promise<CaptureResult>>();

function cachedCapture(scenario: ScenarioEntry): Promise<CaptureResult> {
  const cached = captureCache.get(scenario.id);
  if (cached !== undefined) return cached;
  const promise = captureRun(scenario.run, scenario.input, scenario.seed);
  captureCache.set(scenario.id, promise);
  return promise;
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
      const capture = await cachedCapture(scenario);
      const record = buildRecord(capture, { scenarioId: scenario.id, slug: scenario.slug });
      const fresh = serializeCorpus(record);

      const committedPath = join(CORPUS_DIR, corpusFileNameFor(scenario.id, scenario.slug));
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
      const capture = await cachedCapture(scenario);
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
    const scenario = SCENARIOS.find((s) => s.id === "m-09")!;
    const capture = await cachedCapture(scenario);

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
      const capture = await cachedCapture(scenario);
      const paths = capture.rawDirectives.map((d) => (d.op === "create" ? d.create.pathTemplate : undefined));

      // Hardcoded literal, written directly in THIS test source — if the landed
      // REQ-FSC-05 pipeline does not chain multi-filter tokens, this assertion goes RED
      // and STAYS RED; the gap escalates via the `PC-SPEC-FSC-TOKENS` row (registered in
      // S-001's `openspec/pending-changes.md`), never a weakened assertion.
      expect(paths).toContain("m04-out/{= name | singular | dasherize =}.entity.ts");
    });

    it("renamed fixture proves the PINNED order — rename (original name) -> token translation -> `.template` strip", async () => {
      const scenario = SCENARIOS.find((s) => s.id === "m-04")!;
      const capture = await cachedCapture(scenario);
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
      // The property under test is the WRITE's own overwrite behavior (mkdirSync +
      // writeFileSync at the same pinned path), not capture determinism (FIT-23 already
      // owns that) — rendering twice from the SAME capture exercises it identically.
      const scenario = SCENARIOS.find((s) => s.id === "m-01")!;
      const capture = await cachedCapture(scenario);
      const record = buildRecord(capture, { scenarioId: scenario.id, slug: scenario.slug });
      writeReport(scenario, record, capture);
      writeReport(scenario, record, capture);

      const matchingFiles = readdirSync(REPORTS_ABS_DIR).filter((f) => f.startsWith(`${scenario.id}.${scenario.slug}.`));
      expect(matchingFiles).toHaveLength(1);
    });
  });
});

describe("S-004 — matrix-row assertions beyond the generic corpus-compare (batch-cap, containment, rejection boundaries)", () => {
  /** SCM-05: every rejection-outcome row's e2e assertion covers the FULL attribution
   * triple — reason, verb, path — explicitly, even when verb/path are `null` (never
   * "reason alone"). Looks the scenario up by id so it always exercises the SAME
   * registry entry the generic corpus-compare loop above already byte-verified. */
  async function assertRejectionTriple(
    scenarioId: string,
    expected: { reason: string; verb: string | null; path: string | null }
  ): Promise<CaptureResult> {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
    const capture = await cachedCapture(scenario);
    const record = buildRecord(capture, { scenarioId: scenario.id, slug: scenario.slug });
    expect(record.normative.outcome).toEqual("rejected");
    expect(record.normative.directives).toEqual([]);
    expect(record.normative.rejection).toEqual(expected);
    return capture;
  }

  it("M-08 / REQ-CCL-05.1 — binary `.template` in a scaffold walk fails loud, full triple asserted", async () => {
    // `invalidInput()`'s producer site never attributes a directive (verb/path both
    // `undefined` -> `null`) — the walk rejects before classify-transport ever returns.
    await assertRejectionTriple("m-08", { reason: "invalid-input", verb: null, path: null });
  });

  it("M-10 / batch-cap REQ-04.2 — a single group's own batch exceeding cap still rejects, full triple asserted", async () => {
    // `EmitRejection("cap", ...)` is thrown WITHOUT a `pos` (`emit-rejection.ts`'s own
    // JSDoc: "cap"/"unrepresentable"/"unknown" are BATCH-level, no single offending
    // directive) — `verb`/`path` are `undefined` -> `null` on every batch-cap rejection,
    // never `M10_GIANT_PATH` despite it being the batch's only directive.
    await assertRejectionTriple("m-10", { reason: "changes-too-large", verb: null, path: null });
  });

  describe("M-11 / batch-cap REQ-04.3 — exactly-at-cap passes; one-byte-over rejects (pins `>` not `>=`)", () => {
    it("at-cap scenario commits (corpus-canonical)", async () => {
      const scenario = SCENARIOS.find((s) => s.id === "m-11")!;
      const capture = await cachedCapture(scenario);
      expect(capture.error).toBeUndefined();
      expect(capture.record.normative.outcome).toEqual("committed");
    });

    it("one-byte-over rejects `changes-too-large` (e2e-inline-only, never corpus-captured — the boundary's OTHER side)", async () => {
      const capture = await captureRun(runM11OverCap, { name: "Widgets" });
      expect(capture.error).toBeInstanceOf(AuthoringError);
      const err = capture.error as AuthoringError;
      // Batch-level rejection (see M-10's comment) — verb/path are null despite
      // `M11_OVER_CAP_PATH` being the batch's only directive.
      expect({ reason: err.reason, verb: err.verb ?? null, path: err.path ?? null }).toEqual({
        reason: "changes-too-large",
        verb: null,
        path: null,
      });
    });
  });

  describe("M-12 / REQ-FEH-02.1/.2 — templateFile binary/oversized fails loud, never silently copies", () => {
    it("binary templateFile fails loud (corpus-canonical), full triple asserted", async () => {
      await assertRejectionTriple("m-12", { reason: "invalid-input", verb: null, path: null });
    });

    it("oversized templateFile fails loud (e2e-inline-only, never corpus-captured — the OTHER FEH-02 variant)", async () => {
      const capture = await captureRun(runM12Oversized, { name: "Widgets" });
      expect(capture.error).toBeInstanceOf(AuthoringError);
      expect((capture.error as AuthoringError).reason).toEqual("invalid-input");
    });
  });

  it("M-13 / REQ-FSC-04.2 — filters eliminate every entry, full triple asserted", async () => {
    // Same `invalidInput()` shape as M-08/M-12/M-15 (verb/path both null) — GCC-09.1's own
    // illustration shows M-13 with a concrete `path`; the LANDED API mints none (see this
    // slice's apply-progress note on the divergence).
    await assertRejectionTriple("m-13", { reason: "invalid-input", verb: null, path: null });
  });

  it("M-15 / REQ-FSC-08.1 / SCM-05.1 — intra-scaffold destination collision, full triple asserted", async () => {
    // `detectDestinationCollisions` names both offending sources in the free-text MESSAGE
    // only (GCC-09 excludes message text from the record) — the attribution triple itself
    // carries no path (invalidInput() shape).
    await assertRejectionTriple("m-15", { reason: "invalid-input", verb: null, path: null });
  });

  describe("M-16 / REQ-PRC-04.1/.6 — traversal / absolute source path rejected, containment cited", () => {
    it("traversal source rejects (corpus-canonical), full triple asserted", async () => {
      await assertRejectionTriple("m-16", {
        reason: "source-outside-package",
        verb: null,
        path: "../m16-traversal-outside.txt",
      });
    });

    it("absolute source rejects with the SAME reason (e2e-inline-only — a literal absolute path embedded verbatim would trip FIT-24's purity guard, so this variant is never corpus-captured)", async () => {
      const capture = await captureRun(runM16Absolute, { name: "Widgets" });
      expect(capture.error).toBeInstanceOf(AuthoringError);
      expect((capture.error as AuthoringError).reason).toEqual("source-outside-package");
    });
  });

  describe("M-17 / REQ-PRC-07.1 — no-existence-oracle for out-of-ceiling paths", () => {
    it("non-existing target rejects (corpus-canonical), full triple asserted", async () => {
      await assertRejectionTriple("m-17", {
        reason: "source-outside-package",
        verb: null,
        path: "../m17-nonexistent-outside.txt",
      });
    });

    it("an EXISTING out-of-ceiling target rejects with the IDENTICAL reason and message shape (modulo path text) — proving the verdict never consults existence", async () => {
      const nonExisting = await assertRejectionTriple("m-17", {
        reason: "source-outside-package",
        verb: null,
        path: "../m17-nonexistent-outside.txt",
      });
      const existingCapture = await captureRun(runM17Existing, { name: "Widgets" });
      expect(existingCapture.error).toBeInstanceOf(AuthoringError);
      const existingErr = existingCapture.error as AuthoringError;
      const nonExistingErr = nonExisting.error as AuthoringError;
      expect(existingErr.reason).toEqual(nonExistingErr.reason);
      // "Identical message shape, modulo path text": strip each error's OWN attributed
      // path substring, then compare the remaining template text.
      expect(existingErr.message.replace(existingErr.path ?? "", "<path>")).toEqual(
        nonExistingErr.message.replace(nonExistingErr.path ?? "", "<path>")
      );
    });
  });

  it("M-18 / REQ-BRC-06.1 — missing in-ceiling source surfaces source-not-found, full triple asserted", async () => {
    await assertRejectionTriple("m-18", { reason: "source-not-found", verb: null, path: "missing.txt" });
  });

  it("M-21 / batch-cap REQ-05.1 — cross-chunk atomicity: a later-flush rejection commits nothing from earlier chunks", async () => {
    const capture = await assertRejectionTriple("m-21", {
      reason: "path-collision",
      verb: "create",
      path: M21_COLLISION_SEED_PATH,
    });
    expect(capture.tree.size).toEqual(0); // first chunk discarded, run-level all-or-nothing
    expect(capture.emitted.length).toBeGreaterThan(1); // proves >=2 flushes actually occurred
  });
});
