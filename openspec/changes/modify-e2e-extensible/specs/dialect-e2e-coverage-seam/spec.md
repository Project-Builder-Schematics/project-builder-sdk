# Dialect E2E Coverage Seam Specification

**Spec version**: V2
**Status**: signed (2026-07-22)
**Change**: `modify-e2e-extensible`
**Sensitive areas covered**: security (code execution) — `src/dialects/typescript/**`, `src/dialects/react/**` (read-only in this change; exercised, never modified). Flagged at triage.
**Council review V1→V2**: blind 3/3 needs-changes, convergent findings. This domain absorbs findings 2, 5, 6a, 7, 8, 14, 15, 16 (rewritten REQ-DCS-07 allow-list; new REQ-DCS-11/REQ-DCS-12; rescoped REQ-DCS-09; pinned canonical golden dir; threat-model ADR added to REQ-DCS-08). REQ-IDs 01-10 kept stable in identity; 11-12 are new.

## Purpose

Names and generalizes the golden-committed-tree idiom (already proven by S-001's toy-dialect e2e and S-002's real TypeScript modify e2e) into a reusable two-tier seam so adding e2e coverage for a future dialect operator becomes an XS/S increment — one coverage-table row plus two byte files — never another L-sized effort. Tier A is a data-driven coverage table; Tier B stays hand-written for bespoke behavioral flows that exercise the coalescing seam (`src/core/dialect-handle.ts`) itself.

## Requirements

### REQ-DCS-01: Coverage table schema

The system MUST expose a named coverage-table module whose rows conform to `{dialect, op, seedPath, seedGolden, expectedGolden, factory}`. `seedPath` is the in-tree virtual path key `ContractFake` seeds; `seedGolden` names the golden byte file (loaded via `golden()`) that becomes that path's PRE-run seed content; `expectedGolden` names the golden byte file the POST-run committed content is compared against. **Finding 13 resolved**: `seedGolden` is kept (not dropped) — it is a distinct, load-bearing field, governed by Scenario 01.2 below, not a decorative duplicate of `seedPath`.

#### Scenario REQ-DCS-01.1: A row declares all five fields

- GIVEN the coverage table module
- WHEN a maintainer reads any row
- THEN every row exposes `dialect`, `op`, `seedPath`, `seedGolden`, `expectedGolden`, and `factory`

#### Scenario REQ-DCS-01.2: seedGolden governs the actual seed bytes

- GIVEN a Tier-A row
- WHEN the iterating e2e constructs its `ContractFake` from the row
- THEN the fake's seed content for `seedPath` equals `golden(seedGolden)` byte-for-byte

### REQ-DCS-02: Tier-A iterating e2e

The system MUST provide exactly one e2e test that iterates every Tier-A row and asserts `ContractFake.committedTree()` equals a golden `Map` built from that row's `expectedGolden`.

#### Scenario REQ-DCS-02.1: A new row is exercised without a new test file

- GIVEN a maintainer adds one new row plus two golden byte files to the coverage table
- WHEN the Tier-A iterating e2e runs
- THEN the new row's assertion runs and passes without any other test file changing

### REQ-DCS-03: Tier A/B boundary

The system MUST document, in the seam's own module, that Tier B (bespoke behavioral flows: coalescing order-invariance, mid-chain read split, forgotten-await join, contained throw) is exempt from Tier-A enumeration and from fit-42.

#### Scenario REQ-DCS-03.1: A Tier-B flow is never flagged missing

- GIVEN a Tier-B behavioral flow with no corresponding Tier-A row
- WHEN fit-42 runs
- THEN fit-42 does not report it as a missing cell

### REQ-DCS-04: Single scripted golden regen

The system MUST regenerate every Tier-A golden byte file through exactly one scripted path, mirroring `scripts/regen-corpus.ts`'s posture: outside the `bun test` discovery glob, never imported by a test file. Hand-authored golden bytes MUST NOT occur.

#### Scenario REQ-DCS-04.1: Regenerating goldens does not touch test files

