# Apply Progress: Stage 5 — First Dialect

**Batch**: 1 of N (S-000 + S-001) · **Mode**: Strict TDD · **Suite**: 662 → 689 (bun test) ·
`bunx tsc --noEmit`: CLEAN throughout · **Branch**: `feat/stage-5-first-dialect`

## Slices Built This Run

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-000 | edge-case (guard) | complete | 3/3 |
| S-001 | walking-skeleton | complete | 10/10 |

## Commits

1. `f21b17c` — test(fitness): S-000 — rebuild FIT-01 as a transitive import-graph walk
2. `e071f1b` — feat(core): S-001 — real dialect generics, coalescing handle, run-boundary join
3. `386604e` — test(fitness): S-001 — coalescing orphan + unawaited-join guards (ADR-0037)
4. `2d59327` — test: S-001 — type-level pins, toy-dialect e2e smoke, conformance type-pin

## Deviations From Plan (both content-neutral, mechanical)

### 1. ADR renumbering: "ADR-0034" → ADR-0037

Design.md and slices.md drafted the coalescing-seam decision as ADR-0034 (and the S-002
ts-morph decision as ADR-0033). By the time this worktree branched from `main`,
`stage-4b-testing-harness` had already landed ADRs 0033-0036 for an unrelated concern
(third-audience author-testing, shipped-fake containment) — both branches independently
picked the "next free number" at planning time, and stage-4b merged first. Landed this
change's decision as `openspec/decisions/0037-coalescing-seam-handle-owned.md` (renumbered,
content unchanged, header documents the collision and precedent — this project has an
established convention for exactly this situation, per stage-4's own 0024-0028 renumber).
**S-002's ADR-0033 (ts-morph) will need the SAME treatment** — flagging now so the next
batch's executor isn't surprised; next free slot at that point will be 0038 (or later if
another change lands first).

### 2. Fitness function renumbering: "FIT-17"/"FIT-18" → FIT-19/FIT-20

Same root cause: `fit-17-testing-dev-only-bundle.test.ts` and
`fit-18-fake-single-source-parity.test.ts` already exist on `main` from
stage-4b-testing-harness. Landed as `test/fitness/fit-19-coalescing-orphan-guard.test.ts` and
`test/fitness/fit-20-unawaited-join-guard.test.ts`. Neither REQ-ID text nor any signed spec
references the literal numbers "17"/"18" — these are design/slices-internal labels only, so
the renumbering carries zero content risk.

### 3. Generic type-parameter default: `unknown` → `any`

Design's `Op<Ast>`/`OpPack<Ast>`/`Dialect<Ast,Ops>`/`Handle<State,Ast,Ops>` needed default
type parameters so `src/conformance/index.ts`'s fixtures could keep using BARE (no
type-argument) `Dialect`/`OpPack`, per design §4.3's literal code block. Defaulting to
`unknown` compiles for the type DECLARATIONS themselves but breaks at every USE site: `Op<Ast>`'s
`ast` parameter is contravariant, so a concrete `Dialect<ToyAst, ...>` is not structurally
assignable to `Dialect<unknown, OpPack<unknown>>` (surfaced writing
`test/conformance/toy-dialect-smoke.test.ts`). Switched every default to `= any`, which
short-circuits variance checking in both directions — exactly the "some dialect, don't care
about the concrete Ast" erasure the bare form needs. Explicit instantiations
(`Dialect<ToyAst, {push:...}>`, `Handle<"found", Ast, {}>`, etc.) are completely unaffected —
`any` only ever applies when NO type argument is supplied.

### 4. pkg-surface-baseline.json touched one line early (pulled forward from S-002)

Adding `src/core/dialect-handle.ts` produces new `dist/core/dialect-handle.{js,d.ts,d.ts.map}`
output, which FIT-14's self-building `beforeAll` (`bun run build`) picks up — without a
baseline update this fails FIT-14's own tarball-diff assertion at S-001's boundary, violating
binding constraint 8 ("every slice leaves the suite GREEN... no broken intermediate states").
Added the 3 new tarball entries to `test/fitness/pkg-surface-baseline.json` (alphabetically
placed). This is the MINIMUM slice of S-002's own "regenerate pkg-surface-baseline.json" task
— only the 3 new lines for this new internal file; the ts-morph/exports/dependency parts of
that task are untouched and remain S-002's job.

## TDD Cycle Evidence

### S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| Transitive walk | `fit-01-commons-no-ast.test.ts::the graph walk reaches the transitive ts-morph import through helper.ts` | fitness (static scan) | `expect(violations).toEqual([{file:helper.ts,specifier:ts-morph}])` — got `[]` | ✅ | 2 cases (real-commons-clean-graph + planted-1-hop-violation) | comment-stripping + export-from matching added post-GREEN (2 real bugs found: JSDoc @example false positive, `export { x } from` not matched) |

