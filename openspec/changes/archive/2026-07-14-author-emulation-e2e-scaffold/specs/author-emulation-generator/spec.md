# Author-Emulation Generator Specification

**Spec version**: V2
**Status**: signed (owner, 2026-07-13)
**Change**: `author-emulation-e2e-scaffold`

V1 → V2 (council fixes applied): REQ-AEG-01 gains scenario .2 (full 7-field
`ScaffoldArgs` coverage relocated here from matrix row M-02's over-broad quantifier,
QA-minor); REQ-AEG-06 added (DX friction capture — the "gaps hidden" Intent pillar,
BA major); REQ-AEG-07 added (git-hostile fixture materialization policy, QA-M-d).
All V1 REQ-IDs preserved.

## Purpose

Defines the in-repo, CRUD-shaped fixture factory that exercises the `scaffold`-family
IR surface (`scaffold`, `copyIn`, `create({templateFile})`) the way a real schematic
author would — not a faithful port of the reference `crud-graphql-mongo` schematic
(owner ruling D2, obs #941), but a realistic exerciser bounded to this SDK's own
capabilities.

## Requirements

### REQ-AEG-01: CRUD-Shaped Generator Exhausts the Scaffold-Family IR Surface

The fixture MUST be a single `defineFactory({packageDir})` factory, CRUD-shaped (not a
faithful `crud-graphql-mongo` port, D2), that in ONE run exercises all three
scaffold-family verbs: `scaffold(...)` over a package-local folder, at least one
standalone `copyIn(...)` call, and at least one `create({templateFile})` call. Across
the fixture's scaffold calls fixture-wide (not necessarily in one call), ALL SEVEN
`ScaffoldArgs` fields (`from`, `to`, `options`, `include`, `exclude`, `rename`,
`force`) MUST be exercised with an explicit non-default value at least once — this is
where the field-coverage guarantee lives (matrix row M-02 pins only the
defaults/mandatory-rejection half).

#### Scenario REQ-AEG-01.1: One factory run exercises all three verbs [SDK]

- GIVEN the author-emulation fixture factory
- WHEN run via `runFactoryForTest`
- THEN `result.emitted` contains at least one `create` directive from `scaffold`, one
  `copyIn` directive, and one `create` directive from `create({templateFile})`

#### Scenario REQ-AEG-01.2: All seven ScaffoldArgs fields exercised fixture-wide [SDK]

- GIVEN the fixture's full set of `scaffold` calls across the matrix scenarios
- WHEN their argument objects are collected
- THEN every one of the seven `ScaffoldArgs` fields appears with an explicit
  non-default value in at least one call

### REQ-AEG-02: Module-Wiring and tsconfig-AST Are a Declared, Honest Gap

The fixture MUST NOT implement real module registration, import-graph wiring, or any
`dialect-modify`/ts-morph logic — generated file content referencing "wiring" (e.g. an
NgModule-style import list) is illustrative TEXT ONLY, never executed or AST-verified.
This is the D2 honest gap and feeds `golden-corpus-contract`'s NOT-exercised ledger.

#### Scenario REQ-AEG-02.1: No dialect-modify verb anywhere in the fixture [SDK]

- GIVEN the full author-emulation fixture and its captured transcript
- WHEN the emitted directives are inspected
- THEN zero `modify` directives targeting a wiring/module-registration file appear —
  only `create`/`copyIn` directives are emitted

### REQ-AEG-03: Typed Options Follow the SDK's Own Stage-4 Pattern

The fixture MUST define its options via `schema.json` + a `pbuilder-codegen`-generated
`schema.generated.ts`, and call `scaffold`/`create` with an `options` object typed
against the generated `Input` type (mirroring `test/fixtures/typed-factory/`) — NOT a
literal copy of the reference schematic's near-empty `schema.json`.

#### Scenario REQ-AEG-03.1: Options are typed against a generated schema [SDK]

- GIVEN the fixture's `schema.json` and its generated `schema.generated.ts`
- WHEN the factory calls `scaffold`/`create` with `options`
- THEN the `options` value type-checks against the generated `Input` type — a
  compile-time guarantee, not a runtime assertion

### REQ-AEG-04: Binary Asset Is Real and `.gitattributes`-Marked

The fixture MUST include at least one committed binary asset (non-UTF-8 content, e.g.
a small real image) matched by a `.gitattributes` entry marking it `binary`, so git
never attempts a text diff on it.

#### Scenario REQ-AEG-04.1: Binary fixture is git-attribute-marked [SDK]

- GIVEN the fixture's `.gitattributes` file and its binary asset path
- WHEN the attribute is inspected
- THEN the binary asset's path pattern is marked `binary`

### REQ-AEG-05: Chained Filename Token Exercised

The fixture MUST include at least one source filename carrying a CHAINED multi-filter
token (e.g. `__name@singular@dasherize__`, 2+ filters) that `scaffold`'s REQ-FSC-05
pipeline translates — the fixture-content half of the D3 chained-token scenario;
the assertion + upstream pending-changes flag are `scenario-matrix` REQ-SCM-03's
responsibility.

#### Scenario REQ-AEG-05.1: Fixture ships a chained-token filename [SDK]

- GIVEN the fixture's `files/` tree
- WHEN its filenames are listed
- THEN at least one entry's name contains 2+ chained `@filter` segments (e.g.
  `__name@singular@dasherize__.entity.ts`)

### REQ-AEG-06: DX Friction Capture — the "Gaps Hidden" Intent Pillar

DX friction discovered WHILE AUTHORING the fixture (missing helpers, awkward
signatures, confusing errors, docs gaps) MUST be recorded in the coverage manifest's
`FRICTION` section (`golden-corpus-contract` REQ-GCC-08) — one entry per observation,
each naming the friction and its disposition (`accepted-as-is`, or a reference to an
`openspec/pending-changes.md` row for actionable items). An empty section MUST state
the literal `none observed` — absence of the section is a verify-final failure
(presence check); silence is never a valid record.

#### Scenario REQ-AEG-06.1: Friction section present, explicit even when empty [SDK]

- GIVEN the coverage manifest after the fixture is authored
- WHEN the `FRICTION` section is inspected
- THEN it exists and contains either ≥1 friction entry with a disposition, or the
  literal `none observed`

### REQ-AEG-07: Git-Hostile Fixtures Are Materialized at Test Setup, Never Committed

Fixture states that git cannot faithfully commit — empty directories, symlinks,
platform-dependent entries — MUST be materialized programmatically at test setup (and
cleaned up after), never committed to the repository. Their corpus records are
committed like any other scenario's (matrix row M-14's empty-folder no-op commits an
empty-sequence SUCCESS record — `golden-corpus-contract` REQ-GCC-09 vocabulary).

#### Scenario REQ-AEG-07.1: Empty-folder and symlink fixtures are setup-materialized [SDK]

- GIVEN matrix rows M-14 (empty folder) and M-19 (symlinked directory)
- WHEN the repository's tracked files are inspected
- THEN no committed empty directory or symlink exists for them — both are created by
  the test's own setup code

## Sensitive Areas Coverage

No sensitive areas covered — the fixture is test-only content with no runtime
authority; it consumes (never re-decides) the already-signed containment/classification
security surface from `schematic-local-files`.
