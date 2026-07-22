# React-Dialect Modify E2E Specification

**Spec version**: V2
**Status**: signed (2026-07-22)
**Change**: `modify-e2e-extensible`
**Sensitive areas covered**: security (code execution) — `src/dialects/react/**` (read-only in this change; exercised, never modified). Flagged at triage.
**Council review V1→V2**: blind 3/3 needs-changes, convergent findings. This domain absorbs findings 6, 8, 11 (the shared-factory design decision reconciling REQ-RME-03's changed-file set; canonical golden dir; per-row failure isolation; a new scripted meta-verification oracle). REQ-IDs 01-04 kept stable in identity; 05 is new.

## Purpose

Lands React-dialect `.modify(fn)` coverage as PURE Tier-A rows — the concrete acceptance proof that the seam (`dialect-e2e-coverage-seam`) makes a new operator × dialect cell an XS/S increment. `.modify(fn)` already lives in dialect-agnostic core (`src/core/dialect-handle.ts`), proven generic by the toy-dialect e2e (S-001); this capability is the second real-dialect proof point, after TypeScript.

## Requirements

### REQ-RME-01: Universal `.modify(fn)` present and green for both dialects

The Tier-A coverage table MUST include a row for `{dialect: "react", op: "modify"}` alongside the existing `{dialect: "typescript", op: "modify"}` row, both passing the Tier-A iterating e2e.

#### Scenario REQ-RME-01.1: Both universal rows pass in the same run

- GIVEN the Tier-A iterating e2e
- WHEN it runs
- THEN both the TypeScript and the React `.modify(fn)` rows assert their committed tree against their golden and pass

### REQ-RME-02: Every React row seeds a `.tsx` path, isolated per-row

Any Tier-A row with `dialect: "react"` MUST have a `seedPath` ending in `.tsx`, consistent with the React dialect's synchronous `.tsx`-only `find()` gate. **Finding 11 resolved**: a row's `.tsx`-gate rejection MUST surface as that ROW's own isolated failure within the Tier-A iterating e2e (REQ-DCS-02) — it MUST NOT abort the whole suite via an uncaught/unhandled rejection, and every other row MUST still execute and report independently.

#### Scenario REQ-RME-02.1: A React row's seed is rejected if not `.tsx`

- GIVEN a hypothetical React row whose `seedPath` ends in `.ts`
- WHEN the Tier-A iterating e2e runs that row
- THEN `react.find()`'s synchronous gate throws before any op executes, failing the row loudly

#### Scenario REQ-RME-02.2: A rejecting row does not abort other rows

- GIVEN one row's `.tsx`-gate throws
- WHEN the Tier-A iterating e2e runs the full table
- THEN that row is reported failed, no `unhandledRejection` aborts the process, and every other row still executes and reports its own pass/fail

### REQ-RME-03: Extensibility acceptance proof — changed-file-set constraint

**Design decision (finding 6, recorded here per the council's binding ruling)**: the `.modify(fn)` Tier-A factory is ONE generic, dialect-parameterised function — it dispatches on the row's own `dialect` field to call `ts.find(...)` or `react.find(...)` — REUSED by every `.modify(fn)` row across both dialects. The React increment therefore authors NO new factory; it only adds a table row referencing the already-existing shared factory.

Landing the React `.modify(fn)` row MUST therefore touch only: the coverage table (one new row referencing the EXISTING shared factory) and its two new byte files under the canonical root `test/e2e/dialect-coverage/golden/react/` (REQ-DCS-10) — one `.tsx` seed, one expected golden. It MUST NOT edit the Tier-A iterating harness, fit-42, `ContractFake`, `golden()`, or the shared factory module itself.

For a GENUINELY NEW operator (a future change, not this one): the honest unit of addition is {one new row, its byte files, AND one new maintainer-authored factory function in the factory module} — the allowed changed-file set for THAT future case explicitly includes the factory module. This change's own extensibility proof binds only to the narrower React-row case above, where the factory is already generic and reused, not authored fresh.

#### Scenario REQ-RME-03.1: The React increment's diff is table plus goldens only, zero new factory

- GIVEN the git diff introducing the React `.modify(fn)` row
- WHEN the changed-file set is inspected
- THEN it is a subset of {coverage-table module, one file under `test/e2e/dialect-coverage/golden/react/` (`.tsx` seed), one file under the same root (expected golden)} — zero diff in the iterating e2e, fit-42, `contract-fake.ts`, `golden.ts`, or the shared factory module

### REQ-RME-04: Golden byte fidelity for `.tsx` goldens

React `.tsx` golden files MUST match the newline/BOM convention `ContractFake`/`golden()` already assume for the TypeScript golden set (LF-only unless the seed itself carries a BOM/CRLF, per the dialect's content-derived fidelity primitives).

#### Scenario REQ-RME-04.1: A `.tsx` golden round-trips byte-exact

- GIVEN a `.tsx` seed with LF line endings and no BOM
- WHEN the React `.modify(fn)` row runs through `ContractFake` and its output is compared to the golden
- THEN the committed bytes equal the golden file byte-for-byte, including line-ending convention

### REQ-RME-05: Scripted meta-verification oracle (new, finding 6)

The extensibility acceptance proof (REQ-RME-03) MUST be verified by a scripted diff oracle — `git diff --name-only <merge-base>` — run at `sdd-verify`/CI time, NOT by manual or eyeballed PR review. The active actor is a dedicated out-of-band script, following the naming and posture precedent of `scripts/conformance-pr-gate.ts` (not a `.test.ts`, not on `bun test`'s discovery glob): proposed name `scripts/verify-react-tier-a-diff.ts`. It asserts the diff's changed-file set is a subset of {the coverage-table module, the two new files under `test/e2e/dialect-coverage/golden/react/`}.

#### Scenario REQ-RME-05.1: The oracle passes on the actual landing commit

- GIVEN the commit(s) that land the React `.modify(fn)` row
- WHEN `scripts/verify-react-tier-a-diff.ts` runs `git diff --name-only <merge-base>`
- THEN the changed-file set is a subset of the allowed set and the script exits 0

#### Scenario REQ-RME-05.2: The oracle fails on a synthetic over-broad diff

- GIVEN a synthetic commit that ALSO edits the Tier-A iterating harness alongside the React row
- WHEN the script runs
- THEN it fails, naming the disallowed file
