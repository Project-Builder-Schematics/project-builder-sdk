# Verify In-Loop Result

**Change**: stage-6-release-shape
**Iteration**: 1/3 (verify-in-loop-4 in the change-wide sequence)
**Scope**: S-005 (planning-doc reconciliation — FINAL slice; all 6 slices now claim complete)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit — this change is ready for `/evaluate` (verify --mode=final).

- Tasks in scope complete: 2/2 (S-005.1, S-005.2)
- Full suite: 1109 pass / 0 fail, verified independently across 2 full runs + 1 isolated-file run (20/20), all stable
- Typecheck (`tsc --noEmit`, repo root): clean
- Spec compliance for scope: 10/10 scenarios (REQ-AOD-09.1/.2/.3/.4/.5/.6, REQ-AOD-10.1, REQ-AOD-12.1/.2/.3)
- Assertion audit (delta: 10 new tests in `test/docs/doc-set-content.test.ts`): clean — no banned patterns
- Semantic cross-check against real repo state (ledger dispositions, sensitive-areas posture): clean, see below

## Completeness (Step 4)

| Slice | Task | Status |
|---|---|---|
| S-005 | S-005.1 (extend `doc-set-content.test.ts`) | [x] complete |
| S-005 | S-005.2 (ROADMAP/pending-changes/problem-statement/objectives-plan/sensitive-areas) | [x] complete |

All 6 slices (S-000..S-005) now checkboxed complete in `slices.md`. Confirmed — this is the last slice in Build Order.

## Correctness — Static Spec Match (Step 5)

| REQ | Structural evidence | Result |
|---|---|---|
| REQ-AOD-09.1 | `openspec/pending-changes.md` rows 27/33/34/35/86/143 struck through, each carrying `RETIRED — \`stage-6-release-shape\`` marker (6 occurrences, exact) | ✅ present |
| REQ-AOD-09.2 | Row 74 ("EmitRejection port conformance...") Stage cell no longer `**6**`; reads `engine repo, cross-repo flag (with PC-PROTO-01)` — row stays OPEN, not closed | ✅ present |
| REQ-AOD-09.3 | `ROADMAP.md`: "Stage 6 — release shape (2026-07-14): ... delivers RELEASE-READINESS, not a release ... The first LIVE publish is a separate, future gate" | ✅ present |
| REQ-AOD-09.4 | Rows 56 (`BATCH_CAP_BYTES`) and 142 (provenance go-live checklist), Stage cell = `PC-PROTO-01 / public-package plan` on both — OPEN, not closed | ✅ present |
| REQ-AOD-09.5 | Row 175 (`RunResult.error`'s typed union), Stage cell = `sdk-kit extraction / public-package plan`, prose explicitly "superseding the V1 ... trigger" — OPEN, not closed | ✅ present |
| REQ-AOD-09.6 | New row: "GitHub Environment required-reviewers gate is a MANDATORY precondition of removing `--dry-run`" — deferred to the public-package plan | ✅ present |
| REQ-AOD-10.1 | `openspec/objectives-plan.md` End-state section (`## End state — what exists when the whole plan is complete`): demo paragraph reads "...calls `dryRun()` to show its coalesced-IR plan ... BEFORE opening a dialect handle or reading anything, then opens `app.module.ts` via the dialect handle..." — `dryRun()` textually precedes "dialect handle" | ✅ present |
| REQ-AOD-12.1 | `openspec/sensitive-areas.md` deployment row: confidence `medium`, `.github/workflows/publish.yml` in paths, hardened posture (SHA-pins, repo-owner guard, trigger-surface restriction) noted | ✅ present |
| REQ-AOD-12.2 | Supply-chain row: `dist/core/**` ship-not-strip decision (REQ-FPS-06) + SHA-pin convention (REQ-PPH-02) noted | ✅ present |
| REQ-AOD-12.3 | "Review Required" section rewritten: "All rows above now reflect CONCRETE, landed code..." (was "All entries are `confidence: low` and **anticipated** — none reflect existing code") — blanket-wrong sentence corrected, `security (IPC)` named as the sole remaining lower-confidence row | ✅ present |

## CRITICAL Semantic Cross-Check (ledger dispositions vs real repo state)

This is the check the launch instructions flagged as the one token-scans can miss. Verified against the actual repo, not the claim text.

**RETIRED rows — deliverable actually shipped:**

| Row | Claimed deliverable | Verified against |
|---|---|---|
| 27 (W3 guard) | `publish.yml` repo-owner guard | `.github/workflows/publish.yml:25` — `if: github.repository == 'Project-Builder-Schematics/project-builder-sdk'` — present |
| 33 (SHA pins) | `actions/checkout` + `actions/setup-node` pinned | `publish.yml:34,40` and `ci.yml:19` — both pinned to 40-hex SHAs with `# vX.Y.Z` comments — present |
| 34 (dist/core doc) | `dist/core/**` documented not stripped | `README.md:75-78` ("`dist/core/**` ships, documented, not stripped..."); `openspec/sensitive-areas.md` supply-chain row also references it — present |
| 35 (prebuild clean) | `prebuild` script added | `package.json:63` — `"prebuild": "rm -rf dist"` — present |
| 86 (demo restructure) | `dryRun()` before dialect-open in the end-state demo | `openspec/objectives-plan.md` End-state section — confirmed above (REQ-AOD-10.1 row) — present |
| 143 (README front-door) | Dialect entry linked from README | `README.md:9-12` — links `docs/authoring-a-dialect.md` — present |

All 6 retired rows have real, verifiable deliverables in this worktree. No row was retired without its backing work existing.

**RE-TAGGED rows — still OPEN, correctly re-tagged, never claimed as delivered:**

| Row | Disposition | Verified |
|---|---|---|
| 74 | Stage cell moved off `**6**` to `engine repo, cross-repo flag (with PC-PROTO-01)` | Row text unmodified (not struck through), no `RETIRED` marker — confirmed OPEN |
| 56 | Stage cell → `PC-PROTO-01 / public-package plan` | Row text unmodified, no `RETIRED` marker — confirmed OPEN |
| 142 | Stage cell → `PC-PROTO-01 / public-package plan` | Row text unmodified, no `RETIRED` marker — confirmed OPEN |
| 175 | Stage cell → `sdk-kit extraction / public-package plan`, superseding V1 trigger in prose | Row text unmodified, no `RETIRED` marker — confirmed OPEN |

Zero re-tagged rows were closed. This is the binding constraint the launch instructions called out as a CRITICAL finding if violated — confirmed clean.

**Sensitive-areas posture vs S-002's actual shipped work:**

Cross-checked `openspec/sensitive-areas.md`'s new deployment-row claims directly against the real workflow files (not against S-002's apply-progress prose):

