# Conformance Self-Check Specification

**Spec version**: V3
**Status**: SIGNED (V3 re-signed by owner 2026-07-18; evidence-driven V2→V3 corrections — see spec-summary.md log)
**Change**: `conformance-corpus`

## Purpose

Defines the SDK-local, fail-closed structural test that catches the corpus's own hard-failure
modes BEFORE they reach the engine's external CI. Structural-only (explore's Approach 3, owner
-endorsed): parses `corpus.json` + every `manifest.json`, no runner spawn, no behavioral proof.
The exact implementation shape (test file placement/naming) is a design decision — this domain
pins WHAT the check must catch, not HOW it is wired into the test layer.

## Requirements

### REQ-CSC-01: Mirrors the Engine Loader's 3 Hard-Failure Rules

The self-check MUST fail (non-zero) when any of REQ-CCR-02's three rules is violated: a listed
id with no `manifest.json`; a fixture directory with `factory.ts` but no `manifest.json`; a
`manifest.json#id` that differs from its directory name.

#### Scenario REQ-CSC-01.1: Self-check fails on a listed-but-missing manifest

- GIVEN `corpus.json#fixtures` lists an id with no `manifest.json` on disk
- WHEN the self-check runs
- THEN it fails, naming the offending id

#### Scenario REQ-CSC-01.2: Self-check passes a fully-consistent corpus

- GIVEN every fixture in `corpus.json#fixtures` has a matching manifest/dirname/factory
- WHEN the self-check runs
- THEN it passes

### REQ-CSC-02: Seed/Expected/Schematic/Factory Reference Resolution, and the Collection Marker

For every case in every `manifest.json`, when `seed`/`expected` names a directory string (not
the literal `"zero-effect"`/`"empty"`/`null`), the self-check MUST assert that directory exists
under the fixture. When `lowering.mode === "schematic"`, the self-check MUST assert
`schematic/schema.json` and at least one file under `schematic/files/` exist. The self-check
MUST ADDITIONALLY assert that `manifest.json#factory.module` resolves to an existing file
relative to the fixture directory (default `factory.ts`) — a listed factory pointer that does
not resolve on disk is a hard failure of the same class as a dangling `seed`/`expected`
reference. The self-check MUST ADDITIONALLY assert that `conformance/collection.json`
(REQ-CCR-08) EXISTS and resolves as an ancestor for EVERY fixture listed in
`corpus.json#fixtures` — a corpus lacking this marker makes every runner-driven fixture
invocation fail at exit 1 before its factory ever executes (`resolvePackageRoot`,
`src/core/context.ts`), which defeats the corpus's purpose; this is a hard failure of the same
class as the other reference-resolution checks in this REQ, checked ONCE per self-check run
(not per-fixture, since the marker is shared).

(Previously: this REQ covered only `seed`/`expected`/`schematic`/factory-module reference
resolution (V2, QA-M2). V3 adds the `collection.json` marker check per the same evidence class —
a missing package-anchor marker was previously uncaught by any REQ-CSC series check, and would
silently fail 100% of runner-driven fixture invocations without the self-check ever flagging it.)

#### Scenario REQ-CSC-02.1: Dangling expected reference fails

- GIVEN a case with `expected: "expected"` but no `expected/` directory on disk
- WHEN the self-check runs
- THEN it fails, naming the fixture and case

#### Scenario REQ-CSC-02.2: Missing factory.ts file fails

- GIVEN a fixture's `manifest.json#factory.module` names `"factory.ts"` but no such file exists
  in the fixture directory
- WHEN the self-check runs
- THEN it fails, naming the fixture and the unresolved factory path

#### Scenario REQ-CSC-02.3: Missing collection.json marker fails the whole corpus

- GIVEN `conformance/collection.json` does not exist (and no other ancestor `collection.json` is
  present above any fixture directory)
- WHEN the self-check runs
- THEN it fails, naming the missing marker — every fixture would otherwise fail at exit 1 before
  its factory runs (REQ-CCR-08)

### REQ-CSC-03: Manifest Schema Validity, Including `transcript` and `outcome`

