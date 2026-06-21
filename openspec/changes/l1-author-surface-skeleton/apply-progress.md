# Apply Progress: l1-author-surface-skeleton

**Scope**: skeleton + S-001 + S-002 · **Mode**: Strict TDD · **Store**: hybrid (filesystem half)

## Slices Built This Run

| Slice | Scope tag | Status | Tasks Done |
|---|---|---|---|
| S-000 | walking-skeleton | complete | 8/8 (S-000.1 … S-000.8) |
| S-001 | edge-case | complete | 3/3 (S-001.1/.2/.3) |
| S-002 | happy-path | complete | 4/4 (S-002.1/.2/.3/.4) |

## Suite Status

| Gate | Before S-000 | After S-000 | After S-001 | After S-002 |
|---|---|---|---|---|
| `bun test` | 148 pass | 153 pass | 159 pass | 170 pass |
| `bun run typecheck` | exit 0 | exit 0 | exit 0 | exit 0 |
| permissive-proof | exit 2 (1× TS2578) | exit 2 (1× TS2578) | exit 2 (unchanged) | exit 2 (unchanged) |

## TDD Cycle Evidence — S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-000.1 | `typed-create.test.ts::typed create compiles` (REQ-01.1/.3) | type-level | `tsc TS2558: Expected 0 type arguments, but got 1` | resolved S-000.8 | n/a (type proof) | none |
| S-000.1 | `permissive-proof.ts` excess-field (REQ-01.2) | type-level | directive unused until overload narrows; discrimination: removing `extra:1` -> 2nd TS2578 at L57 | resolved S-000.8 (directive USED) | n/a | none |
| S-000.2 | `commit-discard.test.ts::write-only typed factory commits` (REQ-06.1/02.1/02.2) | integration | `TypeError: fake.committedTree is not a function` | resolved S-000.6+.8 | n/a (single success path) | none |
| S-000.3 | `error-attribution.test.ts::forced collision -> AuthoringError` (REQ-10/11/12/13) | integration | `Cannot find module authoring-error.ts` -> after S-000.5: raw `ContractFake:` error not yet translated | resolved S-000.7+.8 | n/a (single forced-rejection per spec scope) | none |
| S-000.4 | `write-only-factory.test.ts::throwing factory commits nothing` (contract flip) | integration | `TypeError: fake.committedTree is not a function` (deliberate red, obs-648) | resolved S-000.6+.8 | n/a | none |

> RED->GREEN for the two load-bearing cross-boundary tests (REQ-13.1 forced-rejection attribution; REQ-06/07 commit/discard) was observed against a real `ContractFake` unmocked on both sides — no mock on emit/attribution/commit. This is the obs-648 anti-masked-criticals proof: the all-or-nothing + attribution guarantees are exercised by a real forced rejection, not asserted on JSDoc.

## TDD Cycle Evidence — S-001

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-001.1 | `test/fake/commit-discard.test.ts::REQ-08.1` (REQ-08.1) | unit | Passed immediately — S-000.6 already implemented. Confirmed as regression coverage per spec "confirm no gaps". | S-000.6 | n/a (single success path per REQ) | none |
| S-001.1 | `test/fake/commit-discard.test.ts::REQ-08.2` (REQ-08.2) | unit | Passed immediately — S-000.6 already implemented. | S-000.6 | n/a | none |
| S-001.1 | `test/fake/commit-discard.test.ts::REQ-08.3` (REQ-08.3) | unit | Passed immediately — S-000.6 already implemented. | S-000.6 | n/a | none |
| S-001.2 | `commit-discard.test.ts::REQ-06.2 multi-directive` (REQ-06.2) | integration | Passed immediately — S-000.8 already correct. | S-000.8 | n/a | none |
| S-001.2 | `commit-discard.test.ts::REQ-07.2 throw-after-buffer` (REQ-07.2) | integration | Passed immediately — S-000.8 already correct. | S-000.8 | n/a | none |
| S-001.2 | `commit-discard.test.ts::REQ-09.1 JSDoc source-scan` (REQ-09.1) | architectural | Passed immediately — JSDoc already reworded in S-000.8. | S-000.8 | n/a | none |
| S-001.3 | NOT NEEDED — no S-001.2 case was red | — | — | — | — | — |