### S-001

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| Coalescing mechanism | `dialect-handle.test.ts` (10 cases) | unit/integration | Chaining bug found on first real run: `.raw is not a function` (op methods returned the internal controller, not the public handle wrapper) — 4 tests failed for this reason | ✅ (after fixing the wrapper's return-value binding) | REQ-MC-01/02/04/05/07 + REQ-DG-05 — 10 distinct cases | n/a |
| FIT-19 orphan guard | `fit-19-coalescing-orphan-guard.test.ts` | fitness | Verified via literal mechanism removal (see below) | ✅ | n/a (dedicated ADR-level guard, not scenario variation) | n/a |
| FIT-20 join guard | `fit-20-unawaited-join-guard.test.ts` | fitness | Verified via TWO literal, independent mechanism removals (see below) | ✅ | 2 cases (happy unawaited + throwing unawaited) | Added an explicit in-flight delay to the throwing case so the rejection genuinely races the drain — the first version raced by accident and didn't exercise the real window |

**Literal mechanism-removal verification (temporary, reverted after observing RED — `git diff`
against the committed state confirmed byte-identical restoration):**

- Removed `ensureOpen()`'s `pendingSnapshot().includes(...)` identity check → FIT-19 AND
  `dialect-handle.test.ts`'s REQ-MC-02.1/.2.3 all failed with `Received length: 1` (expected
  2) — the post-read edit was silently absorbed into the pre-read directive instead of
  splitting.
- Removed `dialects.drain()` from `defineFactory` → FIT-20's happy case lost the edit
  entirely (`Received length: 0`); the throwing case's rejection never surfaced
  (`caught === undefined`).
- Removed the eager shadow-catch (`#tail.catch(() => {})`) while keeping drain → FIT-20's
  throwing case crashed Bun's own test runner with an uncaught rejection at the exact throw
  site — the strongest possible signal that the pre-drain window is real and this line closes
  it.

## Files Changed

| File | Action | Slice | What |
|---|---|---|---|
| `test/fitness/fit-01-commons-no-ast.test.ts` | Modified | S-000 | Direct-scan → transitive graph walk |
| `test/fixtures/red/fit-01-transitive/{leaf,helper}.ts` | Created | S-000 | Permanent planted 2-hop fixture |
| `src/core/define-dialect.ts` | Rewritten | S-001 | Real generics: `Op<Ast>`, `OpPack<Ast>`, `DialectDescriptor`, `Handle<State,Ast,Ops>`, `Dialect<Ast,Ops>`, `defineOpPack`/`defineDialect`/`withOps` |
| `src/core/dialect-handle.ts` | Created | S-001 | The coalescing handle factory (`#tail` queue, `ensureOpen`, lazy getter, error wrapper, registry self-registration) |
| `src/core/context.ts` | Modified | S-001 | `DialectRegistry` + `RunContext.dialects`; `defineFactory` drains before flush |
| `src/conformance/index.ts` | Modified | S-001 | `OpExercise` type + `OpPackFixture.exercises` (REQUIRED, type-only) |
| `openspec/decisions/0037-coalescing-seam-handle-owned.md` | Created | S-001 | ADR (renumbered from "0034") |
| `test/fixtures/toy-dialect/index.ts` | Created | S-001 | Throwaway toy dialect proof vehicle |
| `test/core/dialect-handle.test.ts` | Created | S-001 | REQ-MC-01/02/04/05/07 + REQ-DG-05 |
| `test/fitness/fit-19-coalescing-orphan-guard.test.ts` | Created | S-001 | Renumbered from "fit-17" |
| `test/fitness/fit-20-unawaited-join-guard.test.ts` | Created | S-001 | Renumbered from "fit-18" |
| `test/types/define-dialect.test.ts` | Modified | S-001 | Type-level pins (DG-01.1, DG-02.1, DG-02.3, `.raw`, thenable, `remove` state-gating) |
| `test/e2e/toy-dialect-skeleton.e2e.test.ts` | Created | S-001 | Outside-in smoke against `ContractFake` |
| `test/conformance/toy-dialect-smoke.test.ts` | Created | S-001 | Type-pin + expect-throw characterization |
| `test/fitness/pkg-surface-baseline.json` | Modified | S-001 | 3 new tarball entries (dialect-handle.*) |

## Next Recommended

`/build --scope=slice:S-002` — requires S-000 GREEN (confirmed) + S-001 complete (confirmed).
S-002 is the first task to touch `package.json#dependencies` (ts-morph) — its own halt-check
(constraint 1) should re-verify FIT-01 is still green before proceeding. S-002's executor
should also apply the SAME ADR-renumbering treatment to ADR-0033 (ts-morph) — next free slot
is 0038 at time of writing.
