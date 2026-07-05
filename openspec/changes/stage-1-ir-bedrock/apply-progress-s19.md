# Apply Progress — S-1.9 (Test pyramid codification + author-to-tree e2e)

**Change**: stage-1-ir-bedrock · **Slice**: S-1.9 · **Mode**: Strict TDD
**Status**: complete

## Files Changed

| File | Action | Purpose |
|---|---|---|
| `test/e2e/author-to-tree.e2e.test.ts` | Create | [characterization-RED-waived] REQ-04.1 — create→modify happy path + move-with-force golden end-state (REQ-KIT-03.*, REQ-FAKE-04.m1–m3), factory → `defineFactory` → `ContractFake`, no engine anywhere |
| `test/pyramid/pyramid-codification.test.ts` | Create | [must-fail-first] pyramid REQ-01/02/03 — static text-scan (FIT-08/09 style) over `CONTRIBUTING.md`'s two tables + `.github/workflows/ci.yml`'s test-step coverage; includes a red-proof for the CI-exclusion detector |
| `CONTRIBUTING.md` | Modify | New "Test pyramid" section: four-layer→directory table (unit=`test/golden-ir`, fitness=`test/fitness`, integration=`test/fake`, e2e=`test/e2e`) + contribution decision table (new verb / new fitness invariant / cross-module behavior / full author-facing story) |
| `.github/workflows/ci.yml` | Read-only (verified) | Confirmed unmodified; its `bun test` step is whole-tree (no path args), so it structurally covers all four mapped directories — REQ-03.1 passes against it as-is |

## TDD Cycle Evidence — S-1.9

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| T-01 e2e | `author-to-tree.e2e.test.ts::create then modify commits a golden end-state tree` | e2e | n/a — characterization-RED-waived (proves existing create/modify behavior, passed on first run) | ✅ | n/a — single golden fixture per spec REQ-04.1 | none needed |
| T-01 e2e | `author-to-tree.e2e.test.ts::move with force overwrites an existing destination` | e2e | n/a — characterization-RED-waived (proves existing S-1.3 move-force behavior, passed on first run) | ✅ | n/a — single golden fixture | none needed |
| T-02 pyramid | `pyramid-codification.test.ts::REQ-01 the table exists...` | architectural | "Expected: 4, Received: 0" (no layer table in CONTRIBUTING.md yet) | ✅ | n/a — structural existence check, not a computed class | none needed |
| T-02 pyramid | `pyramid-codification.test.ts::REQ-02 has a row for new verb...` | architectural | "Expected: 4, Received: 0" (no decision table yet) | ✅ | n/a | none needed |
| T-02 pyramid | `pyramid-codification.test.ts::REQ-03 no directory...excluded` | architectural | "Expected: 4, Received: 0" (gated on REQ-01's table existing — no vacuous pass) | ✅ | n/a — CI command is fixed text, not a computed class | none needed |
| T-02 pyramid | `pyramid-codification.test.ts::[red-proof] a scoped bun test invocation...` | architectural | n/a — red-proof fixture, asserts the detector itself (FIT-08/09 convention) | ✅ | 2 cases (excluding dir / including dir) | none needed |

## REQ Coverage

| REQ-ID | Test | State |
|---|---|---|
| pyramid REQ-01.1 | `pyramid-codification.test.ts` (REQ-01 describe block) | ✅ pass |
| pyramid REQ-02.1 | `pyramid-codification.test.ts` (REQ-02 describe block) | ✅ pass |
| pyramid REQ-03.1 | `pyramid-codification.test.ts` (REQ-03 describe block) | ✅ pass |
| pyramid REQ-04.1 | `author-to-tree.e2e.test.ts` (both scenarios) | ✅ pass |

19/19 change-wide REQ-IDs mapped per `slices.md`'s coverage check; this slice closes the last 4 (pyramid REQ-01–04).

## CI Coverage Check Result

`ci.yml`'s "Run tests" step runs bare `bun test` (no path restriction) — the whole-tree glob, so it structurally cannot exclude any directory named in the doc's layer table. Verified programmatically by `pyramid-codification.test.ts`'s REQ-03 test (passes) rather than by inspection alone. **No edit to `ci.yml` was made or needed** — per the task's read-only constraint, this was the expected outcome, not a gap.

## Directory-to-Layer Mapping Decision (not explicit in design)

The design's Test Derivation table (§4.6) labels test *levels* per REQ but doesn't name a single canonical directory per pyramid layer. Chosen mapping, justified from that same table's own level labels:
- **unit** → `test/golden-ir` (REQ-GIR-01 is explicitly labeled "unit" there)
- **fitness** → `test/fitness` (obvious; all `fit-*.test.ts`)
- **integration** → `test/fake` (REQ-FAKE-07, boundary REQ-01–04, batch-cap REQ-01–03 all labeled "integration" there)
- **e2e** → `test/e2e` (new, this slice)

`test/skeleton` also hosts integration-style tests (uses `ContractFake` too) but is not one of the four canonical directories — the decision table's "cross-module / handle behavior" row names both `test/fake` and `test/skeleton` as acceptable homes, since REQ-02 only requires each row to point at *a* layer from REQ-01, not a single directory.

## Deviations From Design

None — implementation matches design §1.9 and the slices.md task list exactly.

## Foreign Failures Observed (not fixed, per parallel-execution constraint)

- `bunx tsc --noEmit`: 3 unused-variable errors in `test/fitness/fit-10-engine-client-port-guard.test.ts` (S-1.8's file, lines 24/58/63) — untouched by this slice.
- `bun test` (full suite): 2 failures in `test/fake/batch-cap.test.ts` (S-1.4's file, REQ-01.2/REQ-01.3) — expected RED-phase state of a sibling slice in progress, untouched by this slice.

## Final Full-Suite Run

`bun test` → **216 pass / 2 fail** across 218 tests in 39 files (the 2 failures are the foreign S-1.4 failures above; all 6 of this slice's own tests are in the pass count).
`bunx tsc --noEmit` → 3 foreign errors (S-1.8's file); zero errors in this slice's files.

## Risks

- None blocking. The directory-mapping decision above is a judgment call the design left open; flagged for `sdd-verify` to confirm it reads as intended rather than silently accepted.
