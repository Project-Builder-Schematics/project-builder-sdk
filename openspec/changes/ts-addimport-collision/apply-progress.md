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

## S-003: Input-shape variants — merge/create branch edge data

**Status**: complete (5/5 tasks)

### Safety Net (Phase 0)

`bun test` baseline before this slice: **2075 pass, 0 fail, 4517 expect() calls, 191 files**
(post S-001) — all green.

### Pre-implementation probe (empirical, not assumed)

Before writing any test, each of S-003's ten scenarios was driven through the public handle
against the S-000/S-001 code (a throwaway probe script, not committed) to determine honestly
which shapes the ported V8 algorithm already handles correctly as a byproduct of its general
form, vs which need genuinely new logic. Result: **8 of 10 already pass** (`.7`, `.9`, `.18`
type + interface, `.20`, `.22`, `.23`, `.29`, `.30`) — the general `boundNamesIn`/
`isValueNamespaceClaimed`/`isNonTypeOnlyNamedImportClause` machinery from S-000/S-001 already
covers these shapes without any shape-specific special-casing. **2 genuinely require new
production code**: `.15` (self-alias — the current `satisfiesIdempotency` verbatim-ported from
react REJECTS `{ X as X }` instead of no-op'ing it) and `.21` (directive prologue — the current
Create branch always calls `addImportDeclaration`, which inserts ABOVE the directive, silently
neutering it).

### TDD Cycle Evidence — S-003

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-003.3 | `ops-addImport.test.ts::REQ-TSD-01.15: self-alias {X as X} — idempotent no-op` | integration | Threw `dialect operation failed: addImport("X") on "a.ts" — a value or import binding named "X" already exists...` instead of no-op'ing — `satisfiesIdempotency` did not yet recognize self-alias, so Step 1 fell through to Step 2's claimed-scan and rejected | ✅ | n/a — single-case owner-ratified deviation, explicitly bounded by the spec, not a class of inputs | — |
| S-003.4 | `ops-addImport.test.ts::REQ-TSD-01.21: directive prologue — import lands AFTER it, byte-exact golden` | integration | `Expected: "\"use client\";\n\nimport {...} ...` / `Received: "import {...} ...\n\n\"use client\";..."` — pre-fix Create branch called `addImportDeclaration` unconditionally, inserting above the directive | ✅ | 2nd case (two leading directives) forces genuine statement-counting logic — an implementation hard-coding "insert at index 1" would fail this case while passing the single-directive one | — |
| S-003.4 (triangulation) | `ops-addImport.test.ts::REQ-TSD-01.21 (triangulation): TWO leading directives` | integration | Same shape as above — both directives landed after the spuriously-inserted import instead of staying first | ✅ | completes the 0/1/2-directive matrix (0 already covered by every other create-branch case in this file) | — |
| S-003.1/coverage | `ops-addImport.test.ts::REQ-TSD-01.7` (type-only+diff-name → create), `.9` (aliased type-only → create) | integration | Passed immediately — `isValueNamespaceClaimed`'s file-wide scan and `boundNamesIn`'s specifier-level `isTypeOnly()` read already correctly exclude these from CLAIMED, ported unchanged from S-001 | ✅ (unchanged) | n/a — regression coverage, not driving | — |
| S-003.1/coverage | `ops-addImport.test.ts::REQ-TSD-01.18` (`type` alias + `interface` exempt → create, 2 sub-cases) | integration | Passed immediately — `isValueNamespaceClaimed` never checks `type`/`interface` declarations (ADR-0039 exemption, already true pre-S-003) | ✅ (unchanged) | n/a — regression coverage | — |
| S-003.2/coverage | `ops-addImport.test.ts::REQ-TSD-01.22` (multi-decl → merge FIRST, scan ALL) | integration | Passed immediately — the merge-target search already uses `.find()` (first match) and the claimed-scan already uses `.some()` over ALL `ast.getImportDeclarations()`, not scoped to one decl | ✅ (unchanged) | n/a — regression coverage | — |
| S-003.2/coverage | `ops-addImport.test.ts::REQ-TSD-01.23` (empty `{}` clause is a valid merge target) | integration | Passed immediately — `isNonTypeOnlyNamedImportClause` already checks for the `NamedImports` NODE's presence, not specifier count | ✅ (unchanged) | n/a — regression coverage | — |
| S-003.2/coverage | `ops-addImport.test.ts::REQ-TSD-01.29`/`.30` (mixed default+named: merge to named / default-name no-op) | integration | Passed immediately — `boundNamesIn` already collects BOTH the default and named clause from one declaration; this is exactly the Class A bucket-4 fix S-000's general port already closed as a byproduct, not a special case | ✅ (unchanged) | n/a — regression coverage; confirms S-000's port already subsumed this Class A member | — |
| S-003.3/coverage | `ops-addImport.test.ts::REQ-TSD-01.20` (side-effect import preserved, separate named decl, Class B) | integration | Passed immediately — `isNonTypeOnlyNamedImportClause` already returns `false` for a side-effect-only declaration (no `ImportClause` at all → `getNamedBindings()` is `undefined`), so it was never a merge target; Step 4 already inserts a fresh separate declaration | ✅ (unchanged) | n/a — regression coverage | — |
| Refactor | — | — | n/a | ✅ (all green throughout) | n/a | Rewrote `addImport`'s JSDoc Steps 1/3/4 prose to document the self-alias deviation, the first-match/side-effect-coexistence facts, and the directive-prologue placement fact — no behavior change, confirmed by full-suite green before/after |

### Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modified | Added `selfAliased` to `BoundName` + `boundNamesIn`; changed `satisfiesIdempotency` to treat a self-aliased named specifier as idempotency-satisfying (deliberate deviation, REQ-TSD-01.15); added `leadingDirectiveCount` (counts leading string-literal `ExpressionStatement`s); Create branch now calls `ast.insertImportDeclaration(directiveCount, ...)` when a directive prologue exists, `ast.addImportDeclaration(...)` otherwise (shebang path untouched — 0 directives, same branch as before); rewrote `addImport`'s JSDoc Steps 1/3/4 |
| `test/dialects/typescript/ops-addImport.test.ts` | Modified | Added a new describe block covering `.7`/`.9`/`.15`/`.18`(×2)/`.20`/`.21`(+triangulation)/`.22`/`.23`/`.29`/`.30` |
| `test/dialects/typescript/golden/directive-add-import-before.txt` | Created | Golden fixture: seed file with a `"use client";` directive prologue |
| `test/dialects/typescript/golden/directive-add-import-after.txt` | Created | Golden fixture: expected output, import inserted after the directive |
| `openspec/changes/ts-addimport-collision/slices.md` | Modified | Marked S-003's 5 tasks `[x]` |

REQ-TSD-03.8 (CRLF + addImport) was NOT modified — its golden fixtures (`crlf-add-import-before.txt`/
`crlf-add-import-after.txt`) and its test in `dialect.test.ts` already existed pre-change (from the
archived `stage-5-first-dialect` change); confirmed still green post-S-003 (regression-only, no new
code, per the slice's own "confirm .8 stays green" framing — its goldens were already committed, so
the only S-003.5 golden work was `.21`'s pair).

### Deviations from Design

**One flagged, non-silent deviation** — same pattern as S-000/S-001: 8 of the 10 covered
scenarios (`.7`, `.9`, `.18`×2, `.20`, `.22`, `.23`, `.29`, `.30`) passed **immediately** against
the pre-S-003 code, rather than failing red first. Root cause, verified empirically via a
throwaway probe before writing any test (not assumed): S-000's port of the general V8 algorithm
(`boundNamesIn`, `isValueNamespaceClaimed`, `isNonTypeOnlyNamedImportClause`) already handles
these ten shapes correctly as a natural consequence of its general form — none of them needed
shape-specific special-casing. This is consistent with the spec's own framing: `.30` is
explicitly a Class A bucket-4 member (same-local-name idempotency vs MIXED shapes) that the
port's general default/namespace idempotency logic already subsumed at S-000, and `.7`/`.9`/`.18`/
`.22`/`.23`/`.29` were never separately-naive-coded special cases in the original shipped
`addImport` to begin with — the V8 port's uniform treatment closes them for free. The genuinely
NEW behavior this slice adds — self-alias idempotency (`.15`) and directive-prologue-aware
insertion (`.21`) — DID fail red for the right reason (verified: a real thrown collision reject
where a no-op was expected, and a real byte-mismatch with the import misplaced above the
directive). No test was modified to make it pass; no implementation was written ahead of a
failing test for the behavior it drives.

No other deviations — implementation matches design (§4.3 data model's `leadingDirectiveCount`
addition, §4.4's directive-prologue Create-branch contract). The self-alias deviation's exact
mechanism (`selfAliased` field on `BoundName`, threaded through `satisfiesIdempotency`) was not
spelled out in design §4.3's terse ported-signature comment (which mirrors react's unmodified
formula) — the deviation itself IS in the algorithm digest (slices.md) and the signed spec
(REQ-TSD-01 Step 1, REQ-TSD-01.15), so this is filling in an implementation detail the design left
to the executor, not contradicting a design decision.

### Halt / Issues Found

None.

### Post-Slice Audit (Step 7c)

Skipped — same reason as S-000/S-001: no architecture baseline/ADR context was injected into
this run's launch prompt. Flagged for the orchestrator.

### Test Results

- `bun test test/dialects/typescript/ops-addImport.test.ts`: **28 pass, 0 fail, 122 expect() calls**
  (up from 16 pre-slice, +12 new tests)
- `bun test` (targeted: `dialect.test.ts`, `ops-addImport.test.ts`, `ops-declarations.test.ts`,
  `ops-removeImport.test.ts`, `ops-exact-set.test.ts`, `dialect-modify.e2e.test.ts`,
  `dialect-handle.test.ts`, `fit-raw-sweep.test.ts`): **124 pass, 0 fail, 356 expect() calls** —
  includes REQ-TSD-03.8 (CRLF+addImport) confirmed still green
- `bun test` (full suite, post-change): **2087 pass, 0 fail, 4541 expect() calls, 191 files** — up
  from the 2075/191 S-001 baseline by exactly 12 new tests, zero regressions
- `bun run typecheck`: clean, no errors

### Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 1 (S-003) |
| Slices complete | 1 |
| Slices in progress | 0 |
| Tasks complete | 5/5 |

### Next Step

Ready for `/build --scope=slice:S-002` (injection-safety validation gate — `Requires: S-001`,
already satisfied) or `/build --scope=slice:S-004` (explicit contract postures — `Requires:
S-003`, now satisfied) per the Build Order table.

## S-002: Injection-safety validation gate (REQ-TSD-13)

**Status**: complete (5/5 tasks)

### Safety Net (Phase 0)

`bun test` baseline before this slice: **2087 pass, 0 fail, 4541 expect() calls, 191 files**
(post S-003) — all green.

### Deviation caught and corrected mid-slice (self-flagged)

Implementation was drafted (import + JSDoc + inline `assertValidImportBinding(name)` call) BEFORE
the RED tests were written — a direct violation of the double-loop/RED-first discipline this
harness mandates. Caught before any test was run against it: the production edit was fully
REVERTED (three `Edit` calls undoing the import, the JSDoc rewrite, and the call site) back to
byte-identical S-003 state (confirmed via `git diff --stat` showing 0 lines, after fixing one
stray whitespace artifact from the revert itself), THEN the full RED-battery below was written and
run against the reverted (pre-S-002) code to capture real failing evidence, THEN the same
implementation was reapplied to drive GREEN. No fabricated RED evidence exists in this slice —
every row below quotes the actual pre-implementation failure.

### TDD Cycle Evidence — S-002

All 11 new test-cases were written together as one RED battery (per REQ-TSD-13's own scenario
grouping) and run once against the pre-validation-gate code; actual pass/fail split recorded
below, not assumed.

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-002.1/.3 | `ops-addImport.test.ts::REQ-TSD-13.1` (confirmed injection breakout, zero echo) | integration | `expect(caught).toBeInstanceOf(Error)` — `Received value: undefined` (no validation existed; the hostile name silently reached the Create branch, splicing raw injected syntax into the AST call rather than rejecting) | ✅ | — | — |
| S-002.1/.3 | `ops-addImport.test.ts::REQ-TSD-13.2` (11-word reserved-word/strict-mode battery) | integration | Same shape, all 11 sub-cases — `caught` was `undefined` for every reserved word (each silently created a spurious import instead of rejecting) | ✅ | 11 forcing cases in one battery — completes the 48-entry reserved-word set's coverage sample | — |
| S-002.1/.3 | `ops-addImport.test.ts::REQ-TSD-13.2` (3-entry `JSX_NAME_DENYLIST` battery, SEPARATE check) | integration | Same shape, all 3 sub-cases (`__proto__`/`constructor`/`prototype`) — no denylist check existed in `addImport` at all pre-slice | ✅ | 3rd forcing case (`prototype`) confirms the denylist check is exact-Set, not folded into the reserved-word check | — |
| S-002.1/.3 | `ops-addImport.test.ts::REQ-TSD-13.3` (5-case grammar battery: empty/whitespace/leading-digit/space/brace) | integration | Same shape, all 5 sub-cases — grammar-invalid names were never checked, all silently created spurious imports | ✅ | 5 forcing cases (empty string skipped from the zero-echo sub-assertion — `"".includes("")` is vacuously true, a deliberate assertion-design note, not a gap) | — |
| S-002.1/.3/coverage | `ops-addImport.test.ts::REQ-TSD-13.2` (lookalike substrings accepted: `classroom`/`imported`/`defaultValue`/`evaluate`/`argumentsList`) | integration | Passed immediately — with no validation gate at all pre-slice, nothing rejected these either; becomes the genuine exact-Set-vs-substring regression guard once the gate exists | ✅ (unchanged) | n/a — regression coverage, not driving | — |
| S-002.1/.3/coverage | `ops-addImport.test.ts::REQ-TSD-13.4` (`from`-escaping regression, hostile module specifier) | integration | Passed immediately — ts-morph's own string-literal escaping of `moduleSpecifier` already contained this pre-slice (this REQ pins the assumption, doesn't newly implement it); byte-exact assertion confirmed against the actual ts-morph escape output | ✅ (unchanged) | n/a — regression pin, not driving | — |
| S-002.1/.3 | `ops-addImport.test.ts::REQ-TSD-13.6` (precedence: denylisted name ALSO value-namespace-claimed) | integration | `Expected to contain: "reserved name" / Received: "...a value or import binding named \"__proto__\" already exists..."` — pre-slice, Step 2's collision check fired first (no competing validation gate), proving the ordering-sensitive assertion was real | ✅ | — | — |
| S-002.4 | `ops-addImport.test.ts::REQ-TSD-13.x-neg` (3 cases: grammar/reserved-word/denylist rejects never carry the path clause) | integration | `expect(caught).toBeInstanceOf(Error)` — `Received value: undefined` for all 3 (no reject existed yet to check the shape of) | ✅ | 3 forcing cases across all three validation branches (grammar/reserved-word/denylist), each independently proving the path clause absence, per F12's kill-the-consistency-fix-mutant framing | — |
| S-002.2/.5 | `ops-addImport.test.ts::JSDoc trust-boundary guard` (scans `ops.ts` source for the `Trust boundary` block) | architectural | `expect(trustBoundaryBlock).toBeDefined() / Received: undefined` — no `Trust boundary` JSDoc block existed in `ops.ts` pre-slice | ✅ | n/a — single structural assertion, not a class of inputs | — |
| Refactor | — | — | n/a | ✅ (all green throughout) | n/a | None needed — the implementation (one import + one call + one JSDoc rewrite) was already minimal; no post-GREEN cleanup found |

### Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modified | Added `assertValidImportBinding` import from `jsx-name-validator.ts` (WHY comment: misnomer + ADR-02 pointer); added the `ts-addimport-collision/S-002` paragraph to the file-header comment; added `assertValidImportBinding(name);` as `addImport`'s first statement (WHY comment: deliberate path-less shape vs Step 2's path-ful tail, REQ-TSD-13.6 precedence); rewrote `addImport`'s JSDoc — new "Step 0" validation paragraph ahead of Steps 1-4, and a trailing "Trust boundary (REQ-TSD-13.5)" paragraph affirmatively naming `addFunction`/`addVariable`/`addClass`'s `name`/`source`/`initializer` as RAW-SPLICED, unvalidated by this change |
| `test/dialects/typescript/ops-addImport.test.ts` | Modified | Added `readFileSync` import; updated the file-header comment with an S-002 paragraph explaining `expectCollisionReject`'s reuse across both reject shapes; added 3 new describe blocks: REQ-TSD-13 battery (7 cases), REQ-TSD-13.x-neg (3 cases), JSDoc trust-boundary guard (1 case) |
| `openspec/changes/ts-addimport-collision/slices.md` | Modified | Marked S-002's 5 tasks `[x]` |

### Deviations from Design

**One flagged, self-corrected process deviation** (see "Deviation caught and corrected mid-slice"
above) — implementation was briefly written ahead of RED, caught before any test ran against it,
fully reverted, and redone in the correct RED→GREEN order. No implementation trace of the
premature draft remains; `git diff` on `ops.ts` before the correct RED run showed zero lines
(confirmed).

