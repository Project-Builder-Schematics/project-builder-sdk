# Apply Progress: Stage 5 — First Dialect

**Batch**: 1 of N (S-000 + S-001) · **Mode**: Strict TDD · **Suite**: 662 → 689 (bun test) ·
`bunx tsc --noEmit`: CLEAN throughout · **Branch**: `feat/stage-5-first-dialect`

---

## Batch 2 — S-002: The Real Dialect (ts-morph, `./typescript`, `addImport`)

**Mode**: Strict TDD (batch-oriented per house precedent — implementation and its driving
test written together per coherent mechanism, same as batch 1's "coalescing mechanism" row;
every unit still ran through a real RED before GREEN where behaviour was new/uncertain) ·
**Suite**: 689 → 729 (bun test) · `bunx tsc --noEmit`: CLEAN · `bun run build`: CLEAN ·
resolved ts-morph pin: **28.0.0** (latest stable at S-002 apply time, 2026-07-12, verified via
`npm view ts-morph version`) · measured FIT-03 `/typescript` budget: **6.82 KB actual, 32 KB
committed budget** (`--packages=external`).

### Slices Built This Run

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-002 | happy-path | complete | 10/10 |

### Commits

1. `3c04bd5` — chore(deps): S-002 — land ts-morph as the first runtime dependency (D5, ADR-0038)
2. `bc073d2` — feat(dialects): S-002 — real TypeScript dialect via ts-morph (addImport, .raw)
3. `ed5ab53` — test(fitness): S-002 — extend FIT-03/04/05/06/08/09/14 for the ./typescript subpath

### Halt-check (constraint 1)

Confirmed `fit-01-commons-no-ast.test.ts` GREEN (6/6) BEFORE `ts-morph` entered
`package.json#dependencies` — re-verified again after landing (still 6/6), and again after the
full batch (still green, nothing under `src/commons/**` reaches the new dialect tree).

### Deviations From Plan

#### 1. ADR renumbering: "ADR-0033" → ADR-0038 (same precedent as batch 1's ADR-0037)

Design drafted the ts-morph decision as "ADR-0033". By S-002 apply time the free range had
moved twice: `stage-4b-testing-harness` claimed 0033-0036 on `main`, and this change's own
S-001 batch claimed 0037 for the coalescing-seam decision. Landed as
`openspec/decisions/0038-ts-morph-runtime-dependency.md` — content verbatim per design §4.5,
header documents the collision. `openspec/decisions/0014-single-package-subpath-shape.md`
amended in place (its own convention — ADRs amend rather than fork) to wire `./typescript`.

#### 2. Exports-map count: design's "four entries" → actual five (`./testing` pre-existing)

Design/slices/REQ-FPS-02/REQ-PKG-01 all state the exports map "is now FOUR entries" (assuming
a 3-entry starting point: `.`, `./commons`, `./conformance`). By S-002 apply time
`stage-4b-testing-harness` had already landed a 4th entry, `./testing` (third-audience
author-testing surface), on `main` — independently of this change, the same cross-branch
"next free slot computed at plan time, other branch merged first" collision class as the ADR
renumbering above, just for a count instead of a number. Treated identically: the AUTHORIZED
delta this change makes is "+1 subpath (`./typescript`) +1 dependency (`ts-morph`)" relative
to whatever the actual current baseline is — not the literal stale count. Final state: **five**
exports entries (`.`, `./commons`, `./conformance`, `./testing`, `./typescript`), **one**
dependency (`ts-morph`, exact-pinned). `pkg-surface-baseline.json`, FIT-09, and FIT-14 updated
to the real 5-entry/1-dep state; new assertions added asserting the EXACT authorized set (not
just "unchanged from baseline") so a future silent 6th entry or 2nd dependency still fails red.

#### 3. Two empirically-discovered ts-morph@28.0.0 behaviours the design's prose assumed differently

Both probed BEFORE writing any golden/implementation (not discovered via a failing golden —
caught at the design-verification stage, not the red-proof stage):

