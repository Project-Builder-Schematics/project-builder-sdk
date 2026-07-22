# Dialect Coverage Fitness Specification

**Spec version**: V2
**Status**: signed (2026-07-22)
**Change**: `modify-e2e-extensible`
**Council review V1→V2**: blind 3/3 needs-changes, convergent findings. This domain absorbs findings 1, 3, 4, 10, 12 (live-reflection cell universe replacing any hand-list; required-cell gap-list downgrade now fails; non-vacuous coverage gate; unreadable-golden + absent-row scenarios; declared-gap followup-reference validity). REQ-IDs 01-04 kept stable in identity; 05-06 are new.

## Purpose

A net-new fitness guard (fit-42 — number verified free against `main` and every in-flight branch at exploration time; re-verify immediately before slice/apply per cross-change lesson #2086) that enumerates the dialect × operator Tier-A matrix and fails closed whenever a declared-required cell has no matching Tier-A row and goldens. This is the enforcement half of the "future operator = XS/S" hard requirement.

## Requirements

### REQ-DCF-01: Fail-closed on missing required cell

fit-42 MUST fail when a cell declared required (today: universal `.modify(fn)` × `{typescript, react}`) has no matching Tier-A row, or the row's golden files are absent or unreadable. **Finding 10 resolved**: "unreadable" and "absent-row" are distinct failure cases from "golden file deleted" and MUST both be covered explicitly.

#### Scenario REQ-DCF-01.1: A deleted required golden trips the guard

- GIVEN the React `.modify(fn)` row's `expectedGolden` file is deleted
- WHEN fit-42 runs
- THEN it fails, naming the missing cell `{react, modify}`

#### Scenario REQ-DCF-01.2: An unreadable (not merely absent) required golden trips the guard

- GIVEN the React `.modify(fn)` row's `expectedGolden` file exists on disk but a simulated read failure (e.g. permission error) occurs when fit-42 loads it
- WHEN fit-42 runs
- THEN it fails, distinguishing "unreadable" from "missing" in its report, still naming cell `{react, modify}`

#### Scenario REQ-DCF-01.3: A required cell with no row at all trips the guard

- GIVEN the coverage table has NO row whatsoever for `{typescript, modify}` (not even a row with missing goldens — the row itself is absent)
- WHEN fit-42 runs
- THEN it fails, naming `{typescript, modify}` as a required cell with zero rows

### REQ-DCF-02: Exhaustive partition — cover XOR declared-gap

Every `{dialect, op}` cell in the full operator × dialect axis (REQ-DCF-03) MUST be in exactly one of two states: covered by a Tier-A row, or declared as an honest gap with a followup reference. An undeclared, absent cell MUST fail fit-42. No third (silent) state is permitted. **Finding 3 resolved**: a cell that is REQUIRED (the universal `.modify(fn)` × `{typescript, react}` set, REQ-RME-01) MUST NOT be satisfiable by appearing in the declared-gap list — declared-gap is only a legitimate resolution for a NON-required cell. A required cell listed as a declared gap MUST fail fit-42 exactly as an undeclared-absent cell would (this is a downgrade attempt, not an honest gap).

#### Scenario REQ-DCF-02.1: An undeclared cell fails

- GIVEN a `{dialect, op}` cell that is neither a Tier-A row nor a declared gap
- WHEN fit-42 runs
- THEN it fails, naming the undeclared cell

#### Scenario REQ-DCF-02.2: A declared gap does not fail for a non-required cell

- GIVEN a `{dialect, op}` cell recorded as a declared gap with a followup reference, and this cell is NOT in the required set
- WHEN fit-42 runs
- THEN it passes for that cell and surfaces the gap plus followup reference in its report

#### Scenario REQ-DCF-02.3: A required cell cannot be downgraded to a declared gap

- GIVEN `{react, modify}` (a required cell) is listed in the declared-gap list instead of having a Tier-A row
- WHEN fit-42 runs
- THEN it fails, naming `{react, modify}` as an illegitimate downgrade of a required cell

### REQ-DCF-03: Matrix axis pin — live-reflection derivation

The fit-42 axis MUST be dialect-AST operators exercised through public dialect handles (`ts.find(...)`/`react.find(...)` op methods and `.modify(fn)`). `replaceContent` and any wire-level `{op:"modify"}` directive MUST NOT be counted as axis cells — that shape is root `conformance/` corpus territory and is out of this axis by construction.

**Finding 1 resolved**: the per-dialect operator UNIVERSE fit-42 diffs Tier-A rows and declared gaps against MUST be derived via LIVE REFLECTION over each dialect's own registered op-pack — e.g. `Object.keys()` over the op-pack literal each dialect module exports (`src/dialects/typescript/ops.ts`'s and `src/dialects/react/ops.ts`'s named exports — the SAME literal passed to `defineOpPack`/`withOps`), or equivalent public op-method reflection off a constructed handle. fit-42 MUST NEVER hand-maintain a literal array of operator names that duplicates this — a duplicated list can silently go stale when a new op ships.

#### Scenario REQ-DCF-03.1: replaceContent is not an axis cell

- GIVEN fit-42's cell enumeration
- WHEN it lists required or declared cells
- THEN no cell names `replaceContent` or a wire-level `modify` directive

#### Scenario REQ-DCF-03.2: A new real op absent from both table and gap list fails (negative test)

- GIVEN a new op is added to a dialect's `ops.ts` op-pack (reflected live) but is added to NEITHER the coverage table NOR the declared-gap list
- WHEN fit-42 runs
- THEN it fails, naming the new op by its reflected name — proving the universe comes from live reflection, not a hand-list that would have silently missed it

### REQ-DCF-04: Negative test proves fail-closed

The seam MUST include a deliberate-deletion negative test demonstrating fit-42 fails when a required cell's Tier-A artefact is removed, mirroring `fit-40`'s `.negative.test.ts` precedent.

#### Scenario REQ-DCF-04.1: The negative test is green against a deliberately broken fixture

- GIVEN a test-local copy of the coverage table with the React `.modify` row's golden deleted
- WHEN the negative test invokes fit-42's check function against it
- THEN the check reports failure, and the negative test asserts that failure occurred

### REQ-DCF-05: Declared-gap followup reference validity (new, finding 12)

Each declared-gap entry's followup reference MUST be a string that appears verbatim as an exact substring within `openspec/pending-changes.md` (this project's `spec_source: internal` followup ledger — see the followups this change itself registers in `dialect-modify-e2e-robustness`'s spec). fit-42 MUST read that file at check time and fail closed if a declared gap's reference is absent, empty, or does not match any substring in the file.

#### Scenario REQ-DCF-05.1: A declared gap with an unmatched reference fails

- GIVEN a declared-gap entry whose followup reference string does not appear anywhere in `openspec/pending-changes.md`
- WHEN fit-42 runs
- THEN it fails, naming the cell and the unmatched reference string

#### Scenario REQ-DCF-05.2: A declared gap with a matched reference passes

- GIVEN a declared-gap entry whose followup reference string is an exact substring present in `openspec/pending-changes.md`
- WHEN fit-42 runs
- THEN it passes for that cell

### REQ-DCF-06: Non-vacuous coverage (new, finding 4)

A Tier-A row only counts as "covered" (REQ-DCF-02) if: its seed content (`golden(seedGolden)`) is non-empty; its expected content (`golden(expectedGolden)`) is non-empty; AND, for a mutating op (every axis op except a pure read), the expected committed bytes differ from the seed bytes. A row failing any of these conditions is VACUOUS and MUST fail fit-42 even though a row technically exists for that cell.

#### Scenario REQ-DCF-06.1: A no-op-shaped row for a mutating op fails as vacuous

- GIVEN a row for a mutating op whose `expectedGolden` is byte-identical to its `seedGolden`
- WHEN fit-42 runs
- THEN it fails, naming the cell as vacuous (no actual mutation proven)

#### Scenario REQ-DCF-06.2: An empty seed or expected golden fails as vacuous

- GIVEN a row whose `seedGolden` or `expectedGolden` resolves to zero-length content
- WHEN fit-42 runs
- THEN it fails, naming the cell as vacuous
