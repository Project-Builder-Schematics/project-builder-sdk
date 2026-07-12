# Verify In-Loop Result

**Change**: stage-5-first-dialect
**Iteration**: 1/3
**Scope**: S-000, S-001
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS (with followups)

All scope checks green. Loop can exit for this batch.

- Tasks in scope complete: 13/13 (S-000 3/3, S-001 10/10)
- Full suite: 689/689 passed (0 fail), 1202 `expect()` calls — `bun test`
- `bunx tsc --noEmit`: clean (exit 0)
- `bun run build`: clean (tsc build + bin bundle, exit 0)
- Spec compliance for scope: 26/27 scenarios directly evidenced (see matrix); 1 followup (DG-03.2)
- Assertion audit: clean — no banned patterns (`toBeDefined`/`toBeTruthy`/`objectContaining`/count-only) in any delta test file; all coalescing/content assertions are byte-exact per constraint 7

Orchestrator action: proceed to `/build --scope=slice:S-002` per apply-progress's own recommendation. Two non-blocking followups below should be picked up opportunistically (either now or carried into S-002/final verify).

---

## Mandatory Execution Evidence

| Check | Result |
|---|---|
| `bun test` (full suite) | 689 pass / 0 fail / 1202 expect() — up from 662 pre-batch |
| `bunx tsc --noEmit` | clean, exit 0 |
| `bun run build` | clean, exit 0 (tsc build + bin bundle) |
| `package.json#dependencies` | `{}` — confirmed NO `ts-morph` (constraint 1). `devDependencies` also clean of `ts-morph`. |
| FIT-19 mechanism-removal spot-check | Reverted `ensureOpen()`'s `pendingSnapshot().includes(...)` identity check → test failed RED exactly as apply-progress claimed (`Expected length: 2, Received length: 1`). Reverted; full suite re-confirmed green (689/689), diff clean. |
| FIT-20 mechanism-removal spot-check | Removed the eager shadow-catch (`#tail.catch(() => {})`) from `#enqueue` while keeping drain → the throwing-unawaited case crashed with an uncaught rejection exactly as apply-progress claimed ("crashed Bun's own test runner"). Reverted; full suite re-confirmed green (689/689), diff clean. |
| Frozen literals byte-exact | `"dialect operation failed: "` prefix + all four tails (`raw() on "{path}" threw`, `could not parse "{path}" as TypeScript`, `could not print "{path}"`, the QUOTED not-found tail `"{path}" does not exist — create it first in this run`) verified byte-exact in `src/core/dialect-handle.ts` against design §4.4's table and the verify-plan-4 quoted-tail amendment. `.cause` confirmed `undefined` via direct test assertions (`err.cause`) in both `dialect-handle.test.ts` and `toy-dialect-skeleton.e2e.test.ts`. |
| Constraint 7 (content, never count-only) | Every coalescing assertion inspected (`dialect-handle.test.ts`, `fit-19`, `fit-20`, `toy-dialect-skeleton.e2e.test.ts`) pairs a length assertion with a `.toBe(...)`/`.toEqual(...)` exact-content assertion — none rely on length alone. |

## Completeness (S-000 + S-001)

| Slice | Tasks | Status |
|---|---|---|
| S-000 | 3/3 | complete |
| S-001 | 10/10 | complete |