The self-check MUST validate every `manifest.json` against the schema fields (`id`,
`wireSpecVersion`, `class`, `factory`, `input`, `lowering`, `cases[]`) — presence and basic type
correctness (e.g. `cases` is a non-empty array, `class` is one of
`handshake`/`wire-mutation`/`composition`). For every case, the self-check MUST ADDITIONALLY
validate the `transcript` object's shape (`callbacks[]` is an array of strings drawn from the
four reverse-callback methods; `singleCommit`, `forbidDiscard`, `emitBeforeCommit` are booleans
— all four fields present, per REQ-CFX-13) and the `outcome` object's shape (`exitCode` is an
integer; `emitRejectionCode` is `null` or a string; `failedIndex` is `null` or an integer;
`writtenPaths` is an array of strings — per REQ-CFX-04 and REQ-CFX-12).

(Previously: this REQ validated only the top-level manifest fields. V2 extends required-field
validation to `transcript` and `outcome` per QA blind-review finding QA-B2/BA-M1 — a case
missing its transcript object, or carrying a malformed outcome object, was previously
structurally undetected.)

#### Scenario REQ-CSC-03.1: Empty cases array fails validation

- GIVEN a `manifest.json` with `cases: []`
- WHEN the self-check runs
- THEN it fails — every landed fixture must have at least one case

#### Scenario REQ-CSC-03.2: A case missing its transcript object fails validation

- GIVEN a case object with no `transcript` key
- WHEN the self-check runs
- THEN it fails, naming the fixture and case

### REQ-CSC-04: Outcome Triple Internal Consistency (Tool-Level Enforcement)

The self-check MUST assert, for every case, REQ-CFX-04's triple consistency rule
(`exitCode === 2 ⟺ emitRejectionCode !== null`; `failedIndex` integer only for directive-level
codes, `null` for batch-level).

#### Scenario REQ-CSC-04.1: exitCode 2 with null rejection code fails

- GIVEN a case with `exitCode: 2` and `emitRejectionCode: null`
- WHEN the self-check runs
- THEN it fails

### REQ-CSC-05: Bun-Pin Assertion (advisory-candidate)

The self-check SHOULD assert `process.versions.bun ===` the `engines.bun` value in
`package.json` (cheap, fail-closed ethos — catches a drifted local Bun before it produces a
fixture landed under the wrong runtime). Marked SHOULD, not MUST: `sdd-design`/the owner MAY
demote this to advisory-only (a warning, not a failing assertion) if judged too strict for local
dev.

#### Scenario REQ-CSC-05.1: Bun version mismatch is flagged

- GIVEN `process.versions.bun` differs from `package.json#engines.bun`
- WHEN the self-check runs
- THEN it reports the mismatch (failing by default per SHOULD, unless design demotes it)

### REQ-CSC-06: Self-Check Is the Named Fail-Closed Verifier for REQ-CSC-01..04 AND REQ-CDT-03..06

The self-check MUST run as part of the `bun test` suite and MUST exit non-zero on any
violation of REQ-CSC-01 through REQ-CSC-04 — never warn-only, never skip-on-error. The
self-check ADDITIONALLY IS the named fail-closed verifier for `corpus-determinism`'s byte/path
-format rules REQ-CDT-03 (zero CR bytes), REQ-CDT-04 (no BOM), REQ-CDT-05 (POSIX relative
paths), and REQ-CDT-06 (byte-exactness for `expected/**` and `schematic/files/**` leaves) — the
self-check MUST run these byte-level scans over every text file under `conformance/` and exit
non-zero on any violation. These four REQs are enforced HERE, not as free-floating prose MUSTs
with no tool-level owner.

(Previously: this REQ named only REQ-CSC-01..04 as its enforcement scope. V2 makes it the
explicit enforcement owner of REQ-CDT-03..06 per QA blind-review finding QA-M3 — those
determinism rules previously had no named verifier.)

#### Scenario REQ-CSC-06.1: A REQ-CSC violation fails the whole suite

- GIVEN any REQ-CSC-01..04 violation present in `conformance/`
- WHEN `bun test` runs
- THEN the suite exits non-zero

#### Scenario REQ-CSC-06.2: A REQ-CDT byte/path violation fails the whole suite

- GIVEN a CR byte, a BOM, a non-POSIX path, or an undeclared trailing newline present anywhere
  under `conformance/` (REQ-CDT-03..06)
- WHEN `bun test` runs
- THEN the suite exits non-zero, naming the offending file and rule

## Sensitive Areas Coverage

No sensitive areas covered. Structural-only: parses JSON and checks the filesystem; no process
spawn, no `src/transport/**` involvement.

## Open Technical Questions (routed to `sdd-design`)

- Implementation shape: does the self-check live as a new `test/conformance-corpus/` cluster or
  fold into an existing test layer? File placement/naming is design's call.
