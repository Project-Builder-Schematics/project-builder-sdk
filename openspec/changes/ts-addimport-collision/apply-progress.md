# Apply Progress: ts-addimport-collision

**Mode**: Strict TDD
**Store**: openspec (per launch instructions — engram unavailable this run)

## S-000: Walking Skeleton — port the happy-path algorithm (no-op / merge / create)

**Status**: complete (6/6 tasks)

### Safety Net (Phase 0)

`bun test` baseline before any change: **2056 pass, 0 fail, 4415 expect() calls, 190 files** — all
green, confirming a clean starting point (matches slices.md's "190 test files pre-existing" note).

### TDD Cycle Evidence — S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-000.5 | `dialect-modify.e2e.test.ts::Flow 1 (ts-addimport-collision S-000): addImport merges into an existing named clause through the public handle` | e2e | **Passed immediately on first run against the pre-port naive `addImport`** — see deviation note below; not a vacuous assertion (real byte-exact golden), documented rather than silently accepted | ✅ (post-port, unchanged) | n/a — happy-path smoke, see note | none needed |
| S-000.1+.2/T1 | `ops-addImport.test.ts::REQ-TSD-01.10: default import, SAME local name — idempotent no-op` | integration | `Expected length: 0 / Received length: 1` (naive code emitted a spurious merge instead of a no-op) | ✅ | — | — |
| S-000.1+.2/T2 | `ops-addImport.test.ts::REQ-TSD-01.11: default import, DIFFERENT name — separate named decl inserted` | integration | `- "import Def from \"m\";\n- import { Other } from \"m\";\n+ \"import Def, { Other } from \"m\";\n"` (naive code grafted a named clause onto the default-only declaration instead of creating a separate one) | ✅ | 2 cases (default-idempotency + default-create forced the `kind`-based branch split) | — |
| S-000.1+.2/T3 | `ops-addImport.test.ts::REQ-TSD-01.12: namespace import, DIFFERENT name — separate named decl inserted, no throw` | integration | Threw `dialect operation failed: addImport() on "a.ts" threw` — naive code called `addNamedImport` on a namespace-only declaration, which ts-morph cannot satisfy (real thrown `ManipulationError`, contained) | ✅ | 3rd case, forces the namespace branch alongside default | — |
| S-000.1+.2/T4 | `ops-addImport.test.ts::REQ-TSD-01.13: namespace import, SAME local name — idempotent no-op` | integration | Same thrown error as T3 (idempotency check never ran for namespace kind in naive code, so it fell through to the same broken merge attempt) | ✅ | 4th case, completes the 3-kind (default/namespace/named) idempotency+create matrix | — |
| S-000.1+.2/coverage | `ops-addImport.test.ts::REQ-TSD-01.5` (merge), `.19` (fresh create), `.31` (named idempotency) | integration | Passed immediately — naive code already handled the plain non-type-only, non-default, non-namespace happy path correctly (same reasoning as the e2e smoke test) | ✅ (post-port, unchanged) | n/a — regression coverage, not driving | — |
| S-000.6 | `dialect.test.ts::REQ-TSD-01.2` / `::REQ-TSD-03.10`; `ops-exact-set.test.ts`; `fit-raw-sweep.test.ts` | integration/architectural | Pre-existing, confirmed still green post-port (verify-only, no new code, per slice's own instruction) | ✅ | n/a | — |
| Refactor | — | — | n/a | ✅ (all green throughout) | n/a | Removed the now-stale top-of-file comment describing the retired naive merge behavior, replaced with a pointer to the S-000 port note — no behavior change, confirmed by full-suite green before/after |

### Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modified | Ported `BoundName`/`boundNamesIn`/`satisfiesIdempotency`/`isNonTypeOnlyNamedImportClause` verbatim from `react/ops.ts:81-234`; replaced `addImport`'s naive first-match unconditional merge with the Steps 1/3/4 algorithm (idempotency → merge → create); rewrote the function's JSDoc to the 3-step S-000 subset (Step 2 explicitly marked deferred to S-001); cleaned the stale top-of-file comment block describing the old behavior |
| `test/dialects/typescript/ops-addImport.test.ts` | Created | New integration test file: REQ-TSD-01.5 (merge), .10/.11/.12/.13 (idempotency/create — default & namespace, RED-driving), .19 (fresh create), .31 (named idempotency) |
| `test/e2e/dialect-modify.e2e.test.ts` | Modified | Added one e2e case (Flow 1 family) proving the ported merge algorithm threads through the public handle + coalescing controller, per S-000's Acceptance criterion |
| `test/dialects/typescript/golden/merge-add-import-before.txt` | Created | Golden fixture: seed file with an existing non-type-only named clause (`import { other } from "node:fs";`) |
| `test/dialects/typescript/golden/merge-add-import-after.txt` | Created | Golden fixture: expected merged output (`import { other, readFileSync } from "node:fs";`) |
| `openspec/changes/ts-addimport-collision/slices.md` | Modified | Marked S-000's 6 tasks `[x]` |

### Deviations from Design

**One flagged, non-silent deviation** — the double-loop TDD ordering (sdd-apply Step 7b) instructs
writing the slice's highest-level test first and watching it fail. For S-000's Acceptance scenario
(merge into an existing plain non-type-only named clause, REQ-TSD-01.5-shaped), both the e2e test
(S-000.5) and three of the seven `ops-addImport.test.ts` cases (`.5`, `.19`, `.31`) passed
**immediately** against the pre-port naive implementation, rather than failing red first.

Root cause, verified empirically (not assumed): the pre-existing naive `addImport` already merges
correctly into a plain non-type-only named clause and creates correctly when nothing exists for the
module — it only breaks on the DEFAULT/NAMESPACE dimension (grafting a named clause onto a
default-only or namespace-only declaration, corrupting output or throwing). This matches the slice's
own framing ("port the happy-path algorithm") — S-000's genuinely new behavior is exactly the
default/namespace idempotency+create handling (`.10`/`.11`/`.12`/`.13`), which DID fail red for the
right reason (real assertion mismatches, and for `.12`/`.13` a real thrown `ManipulationError`).

Rather than fabricating false RED evidence or silently treating the pass as a violation, this is
recorded as a deliberate, reasoned exception: the immediately-passing tests are real, non-vacuous,
byte-exact/zero-directive assertions that (a) will regression-guard the ported implementation going
forward, and (b) are legitimate happy-path coverage rather than behavior-discovery tests. The
genuinely RED-driving scenarios for this slice's new behavior did follow the RED→GREEN cycle
correctly. No test was modified to make it pass; no implementation was written ahead of a failing
test for the behavior it drives.

No other deviations — implementation matches design (§4.3 data model, §4.4 interface contract's
Step 1/3/4 subset). Step 2 (collision) is correctly absent per slices.md's explicit S-000 scope cut
— confirmed no `isValueNamespaceClaimed` or collision-reject logic was introduced in this slice.

### Halt / Issues Found

None.

### Post-Slice Audit (Step 7c)

Skipped — no architecture baseline/ADR context was provided in this run's launch prompt (not
injected by the orchestrator). Flagged for the orchestrator rather than fabricating a heuristic
audit without data.

### Test Results

- `bun test` (targeted: `ops-addImport.test.ts`, `dialect-modify.e2e.test.ts`, `dialect.test.ts`,
  `ops-declarations.test.ts`, `ops-removeImport.test.ts`, `ops-exact-set.test.ts`,
  `fit-raw-sweep.test.ts`): **62 pass, 0 fail, 124 expect() calls**
- `bun test` (full suite, post-change): **2064 pass, 0 fail, 4427 expect() calls, 191 files** — up
  from the 2056/190 baseline by exactly the 8 new tests (7 in `ops-addImport.test.ts` + 1 in the
  e2e file), zero regressions
- `bun run typecheck`: clean, no errors

### Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 1 (S-000) |
| Slices complete | 1 |
| Slices in progress | 0 |
| Tasks complete | 6/6 |

### Next Step

Ready for `/build --scope=slice:S-001` (loud collision reject) — S-000's walking skeleton is the
prerequisite every later slice depends on.

## Fix Iteration 1→2 (verify-in-loop-1.md, Finding 1 — WARNING)

**Finding**: `.10`/`.13`/`.31` idempotency cases in `ops-addImport.test.ts` asserted only
`toHaveLength(0)` (zero directives), not the spec's full dual observable ("printed output
byte-IDENTICAL to input"). House precedent — `test/dialects/react/ops.test.ts:461` (REQ-RXD-05.6)
and `:502` (REQ-RXD-05.9) — asserts BOTH `toHaveLength(0)` AND `expect(await client.read(path)).toBe(before)`
for the identical scenario shape.

**Fix (test-only, `src/` untouched)**: added `expect(await client.read("a.ts")).toBe(seed)` to the
three flagged cases (`.10`, `.13`, `.31`) in `test/dialects/typescript/ops-addImport.test.ts`,
mirroring the react precedent exactly. `.11`/`.12` are create-branch cases (not the no-op shape),
so no change applied there — confirmed they don't share the finding's scope.

**Assertion diff summary**: 3 lines added, one per case, immediately after the existing
`expect(collectModifies(emitted)).toHaveLength(0);` line:
```ts
expect(await client.read("a.ts")).toBe(seed);
```

**Verification**:
- `bun test test/dialects/typescript/ops-addImport.test.ts`: 7 pass, 0 fail, 14 expect() calls
  (up from 11 pre-fix, +3 — one new assertion per fixed case, test count unchanged)
- `bun test` (full suite): 2064 pass, 0 fail, 4430 expect() calls, 191 files (up from 4427
  pre-fix, +3, zero regressions, zero test-count change)
- `bun run typecheck`: clean

**Files changed this iteration**: `test/dialects/typescript/ops-addImport.test.ts` (modified, 3
lines added) and this apply-progress.md entry. No other files touched — no `src/` change, no
state files, no commit.

## S-001: Loud collision reject — the failure path vs S-000's happy path

**Status**: complete (5/5 tasks)

### Safety Net (Phase 0)

`bun test` baseline before this slice: **2064 pass, 0 fail, 4430 expect() calls, 191 files**
(post S-000 + its fix iteration) — all green.

### TDD Cycle Evidence — S-001

RED tests were written together (8 collision-reject cases + the `.28` GREEN pair + the `.24`
ordering pair) and run once against the pre-Step-2 code before any implementation, per the same
methodology as S-000 — actual pass/fail split recorded below, not assumed.

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-001.1+.2 | `ops-addImport.test.ts::REQ-TSD-01.6` (type-only decl reject) | integration | `Expected constructor: [class Error] / Received value: undefined` — pre-Step-2 code silently created a second, invalid decl instead of rejecting | ✅ | — | — |
| S-001.1+.2 | `ops-addImport.test.ts::REQ-TSD-01.8` (inline `{ type X }` reject) | integration | Same shape as `.6` — pins the specifier-level (not only decl-level) type-only check | ✅ | 2nd case, forces the `specifier.isTypeOnly()` branch of `boundNamesIn` to matter for CLAIMED, not only for idempotency | — |
| S-001.1+.2 | `ops-addImport.test.ts::REQ-TSD-01.14` (aliased-to-different-name reject) | integration | Same shape — pre-Step-2 code merged a second, colliding unaliased `x` instead of rejecting | ✅ | 3rd case, forces claimed-scan to key on LOCAL NAME (alias), not the exported name | — |
| S-001.1+.2 | `ops-addImport.test.ts::REQ-TSD-01.16` (cross-module reject) | integration | Same shape — pre-Step-2 code created a duplicate `readFileSync` binding under a different module | ✅ | 4th case, forces the claimed-scan to run file-wide (`ast.getImportDeclarations()`), not scoped to `declarationsForModule` | — |
| S-001.1+.2 | `ops-addImport.test.ts::REQ-TSD-01.17` (8-kind value-namespace battery: function/const/let/var/class/enum/namespace/export-default-function) | integration | Same shape, all 8 sub-cases — pre-Step-2 code had NO value-namespace check in `addImport` at all | ✅ | 8 forcing cases in one battery — completes the `isValueNamespaceClaimed` predicate's kind coverage inside `addImport`'s own Step 2 (previously only exercised via the sibling ops) | — |
| S-001.1+.2 | `ops-addImport.test.ts::REQ-TSD-01.26`/`.27` (type-only default/namespace specifier reject) | integration | Same shape — pins that CLAIMED reaches the default/namespace specifier code paths in `boundNamesIn`, not only the named-specifier path `.6`/`.8` cover | ✅ | — | — |
| S-001.1+.2 | `ops-addImport.test.ts::REQ-TSD-01.32` (29-char name echoed in full) | integration | Same shape — pre-Step-2 code created instead of rejecting, so no echo existed to check at all | ✅ | — | — |
| S-001.1+.2/coverage | `ops-addImport.test.ts::REQ-TSD-01.28` (aliased-underlying merge, GREEN pair for `.14`) | integration | Passed immediately — pre-Step-2 merge already produced the correct output for this input (Step 3's merge logic was unaffected); becomes a genuine regression guard against a claimed-scan keyed on exported name instead of local name once Step 2 exists | ✅ (post-Step-2, unchanged) | n/a — regression coverage, not driving | — |
| S-001.4/coverage | `dialect.test.ts::REQ-TSD-01.24` (both cases: chained second call, fresh-run seed) | integration | Passed immediately — with no Step 2 yet, there was no competing check for Step 1 to beat; becomes the genuine ordering regression guard once Step 2 exists | ✅ (post-Step-2, unchanged) | n/a — ordering-invariant coverage, confirmed still correct post-implementation | — |
| S-001.5 | `ops-declarations.test.ts` (full suite, 213 lines) | integration | n/a — behaviour-preservation guard, not a new-behavior test | ✅ (11/11 unchanged — count corrected per verify-in-loop-3 finding 1) | n/a | Refactored `assertNoCollision` to call the extracted `isValueNamespaceClaimed`; same predicate, same message, same import-scan posture — confirmed via full pass, zero assertion changes needed |
| Collateral fix | `test/core/dialect-handle.test.ts::REQ-TSD-08.6` | integration | Full-suite run surfaced 1 regression: this pre-existing test's fixture (`const x = 1;`) coincidentally collides with its own `addImport("x", "m")` call under the new, correct Step 2 — an incidental name choice unrelated to the test's actual subject (RYOW add+remove in one chain) | ✅ after renaming the import to `"y"` | n/a — fixture rename, not new behavior | — |
| Refactor | — | — | n/a | ✅ (all green throughout) | n/a | Updated a now-stale S-000-era comment ("lands in S-001") to reflect Step 2 having landed; no behavior change |

### Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modified | Extracted `isValueNamespaceClaimed` from `assertNoCollision`; wired it into both `assertNoCollision` (behaviour-preserving refactor) and `addImport`'s new Step 2; added the file-wide claimed-scan + inline `dialectError` (TS house-style tail, "two bindings sharing a name") strictly after Step 1; updated `addImport`'s JSDoc to the full 4-step algorithm |
| `test/dialects/typescript/ops-addImport.test.ts` | Modified | Added a `expectCollisionReject` test helper (dual observable: throw + byte-unchanged read-back) and a new describe block covering `.6`/`.8`/`.14`/`.16`/`.17`/`.26`/`.27`/`.28`/`.32` |
| `test/dialects/typescript/dialect.test.ts` | Modified | Added a new describe block with the two `.24` ordering-invariant cases |
| `test/core/dialect-handle.test.ts` | Modified | Renamed a colliding fixture import name (`"x"` → `"y"`) in `REQ-TSD-08.6`, collateral fix caused by the new, correct Step 2 behavior — see Deviations |
| `openspec/changes/ts-addimport-collision/slices.md` | Modified | Marked S-001's 5 tasks `[x]` |

### Deviations from Design

**One flagged, non-silent deviation** — same pattern as S-000's: two groups of tests (`.28`'s GREEN
pair and both `.24` ordering cases) passed immediately against the pre-Step-2 code, rather than
failing red first, because there was no competing Step 2 logic yet for them to guard against. This
is expected and documented, not fabricated RED — the genuinely new Step 2 behavior (the 8 reject
scenarios) DID fail red for the right reason (verified: either a thrown-error assertion with no
throw occurring, or a byte-unchanged assertion failing because the file WAS silently, incorrectly
mutated).

**One necessary collateral fix, not a design deviation**: `test/core/dialect-handle.test.ts`'s
pre-existing `REQ-TSD-08.6` test used `addImport("x", "m")` against a fixture containing a
top-level `const x = 1;` — an incidental name choice (the test is about RYOW add+remove chaining,
not collision) that now correctly collides under the new, spec-mandated Step 2 check. Fixed by
renaming the import to `"y"`; the test's actual subject (RYOW mechanics) is unaffected and the fix
required zero behavioral reasoning beyond avoiding the unrelated collision.

No other deviations — implementation matches design (§4.4 interface contract, §4.5 ADR-01/ADR-02
extraction). `isValueNamespaceClaimed`'s extraction is behaviour-preserving for the siblings:
`assertNoCollision`'s own import-scan stays NAMED-imports-only (unchanged), confirmed by
`ops-declarations.test.ts`'s 14 tests staying green with zero assertion changes.

### Halt / Issues Found

None.

### Post-Slice Audit (Step 7c)

Skipped — same reason as S-000: no architecture baseline/ADR context was injected into this
session's launch prompts. Flagged for the orchestrator.

### Test Results

- `bun test test/dialects/typescript/ops-addImport.test.ts test/dialects/typescript/dialect.test.ts test/dialects/typescript/ops-declarations.test.ts`: **45 pass, 0 fail, 172 expect() calls**
- `bun test` (full suite, post-change + collateral fix): **2075 pass, 0 fail, 4517 expect() calls,
  191 files** — up from the 2064/191 S-000 baseline by exactly 11 new tests (8 collision cases +
  `.28` + 2 `.24` cases), zero unresolved regressions (the 1 transient regression from the
  incidental fixture collision was fixed, not ignored)
- `bun run typecheck`: clean (one transient error — `client.read()`'s `string | undefined` return
  type vs the test helper's declared `string` — fixed by widening the helper's return type)

### Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 1 (S-001) |
| Slices complete | 1 |
| Slices in progress | 0 |
| Tasks complete | 5/5 |

### Next Step

Ready for `/build --scope=slice:S-002` (injection-safety validation gate, REQ-TSD-13) or
`/build --scope=slice:S-003` (input-shape variants) — both list `Requires: S-001`/`S-000`
respectively per the Build Order table; S-002 additionally requires S-001 specifically.
