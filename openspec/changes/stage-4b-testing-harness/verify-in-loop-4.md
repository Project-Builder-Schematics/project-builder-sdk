## Verify In-Loop Result

**Change**: stage-4b-testing-harness
**Iteration**: 4/3 (final gated slice — S-006 only; S-000..S-005 verified PASS in iterations 1-3, not re-litigated)
**Scope**: S-006
**Mode**: in-loop (Strict TDD)
**Commit under review**: `ead213e` (delta `170c808..HEAD`) — matches expected commit exactly.

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 6/6 (`[x]` in slices.md — gate check, fixture Create, must-fail-first test Create, `@example` verify-and-skip, README conditional revert, FIT-14 baseline verify-and-skip)
- Affected tests passed: 23/23 (delta files: `harness-opted-in.test.ts`, `testing-story-docs.test.ts`, `definefactory-jsdoc.test.ts`, `fit-14-package-surface.test.ts`)
- Full suite: 651/651 pass, 0 fail (regression-clean vs previously-passing tests)
- Typecheck (`bunx tsc --noEmit`): clean, exit 0
- Spec compliance for scope: 4/4 clauses (ATH-11.2, ATH-13.1, ATH-13.2, TSD-03.1)
- Assertion audit: clean (no banned patterns; real triangulation)
- Zero `src/` production changes: confirmed (`git diff 170c808..HEAD -- src/` empty)
- Zero new runtime dependencies: confirmed (no `package.json`/lockfile diff)

### Files touched (delta)

| File | Action | Purpose |
|---|---|---|
| `README.md` | Modify | Removed the stage-4b qualifying line, byte-exact match to REQ-FPS-05.4's literal |
| `test/fake/harness-opted-in.test.ts` | Create | ATH-11.2 + ATH-13.1/.2 |
| `test/fixtures/harness-opted-in/schema.json` | Create | `{ port: number }` per ATH-13.1 |
| `test/docs/testing-story-docs.test.ts` | Modify | TSD-03.1 assertion added |
| `test/fitness/definefactory-jsdoc.test.ts` | Modify | REQ-FPS-05.4 guard flipped presence→absence |
| `openspec/changes/stage-4b-testing-harness/slices.md` | Modify | Task checkmarks + deviation notes |