**One flagged, non-silent TDD-evidence deviation** — same pattern as every prior slice in this
change: REQ-TSD-13.4 (`from`-escaping) and REQ-TSD-13.2's lookalike-acceptance sub-case passed
**immediately** against the pre-gate code, rather than failing red first. Root cause, verified
empirically: `.4`'s safety was never a new-code claim — the spec itself frames it as "pinned by a
regression scenario, never assumed silently" against ts-morph's PRE-EXISTING string-literal
escaping; and the lookalike-acceptance sub-case is a GREEN boundary that trivially held with no
validation gate at all (nothing rejected anything). Both are legitimate regression coverage, not
fabricated RED. Every genuinely NEW-behavior case (13.1, both 13.2 reject batteries, 13.3, 13.6,
all three 13.x-neg cases, the JSDoc guard) DID fail red for the right reason (real
`caught === undefined` or real message-content mismatches), as itemized in the evidence table.

No other deviations — implementation matches design §4.4 (interface contract, inline validation
per ADR-02, two-shape reject posture) and slices.md's S-002 task list exactly. `validatedOp` was
NOT used (ADR-02 explicit decision, TS house style stays inline like `assertNoCollision`).

### Halt / Issues Found

None.

### Post-Slice Audit (Step 7c)

Skipped — same reason as every prior slice in this change: no architecture baseline/ADR context
was injected into this run's launch prompt (skipped per the audit's own `architecture.adrs is
empty` short-circuit condition, since no baseline was provided to check against). Flagged for the
orchestrator, as in S-000/S-001/S-003.

### Test Results

- `bun test test/dialects/typescript/ops-addImport.test.ts`: **39 pass, 0 fail, 254 expect() calls**
  (up from 28 pre-slice, +11 new tests)
- `bun test` (full suite, post-change): **2098 pass, 0 fail, 4673 expect() calls, 191 files** — up
  from the 2087/191 S-003 baseline by exactly 11 new tests, zero regressions
- `bun run typecheck`: clean, no errors

### Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 1 (S-002) |
| Slices complete | 1 |
| Slices in progress | 0 |
| Tasks complete | 5/5 |

### Next Step

Ready for `/build --scope=slice:S-004` (explicit contract postures — `Requires: S-003`, already
satisfied) per the Build Order table; S-005 (`Requires: S-002, S-004`) unlocks once S-004 also
lands.

## S-004: Explicit contract postures — asymmetry, shebang fallback, idempotency durability

**Status**: complete (4/4 tasks). S-004.1 was HALTED mid-slice, routed to the orchestrator, and
RESOLVED: the owner reviewed the empirical probe evidence and ratified a spec correction
("Corregir la spec") over a production-code change. Spec V3.2 (signed, `unfreeze=true`, scoped
to `.25` alone) now states the TRUE `removeImport` semantics this executor established. S-004.1 is
now pinned against the corrected scenario — see "S-004.1 — RESOLVED" below.