- GIVEN the regen script runs for the dialect-coverage table
- WHEN the goldens are rewritten
- THEN no `.test.ts` file is modified and the script itself is excluded from `bun test`'s glob

### REQ-DCS-05: Harness confinement

The harness — coverage table, iterating e2e, regen script, AND every factory-definition module (the file(s) declaring Tier-A `factory` functions, including the shared `.modify(fn)` factory of REQ-RME-03) — MUST live entirely under `test/support/**`, `test/e2e/**`, and `test/fitness/**`. None of it MUST be reachable from `package.json#exports`, `src/conformance/index.ts`, or `src/testing/**` (FIT-08 posture).

#### Scenario REQ-DCS-05.1: No production export reaches the harness

- GIVEN the built `dist/` tree and `package.json#exports`
- WHEN a fitness check scans for references to the coverage-table module and every factory-definition module
- THEN no public export path resolves to any of them

### REQ-DCS-06: Tier-A factory is a static in-repo reference

Each row's `factory` field MUST be a maintainer-authored function imported statically from an in-repo module. The harness MUST NOT dynamically `import()` or otherwise execute a contributor-supplied module path at runtime.

#### Scenario REQ-DCS-06.1: A row's factory resolves at compile time

- GIVEN any coverage-table row
- WHEN the module is type-checked
- THEN `factory` resolves to a statically-imported function reference, never a string path or dynamic-import call

### REQ-DCS-07: Fail-closed import allow-list on the unit of addition

**Finding 2 resolved — full rewrite**: REQ-CFX-01's 3-item banned-substring shape is a DENY-list (fail-open: anything not on the banned list passes, including `node:vm`, `node:https`, `node:worker_threads`, `createRequire`, or any npm package). This requirement is instead a true ALLOW-list (fail-closed: only enumerated things pass, everything else fails).

Scope: (a) the guard scans the coverage-table module AND every factory-definition module (REQ-DCS-05). (b) Relative imports MUST resolve to one of the seam's sanctioned entry points only (e.g. `../../src/dialects/typescript/index.ts`, `../../src/dialects/react/index.ts`, `../../src/testing/index.ts`, the coverage table's own sibling support modules under `test/support/**`) — any other relative specifier fails. (c) Bare/builtin specifiers MUST be drawn from a small explicit allow-set (e.g. `bun:test`, `node:path` for path joins) — every other bare or builtin specifier fails closed, with no substring-based exception list.

#### Scenario REQ-DCS-07.1: A builtin outside the old deny-list trips the guard

- GIVEN a factory-definition module that imports `node:vm`
- WHEN the allow-list guard runs
- THEN it fails closed and names `node:vm` as not on the allow-set — proving this is an allow-list, not a re-hosted deny-list that would have missed it

#### Scenario REQ-DCS-07.2: A bare npm package import trips the guard

- GIVEN a factory-definition module that imports a bare npm specifier (e.g. `lodash`)
- WHEN the allow-list guard runs
- THEN it fails closed, since no npm package is on the bare/builtin allow-set

#### Scenario REQ-DCS-07.3: A non-sanctioned relative import trips the guard

- GIVEN a coverage-table module with a relative import to anything other than a sanctioned entry point
- WHEN the allow-list guard runs
- THEN it fails closed and names the offending relative specifier

### REQ-DCS-08: ADRs recorded for the seam