## Spec Compliance Matrix (scope: S-000 + S-001)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-FIT-01 | transitive walk catches ts-morph via helper.ts | `fit-01-commons-no-ast.test.ts` (permanent-fixture) | ✅ COMPLIANT |
| REQ-FIT-01 | 3 pre-existing red-proofs (direct/builtin/../core) still hold | `fit-01-commons-no-ast.test.ts` | ✅ COMPLIANT |
| REQ-DG-01.1 | 5th descriptor field is compile error | `test/types/define-dialect.test.ts` | ✅ COMPLIANT |
| REQ-DG-01.2 | `find` is the entry verb, returns open Handle | behavioral evidence via toy-dialect e2e/unit tests | ✅ COMPLIANT |
| REQ-DG-02.1 | chain type-checks only through attached ops | `test/types/define-dialect.test.ts` | ✅ COMPLIANT |
| REQ-DG-02.2 | single-pack, no collision diagnostic asserted | vacuous by construction (one pack only) | ✅ COMPLIANT |
| REQ-DG-02.3 | `defineOpPack` standalone | `test/types/define-dialect.test.ts` | ✅ COMPLIANT |
| REQ-DG-03.1 | named-op then `.raw()`, coalesce, both mutations | `dialect-handle.test.ts` REQ-MC-01.1 (same content shape, different REQ label) | ✅ COMPLIANT (evidenced under MC-01.1) |
| REQ-DG-03.2 | `.raw()` FIRST then named op, same coalescing | **no test found** | ❌ UNTESTED — see Finding 1 |
| REQ-DG-05.1 | throwing `.raw()` contained, frozen prefix, no `.cause` | `dialect-handle.test.ts`, `fit-20`, e2e | ✅ COMPLIANT |
| REQ-DG-05.2 | unparseable content contained, same shape | `dialect-handle.test.ts` (PARSE_FAIL_SENTINEL) | ✅ COMPLIANT |
| REQ-MC-01.1 | 2 ops, no read, 1 modify, byte-exact | `dialect-handle.test.ts` | ✅ COMPLIANT |
| REQ-MC-01.2 | 2 independent handles, 2 paths, no cross-contamination | `dialect-handle.test.ts` | ✅ COMPLIANT |
| REQ-MC-02.1 | split-by-read, 2 modifies, byte-exact both | `dialect-handle.test.ts`, `fit-19` | ✅ COMPLIANT |
| REQ-MC-02.2 | mid-chain read observes own writes | `dialect-handle.test.ts` | ✅ COMPLIANT |
| REQ-MC-02.3 | cross-path read splits open handle (global trigger) | `dialect-handle.test.ts` | ✅ COMPLIANT |
| REQ-MC-04.1 | unseeded find()-only chain rejects at frozen not-found | `dialect-handle.test.ts` | ✅ COMPLIANT |
| REQ-MC-05.1 | dryRun shows 1 planned modify, zero getter calls | `dialect-handle.test.ts` (printCalls spy) | ✅ COMPLIANT |
| REQ-MC-06.1 | forgotten-await joins; throwing unawaited rejects contained, no unhandledRejection | `fit-20` (both cases), e2e | ✅ COMPLIANT |
| REQ-MC-07.1 | sequential awaited same-path, cumulative split modifies | `dialect-handle.test.ts` | ✅ COMPLIANT |
| MC-07 boundary | concurrent same-path UB never asserted | confirmed absent (grep found no concurrent-same-path assertion) | ✅ COMPLIANT (constraint 6) |

26/27 direct scenario-level checks compliant; 1 untested (Finding 1, non-blocking).

## Assertion Quality / Strict TDD (in-loop, delta scope)