**Process note**: the host process crashed mid-slice, after S-004.2's and S-004.3's tests were
already written and passing on disk but before S-004.4/apply-progress/slices.md were updated.
Resumed from the saved transcript; the S-004.1 halt narrative below was authored post-crash and
every empirical claim in it was RE-VERIFIED against current HEAD after resume, not carried over
from pre-crash memory — see "Re-verification after crash-resume" below. S-004.1 itself was then
completed in a THIRD pass, after the orchestrator routed the halt to the owner and returned with
the ratified spec correction.

### Safety Net (Phase 0)

`bun test` baseline before this slice: **2098 pass, 0 fail, 4665 expect() calls, 191 files**
(post S-002, per this slice's launch prompt) — all green.

### S-004.1 — HALTED (spec/implementation mismatch, empirically confirmed)

**Task**: pin REQ-TSD-01.25's asymmetry claim — `addImport` merges FIRST-match only,
`removeImport` removes ALL matches.

**Finding**: `addImport`'s first-match-only half is real and already covered (S-003's `.22` test,
`ops-addImport.test.ts`). `removeImport`'s claimed "all-match" half is **NOT what the shipped
code does**. `removeImport` (`src/dialects/typescript/ops.ts:353-368`) walks every declaration
matching `from` to LOCATE the one containing `name`, but `return`s immediately after handling the
FIRST declaration where it finds a match — it never continues to a second declaration that also
binds the same local name.

**Empirical proof** (throwaway probe script, not committed — run twice, once before the crash and
once after resume against current HEAD, byte-identical result both times):

```ts
// seed: 'import { a, x } from "m";\nimport { y, x } from "m";\n' — "x" bound in BOTH declarations
await ts.find("a.ts").removeImport("x", "m");
// actual result: 'import { a } from "m";\nimport { y, x } from "m";\n'
// — the FIRST declaration's "x" is removed; the SECOND declaration's "x" survives untouched.
// REQ-TSD-01.25's claim ("removes x from EVERY matching declaration it appears in") would
// predict: 'import { a } from "m";\nimport { y } from "m";\n' — NOT what happens.
```

A second probe against `import { x } from "m";\nimport { y, x } from "m";\n"` (first decl is a
last-binding-only whole-statement deletion) gives the same story: only the first decl's `x` is
removed (`import { y, x } from "m";` survives as the sole remaining line).

**Root cause**: `removeImport`'s "Judgment-day round 1, Issue 2" fix (see its JSDoc and
`ops-removeImport.test.ts`'s own comment at line 86) walks every declaration to find WHICHEVER ONE
contains `name` — fixing the bug where only the first declaration was ever inspected at all. It
was never extended to continue searching for and removing ADDITIONAL occurrences once the first is
found. In ordinary use this distinction is invisible: a name can only be bound once across a
file's imports without `addImport` itself ever producing a duplicate (TypeScript would otherwise
reject the duplicate identifier), so "search every declaration, act on whichever one has it" and
"remove from every declaration that has it" are indistinguishable — UNTIL a hand-authored fixture
puts the same local name in two declarations at once, exactly as REQ-TSD-01.25's second fixture
does.

**Not an isolated misreading**: this same "removeImport iterates ALL matching declarations
(judgment-day Issue 2 fix)" framing already appears, independently, in
`openspec/pending-changes.md:341` (registered from `ts-dialect-backend-ops` planning, 2026-07-14)
and in the design.md Test Derivation table (row 114) for this change — the imprecise belief is
carried across at least three documents (JSDoc, a prior pending-changes row, and this change's own
signed spec/design), not a one-off error in the spec text alone.

**Action taken**: per the launch prompt's explicit instruction ("if a pin unexpectedly FAILS, halt
and report — do not 'fix' contract behaviour without orchestrator routing"), this task is HALTED,
not implemented and not silently skipped. No test asserting the false "all-match" claim was
written (it would be a fabricated-to-fail RED with no sanctioned fix in this pin-only slice — the
opposite of the honesty rule this harness enforces). No production code was touched.
`slices.md`'s S-004.1 checkbox is left unchecked with a pointer to this section.

