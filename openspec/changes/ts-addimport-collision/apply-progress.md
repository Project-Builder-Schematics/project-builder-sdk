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
