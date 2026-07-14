# Apply Progress: bare-factory-migration

**Mode**: Strict TDD | **Artifact store**: hybrid (this file + Engram mirror `sdd/bare-factory-migration/apply-progress`)

## Slice Status

| Slice | Scope tag | Status | Notes |
|---|---|---|---|
| S-000 | walking-skeleton | done | see below |
| S-001 | happy-path | done | see below |
| S-002 | happy-path | done | 9-file consumer set per §21 R-9; see below |
| S-003 | happy-path | not started | |
| S-004 | happy-path | not started | |
| S-005 | happy-path | not started | |
| S-006 | edge-case | not started | |

## S-000 — Walking Skeleton — bare signature + delegation + FIT-29

### Tasks completed

- [x] `src/testing/index.ts`: `runFactoryForTest<O>` signature changed from
  `(factory: (o, deps: {client}) => Promise<void>, input, seed?)` to
  `(fn: (input: O) => void | Promise<void>, input, options?: {seed?, packageDir?})`.
  Delegates internally to `defineFactory<O>(fn, options?.packageDir !== undefined ? {packageDir} : undefined)`
  then drives the returned runner with the SAME internally-built `client`/`ContractFake` as
  before (single-wrap-seam invariant, ADR-C). `RunResult` shape unchanged. `defineFactory`
  re-export from `./testing` left UNTOUCHED (removal is S-006, explicitly out of scope here).