**Routing recommendation for the orchestrator**: closest existing halt bucket is `spec-ambiguity`
(routes to Planner / `sdd-spec`) — though this is better described as a factual/empirical error in
an already-signed spec scenario than a wording ambiguity. Two honest paths forward, either is
spec-conformant once decided: (a) correct REQ-TSD-01.25's `removeImport` half to describe the TRUE
existing behaviour (finds and removes from whichever ONE declaration actually contains the
binding, not every one) and pin THAT instead; or (b) explicitly author a NEW behaviour change to
`removeImport` (continue the loop, remove from every matching declaration) — a real, if small,
production change outside this "pins only, zero production code" slice's own framing, needing its
own RED-GREEN cycle and its own review of blast radius (this function is exercised by
`ops-removeImport.test.ts`'s 8 existing passing tests). Not routing myself to either — this is a
product/spec decision, not an implementation judgment call.

### S-004.1 — RESOLVED: option (a), spec corrected to V3.2, ZERO production-code change

**Owner ratification**: shown the probe evidence above, the owner chose **"Corregir la spec"**
(option a) — `openspec/changes/ts-addimport-collision/specs/typescript-dialect/spec.md` REQ-TSD-01.25
is rewritten (V3.2, `unfreeze=true`, scoped to `.25` alone; ratification #5 in the spec's sign-off
history) to state the TRUE semantics: `addImport` merges into ONLY the first declaration
(unchanged); `removeImport` SEARCHES every declaration matching `from` (its judgment-day Issue 2
fix, unchanged) but REMOVES the binding from only the FIRST declaration containing it, then
returns — on the hand-authored, TS2300-compile-invalid duplicate-binding fixture, the second `x`
survives untouched. `design.md` (file table + Test Derivation row `.25`) and
`openspec/pending-changes.md:341`'s `removeImport` clause were corrected by the orchestrator in
lockstep — not touched by this executor.

**Task, as re-scoped by V3.2**: pin the corrected asymmetry as an explicit contract fact — no
production-code change (the owner ratified correcting the SPEC, not the implementation).

**Pre-write probe (Strict TDD posture for pins)**: both halves re-probed against current HEAD
before writing the committed test, to confirm the exact fixture/output pair the test would assert:
- `addImport` half: seed `import { a } from "m";\nimport { b } from "m";\n"`,
  `addImport("c", "m")` → `import { a, c } from "m";\nimport { b } from "m";\n"` (merges into the
  FIRST declaration only — same mechanism S-003's `.22` already covers, now also pinned here as
  half of the stated asymmetry fact).
- `removeImport` half: seed `import { a, x } from "m";\nimport { y, x } from "m";\n"`,
  `removeImport("x", "m")` → `import { a } from "m";\nimport { y, x } from "m";\n"` — identical to
  the halt section's probe result above (this fixture/output pair was independently re-verified a
  THIRD time here, still byte-identical).

**Mechanism-level root cause** (same as established during the halt, now the CORRECT reading):
`removeImport` (`src/dialects/typescript/ops.ts:353-368`) filters `ast.getImportDeclarations()` to
those matching `from`, then loops — `continue`ing past declarations that don't contain `name` (the
judgment-day Issue 2 fix: the search is NOT scoped to the first declaration), but `return`ing
immediately once it finds and removes the binding from the FIRST declaration that DOES contain it.
`addImport`'s merge target is `declarationsForModule.find(isNonTypeOnlyNamedImportClause)` —
`Array.prototype.find` returns the first match, unconditionally first-declaration-scoped, no
search/removal distinction to make.

**Both tests pin EXISTING, unchanged production behaviour** — genuinely green-on-arrival, not a
defect-discovery pair. No `src/` file was touched for this task; the JSDoc-only edits (below) are
comments, not behaviour.

### JSDoc alignment (comment-only, no behaviour change)

Two stale JSDoc passages referenced the disproven "all-match" framing; both corrected to state the
search-all/remove-first-hit semantics V3.2 now pins:

- `src/dialects/typescript/ops.ts` (~line 176-178, inside `addImport`'s Step 3 JSDoc): "contrast
  `removeImport`'s all-match posture" → rewritten to name the actual posture (searches every
  declaration, removes from only the first it finds the binding in) and points to
  `removeImport`'s own JSDoc.
