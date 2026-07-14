# Verify In-Loop Result

**Change**: bare-factory-migration
**Iteration**: 2/3
**Scope**: S-000 (delta re-check of verify-in-loop-1's two findings)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

Both iteration-1 findings verified closed with real execution evidence. Batch 1 (S-000)
is complete; batch 2 (S-001 + S-002) unblocks.

- Tasks in scope complete: all S-000 tasks + the R-10 fix task
- Affected tests passed: 56/56 (S-000 scoped set, now 5 files)
- Spec compliance for scope: 10/10 covered scenarios have runtime or structural evidence
  (REQ-ATH-01.1/.4/.5, REQ-ATH-17.1/.2, REQ-ATH-18.2 pin, REQ-AOD-01.1/.2/.3, REQ-TES-05.3)
- Assertion audit: clean (no banned patterns in the delta test file)

---

## Finding 1 re-check — 5 unclaimed files (ARCHITECTURAL) → CLOSED at plan level

**Claim**: orchestrator ruling R-9 in a new §21 addendum to `slices.md` (rev 4) folds the 5
files into S-002.

**Verified**:
- `slices.md:694-696` — §21 "Build-Iteration-1 Resolutions Addendum (orchestrator, 2026-07-14
  — slices rev 4)" exists.
- R-9 names ALL 5 files verbatim: `test/fake/copyin-fidelity.test.ts`,
  `test/scaffold/batch-cap-chunk.test.ts`, `test/scaffold/classify-transport.test.ts`,
  `test/scaffold/scaffold-fake.test.ts`, `test/e2e/author-emulation/ir-transcript.test.ts`.