> S-001 entire goal: confirm S-000 implementation satisfies REQ-08/06.2/07.2/09.1. It does. 6 new tests added as regression coverage. No new source files.

## TDD Cycle Evidence — S-002

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-002.1 | `session.test.ts::REQ-03.1 two buffered` (REQ-03.1) | unit | Passed immediately — S-000.7 pendingSnapshot() already returns defensive copy in order. | S-000.7 | n/a (ordering is inherent; single path) | none |
| S-002.1 | `session.test.ts::REQ-03.2 snapshot isolated` (REQ-03.2) | unit | Passed immediately — S-000.7 `slice()` makes defensive copy; later mutations don't affect snapshot. | S-000.7 | n/a | none |
| S-002.2 | `plan.test.ts::REQ-04.1 create op` (REQ-04.1) | unit | `Cannot find module '../../src/dry-run/index.ts'` → after stubs: `error: not implemented` | Implemented switch/map in plan.ts (S-002.4) | n/a (switch exhausts all 6 arms; REQ-04.2 covers the class) | none |
| S-002.2 | `plan.test.ts::REQ-04.2 all six ops` (REQ-04.2) | unit | `error: not implemented` | S-002.4 | 6 distinct op arms — TRIANGULATE satisfied by the test itself (6 discriminating inputs forced the full switch) | none |
| S-002.2 | `plan.test.ts::REQ-04.3 integration from Session` (REQ-04.3) | integration | `error: not implemented` | S-002.4 | n/a (write-only chain, 2 ops) | none |
| S-002.3 | `no-import.test.ts::no core runtime import` (REQ-05.1) | architectural | Scan passes on stub (no imports yet). Red-proofs confirm the scanner fires correctly on violating fixtures. | n/a (fitness constraint, not red on implementation) | n/a | none |
| S-002.4 | `src/dry-run/plan.ts` — implementation | — | (driven by S-002.2 RED above) | switch per op; type-only import from wire.ts | — | Widened param to `readonly Directive[]` for typecheck compatibility with `pendingSnapshot()` return type |

> REQ-04.2 TRIANGULATE note: the six-op all-at-once test (one array with 6 distinct inputs) forced all 6 switch arms to be implemented. A hard-coded return for create alone would fail arms 2-6 — triangulation was implicit in the test structure.

## Files Changed

| File | Action | Slice | What |
|---|---|---|---|
| `src/core/authoring-error.ts` | Create | S-000 | `AuthoringError{verb,path}` + `toAuthoringError` (fresh msg, no `.cause`, raw discarded) |
| `src/core/engine-client.ts` | Modify | S-000 | Port grew `commit()`/`discard()` — REQUIRED, additive (emit/read untouched) |
| `src/core/session.ts` | Modify | S-000 | `pendingSnapshot()`; attribution wrap at `flush` emit site; `commit()`/`discard()` wrappers -> `#client` |
| `src/core/context.ts` | Modify | S-000 | `defineFactory`: `try{run;flush;commit}catch{discard;throw}` (no finally); all-or-nothing JSDoc |
| `src/commons/index.ts` | Modify | S-000 | `create<S>` generic overload (bare inline mapped type, no `OptionsOf<S>`); untyped overload retained |
| `test/support/contract-fake.ts` | Modify | S-000 | `#committed` tree; `commit`/`discard` (commit clears staging per REQ-08.1); `committedTree()`/`stagingTree()` accessors |
| `test/types/typed-create.test.ts` | Create | S-000 | REQ-01.1 positive + REQ-01.3 backward-compat proofs |
| `test/types/permissive-proof.ts` | Modify | S-000 | REQ-01.2 excess-field negative proof |
| `test/skeleton/commit-discard.test.ts` | Create + Extend | S-000 + S-001 | S-000: REQ-06.1/02.1/02.2 success; S-001.2: REQ-06.2 multi-directive + REQ-07.2 throw-after-buffer + REQ-09.1 JSDoc source-scan |
| `test/skeleton/error-attribution.test.ts` | Create | S-000 | REQ-10/11/12/13 forced-rejection cross-boundary |
| `test/skeleton/write-only-factory.test.ts` | Modify | S-000 | Throw case flipped to committed-empty; success reads moved to `committedTree()` (commit clears staging) |
| `test/skeleton/context.test.ts` | Modify | S-000 | Isolation test post-run reads moved to `committedTree()` (commit clears staging) |
| `test/skeleton/session.test.ts` | Modify | S-000 + S-002 | Gap-#1 sweep x2 (no-op stubs); S-002.1: REQ-03.1 pendingSnapshot order + REQ-03.2 snapshot isolation |
| `test/skeleton/read-your-own-write.test.ts` | Modify | S-000 | Gap-#1 sweep (`observeCallOrder` forwards to inner) |
| `test/skeleton/handle-chaining.test.ts` | Modify | S-000 | Gap-#1 sweep (`makeSpy` forwards to inner) |
| `test/fitness/fit-06-example-jsdoc.test.ts` | Modify | S-000 | Scanner dedupes overload signatures by name (intent preserved) — see Deviations |
| `test/fake/commit-discard.test.ts` | Create | S-001 | REQ-08.1/08.2/08.3 fake-unit isolated (commit→committed; discard→staging cleared; independence after re-stage) |
| `src/dry-run/plan.ts` | Create | S-002 | `dryRunPlan(snapshot: readonly Directive[]): DryRunEntry[]` — switch/map per op; type-only import from wire.ts |
| `src/dry-run/index.ts` | Create | S-002 | Re-exports `dryRunPlan` + `DryRunEntry` — NOT in package.json#exports |
| `test/dry-run/plan.test.ts` | Create | S-002 | REQ-04.1/.2/.3 unit+integration (all six ops + Session integration) |
| `test/dry-run/no-import.test.ts` | Create | S-002 | FIT-dry-run-no-import: import-graph scan REQ-05.1 (3 real + 3 red-proofs) |

