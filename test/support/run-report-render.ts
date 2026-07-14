// R-D: renders a human-readable, gitignored per-run report from an ALREADY-captured
// transcript — the report's entry lines derive via `dryRunPlan(rawDirectives)` (the SAME
// mechanism `dryRun()` uses), NEVER from `record.normative.directives` and NEVER a
// parallel hand-rolled op->kind map (RPT-01, FIT-26's no-parallel-map scan). This module
// does not itself capture anything — it takes the capture's output as input, so it never
// imports `ir-transcript.ts` (FIT-25 scope).
import type { Directive } from "../../src/core/wire.ts";
import { dryRunPlan } from "../../src/dry-run/plan.ts";
import type { TranscriptRecord } from "./corpus-format.ts";

export const REPORTS_DIR = "test/e2e/author-emulation/reports";

/** `<matrix-id>.<slug>.report.md` (RPT-03) — mirrors the corpus stem, `.report.md` in
 * place of `.transcript.json`. The ONE pinned name-building function (FIT-26). */
export function reportPathFor(id: string, slug: string): string {
  return `${REPORTS_DIR}/${id}.${slug}.report.md`;
}

export const SEAM_DISCLAIMER = "IR captured at the EngineClient seam — nothing was engine-rendered";

// RPT-05: names exactly the three NOT-EXERCISED items, mirroring the coverage manifest's
// ledger (GCC-08) — a reader of one report file alone must not mistake it for evidence of
// rendered output.
export const GAP_NOTICE =
  "NOT EXERCISED at this seam: module-wiring, tsconfig-AST, template rendering";

function renderHeader(record: TranscriptRecord): string {
  return `# ${record.scenarioId} (${record.slug})\n\n${SEAM_DISCLAIMER}\n\n${GAP_NOTICE}\n`;
}

function renderEntryLine(entry: { verb: string; path: string; kind?: "rendered" | "copied" }): string {
  // `kind` is absent for the non-package-local-read verbs (modify/remove/rename/move/
  // copy) `dryRunPlan` also serves — never reachable here, since `ir-transcript.ts`
  // normalizes only create/copyIn (ITC-05). Rendered defensively rather than assumed.
  const kindSuffix = entry.kind !== undefined ? ` (${entry.kind})` : "";
  return `- ${entry.verb} ${entry.path}${kindSuffix}`;
}

/**
 * Renders one of three templates — success (committed, ≥1 entry), rejection, or empty
 * (committed, zero entries, REQ-ITC-01.2/M-14) — from an already-captured transcript.
 * Entry lines derive from `dryRunPlan(rawDirectives)` (R-D): NEVER from
 * `record.normative.directives`, NEVER a parallel op→kind map (RPT-01).
 */
export function renderReport(record: TranscriptRecord, rawDirectives: readonly Directive[]): string {
  const header = renderHeader(record);

  if (record.normative.outcome === "rejected") {
    const rejection = record.normative.rejection;
    if (rejection === undefined) {
      throw new Error(`run-report-render: rejected outcome for "${record.scenarioId}" carries no rejection triple`);
    }
    return (
      `${header}\n## Outcome: rejected\n\n` +
      `- reason: ${rejection.reason}\n- verb: ${rejection.verb ?? "null"}\n- path: ${rejection.path ?? "null"}\n`
    );
  }

  const entries = dryRunPlan(rawDirectives);
  if (entries.length === 0) {
    return `${header}\n## Outcome: committed (empty)\n\nNo directives emitted.\n`;
  }

  return `${header}\n## Outcome: committed\n\n${entries.map(renderEntryLine).join("\n")}\n`;
}