- "SHA-pins" claim → confirmed: `publish.yml`/`ci.yml` both pin `actions/checkout`; `publish.yml` also pins `actions/setup-node`.
- "repo-owner guard" claim → confirmed: the `if: github.repository == '...'` line exists on the `publish` job.
- "trigger-surface restriction" claim → confirmed: `publish.yml`'s `on:` block is `push: branches: [main]` only, no `pull_request`/`workflow_dispatch`.
- "job-scoped `id-token: write`" (mentioned in the row's Note, not the headline sentence) → confirmed: workflow-level `permissions` has only `contents: read` (line 14-15); `id-token: write` lives inside the `publish` job's own `permissions` block (lines 29-31).

The posture description in `sensitive-areas.md` is not aspirational — every clause maps to a real line in the committed workflow files. No drift found.

## TDD Compliance (Strict TDD, delta only — Step 7)

Delta scope: 1 test file (`test/docs/doc-set-content.test.ts`, extended — 10 new tests, 5 new `describe` blocks), 0 new implementation files (docs/planning-doc content only, no `src/` change, consistent with this slice's own binding constraint).

- **RED evidence**: apply-progress quotes genuine failing assertions for all 10 new tests, run in isolation before implementation (`bun test test/docs/doc-set-content.test.ts` → 10 pass pre-existing / 10 fail new, no import/syntax errors) — consistent with the isolated-file GREEN run I reproduced (20/20 pass, matching 10 pre-existing S-004 + 10 new S-005).
- **Self-caught test-code bugs**: 2 of the 10 tests (REQ-AOD-09.4, REQ-AOD-09.5) initially used substring checks that broke on legitimate prose differences (capitalization drift on row 56's fragment; row 175 legitimately retaining V1 wording in a parenthetical per the REQ's own "superseding" language). Both were caught before returning, fixed with the `lastTableCell()` helper (isolates the Stage-tag cell specifically), re-verified genuinely RED against the real unmodified rows, then GREEN. This is exactly the "self-caught, honestly re-verified RED→GREEN" pattern the launch instructions asked me to check for — confirmed, not just claimed: the current implementation of `lastTableCell`/`findRowLine` (read directly, lines 132-148) is coherent with this narrative and the exact assertions (`toBe()` against an extracted cell, not `toContain()` against the whole line) match what a real fix for that bug would look like.
- **Banned assertion patterns**: none found in the 10 new tests — all assertions are `toContain`/`toMatch`/`toBe`/`toBeGreaterThan`/`toBeLessThan` against specific literal values or extracted cells, never `toBeDefined()`/`toBeTruthy()`/`objectContaining()`/snapshot-only.
- **Triangulation**: REQ-AOD-09.1 and REQ-AOD-09.4 iterate ≥2 fragments/rows in one test (6 and 2 respectively) — satisfies triangulation for their loop logic. The remaining 8 are single-case, fixed-content presence/ordering checks with no conditional/iterative logic to triangulate against (same "spec-bounded, n/a" pattern already accepted in this change's S-000/S-004 in-loop verifies) — consistent with established precedent, not a new gap.
- **Regression check**: full suite 1109/0 both before and after this slice per apply-progress, reproduced independently here (1109/0, twice).

**Strict TDD (in-loop audit) verdict: ok**

## Testing Validation (Step 8)

- **8a Static test analysis**: both S-005 tasks have corresponding tests — S-005.1 IS the test task, S-005.2 (doc edits) is exercised by the same 10 tests. No gap.
- **8b Run tests (real execution)**: `bun test` full suite run twice independently → **1109 pass / 0 fail** both times. `bun test test/docs/doc-set-content.test.ts` in isolation → **20 pass / 0 fail**.
- **8c Typecheck**: `bunx tsc --noEmit` (repo root) → clean, zero errors.
- **8d Coverage**: skipped per in-loop budget (final-mode concern).
- **8e Quality metrics**: `bun run lint` → no `lint` script configured in this project — reported cleanly as "Not available", not a failure. `tsc --noEmit` (used as the change's static-check gate) is clean.

## Deviations Judged

1. **`openspec/problem-statement.md` edited additively without a driving scenario.** Design's §4.2 File Changes table lists it `Modify` under REQ-AOD-09, but none of the REQ's six numbered scenarios name this file (only `ROADMAP.md` and `pending-changes.md` do). Verified directly: the added "Release posture (Stage 6 note, 2026-07-14)" section is factually accurate (cross-references `ROADMAP.md`'s Stage 6 note and the required-reviewers precondition, both confirmed to exist) and additive-only — it does not introduce an untested behavioural claim, and the pre-existing "L2+ out of scope" text was already correct without needing an edit. **Judgment: ACCEPT.** This is the craftsman-preamble-consistent choice — completing a design-declared file-changes row honestly rather than leaving it untouched or inventing a scenario-tested claim that doesn't exist. Non-blocking.
2. **Rows 56/142 "Stage 6 —" lead-ins dropped from prose; test fragments adjusted (test-code-only fix).** Verified: this is a genuine self-caught test bug (case-sensitive substring match broke on a legitimate prose edit), fixed by tightening the assertion to target the Stage-tag cell specifically rather than loosening it. No production/planning-doc content was altered by the fix itself. **Judgment: ACCEPT.** Matches Strict TDD discipline — RED was re-verified for real before GREEN, and the fix is a strengthening (exact `toBe()` on the tag cell) not a weakening.

## Halt / Issues Found

None.

## Next Recommended

`/evaluate` (verify --mode=final) — all 6 slices complete, full suite green and stable, typecheck clean. Reminder for the orchestrator: REQ-AOD-08 (human walkthrough) is NOT discharged by slice completion — `walkthrough-record.md` is confirmed still a template (all sections show `_(fill in: ...)_` placeholders, unchecked attestation boxes). This is expected per the G-2 ruling (steward-reckoning deliverable) and was not counted against S-005's pass verdict.
