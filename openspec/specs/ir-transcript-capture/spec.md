# IR Transcript Capture Specification

**Spec version**: V2
**Status**: signed (owner, 2026-07-13)
**Change**: `author-emulation-e2e-scaffold`

V1 → V2 (council fixes applied): REQ-ITC-01 body clarifies the wrapper's VALUE-ADD
(it constructs the normalized transcript record downstream REQs assert against — never
a bare pass-through, QA-minor) and gains scenario .2 (zero-emission run captures an
empty transcript, BA-minor — the committed-record half is matrix row M-14). All V1
REQ-IDs preserved.

V2 micro-unfreeze 1 (owner-approved 2026-07-13): REQ-ITC-01 wrap target corrected
makeSpyClient → runFactoryForTest (architect P1, orchestrator-verified factual
citation error — `runFactoryForTest` inlines its own recording client, never uses
`makeSpyClient`, and is the only primitive exposing the terminal outcome that
REQ-GCC-09 rejection records and matrix row M-21 require). No REQ-IDs changed, no
scenarios added/removed.

## Purpose

Defines the shared run-level `Batch[]` capture module — the seam future
per-mutation-family e2e changes reuse — and pins its placement, single-capture-path
invariant, and evidence boundary.

## Requirements

### REQ-ITC-01: Run-Level `Batch[]` Capture Wraps `runFactoryForTest`

A NEW `test/support/` module MUST wrap `runFactoryForTest` (`src/testing/index.ts`) —
the normative run-level recording harness, and the only primitive exposing the
terminal outcome (`tree` + `error`) that rejection records (`golden-corpus-contract`
REQ-GCC-09) and matrix row M-21 require — to capture the full ordered `Batch[]` array
emitted by one factory run, WITHOUT altering `runFactoryForTest`'s existing exports or
behaviour (read-only dependency). The module's value-add is NORMALIZATION: it
constructs the transcript record (`golden-corpus-contract` REQ-GCC-03/GCC-09 shape)
from the raw `Batch[]` — downstream corpus/report REQs assert against the module's
constructed OUTPUT, never against a bare pass-through of the harness's `emitted`
array.

#### Scenario REQ-ITC-01.1: Capture module records every emitted Batch in order [SDK]

- GIVEN a factory run that calls `session.flush()` (directly or via chunking) three
  times
- WHEN captured
- THEN the capture module's result contains exactly three `Batch` entries, in emission
  order

#### Scenario REQ-ITC-01.2: Zero-emission run captures an empty transcript [SDK]

- GIVEN a factory run that emits no directives (matrix row M-14's empty-folder no-op)
- WHEN captured
- THEN the capture module returns a well-formed transcript record with an empty
  directive sequence — never `undefined`, never a throw

### REQ-ITC-02: Single Capture Path — One Module, Every Consumer

The corpus writer, the report renderer, and the e2e test file MUST ALL import the SAME
capture module — no second, parallel capture mechanism may exist anywhere in this
change's surface (feeds `fitness-guards` FIT-25).

#### Scenario REQ-ITC-02.1: Only one capture module exists and is universally imported [SDK]

- GIVEN the corpus writer, report renderer, and
  `test/e2e/author-emulation-scaffold.e2e.test.ts`
- WHEN their import statements are scanned
- THEN all three resolve the SAME capture module path

### REQ-ITC-03: Evidence Boundary — Shape, Never Render (Mirrors REQ-BRC-04)

Capture and report code MUST assert directive/`pathTemplate` SHAPE only — op, paths,
tokens (literal, untranslated), `force`, and options-echo. Capture and report code MUST
NEVER assert rendered `{{}}`/`{= =}` template output (the fake never renders). No
by-reference (`copyIn`) entry MAY assert byte content in `result.tree` or on disk.

#### Scenario REQ-ITC-03.1: No assertion inspects rendered output or by-reference bytes [SDK]

- GIVEN the full capture/report/e2e code this change ships
- WHEN reviewed against this boundary
- THEN zero assertions check rendered template content, `result.tree` bytes, or on-disk
  bytes for any by-reference target — only directive-shape assertions exist

### REQ-ITC-04: Placement — New Sibling, Existing Helpers Untouched

The capture module MUST live in `test/support/` as a NEW file (sibling to
`spy-client.ts`, never a rewrite of it). The e2e test file MUST be
`test/e2e/author-emulation-scaffold.e2e.test.ts` — NEVER `scaffold.e2e.test.ts`
(upstream `schematic-local-files` owns that filename; collision confirmed on
`origin/feat/schematic-local-files`). The fixture package MUST live under
`test/fixtures/`. Any binary fixture MUST carry a `.gitattributes` `binary` mark
(`author-emulation-generator` REQ-AEG-04). Corpus/manifest/README/report placement and
naming are pinned in `golden-corpus-contract` REQ-GCC-10 and `run-report` REQ-RPT-03.

#### Scenario REQ-ITC-04.1: File placement matches the pinned paths [SDK]

- GIVEN the change's file tree after this change lands
- WHEN inspected
- THEN `test/support/spy-client.ts` is unmodified, a new capture module sits beside it,
  and the e2e file is exactly
  `test/e2e/author-emulation-scaffold.e2e.test.ts`

### REQ-ITC-05: Zombie Tripwire — No Cross-Family Branching

The capture module MUST NOT contain conditional logic keyed on any mutation family
other than scaffold's own three verbs (`create`, `copyIn` as consumed here) — any
branch checking for `rename`/`move`/`delete`/`modify`/plain `copy` op-specific behaviour
is out of scope and triggers re-triage (state.yaml zombie tripwire #1).

#### Scenario REQ-ITC-05.1: Capture module contains no other-family conditional [SDK]

- GIVEN the capture module's source
- WHEN reviewed
- THEN it records `Batch[]` generically — no `switch`/`if` branch is keyed on
  `rename`/`move`/`delete`/`modify`/`copy` op values

## Sensitive Areas Coverage

No sensitive areas covered — test-only infra with no runtime authority.
