## Verify In-Loop Result

**Change**: stage-2-error-attribution
**Iteration**: 1/3
**Scope**: S-000 (walking skeleton)
**Mode**: in-loop (Strict TDD)
**Delta reviewed**: `git diff c7c46dd..HEAD` — single commit `0384950`

---

### Verdict: NEEDS_FIX

### Execution Evidence

| Command | Result |
|---|---|
| `bun test` (full suite) | 284 pass / 0 fail / 481 expect() calls across 45 files |
| `bunx tsc --noEmit` | clean, no output |
| `bun test test/fitness/` | 61 pass / 0 fail (FIT-04, FIT-10 included) |
| Mutation probe (see Finding 1) | `bun test` → still 284 pass / 0 fail with the bug reintroduced |

### Completeness

All 7 S-000 tasks in `slices.md` marked `[x]`; code inspection confirms each task's
artefact exists (`emit-rejection.ts`, rewritten `authoring-error.ts`, `session.ts` flush,
`engine-client.ts` doc note, `commons/index.ts` re-export, replaced
`error-attribution.test.ts` + `batch-cap.test.ts` pin, regenerated FIT-04 baselines).

### Findings

| # | Severity | REQ/Scenario | File:Line | Finding |
|---|---|---|---|---|
| 1 | **BLOCKER** | REQ-12.1 (error-attribution-skeleton spec.md:204-211) | `src/core/authoring-error.ts:205`, `test/skeleton/authoring-error.test.ts:101-106` | REQ-12.1 is explicitly claimed covered by S-000 (slices.md line 109-110, commit message) and its scenario text is unambiguous: *"a Session whose EngineClient.emit throws a rejection carrying failedIndex:2 for a 3-directive batch ... THEN ... the AuthoringError carries the verb and path of directive index 2 — NOT index 0."* No test in the delta exercises this. The only ≥3-directive, non-zero-failing-index test (`REQ-AEC-03.1`, `authoring-error.test.ts:101-106`) uses three same-verb `create` ops and asserts **only** `appliedCount`, never `verb`/`path`. All 8 cases in the REQ-AEC-01.1 table use single-directive batches (`failedIndex:0`), and the cross-boundary test (`error-attribution.test.ts`) is also single-directive. **Empirical proof**: I reverted `src/core/authoring-error.ts:205` from `batch.instructions[raw.failedIndex]` to `batch.instructions[0]` (reintroducing the exact bug the stage exists to kill) and ran `bun test` — all 284 tests still passed, 0 failures. This is precisely the regression REQ-14's own text warns about ("a single-directive scenario cannot see the `instructions[0]` bug this REQ exists to kill") and the mutation is unguarded today. Fix reverted after the probe; working tree confirmed identical to `HEAD` before returning this report. |
| 2 | WARNING | REQ-AEC-04.2 (authoring-error-contract spec.md:201-207) | `test/fitness/fit-04-dts-semver-gate.test.ts:76-102` | `DTS_PAIRS` monitors `commons/index.d.ts` (bare `export { AuthoringError }` re-export) and the pre-existing handle-state/base-handle pairs, but has no pair for `dist/core/authoring-error.d.ts` — confirmed by `bun run build` + inspection: the real field shape (`verb`/`path`/`reason`/`origin`/`appliedCount`, the six/two-value union literals) lives entirely in `core/authoring-error.d.ts`, not inlined in `commons/index.d.ts`. REQ-AEC-04.2's literal scenario text passes today (the type is correctly declared, and the commons-boundary diff is additive), but a *future* breaking change to `AuthoringError`'s shape or union growth would go undetected by FIT-04 — the same "name re-exported, shape lives elsewhere" gap stage-1 solved for `FoundHandle`/`WritableHandle` via dedicated baseline pairs was not replicated here. Self-reported honestly by the executor in apply-progress (engram obs #739) as out of S-000's authorized file-touch scope. Recommend closing before this change reaches final verify: add `core.authoring-error.d.ts` baseline + `DTS_PAIRS` entry, mirroring the `core.handle-state`/`core.base-handle` pattern. |

No other REQ/scenario gaps found. `primaryPath` correctly uses the source-side path for
both collision and not-found forms across all six verbs (design §4.3); `EmitRejection`
never crosses to `./commons` or `src/core/index.ts` (confirmed by grep + FIT-10 pass);
`originFor`'s exhaustive switch + `never`-arm compile-time pin match ADR-0021; message
templates match the three-way REQ-AEC-06 table exactly; literal-message pins
(`batch-cap.test.ts`, `error-attribution.test.ts`) were rewritten in the same commit as
the format change; FIT-04's `commons.index`/`index` baselines were regenerated and the
delta is additive-only (new lines only, no removed baseline lines).

### Coverage Delta (S-000's claimed 24 scenarios)

| Scenario | Evidenced? |
|---|---|
| REQ-ERM-01.1–.3 | ✅ (`test/fake/emit-rejection.test.ts`) |
| REQ-ERM-02.1 | ✅ (`fit-10-...test.ts` permanent-fixture) |
| REQ-ERM-03.1–.4 | ✅ (`authoring-error.test.ts`) |
| REQ-AEC-01.1–.5 | ✅ (`authoring-error.test.ts`) |
| REQ-AEC-02.2 | ✅ |
| REQ-AEC-03.1 | ✅ (numeric/presence only — appropriately scoped) |
| REQ-AEC-04.1 | ✅ (`error-attribution.test.ts`, imports from `./commons`) |
| REQ-AEC-04.2 | ⚠️ passes today, monitoring gap — see Finding 2 |
| REQ-AEC-06.1–.3 | ✅ |
| REQ-10.1–.2 | ✅ |
| REQ-12.1 | ❌ **not evidenced** — see Finding 1 |
| REQ-12.2 | ✅ (`error-attribution.test.ts`, committed + staging trees empty) |

**23/24 genuinely evidenced; 1 blocker (REQ-12.1) unevidenced and unguarded against
mutation.**

### Orchestrator Action

Routing: **LOCAL** (Executor SDD-light) — this is a missing test, not an architecture or
spec defect; REQ-12.1 already specifies the correct behavior, and the production code
(`session.ts`/`authoring-error.ts`) already implements it correctly. Re-invoke `/build`
targeting: add a ≥3-directive, mixed-verb batch test (mirroring REQ-14.1's own example:
`create("a.ts")`, `create("b.ts")`, `modify("missing.ts")` failing at index 2) through
`Session.flush`/`toAuthoringError`, asserting `verb`, `path`, and `appliedCount` via
`toEqual` against the true offender (not index 0). Confirm it fails against the
`instructions[0]` mutation before landing (mutation-resistance proof). Also close Finding
2 (add `core.authoring-error.d.ts` FIT-04 baseline pair) in this iteration or explicitly
carry it as a tracked followup before final verify.

Iteration 1 of 3 used.