- **BOM is NOT preserved by ts-morph "independently"** (design §4.4's claim) — `SourceFile
  #getFullText()` strips a leading BOM; it never round-trips it. `ast.ts` owns re-prepending
  the BOM itself via a private `WeakMap<SourceFile, boolean>`, set at `parse()`, consumed at
  `print()` — invisible to the frozen `Ast = SourceFile` type, no signature change. Prepares
  REQ-TSD-03.6 (S-003 scope) correctly; not yet golden/test-covered (S-002 doesn't reach TSD-03).
- **ts-morph's parser does not natively throw on malformed syntax** — TypeScript's parser is
  deliberately fault-tolerant (produces a `SourceFile` with diagnostics, not a thrown error),
  contradicting REQ-TSD-04.1/REQ-DG-05.2's "triggering `ast.parse`" framing, which assumes a
  native throw. `ast.parse` now checks `project.getProgram().getSyntacticDiagnostics(sourceFile)`
  post-parse and throws (a plain, generic-message Error — never the frozen prefix itself, honoring
  constraint 3) when syntactic (not semantic/type) diagnostics exist — verified empirically to
  correctly distinguish a real syntax error from a type-only error (zero syntactic diagnostics)
  and from valid/empty content. This is executor latitude (design §4.3 Q4: `ast.parse`'s internal
  failure-detection mechanism is not itself a frozen contract, only its `(source) => Ast` shape
  is) — not yet exercised by a REQ-TSD-04.1 test (S-003 scope); the mechanism is in place and
  will be driven by S-003's malformed-TypeScript fixture.

#### 4. F1 followup (verify-in-loop-1) closed against the REAL dialect, not the toy one

`coalescing.test.ts` adds `.raw()`-before-a-named-op content-verified against ts-morph
(REQ-DG-03.2) — S-001's toy-dialect test only covered the reverse order. Byte-identical to the
forward-order end-state (confirmed via both a probe and the e2e Flow 1/2 pair), proving order
independence on the real AST, not just the toy line-array one.

#### 5. Collateral fixes outside S-002's own file list (required by constraint 8, not scope creep)

Two PRE-EXISTING tests hard-coded a zero-runtime-deps assumption that predates this change and
broke the moment `ts-morph` landed — neither is in S-002's task list or Test Derivation table,
but constraint 8 ("every slice leaves the suite GREEN... no broken intermediate states") is
unconditional:

- `test/bin/codegen-cli.test.ts`: "dependencies stays absent or empty" → "dependencies is
  exactly `[ts-morph]`" (the bin itself still pulls in nothing of its own).
- `test/e2e/installed-consumer.e2e.test.ts`: the scratch-consumer install used a non-routable
  `BUN_CONFIG_REGISTRY` (SEC-m2 zero-deps-era hardening) — now needs REAL registry access to
  resolve `ts-morph`, a legitimate dependency the tarball itself declares. Removed the registry
  override (kept `--ignore-scripts`, the actual supply-chain guard against a malicious
  lifecycle script); documented the reasoning in the file's own header comment. Verified fresh
  (deleted the memoized scratch dir, re-ran from a clean install) — genuinely exercises network
  resolution, not a stale cached pass.

### TDD Cycle Evidence — S-002

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| `detectNewLineKind` | `dialect.test.ts::REQ-TSD-02.2` | unit | Wrong assumption about `NewLineKind` enum ordinals — `expected 0, got 1` on the first assertion; fixed by comparing against the real `NewLineKind` enum instead of hard-coded numbers | ✅ | LF / CRLF-dominant / tie / empty — 4 cases | n/a |
| Read-routing static scan | `read-routing.test.ts::REQ-MC-03.1` | architectural | Real false positive: `src/dialects/typescript/index.ts` flagged for "EngineClient referenced" — the scanner matched the literal word inside a doc comment explaining what is NOT imported, not an actual import; fixed by stripping comments before scanning (mirrors FIT-01's own batch-1 fix for the same class of bug) | ✅ | n/a (structural scan, not scenario-varied) | n/a |
| ts-morph parse-failure containment | (mechanism only — not yet REQ-TSD-04.1-tested, S-003 scope) | — | Probed empirically (`getSyntacticDiagnostics` distinguishes syntax vs. semantic errors: 0 for a type-error-only file, >0 for genuinely malformed source, 0 for empty/valid) before writing any implementation — RED-equivalent discovery at the design-verification stage | ✅ (mechanism in place) | n/a | n/a |
| Coalescing/split/join/addImport/e2e (dialect.test.ts, coalescing.test.ts, dialect-modify.e2e.test.ts — 20 cases total) | multiple files | integration/e2e | Every content expectation was pre-verified against real ts-morph output via standalone probe scripts BEFORE being written into a test (not asserted blind); all passed on first `bun test` run — batch-oriented per house precedent (same as batch 1's 10-case coalescing row), acceptable because the mechanism (dialect-handle.ts) was already proven correct in S-001 and only the AST-specific glue (ast.ts/ops.ts) was new | ✅ | REQ-MC-01/02/06/07 × real dialect + F1 + Flows 1-4 | n/a |
| FIT-03/05/06/08/09/14 extensions | `test/fitness/*.test.ts` | architectural | Fit-09/fit-10 broke on first full-suite run post-implementation (genuine collateral RED: exports-count mismatch, EngineClient-in-comment false positive) — fixed as documented in Deviations #2 and the read-routing row above | ✅ | n/a | n/a |

### Files Changed

| File | Action | Slice | What |
|---|---|---|---|
| `package.json` | Modified | S-002 | `ts-morph@28.0.0` exact dependency; `./typescript` exports entry |
| `bun.lock` | Modified | S-002 | Committed lockfile carrying ts-morph + its 8 transitive deps |
| `openspec/decisions/0038-ts-morph-runtime-dependency.md` | Created | S-002 | ADR (renumbered from "0033") |
| `openspec/decisions/0014-single-package-subpath-shape.md` | Modified | S-002 | Amendment: `./typescript` wired |
| `src/dialects/typescript/ast.ts` | Created | S-002 | ts-morph parse/print, `detectNewLineKind`, BOM re-prepend, syntactic-diagnostics parse-failure detection |
| `src/dialects/typescript/ops.ts` | Created | S-002 | `addImport` op (merge-into-existing-clause idempotency) |
| `src/dialects/typescript/index.ts` | Created | S-002 | Dialect module — `find`, composed via `defineDialect`+`withOps` |
| `test/dialects/typescript/dialect.test.ts` | Created | S-002 | TSD-01/02 base cases, determinism spy |
| `test/dialects/typescript/coalescing.test.ts` | Created | S-002 | MC-01/02/05/06/07 real-AST restatement + F1 followup |
| `test/dialects/typescript/read-routing.test.ts` | Created | S-002 | MC-03 static scan + planted red-proof |
| `test/dialects/typescript/golden/*.txt` (5 files) | Created | S-002 | Byte-exact committed goldens |
| `test/e2e/dialect-modify.e2e.test.ts` | Created | S-002 | Outer-loop Flows 1-4 |
| `test/fixtures/red/dialect-typescript/direct-engine-read.ts` | Created | S-002 | Quarantined red-proof fixture (REQ-MC-03.2) |
| `test/fitness/fit-03-commons-bundle-budget.test.ts` | Modified | S-002 | `/typescript` own budget + red-proof |
| `test/fitness/fit-04-dts-semver-gate.test.ts` | Modified | S-002 | New `typescript.index.d.ts` baseline pair |
| `test/fitness/dts-baseline/typescript.index.d.ts` | Created | S-002 | First-commit baseline |
| `test/fitness/fit-05-serializable-bytes.test.ts` | Modified | S-002 | Real coalesced dialect directive JSON-roundtrip case |
| `test/fitness/fit-06-example-jsdoc.test.ts` | Modified | S-002 | `PUBLIC_PATHS` + `find` `@example` gate + red-proof |
| `test/fitness/fit-08-no-kit-bleed.test.ts` | Modified | S-002 | `./typescript` scanned path + planted red-proofs |
| `test/fitness/fit-09-pkg-exports-resolution.test.ts` | Modified | S-002 | `./typescript` entry assertion, 5-entry exact set |
| `test/fitness/fit-14-package-surface.test.ts` | Modified | S-002 | `dependencies` baseline field, exact-pin assertions |
| `test/fitness/pkg-surface-baseline.json` | Modified | S-002 | 5 exports, ts-morph dependency, 9 new tarball entries |
| `test/bin/codegen-cli.test.ts` | Modified | S-002 (collateral) | Zero-deps → exactly-ts-morph assertion |
| `test/e2e/installed-consumer.e2e.test.ts` | Modified | S-002 (collateral) | Removed non-routable registry override |

### Post-Slice Self-Review (Step 7c — no external audit engine available in this sub-agent context)

Checked the full S-002 diff against all 8 binding constraints manually: (1) halt-check
confirmed before AND after the dependency landed; (2) zero references to
`test/fixtures/toy-dialect/**` anywhere in S-002 code (`rg` confirmed); (3) the frozen-prefix
wrapper is still implemented exactly once, in `dialect-handle.ts` (untouched this batch) —
`ast.ts`'s own thrown errors are plain, unprefixed signals the existing wrapper catches, not a
second implementation; (4) N/A this batch (S-005 scope); (5) every `find()`-only chain in every
new test pre-seeds its target; (6) no test asserts a specific outcome for concurrent
unawaited same-path handles; (7) every coalescing/split/e2e assertion is byte-exact against a
committed golden, never count-only; (8) suite green + `tsc` clean confirmed repeatedly,
including post-build. No findings.

### Next Recommended

`/build --scope=slice:S-003` — requires S-002 complete (confirmed). S-003 (Edge Scenarios &
Fidelity Boundaries) can now exercise the BOM-preservation and parse-failure-detection
mechanisms this batch already built into `ast.ts` but did not yet test (TSD-03/04 are S-003's
own REQ coverage, correctly out of S-002's scope per slices.md). S-004 (conformance core)
is parallelizable with S-003 once S-002 is confirmed complete.

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