- [x] `test/types/runfactoryfortest-shape.test.ts` (NEW): positive proof (bare fn +
  full options bag compiles), REQ-ATH-18.2 zero-arg-factory positive pin, REQ-ATH-01.5
  red-proof (`@ts-expect-error` — old arity-2 wrapped-runner shape rejected: "Target
  signature provides too few arguments").
- [x] `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts` (NEW): production-only
  (`src/**`+`bin/**`) import-reachability guard confining the `defineFactory` BINDING
  (resolving into `core/context.ts` or `core/index.ts`) to `src/core/**`, `src/testing/**`,
  `src/conformance/**`. Narrows `specifiersResolvingInto` to import/export lines that
  actually bind the name `defineFactory` (verified necessary — see Deviation #1 below).
  Includes a red-proof (planted import from `src/commons/**`, inline fixture per FIT-15's
  convention), a barrel-route red-proof, a no-false-positive check (`currentContext`/
  `requirePackageAnchors` imports from the same file are NOT flagged), and two positive
  controls proving the scanner isn't merely blind to the real sanctioned-caller shape.
- [x] `docs/quickstart.md` step 5: `factory.ts` fence rewritten to a bare
  `(input: Input) => {...}` export — zero `defineFactory` tokens, prose rewritten to match.
  Step 6 (test) unchanged — already compatible with the new signature.
- [x] `test/docs/quickstart-docs.test.ts`: REQ-AOD-01.2 assertion updated from
  `toContain("defineFactory<Input>")` (the OLD contract, would now assert the WRONG thing)
  to `not.toContain("defineFactory")` + a bare-export shape match.
- [x] dts SIGNATURE regen (event 1 of 2, design §4.8): `bun run build` → copied
  `dist/testing/index.d.ts` over `test/fitness/dts-baseline/testing.index.d.ts`. Diff is
  minimal and fully attributable: the unexported `RecordingClient` interface no longer
  appears (no longer referenced by the exported signature) and `runFactoryForTest`'s
  parameter list changed to the new bare-fn + options-bag shape. The `export { defineFactory
  } from "../core/context.ts";` line is BYTE-IDENTICAL to before (see Deviation #1).
- [x] REQ-TES-05.3 positive assertion added to `test/fitness/fit-04-dts-semver-gate.test.ts`
  (paired with the same-slice regen, per spec) asserting the dts literally contains the new
  signature text, not just "no removals detected."

### Verification run (this slice, in isolation)

```
bun test test/fitness/fit-29-sanctioned-definefactory-caller.test.ts \
         test/fitness/fit-04-dts-semver-gate.test.ts \
         test/types/runfactoryfortest-shape.test.ts \
         test/docs/quickstart-docs.test.ts
# 53 pass, 0 fail
bun run typecheck   # zero NEW errors traceable to S-000's own files
```

### Regression sentinels (global acceptance criterion)

`git diff --stat -- test/golden-ir test/core test/conformance test/dialects test/skeleton`
→ empty (zero diff). `src/core/context.ts` untouched entirely (frozen `:293-346` body AND
its `:248-292` JSDoc both left as-is — the JSDoc rewrite is S-003's job, not S-000's).

## Deviation #1 (recorded, not silent): kept the direct re-export form

Design's data model implies `runFactoryForTest` needs a LOCAL binding to call
`defineFactory` internally. The straightforward move (two-step `import {defineFactory}
from ...; export {defineFactory};`) was tried first, then reverted: it produced an
UNNECESSARY dts/text diff with zero semantic benefit. Final shape keeps the original
one-line `export { defineFactory } from "../core/context.ts";` (public re-export,
byte-identical to before) PLUS a separate `import { defineFactory } from
"../core/context.ts";` at the top (internal use) — ES module semantics make this legal
(the `export ... from` form creates no local binding, so there's no collision). Net effect:
`src/testing/index.ts` now has TWO independent lines each resolving `defineFactory` from
`../core/context.ts` — FIT-29's test file accounts for this explicitly (its positive-control
test expects `["../core/context.ts", "../core/context.ts"]`, not a single occurrence).

## HALT-WORTHY DISCOVERY — Scope Gap: 5 files use the to-be-migrated calling convention but are unclaimed by any slice

**This is the reason to route back to the Planner (fold into S-002, or a new slice) before
`/build` proceeds to S-001+.** Verified via actual `bun run typecheck` + `bun test` runs
(not guesswork) after S-000's signature change landed.

Design's own inventory (slices.md §13) claims "the 4 harness consumer files" — found via
`fd . test/fake -e ts | rg harness` — are the only `./testing` consumers needing conversion
(assigned to S-002). That search was too narrow. The REAL set of files that build a
`defineFactory(...)`-wrapped runner and pass it DIRECTLY to `runFactoryForTest`/`captureRun`
(the exact old calling convention the whole migration targets) also includes, confirmed by
runtime crash (`TypeError: Cannot destructure property 'client' from null or undefined
value` — a double-wrap, since my new `runFactoryForTest` now wraps `fn` a SECOND time via
`defineFactory`):

1. `test/fake/copyin-fidelity.test.ts` — doesn't match the `rg harness` filter (wrong name).
2. `test/scaffold/batch-cap-chunk.test.ts`
3. `test/scaffold/classify-transport.test.ts`
4. `test/scaffold/scaffold-fake.test.ts`
   (2–4 are outside `test/fake/`, so the `fd . test/fake` search never saw them — all three
   use `defineFactory(fn, {packageDir: dir})` + bare `runFactoryForTest(run, ...)`, same
   shape as the 4 "harness" files, same fix: move `packageDir` into the options bag, drop
   the `defineFactory` wrapper.)
5. `test/e2e/author-emulation/ir-transcript.test.ts` (the TEST file for `captureRun`, NOT
   `test/support/ir-transcript.ts` the implementation — that one design DOES cover). Builds
   its own ad-hoc `defineFactory<void>(...)` runners and passes them to `captureRun`
   directly; NOT routed through `scenarios.ts`'s `SCENARIOS` registry, so it will NOT
   self-heal once S-004 flips `FactoryRunner` to bare — it needs its own conversion.

### NOT a gap — self-healing once S-004 lands (uses `SCENARIOS`/`FactoryRunner`, not ad-hoc `defineFactory`)

These currently fail too, but will resolve automatically once S-004 converts the fixtures +
`scenarios.ts`'s `FactoryRunner` type to bare (and `test/support/ir-transcript.ts`'s
`captureRun` — already in design's file table — accepts a bare `run`):
`scripts/regen-corpus.ts`, `test/e2e/author-emulation-scaffold.e2e.test.ts`,
`test/e2e/author-emulation/corpus-format.test.ts`, `test/fitness/fit-24-corpus-purity.test.ts`,
`test/fitness/fit-28-corpus-determinism.test.ts`.

### NOT a gap — explicitly planned, red until their OWN slice lands

`test/fake/harness-{result,leak-scan,opted-in,in-memory-invariant}.test.ts` (S-002, per
slices.md's own S-002 Failing-first list). `test/e2e/installed-consumer.e2e.test.ts` (S-006,
per slices.md's own S-006 Failing-first list — `hasDefineFactory` still `true` until then).
`.tmp-readme-copy-runnable/example-0.test.ts` (a scratch artifact `testing-story-docs.test.ts`
generates from README's CURRENT content — S-003 rewrites README).

### Recommendation

Fold files 1–5 above into S-002's scope (same fix shape as its existing 4 harness files —
move `packageDir` from the `defineFactory` call into `runFactoryForTest`'s options bag, drop
the wrapper), OR insert a small supplemental slice before S-002. Either way, this should be
resolved by the Planner (re-run `sdd-slice` with this finding) BEFORE `/build` continues past
S-000 — otherwise S-002 will "complete" while 5 files stay silently broken with no owner,
and the gap surfaces only at `sdd-verify --mode=final`'s full-suite check, much later than
necessary.

## S-000 fix — Executor in-loop iteration 1 (verify-in-loop-1 Finding 2 / ruling R-10)

**Gap**: REQ-ATH-01.4, REQ-ATH-17.1, REQ-ATH-17.2 were claimed by S-000's `Covers` line but
had zero EXECUTED runtime evidence — only a `void`-wrapped type proof in
`test/types/runfactoryfortest-shape.test.ts` (tsc-only, never runs). A typo in
`options?.seed`/`options?.packageDir` forwarding would have shipped green.

**Fix**: added `test/fake/harness-options-bag.test.ts` (NEW, 3 tests, tagged
`[characterization]` per the same RED-first waiver `harness-opted-in.test.ts` already
documents — the delegation code at `src/testing/index.ts:119-122` predates this fix and is
reached through a new entry point, not driven by it):

- REQ-ATH-01.4: `runFactoryForTest(bareFn, undefined, { seed: { "a.ts": "x" } })` where the
  bare factory seeds a collision (`create("a.ts", ...)` without force) → `result.tree.size
  === 0`, `result.error instanceof AuthoringError`, `reason === "path-collision"`. Proves
  `options.seed` reaches `ContractFake`.
- REQ-ATH-17.1: `runFactoryForTest(bareFn, {}, { packageDir: FIXTURE_DIR })` against the
  existing `test/fixtures/harness-opted-in` fixture (schema requires `{port: number}`) with
  schema-invalid input (`{}`) → empty tree/emitted, `AuthoringError reason: "invalid-input"`.
- REQ-ATH-17.2: SAME schema-shaped-invalid input, NO `packageDir` → factory body runs to
  completion (`result.tree.get("server.config.ts") === "static content"`,
  `result.error === undefined`) — proves the untyped path stays byte-identical, no validation
  fires.

**Verification**:
```
bun test test/fake/harness-options-bag.test.ts                          # 3 pass, 0 fail
bun test test/fitness/fit-29-sanctioned-definefactory-caller.test.ts \
         test/fitness/fit-04-dts-semver-gate.test.ts \
         test/types/runfactoryfortest-shape.test.ts \
         test/docs/quickstart-docs.test.ts \
         test/fake/harness-options-bag.test.ts                          # 56 pass, 0 fail
bun run typecheck   # 64 errors — SAME 13 pre-existing files as verify-in-loop-1's evidence
                    # table, zero new
```
Regression sentinels (`test/golden-ir`, `test/core`, `test/conformance`, `test/dialects`) and
`src/core/context.ts` (frozen body + JSDoc): both empty diffs vs. merge-base — unchanged.
No file named in ruling R-9 (the 5 unclaimed S-002 files) was touched. No existing harness
file (`test/fake/harness-{result,leak-scan,opted-in,in-memory-invariant}.test.ts`) was
converted — that stays S-002 scope.

## Suite State at End of S-000 (post-fix)

`bun test`: **1165 pass, 99 fail** (was 1162/99 before this fix — the +3 delta is exactly the
3 new characterization tests; the 99 failures are the SAME pre-existing files/buckets, zero
new failures introduced). Every failure traces to one of the three buckets already documented
above (14 files) — zero unexplained failures, zero diff in regression sentinels, zero touch to
the frozen `defineFactory` body.

## S-001 — Wrap-Parity Proof (REQ-ATH-19)

### Tasks completed

- [x] `test/support/wrap-parity-support.ts` (NEW): `runViaManualWrap<O>(fn, input, options?)`
  — calls `defineFactory(fn, {packageDir})` DIRECTLY (never re-wraps via
  `runFactoryForTest`, ADR-C), hand-builds a `RecordingClient`-shaped object (four
  members, structurally mirroring `src/testing/index.ts:100-116`, the private interface
  is never imported) over a fresh `ContractFake({seed})` or a caller-supplied fake.
  `FaultyDiscardFake` (extends `ContractFake`, overrides `discard()` to always reject
  with a caller-supplied error) is the E1/E2 double-fault fixture.
- [x] `test/fake/harness-wrap-parity.test.ts` (NEW):
  - REQ-ATH-19.1: a dialect-USING factory (`ts.find("a.ts").addImport(...)`, chosen
    specifically because a no-dialect factory cannot distinguish "drain ran" from "drain
    was a no-op") run via `runFactoryForTest` AND via `runViaManualWrap` — asserts
    `{tree, emitted}` structurally identical between both paths, including the
    drain→flush ordering.
  - REQ-ATH-19.2: factory throws `E1`; the harness path intercepts
    `ContractFake.prototype.discard` via `spyOn(...).mockImplementationOnce` (production
    `ContractFake.discard()` never itself rejects — there is no injection point into
    `runFactoryForTest`'s internally-built fake, so the shared prototype method is
    intercepted for this one call, then restored in a `finally`); the manual path drives
    a `FaultyDiscardFake(e2)` instance directly. Both assert `error === E1` and
    `error.cause === E2`.

### Verification run (this slice, in isolation)

```
bun test test/fake/harness-wrap-parity.test.ts    # 2 pass, 0 fail
```

Regression sentinels + frozen `defineFactory` body: unaffected (this slice adds
test-only infrastructure; touches no production file).

## S-002 — Harness Rule Completion + Error Strings + Commons JSDoc

**Consumer set**: 9 files per §21 R-9 — the 4 original harness files
(`test/fake/harness-{leak-scan,result,opted-in,in-memory-invariant}.test.ts`) + the 5
folded files (`test/fake/copyin-fidelity.test.ts`, `test/scaffold/{batch-cap-chunk,
classify-transport,scaffold-fake}.test.ts`, `test/e2e/author-emulation/ir-transcript.
test.ts`). Verified via `rg -n "defineFactory" <file>` on all 9 post-conversion: zero
executable references remain (2 files carry inert PROSE mentions of the identifier in
comments — `harness-opted-in.test.ts:5,17`, `classify-transport.test.ts:18` — neither is
an import or call site).

### Tasks completed

- [x] All 9 consumer files converted: test factories are now bare `(input) => ...`
  functions; `packageDir`/`seed` moved from the `defineFactory(fn, {packageDir})` call
  site into `runFactoryForTest`'s (or `rejectedRun`'s) options bag. `defineFactory`
  imports dropped from all 9.
- [x] `test/support/ir-transcript.ts`'s `captureRun<O>(run, input, options?: {seed?,
  packageDir?})` — options-bag signature (design §4.3), needed to convert
  `test/e2e/author-emulation/ir-transcript.test.ts` (one of the R-9 5). Raw-rethrow
  divergence (line 108, unchanged) verified untouched by diff. NOTE: `scripts/
  regen-corpus.ts` and `test/e2e/author-emulation/corpus-format.test.ts` still call
  `captureRun(scenario.run, scenario.input, scenario.seed)` positionally — this was
  ALREADY broken pre-S-002 (their `scenario.run` doesn't fit the bare-fn shape either,
  self-healing bucket, S-004/S-005 owned) — this edit does not add a NEW break, confirmed
  via typecheck (same 5 files, same error count, before and after this slice).
- [x] `harness-result.test.ts`: sync-throw / async-reject / non-function-export /
  zero-arg-factory tests (ATH-01.2/.3, ATH-06.1/.2, ATH-18.1/.2).
- [x] `harness-in-memory-invariant.test.ts`: carve-out reads widened to package-root
  scope (ATH-11.1/.2, ATH-14.1/.2).
- [x] `harness-opted-in.test.ts`: positive fs-read oracle proving `packageDir` was
  actually forwarded (ATH-17.1/.2/.3).
- [x] 3 scaffold/expander error strings reworded to ADR-B's verbatim runtime-neutral
  pattern (`"<verb> has no package directory to resolve … against — pass \`packageDir\`
  to the call that runs this factory"`, `"invalid input: "` prefix kept, each site's own
  detail clause preserved): `src/scaffold/index.ts` (`readTemplateFile`, `copyIn`),
  `src/scaffold/expander.ts` (`scaffold`). Per-message tests added: `test/scaffold/
  index.test.ts` (REQ-TES-09.1/.2), `test/scaffold/expander.test.ts` (REQ-TES-09.3) — each
  asserts `not.toContain("defineFactory")` + the caller-supplied-`packageDir` remedy +
  the verb name + the `"invalid input: "` prefix.
- [x] `src/commons/index.ts` JSDoc: all 6 pre-change `defineFactory` mentions (§14 table
  lines 165, 234, 274, 382, 385, 393) reworded — "inside a `defineFactory` run" →
  "inside a factory run started with packageDir"; `dryRun`'s `@example` rewritten from a
  `defineFactory(() => {...})`-wrapped snippet to a bare `const run = () => {...}` one.
  New `test/commons/jsdoc-bare-contract.test.ts` (REQ-TES-10.1): token-scan asserting
  `not.toContain("defineFactory")` anywhere in the file.
- [x] FIT-06 regex update (R-6, same commit as the JSDoc rewrite):
  `test/fitness/fit-06-example-jsdoc.test.ts`'s REQ-TSD-02.1 assertion changed from
  `toMatch(/@param\s+seed\b/)` to `toMatch(/@param\s+options\.seed\b/)`, matching
  `src/testing/index.ts`'s own `@param options.seed` JSDoc line (already landed in
  S-000).