- **Banned patterns**: none found in any S-000/S-001 delta test file.
- **Triangulation**: `#ensureOpen`'s identity-check branch has ≥2 driving cases (no-read vs. split-by-read); the coalescing/join mechanisms are each exercised by ≥2 distinct scenarios. No triangulation gaps in scope.
- **TDD cycle evidence**: this project's established house convention (already accepted across stage-2/3/4 cycles) bundles implementation + its driving tests into one commit per task rather than separate RED/GREEN commits; apply-progress.md's TDD Cycle Evidence table documents genuine RED findings during development (e.g., the `.raw is not a function` chaining bug — 4 tests failed for this reason before the fix, consistent with the code's current `return handle` pattern). Consistent with prior accepted cycles — not flagged as a violation.
- **Regression**: full suite green, no regressions (662 → 689, delta of +27 fully attributable to the new S-000/S-001 tests).

## Findings

### Finding 1 — WARNING (routing: LOCAL, non-blocking for this iteration)
**REQ-DG-03.2 has no dedicated test.** `slices.md` explicitly claims S-001 "Covers: ... DG-03(.1,.2)". DG-03.1 (named-op then `.raw()`) is evidenced in substance by `dialect-handle.test.ts`'s REQ-MC-01.1 test. DG-03.2 — `.raw()` called BEFORE a named op on the same chain, same coalescing guarantee — has zero test coverage anywhere in this batch (`rg` across `test/core/dialect-handle.test.ts`, `test/e2e/toy-dialect-skeleton.e2e.test.ts`, `test/fitness/fit-19*`, `test/fitness/fit-20*` found no `.raw(...).push(...)` pattern). The coalescing mechanism is structurally order-agnostic (`#enqueue` treats `runOp`/`runRaw` identically — both are opaque closures appended to `#tail`), so the risk of an actual behavioral bug is low, but the scenario's own text ("coalescing holds regardless of `.raw`/named-op ordering") is an explicit order-independence claim that should have its own assertion. Per `strict-tdd-verify.md`, full REQ-ID coverage auditing is a `final`-mode-only dimension, so this does not block in-loop exit — flagged for the executor to close (a single additional test case, e.g. `find(path).raw(fn).push(x)` with byte-exact expected content) either opportunistically now or at latest before final verify.

### Finding 2 — WARNING (routing: SPEC, non-blocking, documentation debt)
**Signed spec text for REQ-FIT-01 is stale relative to the binding verify-plan-5 amendment.** `openspec/changes/stage-5-first-dialect/specs/foundations-skeleton/spec.md` REQ-FIT-01 literally reads: "with an **allow-list** = { the SDK's own `core` public symbols, Node/Bun builtins }; any other import reached at ANY depth ... → fail" — this is the target-allow-list reading. `slices.md`'s "Amendments (verify-plan-5, orchestrator latitude rulings)" section explicitly REJECTS that exact reading ("A target-allow-list reading (relative must resolve into core) is REJECTED — it turns today's legitimate `../dry-run` imports red") in favor of "zero external packages reachable from commons, not commons-only-imports-core." The shipped implementation (`test/fitness/fit-01-commons-no-ast.test.ts`'s `walkTransitiveImports`) correctly follows the RULING, not the spec's literal text — verified: it flags only bare non-builtin specifiers reached transitively, with no allow-list check against "core public symbols," and legitimate `../dry-run`-style relative edges are confirmed NOT to trip it. This is the right implementation per the binding ruling this batch was told to honor. However, the spec FILE itself was never updated to reflect that ruling (no V4/V5 micro-unfreeze for this REQ, unlike the precedent set for `OpPackFixture.exercises`), so a future reader treating the signed spec as source-of-truth would be misled about the actual enforced invariant. Recommend a spec micro-unfreeze reconciling REQ-FIT-01's wording with the ratified "zero external packages reachable" invariant before this change reaches final verify/archive.

## Deviations From Plan (apply-progress.md) — Judged

| # | Deviation | Judgment |
|---|---|---|
| 1 | ADR-0034 → ADR-0037 renumber (stage-4b collision) | SANCTIONED — matches project's own established precedent (stage-4's 0024-0028 renumber); content unchanged, header documents the collision. |
| 2 | FIT-17/18 → FIT-19/20 renumber (same collision) | SANCTIONED — same reasoning; no REQ text or spec references the literal numbers. |
| 3 | Generic default `unknown` → `any` for `Op<Ast>`/`OpPack<Ast>`/`Dialect`/`Handle` | SANCTIONED — well-reasoned, necessary fix for a real contravariance compile error the design's bare-usage intent required; explicit instantiations are unaffected (verified by reading call sites); no design intent violated. |
| 4 | `pkg-surface-baseline.json` +3 entries pulled forward from S-002 | SANCTIONED — verified via `git diff`; exactly 3 new `dialect-handle.*` entries, alphabetically placed, matches FIT-14's own self-building requirement and binding constraint 8 (no broken intermediate state). |

## Files Changed (verified against apply-progress.md's table)

Matches apply-progress.md's Files Changed table exactly — spot-checked `src/core/define-dialect.ts`, `src/core/dialect-handle.ts` (new), `src/core/context.ts`, `src/conformance/index.ts`, `openspec/decisions/0037-coalescing-seam-handle-owned.md`, all S-001 test files, and `test/fitness/pkg-surface-baseline.json`. No undisclosed file changes found.

## Risks Carried Forward

- Finding 1 and Finding 2 above — both non-blocking followups, recommend closing before final verify.
- apply-progress.md's own flag: S-002's ADR-0033 (ts-morph) will need the same renumbering treatment (next free slot 0038 at time of writing) — confirmed still accurate as of this verify pass (no new ADR landed on `main` since).

## Next Recommended

`/build --scope=slice:S-002` (per apply-progress.md's own recommendation) — S-000 GREEN confirmed, S-001 complete confirmed. S-002's halt-check (constraint 1) should re-verify FIT-01 is still green before touching `package.json#dependencies`.
