## Verify In-Loop Result

**Change**: conformance-corpus
**Iteration**: 2/3
**Scope**: S-000
**Mode**: in-loop (Strict TDD)
**Commit range judged**: `6db2f5e..e28c7b6` (`a497194` S-000 implementation, `e28c7b6` fix), branch `feat/conformance-corpus`

---

### Verdict: PASS

Iteration-1's single CRITICAL finding — the ~20 violation collectors in FIT-40 never fired against a truthy/failing input, leaving REQ-CSC-01.1 and REQ-CSC-04.1 as UNTESTED despite green suite — is **genuinely CLOSED**, verified by real execution, not by trusting the executor's claims.

---

### Primary Question: Is the Triangulation Gap Closed?

**Yes**, confirmed by independent verification, not by re-reading the executor's mutation table:

1. **Structural evidence**: `e28c7b6` extracts all 15 (previously ~20-described, actually 15 distinct functions) violation collectors out of `fit-40-conformance-corpus-integrity.test.ts` into pure functions in the new `test/support/conformance-validators.ts` (217 lines). `fit-40` now calls these same functions against the real `conformance/` tree — line-by-line diff confirms this is a pure extraction (each `const violations = ...; expect(violations).toEqual([])` block became `expect(checkX(...)).toEqual([])`), not a behavioral rewrite.
2. **New negative suite**: `test/fitness/fit-40-conformance-corpus-integrity.negative.test.ts` (284 lines, 18 tests) drives every one of those 15 collectors against synthetic broken fixtures — in-memory `LoadedFixture` objects for checks that only inspect manifest fields, `mkdtempSync` real temp-dir trees for checks that resolve paths on disk. Explicitly covers both spec scenarios named in the iteration-1 finding:
   - **REQ-CSC-01.1** (`spec.md:23-27`, "GIVEN a listed-but-missing manifest id... THEN it fails, naming the offending id") — test asserts `checkMissingManifestIds` returns `["ghost-fixture"]`-shaped violation for a synthetic `corpus.json` naming a manifest-less id. Verified by direct read of `spec.md:23-27` against the test body — exact match.
   - **REQ-CSC-04.1** (`spec.md:113-117`, "GIVEN exitCode:2, emitRejectionCode:null... THEN it fails") — test asserts `checkOutcomeTripleConsistency` fires on exactly that input. Verified by direct read of `spec.md:113-117` — exact match.
   - Plus the sibling branches iteration-1 flagged as needing the same treatment: REQ-CCR-02(a)/(b)/(c), REQ-CCR-05.2, REQ-CCR-07.1, REQ-CSC-02.1/.2/.3, REQ-CSC-03.1/.2/(class)/(outcome), REQ-CFX-04 directive+batch sub-branches, REQ-CFX-10.1 — all present.