### Discoveries + fixes made during this slice (not silent — recorded here)

1. **`test/skeleton/dry-run-public-contract.test.ts` — REQ-DRE-04.1 regression from a
   PRIOR (already-archived) change.** This test (from `dry-run-exposure`, Stage 3) pinned
   `dryRun`'s `@example` block to literally contain `"defineFactory"`. REQ-TES-10.1
   mandates removing that exact token from that exact JSDoc block — the two requirements
   are mutually exclusive as originally written. This is NOT one of the ~85 deep-import
   sentinel files (it does not import `defineFactory` at all; it text-scans `src/commons/
   index.ts`), so it falls outside the regression-sentinel zero-diff set (`test/golden-ir
   /**`, `test/core/**`, `test/conformance/**`, `test/dialects/**` — this batch's Hard
   Constraints list; `test/skeleton/**` is NOT in it, unlike design.md §4.8's broader,
   directory-level phrasing). Fix: swapped the stale `toContain("defineFactory")` pin for
   `toContain("const run =")` — same intent (prove the example shows an in-run factory
   declaration), updated for the bare-shape contract. Verified: this was the ONLY
   full-suite failure outside the already-documented self-healing/future-slice buckets
   before the fix; 0 unexplained failures after.
2. **`test/scaffold/batch-cap-chunk.test.ts` — one incomplete conversion.** 3 of its 4
   `describe` blocks were already bare + `runFactoryForTest`/`rejectedRun`; the
   REQ-04.3 exactly-at-cap test still built a manual `defineFactory<void>(...)` +
   `ContractFake` + `run(undefined, {client: fake})` driver. Converted to the same bare +
   `runFactoryForTest(run, undefined, {packageDir: dir})` shape as its siblings; assertion
   moved from `fake.committedTree()` to `result.tree` (the now-unused `ContractFake`
   import for this specific test path was left in place — still used by the file's other
   two `rejectedRun`-based tests). `defineFactory` import removed from the file (zero
   remaining uses).