`sdd-design` MUST record ADRs for: the seam's identity (golden-committed-tree via `ContractFake`, two-tier), fit-42's status as a coverage-completeness fitness (distinct from fit-41's parity concern), the layer boundary between the root `conformance/` corpus (wire-directive shape) and this seam (dialect-leaf-to-committed-bytes), AND (**finding 14**) a threat-model ADR: unlike the root `conformance/` corpus's structural-only REQ-CFX-11 posture (never runner-spawned), this seam EXECUTES maintainer-authored factory code in-process during `bun test`/CI — the ADR MUST name REQ-DCS-07 (fail-closed import allow-list) and REQ-DCS-11 (path containment) as the mitigating guard set for that execution surface.

#### Scenario REQ-DCS-08.1: Design documents the layer boundary

- GIVEN the signed spec
- WHEN `sdd-design` produces its ADR set
- THEN an ADR explicitly states which layer owns wire-directive shape vs dialect-leaf-to-committed-bytes

### REQ-DCS-09: TS-dialect retrofit preserves existing golden-byte comparisons

**Finding 7 resolved — rescoped**: retrofitting `test/e2e/dialect-modify.e2e.test.ts` (S-002) under the new seam MUST NOT change any EXISTING golden-byte comparison: every Flow 1-4 golden-byte assertion MUST continue to pass against byte-unchanged golden files. REQ-DMR-01's and REQ-DMR-03's NEW assertions on these same flows are explicitly PERMITTED as additive augmentations to the existing flows — they do not count as a "behavior change" under this requirement, since they add assertions rather than altering any existing one.

#### Scenario REQ-DCS-09.1: S-002 flows pass unchanged after retrofit, new assertions are additive

- GIVEN the pre-retrofit `dialect-modify.e2e.test.ts` passing suite
- WHEN the file is wrapped/renamed under the new seam and REQ-DMR-01/REQ-DMR-03's assertions are added to the same flows
- THEN every pre-existing Flow 1-4 golden-byte assertion still passes against the same golden bytes, and the new assertions run alongside them without altering any existing one

### REQ-DCS-10: Golden/seed write containment — canonical directory

**Finding 8 resolved — canonical location pinned**: all Tier-A golden and seed byte files (both dialects) MUST live under the single canonical root `test/e2e/dialect-coverage/golden/{dialect}/` — i.e. `test/e2e/dialect-coverage/golden/typescript/` and `test/e2e/dialect-coverage/golden/react/`. This is the ONE location REQ-DCS-05 (confinement), this requirement (write containment), and REQ-RME-03 (React's changed-file-set) all agree on. The regen script (REQ-DCS-04) MUST write only inside this tree; no writer in the harness may escape it.

#### Scenario REQ-DCS-10.1: Regen cannot write outside its own tree

- GIVEN the regen script's target directory list
- WHEN it executes
- THEN every write path is contained under `test/e2e/dialect-coverage/golden/{dialect}/`

### REQ-DCS-11: Path field validation and containment (new, finding 5)

Every `seedPath`/`seedGolden`/`expectedGolden` value MUST be POSIX-relative: no backslash, no leading `/`, and no `..` path segment (mirrors REQ-CDT-05.1's rule verbatim). Every harness read (loading a seed/golden) and every regen write MUST resolve the value against the canonical root (REQ-DCS-10) and assert the resolved path stays contained under that root BEFORE touching disk — a resolution that would escape the root MUST fail closed rather than silently read or write outside it.

#### Scenario REQ-DCS-11.1: A `..`-segment path fails validation before any file I/O

- GIVEN a row whose `seedGolden` value contains a `..` segment
- WHEN the harness validates the row before reading it
- THEN validation fails closed and no file read is attempted

#### Scenario REQ-DCS-11.2: A path resolving outside the canonical root fails containment

- GIVEN a value that is syntactically POSIX-relative but resolves (once joined to the canonical root) to a location outside `test/e2e/dialect-coverage/golden/{dialect}/`
- WHEN the containment check runs
- THEN it fails closed before any read or write touches disk

### REQ-DCS-12: Seeds and goldens are read as bytes only (new, finding 15)

Seed and golden files (identified by `seedGolden`/`expectedGolden`) MUST be read via raw byte/text loading only (mirroring `golden()`'s existing `readFileSync` contract). The harness MUST NOT `import()`, `require()`, or otherwise module-load a seed or golden path under any circumstance — these files are inert data, never executable code, regardless of their extension (including `.ts`/`.tsx` seed files).

#### Scenario REQ-DCS-12.1: Loading a `.tsx` golden never triggers module evaluation

- GIVEN a React row's `.tsx` seed and golden files
- WHEN the harness loads them for the iterating e2e
- THEN both are read as raw text via `readFileSync`-equivalent APIs only, and neither is ever passed to `import()`/`require()`