- `src/dialects/typescript/ops.ts` (~line 341-354, `removeImport`'s own JSDoc, "Judgment-day round
  1 (Issue 2)" paragraph): tightened from "operates on whichever one actually contains `name`"
  (accurate but ambiguous about cardinality) to an explicit statement — search is all-declarations,
  removal is first-match-only, with the REQ-TSD-01.25/V3.2 cross-reference and the "why this was
  invisible on legal input" reasoning inlined.

### S-004.2 — Pin ADR-03's shebang fallback (REQ-TSD-01.33)

**Mechanism-level root cause (verified empirically before writing the test, twice — once
pre-crash, once post-resume against current HEAD, identical result both times)**: a shebang file
run through `ts.find("a.ts").addImport("readFileSync", "node:fs")` throws
`dialect operation failed: addImport() on "a.ts" threw`, `.cause` is `undefined`, zero directives
are emitted, and the read-back content is byte-identical to the seed. This matches ADR-03's own
documented finding exactly: `addImport` itself does not catch anything — ts-morph's
`insertImportDeclaration`/`addImportDeclaration` throws `ManipulationError: A syntax error was
inserted` because a shebang is `SourceFile` leading trivia, not a statement, so the Create branch's
insertion (whether prologue-aware per `.21` or not) cannot target it; the throw propagates out of
the op and is caught + branded by `dialect-handle.ts`'s `#invokeContained` (`:248-258`), the SAME
generic foreign-wrap path `REQ-TSD-04.1`/`REQ-DG-06.1` already pin for other internal ts-morph
failures.

### S-004.3 — REQ-TSD-03.11 seed-with-own-output (durability of the idempotent no-op)

**Mechanism-level root cause (verified empirically before writing the test)**: a first,
independent run applies `addImport("readFileSync", "node:fs")` against `golden
("add-import-before.txt")` and produces `golden("add-import-after.txt")` (asserted). A SECOND,
genuinely separate run (fresh `makeSpyClient`/`Project`) seeded with that exact output and given
the identical `addImport` call emits ZERO directives. This is Step 1's `satisfiesIdempotency`
check (ported at S-000, unchanged since) recognizing the already-merged unaliased named specifier
on re-parse — the same invariant `.24` already proved holds within one run/chain now holds across a
fresh run boundary reading only the prior run's printed bytes, closing exactly the gap the spec's
own justification note (row 500-507 of the spec) describes: `.10` proves duplicate CALLS in one
run don't double-emit; `.11` proves a SEPARATE run reading the prior op's own output makes no
further change at all.

### TDD Cycle Evidence — S-004

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-004.1 | `ops-addImport.test.ts::REQ-TSD-01.25: addImport merges into ONLY the first declaration…` | integration | **Passed immediately on first run** — verified-pin against V3.2; mechanism confirmed via a pre-write probe (see S-004.1 above), same mechanism S-003's `.22` already covers (`Array.prototype.find`, unconditionally first-match) | ✅ (unchanged) | n/a — single documented posture, not a class of inputs | — |
| S-004.1 | `ops-addImport.test.ts::REQ-TSD-01.25: removeImport SEARCHES every declaration…but REMOVES from only the FIRST…` | integration | **Passed immediately on first run** — verified-pin against V3.2 (the SAME fixture/output pair probed three times total across this slice's two passes, byte-identical every time); mechanism: `removeImport`'s loop `continue`s past non-matching declarations but `return`s on the first successful removal | ✅ (unchanged) | n/a — single hand-authored contract-fact fixture, not a class of inputs | — |
| S-004.2 | `ops-addImport.test.ts::REQ-TSD-01.33: a shebang file stays a HANDLE-contained fail-closed reject…` | integration | **Passed immediately on first run** — verified-pin, not a defect-discovery test; mechanism confirmed via a pre-write probe (see S-004.2 above), matching ADR-03's own documented empirical finding exactly (design.md, `ManipulationError` on shebang top-of-file insertion) | ✅ (unchanged) | n/a — single documented containment shape, not a class of inputs | — |
| S-004.3 | `dialect.test.ts::REQ-TSD-03.11: seed-with-own-output — a FRESH, separate run…` | integration | **Passed immediately on first run** — verified-pin; mechanism confirmed via a pre-write probe (see S-004.3 above), the same `satisfiesIdempotency` invariant `.24` already exercises within one run, now proven across a fresh run boundary | ✅ (unchanged) | n/a — single durability proof, not a class of inputs | — |
| Refactor | — | — | n/a | ✅ (all green throughout) | n/a | None needed — both new tests are minimal, matching existing house shapes (`expectCollisionReject`-equivalent inline assertions for `.33`; the two-run pattern already used by `.24`'s second case for `.11`) |

Both S-004.2 and S-004.3 are green-on-arrival by design (this slice's launch prompt frames this as
the expected norm for posture pins) — no implementation drove them; each row above names the real
mechanism proven by an empirical probe BEFORE the committed test was written, per the harness's
honesty rule (never fabricate RED, never assert a mechanism without locating it).

### Re-verification after crash-resume

Both empirical claims in this section were re-run against current HEAD after the crash-resume,
independent of pre-crash memory:
- The S-004.1 `removeImport` two-declaration probe: re-run, byte-identical result
  (`'import { a } from "m";\nimport { y, x } from "m";\n'`).
- `bun test test/dialects/typescript/ops-addImport.test.ts test/dialects/typescript/dialect.test.ts`:
  re-run, **59 pass, 0 fail, 306 expect() calls** — both S-004.2/.3 tests still present on disk and
  still green.

### Files Changed

| File | Action | What Was Done |
|---|---|---|
| `test/dialects/typescript/ops-addImport.test.ts` | Modified | Added a new describe block "addImport / removeImport — REQ-TSD-01.25 match-cardinality asymmetry (S-004, ts-addimport-collision, CORRECTED V3.2)" with two tests (addImport first-match half + removeImport search-all/remove-first-hit half); added a new describe block "addImport — REQ-TSD-01.33 shebang fallback (S-004, ts-addimport-collision, ADR-03)" with one test pinning the contained fail-closed reject shape; updated the file-header docstring with an S-004 paragraph covering both `.25` and `.33` |
| `test/dialects/typescript/dialect.test.ts` | Modified | Added one new test, `REQ-TSD-03.11: seed-with-own-output…`, to the existing REQ-TSD-03 describe block, immediately after `.10` |
| `src/dialects/typescript/ops.ts` | Modified (comment-only) | Two JSDoc corrections aligning with spec V3.2's `.25` semantics — `addImport`'s Step 3 paragraph (removed the "all-match posture" reference) and `removeImport`'s own "Judgment-day round 1 (Issue 2)" paragraph (made the search-all/remove-first-hit cardinality explicit). No behaviour change — confirmed by full-suite green before/after and an unchanged production diff outside comment lines |
| `openspec/pending-changes.md` | Modified | Registered the shebang-aware-insertion followup (ADR-03) under a new `From \`ts-addimport-collision\` (2026-07-21) — ADR-03 shebang-aware insertion, registered at S-004` section, matching the file's existing per-change table format. (Row 341's `removeImport` clause was separately corrected by the orchestrator, per the resume instructions — not touched by this executor.) |
| `openspec/changes/ts-addimport-collision/slices.md` | Modified | Marked S-004.1/.2/.3/.4 all `[x]` — S-004.1's checkbox note records the V3.2 correction and points to this section |
| `openspec/changes/ts-addimport-collision/specs/typescript-dialect/spec.md` | Not touched by this executor | Corrected to V3.2 by the orchestrator per the owner's ratification, before this executor's third pass began — read, not written, this pass |

### Deviations from Design

**One flagged, non-silent deviation — the same "green-on-arrival" pattern as every prior slice**:
S-004.2 and S-004.3 both passed immediately, which the launch prompt explicitly frames as the
expected norm for this slice ("mostly PINS — new production code is likely ZERO"). Each is
documented above with its real mechanism, located via an empirical probe before the test was
written, not assumed.

**One flagged, load-bearing deviation, now RESOLVED — S-004.1 was HALTED, then completed in a
third pass**: see the dedicated sections above. This was a genuine spec/implementation mismatch
discovered during apply, correctly not resolved unilaterally by this executor (the launch prompt
was explicit: "do not 'fix' contract behaviour without orchestrator routing"). The orchestrator
routed the halt to the owner, who ratified a spec correction (option a, V3.2) over a
production-code change (option b) — S-004.1 was then completed against the corrected spec text
with zero production-code change, only the two JSDoc alignments noted above.

**One flagged process note**: this slice's apply run crashed mid-execution (host process crash,
not a task failure) after S-004.2/.3's tests were written but before S-004.4/this file/slices.md
were updated. Resumed from the saved transcript per the orchestrator's resume protocol; every
empirical claim was re-verified against current HEAD post-resume rather than trusted from
pre-crash memory (see "Re-verification after crash-resume" above).

**Design/slices.md tension, noted not resolved**: design.md §4.8 frames the pending-changes
registration (item 2, shebang-aware insertion) as an ARCHIVE-time action ("Archive-time (sdd-apply,
NOT apply)... REGISTER THREE NEW rows"), while `slices.md`'s S-004.4 task explicitly schedules the
SAME registration now, at apply-time. Followed `slices.md` (the executable task list this run was
launched against, and the launch prompt's own constraints explicitly permit writing
`openspec/pending-changes.md` for S-004.4) — flagging the tension rather than silently picking one.
If `sdd-archive` later re-registers the same followup, it should recognize this row as already
present rather than duplicating it.

### Halt / Issues Found

**S-004.1 was HALTED, now RESOLVED.** Original routing recommendation (closest existing bucket:
`spec-ambiguity`, Planner / `sdd-spec`) was followed by the orchestrator; the owner reviewed the
probe evidence and ratified "Corregir la spec" (option a). Spec V3.2 (signed,
`unfreeze=true`, scoped to `.25` alone) now states the true semantics; S-004.1 is pinned against
it with zero production-code change. No unresolved halts remain in this slice.

### Post-Slice Audit (Step 7c)

Skipped — same reason as every prior slice in this change: no architecture baseline/ADR context
was injected into this run's launch prompt beyond the inline "Architecture context" paragraph
(which names the containment boundary and ADR-03's fallback arm directly, both already consumed
above); no separate `architecture.adrs` artefact was provided to run a structured audit against.
Flagged for the orchestrator, as in S-000/S-001/S-002/S-003.

### Test Results

- `bun test test/dialects/typescript/ops-addImport.test.ts test/dialects/typescript/dialect.test.ts`
  (final, all 4 S-004 tasks in place): **61 pass, 0 fail, 310 expect() calls**
- `bun test` (full suite, post-change, `--timeout=30000` — see ambient-load note below): **2102
  pass, 0 fail, 4684 expect() calls, 191 files** — up from the 2098/191 S-002 baseline by exactly
  4 new tests (S-004.1's 2 + S-004.2's 1 + S-004.3's 1), zero regressions
- `bun run typecheck`: clean, no errors (both before and after the JSDoc-only `ops.ts` edits)
- **Ambient system load note**: this environment showed heavy, unrelated concurrent load (other
  repos' Jest workers, load average 8-15 at points during this run) that can produce flaky
  subprocess-timeout failures (`react-conformance`, `copyin-parity`, `scaffold-e2e`) under bun's
  default 5000ms per-test timeout on unrelated, pre-existing tests — NOT caused by this slice's
  changes (none of S-004's edits touch those files or subsystems; this class of flake is itself
  pre-documented in `openspec/pending-changes.md`, "Subprocess-timeout debt" /
  "Cold-start suite non-determinism"). `--timeout=30000` was used throughout this pass and the
  final full-suite run above was clean (0 fail) at that timeout.

### Overall Progress

| Metric | Value |
|---|---|
| Slices in this scope | 1 (S-004) |
| Slices complete | 1 |
| Slices in progress | 0 |
| Tasks complete | 4/4 |

### Next Step

S-004 is complete. S-005 (`Requires: S-002, S-004`) is now unblocked — both its prerequisites are
satisfied. Ready for `/build --scope=slice:S-005` (cross-dialect parity guarantee + release
documentation), the final slice per the Build Order table.