### Verification run (this slice + S-001, isolation set)

```
bun test test/fake/harness-wrap-parity.test.ts test/fake/harness-result.test.ts \
         test/fake/harness-in-memory-invariant.test.ts test/fake/harness-opted-in.test.ts \
         test/fake/harness-leak-scan.test.ts test/fake/copyin-fidelity.test.ts \
         test/scaffold/batch-cap-chunk.test.ts test/scaffold/classify-transport.test.ts \
         test/scaffold/scaffold-fake.test.ts test/e2e/author-emulation/ir-transcript.test.ts \
         test/commons/jsdoc-bare-contract.test.ts test/scaffold/index.test.ts \
         test/scaffold/expander.test.ts test/fitness/fit-06-example-jsdoc.test.ts
# 110 pass, 0 fail (14 files)

bun test test/fitness/fit-29-sanctioned-definefactory-caller.test.ts \
         test/fitness/fit-08-no-kit-bleed.test.ts test/fitness/fit-04-dts-semver-gate.test.ts \
         test/fitness/fit-16-reserved-name-scan.test.ts
# 68 pass, 0 fail — unaffected by this batch's production edits

bun test test/skeleton/dry-run-public-contract.test.ts    # 7 pass, 0 fail (post-fix)

bun run typecheck
# 12 errors, same 5 pre-existing S-004/S-005-owned files (scripts/regen-corpus.ts,
# test/e2e/author-emulation-scaffold.e2e.test.ts, test/e2e/author-emulation/
# corpus-format.test.ts, test/fitness/fit-24-corpus-purity.test.ts, test/fitness/
# fit-28-corpus-determinism.test.ts) — zero new errors traceable to S-001/S-002
```

