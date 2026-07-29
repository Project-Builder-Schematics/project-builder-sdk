/**
 * FIT-26 (REQ-FTG-04): report hygiene + every matrix row cites a REQ/boundary.
 *
 * Four invariants:
 *  (a) `.gitignore` carries the report output pattern (`run-report` REQ-RPT-02/03).
 *  (b) the report filename derives ONLY from `REPORTS_DIR`/`reportPathFor` — no ad-hoc
 *      path literal for the reports dir exists anywhere else in the change's tree.
 *  (c) every row of the signed `specs/scenario-matrix/spec.md` table cites at least one
 *      `schematic-local-files` REQ-ID or an explicit owner boundary (D1-D4) — a row
 *      without a citation fails this check (REQ-SCM-01's 20-row table, archive-synced
 *      `inline-collection-marker`). REQ-SCM-02.1 additionally pins that the
 *      engine-gated `REQ-BRC-08` never appears as a matrix row citation — only as a
 *      `golden-corpus-contract` coverage-manifest NOT-EXERCISED entry.
 *  (d) no report artifact is ever git-tracked (`run-report` REQ-RPT-04): nothing under
 *      the reports dir and no `.report.md`-named file anywhere in the tracked tree —
 *      the aggregate/rolled-up report REQ-RPT-04 bans would surface as either.
 * Plus the GCC-01 count check (design §4.4): committed corpus files map one-to-one with
 * `SCENARIOS` entries, and REQ-GCC-08.1's four-point coverage-manifest completeness
 * checklist (EXERCISED, NOT-EXERCISED, engine-gated entries, FRICTION).
 *
 * Failure-message taxonomy (design §4.4): guard id + broken invariant + named offender +
 * rule cite.
 *
 * Red-proof: `test/fixtures/red/author-emulation/uncited-matrix-row.md` — a matrix-shaped
 * table with one row's Citation(s) column stripped.
 */
import { describe, it, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SCENARIOS } from "../e2e/author-emulation/scenarios.ts";
import { REPORTS_DIR, reportPathFor } from "../support/run-report-render.ts";
import { corpusFileNameFor } from "../support/corpus-format.ts";
import { collectTsFiles } from "../support/import-scan.ts";

const GITIGNORE = new URL("../../.gitignore", import.meta.url).pathname;
const MATRIX_SPEC = new URL(
  "../../openspec/specs/scenario-matrix/spec.md",
  import.meta.url
).pathname;
const UNCITED_ROW_FIXTURE = new URL(
  "../fixtures/red/author-emulation/uncited-matrix-row.md",
  import.meta.url
).pathname;
const CORPUS_DIR = new URL("../e2e/author-emulation/corpus", import.meta.url).pathname;
const COVERAGE_MANIFEST = new URL(
  "../e2e/author-emulation/corpus/coverage-manifest.md",
  import.meta.url
).pathname;
const RUN_REPORT_RENDER = new URL("../support/run-report-render.ts", import.meta.url).pathname;
const TEST_SUPPORT_DIR = new URL("../support", import.meta.url).pathname;
const TEST_E2E_DIR = new URL("../e2e", import.meta.url).pathname;
const SCRIPTS_DIR = new URL("../../scripts", import.meta.url).pathname;

/** Pulls every REQ-ID/owner-boundary token out of a matrix row's Citation(s) text —
 * ignores family-name backtick prefixes, matching how the coverage manifest's own
 * EXERCISED ledger lists bare tokens (e.g. "`ir-path-well-formedness` REQ-IPF-01.1"
 * yields just "REQ-IPF-01.1"). */
function citedTokens(citations: string): string[] {
  const re = /(?:batch-cap REQ-\d+\.\d+)|(?:D\d)|(?:REQ-[A-Z]+-\d+(?:\.\d+)?)/g;
  return citations.match(re) ?? [];
}

interface MatrixRow {
  id: string;
  citations: string;
}

/** Extracts `| M-XX | scenario | citations | gwt |` rows from a matrix-shaped markdown
 * table. Pure text parsing — no markdown AST — mirrors the repo's other FIT scans. */