3. **Non-vacuousness spot-check (independent, not the executor's own mutation table)** — I mutated 3 validator branches myself, one at a time, on the actual working tree, and observed the required RED → restore → GREEN cycle for each, then confirmed `git status`/`git diff` showed a byte-identical tree afterward:

   | # | Mutation | Branch | Result observed |
   |---|---|---|---|
   | 1 | `checkMissingManifestIds` forced to always return `[]` | REQ-CSC-01.1 / REQ-CCR-02(a) | RED — `fit-40-conformance-corpus-integrity.negative.test.ts` failed with `Expected [...] Received []` (17 pass / 1 fail). Restored → 55/55 green. |
   | 2 | `checkOutcomeTripleConsistency`'s top guard `isExit2 !== hasCode` flipped to `===` | REQ-CSC-04.1 / REQ-CFX-04.1/.2 (the exact bug shape iteration-1's failure scenario predicted) | RED — broke BOTH the negative suite (wrong violation reported) AND, notably, the **real** `fit-40-conformance-corpus-integrity.test.ts` (the live `m1-vehicle` fixture's two legitimate cases were now flagged as violations: 51 pass / 4 fail). Restored → 55/55 green. |
   | 3 | `checkOrphanDirectories`'s filter `!fixtureIds.includes(dirName)` inverted (dropped `!`) | REQ-CCR-05.2 | RED — negative test failed (wrong id in emitted violation: `registered` instead of `orphan-dir`) and the real fit-40 test also failed (flagged the legitimate `m1-vehicle` dir as an orphan: 53 pass / 2 fail). Restored → 55/55 green. |

   Working tree confirmed byte-identical after each restore (`git diff` empty on `test/support/conformance-validators.ts` and `test/fitness/**` throughout).

REQ-CSC-01.1 and REQ-CSC-04.1 move from ⚠️ PARTIAL/UNTESTED (iteration-1) to **✅ COMPLIANT** — a test that would fail if the branch broke now exists and was proven to fail when the branch was actually broken.

---

### Real Execution Evidence (all run by me, this iteration, at HEAD `e28c7b6`)

| Check | Result |
|---|---|
| `bun test` (full suite) | **2023 pass / 0 fail**, 4317 `expect()` calls, 188 files, 43.69s. Up from iteration-1's clean baseline of 2005 — exactly +18, matching the new negative test file's 18 tests. No flakes this run. |
| `bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts test/fitness/fit-40-conformance-corpus-integrity.negative.test.ts` | **55 pass / 0 fail** (37 real-tree + 18 negative), 68 `expect()` calls |
| `bun run typecheck` (`tsc --noEmit`) | Clean, no errors |
| `bun run build` | Green; `dist/` still carries no `collection.json`/`corpus.json`/fixture-id directories |
| `scripts/conformance-pr-gate.ts pr1` (at HEAD `e28c7b6`) | PASS — `corpus.json#fixtures === ["m1-vehicle"]` |
| `scripts/conformance-pr-gate.ts pr2 6db2f5e` (at HEAD `e28c7b6`) | PASS — 2 commits checked, no orphan-listing violation |
| **Intermediate-commit self-consistency** (`a497194`, checked in an isolated `git worktree`, not by mutating the primary working tree): `bun scripts/conformance-pr-gate.ts pr1` | PASS — `corpus.json#fixtures === ["m1-vehicle"]` at that SHA |
| Intermediate-commit `bun scripts/conformance-pr-gate.ts pr2 6db2f5e` | PASS — 1 commit checked |
| Intermediate-commit `bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts` | 37 pass / 0 fail (identical to iteration-1's finding — a497194 itself was never broken, only under-tested) |

Both SHAs in the judged range are independently fail-closed and self-consistent.

---

### Regression Sweep

- Full suite went from 2005 (iteration-1 clean baseline) → 2023 (this iteration), a delta of exactly +18 matching the new negative-test file — no other test count drift, no unrelated file touched.
- `git diff a497194 e28c7b6 --stat`: 3 files changed (`fit-40-conformance-corpus-integrity.negative.test.ts` new, `fit-40-conformance-corpus-integrity.test.ts` refactored, `conformance-validators.ts` new). Confirmed via diff: `conformance/**` fixture content, `corpus.json` semantics, `.gitattributes`, `README.md`, and the byte-level scans (REQ-CDT-03/04/07, REQ-CFX-01/02) are untouched by the fix commit.
- Areas iteration-1 verified clean (completeness, REQ-CFX-05/12/13 behavioral pins, PR-gate scripts, `.gitattributes` CRLF safety, build hygiene) were not touched by `e28c7b6` and are not re-litigated here per the task's scoping instruction.
- No new banned assertion patterns introduced — scanned both new/changed test files for `toBeDefined()`, `toBeTruthy()/toBeFalsy()` without context, `objectContaining` as whole assertion, `.not.toThrow()` as only assertion, snapshot-without-behaviour, mock-heavy patterns, multi-unrelated-assertion. Zero matches; every negative-test assertion targets a concrete expected violation string via `toEqual([...])`.

---

### Minor Discrepancy Noted (non-blocking)

`apply-progress.md` claims the extraction left `fit-40` "behaviour byte-identical (confirmed: 37 pass / 0 fail, same 49 `expect()` calls, before and after the extraction)". Independently re-running `fit-40` alone at `a497194` shows **48** `expect()` calls (not 49); at `e28c7b6` it is genuinely 49. The static `expect(` call-site count is identical (53 in both files, confirmed via `rg -c`) and the extraction diff is a verified line-for-line equivalent rewrite, so this is very likely a runtime-counter quirk in Bun's reporter (not a behavioral difference — both runs show 37 pass / 0 fail against the same unchanged `conformance/` corpus data, confirmed via `diff -rq`) rather than a real regression. Flagging because the executor's claim was imprecise, not because it changes the verdict.

---

### Spec Compliance Matrix (scope = S-000's REQ-IDs touched by the fix)

| Requirement | Test | Result (iter-1 → iter-2) |
|---|---|---|
| REQ-CSC-01.1 | `fit-40-...negative.test.ts` "listed-but-missing manifest" | ❌ UNTESTED → **✅ COMPLIANT** |
| REQ-CCR-02(a) | same | ⚠️ PARTIAL → **✅ COMPLIANT** |
| REQ-CCR-02(b) | `fit-40-...negative.test.ts` "factory.ts without manifest.json" | ⚠️ PARTIAL → **✅ COMPLIANT** |
| REQ-CCR-02(c) | `fit-40-...negative.test.ts` "manifest id / dirname mismatch" | (not separately flagged iter-1, now explicitly proven) **✅ COMPLIANT** |
| REQ-CCR-05.2 | `fit-40-...negative.test.ts` "orphan directory" (independently mutation-verified this iteration) | (not separately flagged) **✅ COMPLIANT** |
| REQ-CCR-07.1 | `fit-40-...negative.test.ts` "wireSpecVersion disagreement" | (not separately flagged) **✅ COMPLIANT** |
| REQ-CFX-04.1/.2 | `fit-40-...negative.test.ts` "outcome triple internal consistency" (independently mutation-verified this iteration) | ⚠️ PARTIAL → **✅ COMPLIANT** |
| REQ-CSC-04.1 | same | ❌ UNTESTED → **✅ COMPLIANT** |
| REQ-CFX-10.1 | `fit-40-...negative.test.ts` "zero-effect requires non-empty seed" | ⚠️ PARTIAL → **✅ COMPLIANT** |
| REQ-CSC-02.1/.2/.3, REQ-CSC-03.1/.2/(class)/(outcome) | `fit-40-...negative.test.ts` (respective describe blocks) | ⚠️ PARTIAL → **✅ COMPLIANT** |

All previously-flagged PARTIAL/UNTESTED scenarios in this domain are now COMPLIANT. No new gaps found.

---

### Recommendation

Iteration 2 of 3. Loop can exit for S-000. Recommend proceeding to `sdd-verify --mode=final` before archive (this in-loop pass does not substitute for the comprehensive final pass — code-audit Stage A, coverage, drift check, and the `adversarial_review` decision are final-mode-only and have not run here).