No edit to `src/core/context.ts` (design's `@example` fallback clause not triggered — `@example` already present) and no edit to `test/fitness/fit-14-package-surface.test.ts`/`pkg-surface-baseline.json` (verify-and-skip, both confirmed already current — `git diff` on both is empty).

---

### Deviation 1 — ATH-11.2 allowlist predicate widened beyond §4.6b's literal text

**Card's claim**: `defineFactory`'s opted-in branch makes TWO unconditional `node:fs` reads before `als.run` — `checkReservedNames` → `readdirSync(packageDir)` then `validateAtRunBoundary` → `readFileSync(<packageDir>/schema.json)` — both gated by the same `options.packageDir !== undefined` check, neither optional.

**Verification (read production code directly, not trusted from the card)**:
- `src/core/context.ts:197-206` — `defineFactory` returns a closure that, when `options?.packageDir !== undefined`, unconditionally calls `checkReservedNames(resolvedDir)` then `validateAtRunBoundary(resolvedDir, o)`, both before constructing `RunContext`/`als.run`. Confirmed: single gate, two calls, no further conditional between them.
- `src/core/schema/schema-discovery.ts:39-42` (`findReservedSibling`) — calls `readdirSync(packageDir)` unconditionally when invoked.
- `src/core/context.ts:98-131` (`validateAtRunBoundary`) — calls `readFileSync(schemaPath, "utf-8")` unconditionally when invoked (`schemaPath = packageDir/schema.json`).
- This is production code that predates this slice — it shipped with stage-4-typed-options' own S-006 (git-verifiable, unrelated to this delta) — so the widening reflects an *existing* discovery surface, not something this delta introduced or could avoid.

**Design's own anticipation**: the design's rev-3 record (mirrored in `.sdd/state/stage-4b-testing-harness.json`, `design_rev3` field) explicitly pre-authorized this exact contingency: *"EXECUTOR NOTE: if stage-4's merged discovery reads siblings (e.g. FIT-16 readdirSync of package dir), the ATH-11.2 allowlist predicate needs widening — check merged discovery surface when writing the test."* This is not a post-hoc rationalization by the executor — the design phase foresaw the two-read possibility and licensed the response before slicing.

**Test-side implementation quality**: `isDeclaredOptedInRead` (`test/fake/harness-opted-in.test.ts:141-146`) scopes the widened allowlist precisely — `readdirSync` only when the argument equals `FIXTURE_DIR`, `readFileSync` only when the argument equals `SCHEMA_PATH` (the fixture's exact `schema.json` path). Everything else — any other fs call, any net/Bun/fetch call, any env/argv property-get — still fails the assertion (`undeclaredFsEvents`/`otherSurfaceEvents` both asserted `toEqual([])`). The widening is scoped to exactly the two calls it needed to license, not a blanket relaxation.

**Verdict**: legitimate, evidence-backed, narrowly-scoped deviation. Not a defect.

### Deviation 2 — ATH-13 asserts `AuthoringError` shape instead of interim plain `Error`

**Card's claim**: the spec's literal text anticipates a plain-`Error`/`unknown` interim window "until stage-4's S-006 lands," but that window has already closed on this merge base because stage-4's own S-006 (already archived) upgraded rejections to `AuthoringError`.

**Verification**:
- Spec text itself, `openspec/changes/stage-4b-testing-harness/specs/author-test-harness/spec.md:310-311`: *"Post-S-006, the same rejection upgrades to `AuthoringError` with an author-assertable `reason`, and this REQ's scenarios re-verify against that shape at that time."* — the spec's own words license re-verifying against `AuthoringError` once S-006 lands, not just tolerate it as an alternative reading.
- `openspec/decisions/0027..0031-*.md` — all five ADRs show `Status: Accepted (2026-07-11, promoted at stage-4-typed-options archive)`, confirming stage-4-typed-options has archived (the slice's own GATE task condition).
- `git log` confirms commit `6bbd9f2` — `"feat(schema): stage-4 S-006 — AuthoringError finalization for typed-input rejections"` — exists in history, predates this delta.
- `src/core/schema/input-rejection.ts:21-35` — `rejectionFor`/`rejectionForReservedName` construct `new AuthoringError({..., reason, message})`, not a plain `Error`. Read directly, not inferred from the commit message.
- The already-green `test/skeleton/run-boundary-validation.test.ts` (pre-existing, unrelated to this delta) independently exercises the same code path and shape — corroborates this isn't a new claim invented for this slice.

**Verdict**: legitimate. The spec's own re-verify clause is the license; the archive/promotion/commit/source evidence all confirm the precondition ("S-006 has landed") is factually true on this merge base. Tests are correctly tagged `[characterization]` per the project's own RED-posture taxonomy (pins pre-existing production behavior, RED-first justifiably waived). Not a defect.

---

### TSD-03 README revert + regression guard

- `README.md` diff removes exactly the qualifying line, byte-for-byte identical to the literal pinned in the merged `openspec/specs/factory-package-shape/spec.md:127` (REQ-FPS-05.4) and to the constant asserted in both test files — no other README content touched.
- `test/fitness/definefactory-jsdoc.test.ts` — flipped from `expect(readme).toContain(...)` to `expect(readme).not.toContain(...)`. The constant literal is unchanged (still byte-pinned), only the assertion direction flipped, with an inline comment explaining why this file (stage-4-owned) is the permanent regression guard against ever reintroducing the stale qualifier. Sound — this guard now fails if a future change resurrects the line.
- `test/docs/testing-story-docs.test.ts` gained `REQ-TSD-03` as a new `describe` block (not a new file — the card's task list didn't name one, and design's purpose text for this file already anticipated the assertion; the file's own prior header comment forward-referenced "S-006's scope"). Reasonable placement, no orphaned coverage.

### Strict TDD (in-loop audit)

**Iteration**: 4
**Verdict**: ok
**Delta scope**: 3 test files touched (1 create, 2 modify) + 1 fixture create

**Findings**: none.

- TDD adherence (light): `harness-opted-in.test.ts` tagged `[must-fail-first]` at the file/task level for ATH-11.2 (genuine RED→GREEN, verified against production code above) and `[characterization]` for ATH-13.1/.2 (pins pre-existing behavior, RED waived per the project's own documented taxonomy — a legitimate category, not an ad hoc excuse).
- Banned assertion patterns (delta only): none found — scanned all three delta test files for `toBeDefined()`, `toBeTruthy()`/`toBeFalsy()`, `objectContaining` as sole assertion, `not.toThrow()` as sole assertion. Assertions throughout are exact-value (`toEqual`, `toBeInstanceOf` + a follow-up field-level `toEqual`).
- Triangulation: `isDeclaredOptedInRead`'s two-branch conditional (readdirSync-path vs readFileSync-path) is exercised by a single test that asserts BOTH branches fire (`declaredFsEvents.map(...).sort()).toEqual(["readFileSync", "readdirSync"])`) plus the negative space (`undeclaredFsEvents` empty) — this is genuine triangulation of the predicate, not a single blind-spot case.
- Regression: full suite 651/651 pass — no previously-passing test broken by this delta.

### Tolerated for now (flagged for final)

- None beyond what final-mode will re-audit anyway (mutation testing, full REQ-ID coverage matrix) — those are out of in-loop's scope by design and were already covered across iterations 1-3 for S-000..S-005; S-006 adds ATH-11.2/ATH-13.1/ATH-13.2/TSD-03.1 which final mode will fold into the aggregate.

---

Orchestrator action: exit loop — S-000..S-006 (all slices) are now complete and PASS. Proceed to `/evaluate` (`sdd-verify --mode=final`) before archive. Final mode should aggregate this in-loop's TDD evidence with iterations 1-3, run the full REQ-ID coverage matrix (28 REQs / 54 scenarios per the coverage-check table), the code-audit pre-pr gate, and — since this change is triage L — flag `adversarial_review: required` for judgment-day.
