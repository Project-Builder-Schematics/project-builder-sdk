/**
 * Unit tests for `test/support/run-report-render.ts` (RPT-01/RPT-05, design.md R-D).
 * Synthetic `TranscriptRecord` + `rawDirectives` — never a `SCENARIOS` entry, since
 * report rendering for real matrix rows lands in S-003/S-004; these are render-CONTRACT
 * tests.
 */
import { describe, it, expect } from "bun:test";
import type { Directive } from "../../../src/core/wire.ts";
import {
  renderReport,
  reportPathFor,
  REPORTS_DIR,
  SEAM_DISCLAIMER,
  GAP_NOTICE,
} from "../../support/run-report-render.ts";
import { FORMAT_VERSION, type TranscriptRecord } from "../../support/corpus-format.ts";

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
    expect(GAP_NOTICE.includes("module-wiring")).toBe(true);
    expect(GAP_NOTICE.includes("tsconfig-AST")).toBe(true);
    expect(GAP_NOTICE.includes("template rendering")).toBe(true);
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