## Deviations from Design

1. **`stagingTree()` accessor added to `ContractFake`** (design listed only `committedTree()`). REQ-06.1/REQ-08.1 require asserting "staging cleared"; `#tree` is private, so a symmetric test-only accessor is needed. Same category as `committedTree()` (assertion surface, not on the port).
2. **Existing post-run `fake.read()` assertions moved to `committedTree()`** in `write-only-factory.test.ts` (3 success tests) and `context.test.ts` (1 isolation test). The Fake Migration Plan (point 4) claimed these stay green untouched, but it overlooked that the new run-end `commit()` clears staging (REQ-08.1) BEFORE the tests' post-run reads — so `read()` (bound to `#tree`) no longer finds committed content. The fix mirrors the design's own REQ-02.2 guidance ("assert via committed tree, NOT a `.read()`"). Mid-run reads (read-your-own-writes) are unchanged. NOT a behavioural regression — content is committed, just asserted at the correct phase.
3. **FIT-06 scanner overload-dedup** (`test/fitness/fit-06-example-jsdoc.test.ts`). The text-based scanner counted each `export function create` overload signature as a separate undocumented export (`["create","create"]` violations). Fixed by collapsing same-name declarations into one logical export (documented iff any signature carries `@example`). Preserves the fitness intent exactly; `create` IS documented on its first overload. Not in the design's File Changes (the design anticipated FIT-01 but not FIT-06 vs overloads).
4. **`dryRunPlan` parameter widened to `readonly Directive[]`** (design §4.4 says `Directive[]`). `Session.pendingSnapshot()` returns `readonly Directive[]` (the implementation uses `slice()` which is correct, but the return type is `readonly Directive[]`). Widening the parameter is strictly more correct — the function only reads the array — and satisfies both mutable and readonly call sites without a cast. This is a type-level improvement, not a behavioural deviation.

## Slice Audit Notes (Step 7c)

### S-001 Audit
No code changes to `src/` — only test files added/extended. Layer integrity: no violations. All assertions target observable behaviour (committed tree contents, staging size, JSDoc text), not implementation internals. ADR-01 honored throughout.

### S-002 Audit
- `src/dry-run/plan.ts`: imports ONLY `type Directive` from `../core/wire.ts` — erased at compile time, zero runtime core dependency. REQ-05 verified by `no-import.test.ts` scanner and confirmed by source inspection.
- `src/dry-run/index.ts`: re-exports only from `./plan.ts`. No external imports.
- NOT added to `package.json#exports` — seed surface per design.
- Switch exhausts all 6 Directive union arms (TypeScript enforces exhaustiveness via the mapped return type).
- No new layer — `src/dry-run/` joins existing single-layer library structure.
- No Bug/Architecture/MAJOR findings.