- The ruling is unambiguous on every dimension an S-002 executor needs: fix shape ("bare test
  factories + `runFactoryForTest` options bag", same as the existing 4 harness files),
  explicit non-self-healing note ("do not self-heal at S-004 — none route through
  `SCENARIOS`"), and the resulting file count ("S-002's file set is therefore 4 + 5 = 9
  consumer files"). Coverage/REQs/build order declared unchanged — consistent with the signed
  spec's repo-wide zero-wrapped-callers mandate at S-006, so this is genuinely an inventory
  correction, not scope creep requiring a spec unfreeze.
- The code conversion itself is correctly still pending: `git show 5d4f154` confirms no R-9
  file was touched by the fix commit (apply-progress states this explicitly, and the commit's
  file list is only `apply-progress.md` + `test/fake/harness-options-bag.test.ts`).

**Status**: CLOSED (plan level). The 16 failures in these 5 files are now owned by S-002.

## Finding 2 re-check — missing runtime evidence for REQ-ATH-01.4/17.1/17.2 (LOCAL) → CLOSED

**Claim**: commit `5d4f154` adds `test/fake/harness-options-bag.test.ts` with 3 executed tests.

**Verified — file content vs. spec scenarios** (read in full, matched against
`specs/author-test-harness/spec.md`):

| Scenario | Spec oracle | Test assertion | Discharges? |
|---|---|---|---|
| REQ-ATH-01.4 | seed `{"a.ts":"x"}` via bag + `create("a.ts")` no force → tree empty, `AuthoringError reason:"path-collision"` | `result.tree.size === 0`, `toBeInstanceOf(AuthoringError)`, `err.reason === "path-collision"` | YES — exact oracle, executed |
| REQ-ATH-17.1 | `{packageDir}` + adjacent `schema.json` requiring `{port:number}` + input missing `port` → tree/emitted empty, `reason:"invalid-input"` | `result.tree.size === 0`, `result.emitted` `[]`, `err.reason === "invalid-input"`; fixture `test/fixtures/harness-opted-in/schema.json` verified to require `port` (`required: true`) with sibling `collection.json` ceiling anchor | YES — exact oracle, executed |
| REQ-ATH-17.2 | SAME schema-shaped-invalid input, NO `packageDir` → factory body executes normally | `result.tree.get("server.config.ts") === "static content"`, `error === undefined` | YES — the mutation-resistant leg: an always-validate mutant fails this |

**Not vacuous / not characterization-in-name-only** — mutant analysis per assertion:
- Dropping `options?.seed` forwarding → fake starts unseeded → no collision → ATH-01.4 fails
  (tree.size 1, error undefined).
- Dropping `options?.packageDir` forwarding (the exact REQ-ATH-17.3-class mutant iteration 1
  warned about) → validation never fires → ATH-17.1 fails (factory completes).
- Inverting the `!== undefined` guard / always-validating → ATH-17.2 fails (rejection instead
  of completion).
Each fork has a distinct executed oracle. The `[characterization]` tag is honest labelling
(the delegation code predates the tests), with the same documented RED-first waiver precedent
as `harness-opted-in.test.ts` — acceptable under strict-TDD in-loop tolerance, noted for the
final-mode TDD aggregate.
- Scope discipline: the file exercises ONLY the 3 REQ-IDs S-000's `Covers` line claims;
  ATH-17.3's positive fs-read oracle is correctly left to its own slice per its header note.

**Executed**: `bun test test/fake/harness-options-bag.test.ts` → **3 pass, 0 fail**.

**Status**: CLOSED.

---

## Evidence Table (iteration 2)

| Check | Command | Result |
|---|---|---|
| §21/R-9 addendum exists + names all 5 files | `rg -n "§21\|R-9" slices.md` + full read of `:694-698` | Present, unambiguous, all 5 files named |
| R-10 fix tests | `bun test test/fake/harness-options-bag.test.ts` | 3 pass, 0 fail |
| S-000 scoped set (now 5 files) | `bun test fit-29 fit-04 runfactoryfortest-shape quickstart-docs harness-options-bag` | **56 pass, 0 fail** (was 53; +3 = exactly the new file) |
| Full suite | `bun test` | **1165 pass, 99 fail** — exactly as predicted (was 1162/99; +3 pass = the new tests, fail count unchanged) |
| Failure buckets unchanged | per-file grouping of the 99 fails | Byte-identical distribution to iteration 1 (15 files, same counts: 45/14/7/6/6/4/3/3/2/2/2/2/2/1/1) — every file now owned by a slice (5 via R-9→S-002; rest S-002/S-003/S-004/S-006 as before) |
| Typecheck | `bun run typecheck` | 64 errors, same 13 pre-existing known-red files; `harness-options-bag.test.ts` contributes ZERO |
| Regression sentinels (R-5) | `git diff --name-only $(git merge-base main HEAD) -- test/golden-ir test/core test/conformance test/dialects` | **Empty** |
| Frozen `defineFactory` body | `git diff --name-only <merge-base> HEAD -- src/core/context.ts` | **Empty** — file still untouched entirely |
| R-9 files untouched by fix | `git show 5d4f154 --stat` | Only `apply-progress.md` + the new test file — conversion correctly deferred to S-002 |
| apply-progress honesty | read of the `5d4f154` apply-progress delta | Claims (3 pass / 56 pass / 64 same errors / sentinels clean / 1165-99) all independently reproduced |

## Strict TDD (in-loop audit)

**Iteration**: 2
**Verdict**: ok
**Delta scope**: 1 test file, 0 impl files

- Banned assertion patterns: none (`toEqual` with exact values; `toBeInstanceOf` always paired
  with an exact `reason` assertion).
- Triangulation: the `packageDir` conditional is driven by 2 test cases (present → reject,
  absent → run) plus the seed path — adequate for the delta.
- Tolerated (flagged for final): the 3 tests are `[characterization]` (test-after against
  already-landed S-000 delegation code) under a documented waiver mirroring
  `harness-opted-in.test.ts`'s precedent. The final-mode TDD-cycle aggregate should note this
  waiver rather than count it as an anti-TDD violation, since the tests were mandated by an
  evaluator finding (R-10), not written to rubber-stamp.

---

## Orchestrator action

Exit the S-000 loop. Batch 2 (S-001 + S-002 — S-002 now with the 9-file consumer set per R-9)
may start. Iteration 2 of 3 used.
