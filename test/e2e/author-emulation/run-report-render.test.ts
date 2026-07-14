/**
 * Unit tests for `test/support/run-report-render.ts` (RPT-01/RPT-05, design.md R-D).
 * Synthetic `TranscriptRecord` + `rawDirectives` — never a `SCENARIOS` entry, since
 * report rendering for real matrix rows lands in S-003/S-004; these are render-CONTRACT
 * tests.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Directive } from "../../../src/core/wire.ts";
import {
  renderReport,
  reportPathFor,
  REPORTS_DIR,
  SEAM_DISCLAIMER,
  GAP_NOTICE,
} from "../../support/run-report-render.ts";
import { FORMAT_VERSION, type TranscriptRecord } from "../../support/corpus-format.ts";
import { specifiersResolvingInto, stripComments } from "../../support/import-scan.ts";

const RENDERER_SOURCE_PATH = new URL("../../support/run-report-render.ts", import.meta.url).pathname;
const DRY_RUN_PLAN_PATH = new URL("../../../src/dry-run/plan.ts", import.meta.url).pathname;
const PARALLEL_MAP_FIXTURE = new URL(
  "../../fixtures/red/author-emulation/parallel-kind-map-renderer.ts",
  import.meta.url
).pathname;

/**
 * Detects a hand-rolled op→kind mapping in VALUE position — the parallel-map drift
 * REQ-RPT-01.1 bans. Three shapes cover the realistic implementations of such a map;
 * `renderEntryLine`'s legitimate TYPE annotation (`kind?: "rendered" | "copied"`) matches
 * none of them (its key is `kind`, not a wire-op name, and a type union is not a
 * key:value pair keyed by an op).
 */
