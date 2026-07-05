# Test-Pyramid Codification Specification

**Spec version**: V2
**Status**: signed (2026-07-04, stage-1-ir-bedrock)
**Change**: `stage-1-ir-bedrock`

## Purpose

Makes the SDK's implicit four-layer test pyramid (unit, fitness, integration, e2e) an
explicit, checkable contract: a contributor-facing doc maps each layer to its directory and
to a verb/dialect-authoring decision table, CI demonstrably exercises all four, and at least
one named e2e test exists exercising the full author-to-tree path. Contributor-facing value
only (O2 row 11's CONTRIBUTOR half — the schematic/dialect-author half is Stage 4.5/D7, out
of scope here).

> Path note: the proposal's affected-areas table names `docs/CONTRIBUTING.md`; the actual
> file is root-level `CONTRIBUTING.md` (verified in exploration). Design/apply MUST target
> the real path — this is a proposal typo, not a new file to create.
>
> RED posture: REQ-01..03 are doc/CI structural checks — they fail until the doc/table
> exists (naturally red-first, no waiver needed). REQ-04's e2e test asserts EXISTING SDK
> behavior through a new test file (characterization; RED = the file not existing yet).

## Requirements

### REQ-01: Test-pyramid doc maps all four layers to directories

`CONTRIBUTING.md` (or a doc it links to) MUST contain a table naming all four layers — unit,
fitness, integration, e2e — each mapped to at least one existing test directory containing
≥1 test file.

#### Scenario REQ-01.1: The four-layer table exists and each row resolves to a real directory

- GIVEN the test-pyramid doc
- WHEN its layer table is read
- THEN it lists exactly unit/fitness/integration/e2e, each naming a directory under `test/`
  that exists and contains at least one test file

### REQ-02: A verb/dialect-authoring decision table exists

The same doc MUST contain a decision table telling a contributor which layer(s) a change
requires based on what they are adding (a new verb, a new fitness invariant, a cross-module
behavior, or a full authoring story).

#### Scenario REQ-02.1: Decision table covers the four listed change kinds

- GIVEN the doc's decision table
- WHEN read
- THEN it has a row for each of: new verb/wire op, new fitness invariant, cross-module/handle
  behavior, full author-facing story — each pointing to the layer(s) from REQ-01

### REQ-03: CI runs all four layers

The CI workflow MUST demonstrably execute tests from all four mapped directories (a single
`bun test` invocation over the full `test/` tree satisfies this as long as every mapped
directory is under that glob and none is excluded).

#### Scenario REQ-03.1: CI's test step covers every mapped directory

- GIVEN `.github/workflows/ci.yml`'s test step and the doc's layer-to-directory mapping
- WHEN compared
- THEN no mapped directory is excluded from the CI test invocation

### REQ-04: At least one named, explicit e2e test exists

An e2e test MUST exist exercising the full author path: a factory function (using
`src/commons` verbs) run through `defineFactory` against a seeded `ContractFake`, asserting
the resulting committed tree matches a golden end-state (content, not just "did not throw").

#### Scenario REQ-04.1: Named e2e test drives factory → defineFactory → fake → golden tree

- GIVEN a factory file under `test/e2e/` that calls ≥2 verbs (e.g., `create` then `modify`)
- WHEN run via `defineFactory` against a seeded `ContractFake`
- THEN the fake's committed tree, after the run, deep-equals a committed golden end-state
  fixture