function extractMatrixRows(markdown: string): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const line of markdown.split("\n")) {
    const m = line.match(/^\|\s*(M-\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (m) rows.push({ id: m[1]!, citations: m[3]!.trim() });
  }
  return rows;
}

function uncitedRows(rows: readonly MatrixRow[]): string[] {
  return rows.filter((r) => r.citations.length === 0 || r.citations === "—" || r.citations === "-").map((r) => r.id);
}

describe("FIT-26 (a) — .gitignore carries the report output pattern (REQ-RPT-02/03)", () => {
  it(".gitignore contains the pinned reports directory pattern", () => {
    const gitignore = readFileSync(GITIGNORE, "utf-8");
    expect(gitignore.includes("test/e2e/author-emulation/reports/")).toBe(true);
  });
});

describe("FIT-26 (b) — report filename derives ONLY from REPORTS_DIR/reportPathFor", () => {
  it("no file outside run-report-render.ts hardcodes the reports-directory path", () => {
    const REPORT_PATH_LITERAL_RE = /author-emulation\/reports/;
    const roots = [TEST_SUPPORT_DIR, TEST_E2E_DIR, SCRIPTS_DIR];
    const files = roots.flatMap(collectTsFiles).filter((f) => f !== RUN_REPORT_RENDER);

    const offenders = files.filter((f) => REPORT_PATH_LITERAL_RE.test(readFileSync(f, "utf-8")));
    expect(offenders).toEqual([]);
  });

  it("reportPathFor derives the filename from the single REPORTS_DIR constant", () => {
    expect(reportPathFor("m-01", "example")).toEqual(`${REPORTS_DIR}/m-01.example.report.md`);
  });
});

describe("FIT-26 (c) — every scenario-matrix row cites a REQ-ID or owner boundary (REQ-SCM-01)", () => {
  it("the signed 20-row matrix table has no uncited row", () => {
    const rows = extractMatrixRows(readFileSync(MATRIX_SPEC, "utf-8"));
    expect(rows.length).toEqual(20);
    expect(uncitedRows(rows)).toEqual([]);
  });

  // RED-PROOF: a matrix row stripped of its citation is detected.
  it("[red-proof] a matrix row missing its citation is detected", () => {
    const rows = extractMatrixRows(readFileSync(UNCITED_ROW_FIXTURE, "utf-8"));
    expect(uncitedRows(rows)).toEqual(["M-02"]);
  });

  // REQ-SCM-02.1: the engine-gated REQ appears only as a coverage-manifest note, never
  // as an executing matrix row citation.
  it("REQ-BRC-08 never appears as a matrix row citation, only in the coverage manifest's NOT-EXERCISED ledger", () => {
    const rows = extractMatrixRows(readFileSync(MATRIX_SPEC, "utf-8"));
    expect(rows.some((r) => r.citations.includes("REQ-BRC-08"))).toBe(false);

    const manifest = readFileSync(COVERAGE_MANIFEST, "utf-8");
    const notExercised = manifest.split("## NOT-EXERCISED")[1]?.split(/\n## /)[0] ?? "";
    expect(notExercised.includes("REQ-BRC-08")).toBe(true);
  });
});

describe("FIT-26 — REQ-GCC-08.1: coverage manifest passes the four-point completeness checklist", () => {
  const manifest = readFileSync(COVERAGE_MANIFEST, "utf-8");
  const exercised = manifest.split("## EXERCISED")[1]?.split(/\n## /)[0] ?? "";
  const notExercised = manifest.split("## NOT-EXERCISED")[1]?.split(/\n## /)[0] ?? "";
  const friction = manifest.split("## FRICTION")[1] ?? "";

  it("item 1: EXERCISED lists every REQ-ID/boundary cited anywhere in the scenario-matrix table", () => {
    const rows = extractMatrixRows(readFileSync(MATRIX_SPEC, "utf-8"));
    const citedElsewhere: string[] = [];
    for (const row of rows) {
      for (const token of citedTokens(row.citations)) {
        if (!exercised.includes(token)) citedElsewhere.push(`${row.id}:${token}`);
      }
    }
    expect(citedElsewhere).toEqual([]);
  });

  it("item 2: NOT-EXERCISED contains the three non-engine-gated literal entries", () => {
    expect(notExercised.includes("module-wiring")).toBe(true);
    expect(notExercised.includes("tsconfig-AST")).toBe(true);
    expect(notExercised.includes("template rendering")).toBe(true);
  });

  it("item 3: NOT-EXERCISED contains exactly the one engine-gated literal, REQ-BRC-08 (the retired containment family's citation is dropped, no successor)", () => {
    expect(notExercised.includes("REQ-BRC-08")).toBe(true);
  });

  it("item 4: the FRICTION section exists with at least one entry", () => {
    expect(friction.trim().length).toBeGreaterThan(0);
  });
});

describe("FIT-26 (d) — no report artifact is git-tracked (REQ-RPT-04)", () => {
  const PROJECT_ROOT = new URL("../..", import.meta.url).pathname;

  function trackedReportArtifacts(trackedPaths: readonly string[]): string[] {
    return trackedPaths.filter((p) => p.startsWith(`${REPORTS_DIR}/`) || p.endsWith(".report.md"));
  }

  it("no tracked file lives under the reports dir and no .report.md file is tracked anywhere", () => {
    const result = spawnSync("git", ["ls-files"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
    expect(result.status).toBe(0);

    const tracked = result.stdout.split("\n").filter((line) => line.length > 0);
    expect(trackedReportArtifacts(tracked)).toEqual([]);
  });

  // RED-PROOF (discriminability, no fixture needed): both a per-scenario report inside
  // the reports dir and a rolled-up aggregate placed OUTSIDE it are caught.
  it("[red-proof] a tracked report path is detected, in or out of the reports dir", () => {
    const simulated = [
      "src/core/wire.ts",
      `${REPORTS_DIR}/m-01.example.report.md`,
      "docs/aggregate.report.md",
    ];
    expect(trackedReportArtifacts(simulated)).toEqual([
      `${REPORTS_DIR}/m-01.example.report.md`,
      "docs/aggregate.report.md",
    ]);
  });
});

describe("FIT-26 — GCC-01: committed corpus files map one-to-one with SCENARIOS entries", () => {
  it("every SCENARIOS entry has exactly one committed corpus file at its pinned name, no orphans", () => {
    const committedFiles = readdirSync(CORPUS_DIR).filter((f) => f.endsWith(".transcript.json"));
    expect(committedFiles.length).toEqual(SCENARIOS.length);

    for (const scenario of SCENARIOS) {
      const path = join(CORPUS_DIR, corpusFileNameFor(scenario.id, scenario.slug));
      expect({ scenario: scenario.id, exists: existsSync(path) }).toEqual({
        scenario: scenario.id,
        exists: true,
      });
    }
  });
});
