# Fitness Guards Specification

**Spec version**: V2
**Status**: signed (owner, 2026-07-13)
**Change**: `author-emulation-e2e-scaffold`

V1 → V2 (council fixes applied): REQ-FTG-05 added (FIT-27 anti-tautology static scan —
mechanizes `golden-corpus-contract` REQ-GCC-05, QA-B2); FTG-01/FTG-02 note the
pre-merge RED-provability path via the REQ-GCC-12 skeleton record (gate-decoupling,
QA-minor); FTG-01 notes it is the WEAK determinism guard vs GCC-05's
regenerate-and-diff (QA-M-e). All V1 REQ-IDs preserved.

## Purpose

Pins the five fitness functions (FIT-23..27 — FIT-22 is already taken by
`schematic-local-files`'s `fit-22-scaffold-leaf-rule.test.ts` on origin) that guard the
invariants this change's shared infra depends on.

## Requirements

### REQ-FTG-01: FIT-23 — Corpus Byte-Determinism

A fitness test MUST run the full non-engine-gated scenario set twice IN-PROCESS and
assert the resulting corpus content is byte-identical both times — guards against
non-determinism silently creeping into the walk/capture/render pipeline
(`golden-corpus-contract` REQ-GCC-04). This same-process double-run is deliberately
the FAST, WEAK guard; the STRONG guard is the out-of-band regenerate-and-diff flow
(REQ-GCC-05 — fresh process, fresh state). Before `schematic-local-files` merges,
FIT-23 runs (and is RED-provable) against the REQ-GCC-12 skeleton record alone.

#### Scenario REQ-FTG-01.1: FIT-23 fails on injected non-determinism [SDK]

- GIVEN a deliberately injected source of nondeterminism (e.g. an unsorted walk order,
  or a timestamp leaked into a record)
- WHEN FIT-23 runs
- THEN it fails, naming the scenario whose corpus differed between the two runs

### REQ-FTG-02: FIT-24 — Corpus Purity

A fitness test MUST scan every committed corpus file for binary magic-byte sequences,
absolute-path-shaped strings, and non-deterministic-field shapes (timestamps,
durations, uuids/nonces — `golden-corpus-contract` REQ-GCC-06), failing if any are
found. Pre-merge, FIT-24 is RED-provable against the REQ-GCC-12 skeleton record.

#### Scenario REQ-FTG-02.1: FIT-24 fails on a corpus file containing an absolute path [SDK]

- GIVEN a committed corpus file deliberately containing an absolute filesystem path
  string
- WHEN FIT-24 runs
- THEN it fails, naming the offending file and the matched string

### REQ-FTG-03: FIT-25 — Single Capture Path

A fitness test MUST import-scan the corpus writer, the report renderer, and
`test/e2e/author-emulation-scaffold.e2e.test.ts`, asserting all three resolve the SAME
capture module (`ir-transcript-capture` REQ-ITC-02) and that no second capture module
exists in the change's file tree.

#### Scenario REQ-FTG-03.1: FIT-25 fails if a second capture module is introduced [SDK]

- GIVEN a deliberately introduced second, parallel capture module
- WHEN FIT-25 runs
- THEN it fails, naming both capture module candidates

### REQ-FTG-04: FIT-26 — Report Hygiene + Every Row Cites a REQ-ID

A fitness test MUST assert (a) `.gitignore` contains the report output pattern
(`run-report` REQ-RPT-02/03 — `test/e2e/author-emulation/reports/`), (b) the report
filename derives from a single pinned constant/function rather than ad hoc string
literals scattered across the suite, and (c) every row in the `scenario-matrix` table
cites at least one `schematic-local-files` REQ-ID or an explicit owner boundary
(D1-D4) — a row without a citation fails this fitness check.

#### Scenario REQ-FTG-04.1: FIT-26 fails on an uncited matrix row [SDK]

- GIVEN a scenario-matrix row deliberately stripped of its REQ-ID/boundary citation
- WHEN FIT-26 runs
- THEN it fails, naming the uncited row

### REQ-FTG-05: FIT-27 — Anti-Tautology Static Scan (No Test-Reachable Corpus Writer)

A fitness test MUST statically verify that NO module reachable from the test-imported
graph (`test/e2e/`, `test/support/`, and their transitive test-side imports) performs
a write to the corpus directory (`test/e2e/author-emulation/corpus/`) — the mechanical
enforcement of `golden-corpus-contract` REQ-GCC-05's tautology guard. The maintainer
regeneration script MUST live OUTSIDE the test-imported graph (e.g. under `scripts/`),
MUST NOT be imported by any test file, and MUST NOT be runnable by CI's test command.
FIT-27 is RED-provable pre-merge against the skeleton-record writer path
(REQ-GCC-12).

#### Scenario REQ-FTG-05.1: FIT-27 fails when a test-reachable module writes the corpus [SDK]

- GIVEN a deliberately added corpus-directory write inside a `test/support/` module
- WHEN FIT-27 runs
- THEN it fails, naming the offending module and the write call site

#### Scenario REQ-FTG-05.2: Regen script is outside the test-imported graph [SDK]

- GIVEN the maintainer regeneration script
- WHEN the test-imported graph is resolved
- THEN the script is not part of it, and no test file imports it

## Sensitive Areas Coverage

No sensitive areas covered — these are test-suite hygiene guards with no runtime
authority.