function parallelKindMapMatches(source: string): string[] {
  const withoutComments = stripComments(source);
  const PATTERNS: readonly RegExp[] = [
    // object-literal map: { create: "rendered", copyIn: "copied" }
    /\b(create|copyIn|modify|delete|rename|move|copy)\s*:\s*["'`](rendered|copied)["'`]/g,
    // switch-based map: case "create": return "rendered"
    /case\s+["'`][^"'`]+["'`]\s*:\s*(?:return\s+)?["'`](rendered|copied)["'`]/g,
    // ternary map: d.op === "create" ? "rendered" : "copied"
    /\?\s*["'`](rendered|copied)["'`]\s*:\s*["'`](rendered|copied)["'`]/g,
  ];
  return PATTERNS.flatMap((re) => [...withoutComments.matchAll(re)].map((m) => m[0]));
}

function baseRecord(overrides: Partial<TranscriptRecord>): TranscriptRecord {
  return {
    formatVersion: FORMAT_VERSION,
    scenarioId: "m-01",
    slug: "happy-path-full-generator",
    normative: { outcome: "committed", directives: [] },
    informative: { batchGrouping: [] },
    ...overrides,
  };
}

describe("run-report-render — header carries the seam disclaimer + 3-item gap notice verbatim (RPT-05)", () => {
  it("every rendered report's header contains the literal seam disclaimer", () => {
    const record = baseRecord({});
    const report = renderReport(record, []);

    expect(report.includes("IR captured at the EngineClient seam — nothing was engine-rendered")).toBe(true);
  });

  it("every rendered report's header names all three NOT-EXERCISED items", () => {
    const record = baseRecord({});
    const report = renderReport(record, []);

    expect(report.includes("module-wiring")).toBe(true);
    expect(report.includes("tsconfig-AST")).toBe(true);
    expect(report.includes("template rendering")).toBe(true);
  });

  it("SEAM_DISCLAIMER and GAP_NOTICE are exported as the exact literal constants asserted above", () => {
    expect(SEAM_DISCLAIMER).toEqual("IR captured at the EngineClient seam — nothing was engine-rendered");
    // Full-literal equality: a fourth item (or reworded third) silently joining the
    // notice must fail loudly, not slip past a containment check.
    expect(GAP_NOTICE).toEqual("NOT EXERCISED at this seam: module-wiring, tsconfig-AST, template rendering");
  });
});

describe("run-report-render — committed entries show verb+path+kind, derived via dryRunPlan (RPT-01/RPT-05)", () => {
  it("a mixed create+copyIn directive set renders one line per entry with the correct verb, path, and kind", () => {
    const rawDirectives: Directive[] = [
      { op: "create", create: { pathTemplate: "src/widget.entity.ts", template: "x", options: {} } },
      { op: "copyIn", copyIn: { from: "assets/logo.png", to: "assets/logo.png" } },
    ];
    const record = baseRecord({
      normative: {
        outcome: "committed",
        directives: [
          { op: "create", pathTemplate: "src/widget.entity.ts", template: "x", options: {}, force: false },
          { op: "copyIn", from: "assets/logo.png", to: "assets/logo.png", force: false },
        ],
      },
    });

    const report = renderReport(record, rawDirectives);

    expect(report.includes("create") && report.includes("src/widget.entity.ts") && report.includes("rendered")).toBe(
      true
    );
    expect(report.includes("copyIn") && report.includes("assets/logo.png") && report.includes("copied")).toBe(true);
  });
});

describe("run-report-render — rejection record shows the full attribution triple, no entries", () => {
  it("a rejected record's report carries reason, verb, and path", () => {
    const record = baseRecord({
      normative: {
        outcome: "rejected",
        directives: [],
        rejection: { reason: "invalid-input", verb: "create", path: "c.ts" },
      },
    });

    const report = renderReport(record, []);

    expect(report.includes("invalid-input")).toBe(true);
    expect(report.includes("create")).toBe(true);
    expect(report.includes("c.ts")).toBe(true);
  });
});

describe("run-report-render — an empty committed record (M-14) renders no entry lines", () => {
  it("a zero-directive committed record's report contains no verb/path entry line", () => {
    const record = baseRecord({ normative: { outcome: "committed", directives: [] } });

    const report = renderReport(record, []);

    expect(report.includes("- ")).toBe(false);
  });
});

describe("run-report-render — REPORTS_DIR/reportPathFor are the single pinned path source (FIT-26)", () => {
  it("reportPathFor derives the report filename from REPORTS_DIR alone", () => {
    expect(reportPathFor("m-01", "happy-path-full-generator")).toEqual(
      `${REPORTS_DIR}/m-01.happy-path-full-generator.report.md`
    );
  });
});

describe("run-report-render — no second op→kind lookup table exists in the renderer's source (RPT-01.1)", () => {
  it("the renderer imports dryRunPlan from src/dry-run/plan.ts — the one kind mechanism", () => {
    const source = readFileSync(RENDERER_SOURCE_PATH, "utf-8");
    const resolved = specifiersResolvingInto(source, dirname(RENDERER_SOURCE_PATH), DRY_RUN_PLAN_PATH);
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("the renderer's source contains no value-position op→kind mapping", () => {
    const source = readFileSync(RENDERER_SOURCE_PATH, "utf-8");
    expect(parallelKindMapMatches(source)).toEqual([]);
  });

  // RED-PROOF: a renderer-shaped module carrying a literal { create: "rendered",
  // copyIn: "copied" } map is detected — proves the scan discriminates a real parallel
  // map from the legitimate type annotation.
  it("[red-proof] a planted hand-rolled op→kind map is detected", () => {
    const source = readFileSync(PARALLEL_MAP_FIXTURE, "utf-8");
    const matches = parallelKindMapMatches(source);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.join(" ")).toContain("rendered");
  });

  // RED-PROOF (no false positive): the type-annotation shape alone never triggers.
  it("[red-proof] a kind type annotation is NOT flagged as a parallel map", () => {
    const source = `function f(entry: { verb: string; path: string; kind?: "rendered" | "copied" }) { return entry; }`;
    expect(parallelKindMapMatches(source)).toEqual([]);
  });
});
