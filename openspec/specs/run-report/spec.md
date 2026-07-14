# Run Report Specification

**Spec version**: V2
**Status**: signed (owner, 2026-07-13)
**Change**: `author-emulation-e2e-scaffold`

V1 → V2 (council fixes applied): REQ-RPT-01 re-grounded — `DryRunEntry.kind` VERIFIED
as an upstream-ADDED field landed on `origin/feat/schematic-local-files`
(`src/dry-run/plan.ts`, REQ-DRE-05; same merge gate as every scaffold scenario), and
the labels must derive from the SAME mechanism `dryRun()` uses, never a parallel map
(TW-B1 as downgraded + QA parallel-map-drift flag); REQ-RPT-03 pins the concrete
report path pattern (TW-B2); REQ-RPT-05 added (report content contract + seam
disclaimer + gap notice, TW-M-4). All V1 REQ-IDs preserved.

## Purpose

Pins the owner-stated report requirements (R1/R2, obs #937, verbatim) — the per-run
human-readable rendering of the captured transcript, kept strictly separate from the
committed golden corpus.

## Requirements

### REQ-RPT-01: Report Kind Labels Derive From the Upstream `DryRunEntry` Mechanism

The report MUST label each entry's classification with the `DryRunEntry.kind`
vocabulary — `"rendered"` | `"copied"` — an UPSTREAM-ADDED field landed by
`schematic-local-files` (`src/dry-run/plan.ts`, REQ-DRE-05; on
`origin/feat/schematic-local-files`, same merge gate as all scaffold scenarios). The
report's kind derivation MUST reuse the same mechanism `dryRun()` uses (the frozen
wire-op→verb/kind mapping of `dryRunPlan`/`WIRE_TO_AUTHOR_VERB`) — NEVER a parallel,
hand-rolled op→kind map that can drift from it. Vocabulary note: `rendered`/`copied`
are the AUTHOR-FACING strings; `by-value`/`by-reference` are transport jargon that
stays in spec/ADR prose, never on the report ([OWNER] ruling, upstream
`dry-run-plan-exposure` V3 header).

#### Scenario REQ-RPT-01.1: Report entries use rendered/copied, derived not duplicated [SDK]

- GIVEN a captured transcript with mixed by-value and by-reference entries
- WHEN the report is rendered
- THEN each entry's classification is exactly `"rendered"` or `"copied"`, produced via
  the same wire-op mapping `dryRun()` uses — and no second op→kind lookup table exists
  in the report renderer's source

### REQ-RPT-02: Output Is Gitignored (R1, Owner-Stated)

The report's output path/pattern MUST be added to `.gitignore`. `git status` MUST be
clean immediately after a run — the report is NEVER a tracked file.

#### Scenario REQ-RPT-02.1: git status is clean after a run [SDK]

- GIVEN a clean working tree and a full e2e suite run producing per-scenario reports
- WHEN `git status` is inspected afterward
- THEN it reports no untracked or modified files for the report output path

### REQ-RPT-03: Idempotent, Deterministic Filename and Pinned Path (R2, Owner-Stated)

Reports MUST be written to `test/e2e/author-emulation/reports/` (the `.gitignore`
entry is exactly that directory pattern), with per-scenario filename
`<matrix-id>.<slug>.report.md` (mirroring the corpus stem, `golden-corpus-contract`
REQ-GCC-10, with `.report.md` in place of `.transcript.json`). The filename is a
deterministic function of the scenario identity — never a timestamp or random suffix —
so a re-run of the SAME scenario overwrites the SAME file. Distinct scenarios running
concurrently under separate `bun test` workers MUST NOT collide on the same filename
(distinct matrix ids guarantee distinct names).

(Previously V1: determinism/idempotence required but directory, stem, and extension
were unpinned.)

#### Scenario REQ-RPT-03.1: Re-run overwrites; distinct scenarios never collide [SDK]

- GIVEN the same scenario run twice in succession, and two DIFFERENT scenarios run in
  the same suite invocation
- WHEN `test/e2e/author-emulation/reports/` is inspected after both runs
- THEN the same-scenario re-run leaves exactly one file (the second run's content), and
  the two different scenarios' reports exist as two distinctly named
  `<matrix-id>.<slug>.report.md` files

### REQ-RPT-04: No Committed Aggregate Report

No aggregate or rolled-up report file MAY be committed to the repository — only the
per-scenario corpus (`golden-corpus-contract` REQ-GCC-01) is committed; the report is
exclusively the gitignored per-run artifact.

#### Scenario REQ-RPT-04.1: No aggregate report file is tracked [SDK]

- GIVEN the repository's tracked files after this change lands
- WHEN searched for any rolled-up/aggregate report artifact
- THEN none exists — only the per-scenario corpus files are tracked

### REQ-RPT-05: Report Content — Entry Triple, Seam Disclaimer, Gap Notice

Each report entry MUST carry at least: the author verb, the primary path
(package-relative), and the kind label (REQ-RPT-01). The report header MUST carry, on
every report: (a) the seam disclaimer — the literal statement "IR captured at the
EngineClient seam — nothing was engine-rendered"; and (b) the gap notice naming
module-wiring, tsconfig-AST, and template rendering as not exercised (mirroring the
manifest's NOT-EXERCISED ledger, `golden-corpus-contract` REQ-GCC-08). A reader of one
report file alone MUST NOT be able to mistake it for evidence of rendered output.

#### Scenario REQ-RPT-05.1: Every report carries entries' triple and both header notices [SDK]

- GIVEN any rendered per-scenario report
- WHEN inspected
- THEN every entry shows verb + path + kind, and the header contains the seam
  disclaimer and the three-item gap notice

## Sensitive Areas Coverage

No sensitive areas covered — output-hygiene requirement with no runtime authority.