Regression sentinels: `git diff --stat -- test/golden-ir test/core test/conformance
test/dialects` → empty. `src/core/context.ts`: empty diff (untouched entirely, not just
the frozen body — this batch needed no JSDoc edit there).

## Suite State at End of Batch 2 (S-001 + S-002)

`bun test`: **1217 pass, 56 fail** (was 1165/99 at end of S-000). Every remaining failure
traces to one of the already-documented future-slice/self-healing buckets, now fully and
exactly accounted for — zero unexplained failures:

| Bucket | File | Fails | Owner |
|---|---|---|---|
| self-healing (S-004 fixture flip) | `test/e2e/author-emulation-scaffold.e2e.test.ts` | 45 | S-004 |
| explicitly planned red | `test/e2e/installed-consumer.e2e.test.ts` | 6 | S-006 |
| self-healing | `test/fitness/fit-28-corpus-determinism.test.ts` | 2 | S-004/S-005 |
| explicitly planned red | `.tmp-readme-copy-runnable/example-0.test.ts` | 2 | S-003 |
| self-healing | `test/fitness/fit-24-corpus-purity.test.ts` | 1 | S-004/S-005 |
| self-healing | `test/e2e/author-emulation/corpus-format.test.ts` | 1 | S-004/S-005 |

No file owned by S-001/S-002 appears in this table. `bun run typecheck`: 12 errors, all 5
in the self-healing bucket (`scripts/regen-corpus.ts` + 4 test files above), zero new.
