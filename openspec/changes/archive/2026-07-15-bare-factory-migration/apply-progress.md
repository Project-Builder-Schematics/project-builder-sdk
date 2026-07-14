# Apply Progress: bare-factory-migration

**Mode**: Strict TDD | **Artifact store**: hybrid (this file + Engram mirror `sdd/bare-factory-migration/apply-progress`)

## Slice Status

| Slice | Scope tag | Status | Notes |
|---|---|---|---|
| S-000 | walking-skeleton | done | see below |
| S-001 | happy-path | done | see below |
| S-002 | happy-path | done | 9-file consumer set per §21 R-9; see below |
| S-003 | happy-path | done | see below |
| S-004 | happy-path | done | scratchFactoryRunner redesigned — see deviation note below |
| S-005 | happy-path | done | regen executed, git-clean no-op (see below) |
| S-006 | edge-case | done | export removal, hard-cut ATOMIC — FINAL slice, see below |

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

## S-003 — Author Docs — Bare-Shape Rewrite

### Tasks completed

- [x] README.md: scaffolding-folder example (`:40-47`) rewritten bare (tech-writer finding,
  outside REQ-TSD-01.5's heading-scoped scan — covered instead by a NEW whole-file scan,
  see below). Testing section (`## Testing your factory`): prose + both code examples
  rewritten bare, `seed` moved into the options bag (`{ seed }`), a new closing paragraph
  documents `packageDir`. Zero `defineFactory` tokens remain anywhere in the file (verified).
- [x] `docs/dry-run.md`: runnable fence rewritten bare (`runFactoryForTest` + `(input) =>`
  shape, `seed`-via-options-bag anchoring `find("src/legacy.ts").remove()`'s target so the
  fence actually exercises the removal path); prose at `:40` reworded ("an active run").
- [x] `docs/authoring-verbs.md:78`, `docs/authoring-errors.md:51`: prose reworded to the
  same guarantee without naming the wrap primitive.
- [x] `src/testing/index.ts`: `runFactoryForTest`'s JSDoc rewritten — description paragraph
  fixed (the STALE "`factory` is the RUNNER ... produces" sentence, orphaned by S-000's
  rename, corrected to describe `fn` as the bare author function); `@param fn`/`@param
  options.packageDir` added; `@example` rewritten fully bare (zero wrap-primitive tokens).
- [x] `src/core/context.ts` JSDoc (`:248-292`, frozen body `:293-346` untouched): added a
  literal `@internal` tag + a sanctioned-callers note naming `src/core/**`/`src/testing/**`/
  `src/conformance/**` (FIT-29's allowlist). Kept the EXISTING `@example` (already showed
  the internal bin-invocation + typed wrap pattern — no rewrite needed there).
- [x] `test/fitness/fit-06-example-jsdoc.test.ts`: REQ-TSD-02.1's "@example is complete"
  assertion flipped from `toContain("defineFactory")` (asserting the OLD wrapped contract)
  to `not.toContain("defineFactory")` + a bare-arrow-shape match — this is the ONE
  pre-existing assertion in this file that encoded the wrapped contract; everything else
  (PUBLIC_PATHS widening, `@param options.seed` regex) already landed in S-000/S-002.
- [x] `test/fitness/definefactory-jsdoc.test.ts`: 3 new tests (REQ-FPS-05.2 re-aim) —
  literal `@internal` tag present, sanctioned-caller roots named, `@example` still present
  despite the internal tag (FIT-06's cascade obligation survives per REQ-TSD-02.3).
- [x] `test/docs/testing-story-docs.test.ts`: new REQ-TSD-05 describe block — zero-token
  scan across the 3 doc files (`.3`), prose-reworded assertion (`.2`), and a NEW
  fence-compile check for `dry-run.md` (`.1`): extracts the fence BY CONTENT (searches for
  the one containing `runFactoryForTest`, not by position — dry-run.md has 2 ```ts fences),
  writes it to a scratch dir with an isolated `tsconfig.json` (`{extends: "../tsconfig.json",
  files: ["fence.ts"]}` — same pattern as this repo's project tsconfig with no `include`,
  meaning `files` fully scopes the compile to just this one file + its import graph), and
  runs `bunx tsc --noEmit` against it. "Fence-compiles" is interpreted as a real, isolated
  `tsc` type-check — not a `bun test`/execution pass (dry-run.md's fence has no
  `test()`/`expect()` wrapper, unlike README's copy-runnable examples) — this is a
  DELIBERATE, recorded interpretation since design/spec don't pin the mechanism.
- [x] `test/docs/doc-set-content.test.ts`: new describe block — whole-README zero-
  `defineFactory` scan (design §4.6's "design-added" row), the mechanism covering the
  scaffolding-example fix that sits OUTSIDE REQ-TSD-01.5's heading-scoped scan.

### Verification run (this slice, in isolation)

```
bun test test/docs/doc-set-content.test.ts test/docs/testing-story-docs.test.ts \
         test/fitness/fit-06-example-jsdoc.test.ts test/fitness/definefactory-jsdoc.test.ts
# 56 pass, 0 fail
```

Regression sentinels: empty diff. `src/core/context.ts` diff confined entirely to the JSDoc
range `:248-292` (frozen `:293-346` body byte-identical, verified via diff inspection).

### Suite state at end of S-003

`bun test`: 1225 pass, 55 fail (was 1217/56) — the `.tmp-readme-copy-runnable/example-0.test.ts`
2-fail bucket is GONE (README's example now passes verbatim). `bun run typecheck`: 12 errors,
same 5 self-healing files, zero new.

## S-004 — Fixture Rewrite — typed-factory + author-emulation, bare

### Tasks completed

- [x] `test/fixtures/typed-factory/factory.ts`: `run` converted to a bare
  `(input: Input): void` export; gained a `PACKAGE_DIR` constant (mirrors the
  author-emulation fixture's own convention) for its 2 consumers to thread explicitly.
- [x] `test/e2e/typed-factory.e2e.test.ts`: now performs the ONE `defineFactory<Input>(run,
  {packageDir: PACKAGE_DIR})` wrap itself (REQ-FPS-04.1's "the e2e test that drives it
  performs the wrap internally" clause) — this file was NOT in any slice's named file list,
  but is a direct, necessary consumer of the fixture's shape change (discovered via `grep`
  for `typed-factory/factory` importers before editing, per R-2's "match existing patterns,
  verify before writing" discipline).
- [x] `test/fixtures/author-emulation/factory.ts`: all 28 `export const run*` bindings
  converted to bare. The 19 direct `defineFactory<Input>(fn, {packageDir: PACKAGE_DIR})`
  exports (M01, M02Defaults/MissingFrom/MissingTo, M03-M06, M08, M10, M11AtCap/OverCap,
  M12Binary, M13, M15, M16Traversal/Absolute, M20Valid) became plain exported functions —
  `packageDir` moved entirely to the `ScenarioEntry`/call-site level. The 9 scratch-backed
  exports (M07, M09, M14, M17NonExisting/Existing, M18, M19, M21, WalkOrderDiscriminator)
  keep calling `scratchFactoryRunner`, whose OWN internals changed — see the deviation note
  below, this is the significant design decision of this slice.

#### Deviation from ruling R-3 — recorded, not silent

Slices.md §20 ruling R-3 states `scratchFactoryRunner` "STAYS a direct `defineFactory`
caller." Verified at build time (per slices.md §10's explicit invitation to confirm this at
build time and record the decision) that this is **mechanically impossible to reconcile
with correct corpus capture**: `src/core/session.ts`'s `Session` class holds its
`EngineClient` in a truly private field (`#client`, ES private, no accessor anywhere on
`RunContext` or `Session`'s public API). A nested wrap-primitive call inside a bare-exported
scratch function would need to build its OWN independent client/fake (mirroring
`wrap-parity-support.ts`'s manual-wrap pattern) — and its directives would land in THAT
independent fake, never in the OUTER `runFactoryForTest` wrap's `result.tree`/`emitted`,
which is what `captureRun`/the corpus actually reads. There is no way to relay "the ambient
client" into a nested call from bare, arity-1 factory code — by design, author code never
sees the client at all.

**Implemented instead**: `scratchFactoryRunner` no longer nests a second wrap-primitive
call. It reuses the SAME ambient run `runFactoryForTest`/`captureRun` already established
for the scenario: it creates the scratch dir + `collection.json` (unchanged), replicates the
wrap primitive's OWN reserved-name check via the SAME exported utilities it calls
(`findReservedSibling` + `rejectionForReservedName` from `src/core/schema/*` — never a
private reimplementation), computes `packageRoot === packageDir` directly (faithful: the
scratch dir's `collection.json` sits AT its own root, so the real containment-ceiling walk
would resolve to the same value), then temporarily reassigns `currentContext().packageAnchors`
for the duration of `body`'s execution, restoring the previous value (always `undefined`
today, since these rows carry no static `ScenarioEntry.packageDir`) in a `finally`. The
schema-boundary check (`validateAtRunBoundary`) is NOT replicated — it is unexported, and
every scenario here omits `schema.json` (the same ENOENT opt-out the real check itself
takes), so skipping it only drops a console warning, never an observable result difference.
Verified byte-identical: every "matches the committed corpus" e2e assertion for the 7
scratch-backed corpus rows (m-07, m-09, m-14, m-17, m-19, m-21, plus s-00's own path via the
skeleton fixture) passes unchanged against the ALREADY-COMMITTED corpus with zero regen.

- [x] `test/e2e/author-emulation/scenarios.ts`: `FactoryRunner` narrowed to
  `(input: any) => void | Promise<void>`; `ScenarioEntry.packageDir?: string` added;
  threaded `packageDir: PACKAGE_DIR` (or `SKELETON_PACKAGE_DIR` for s-00) at the 16 direct
  entries (s-00 + 15 matrix rows); the 7 scratch-backed entries (m-07/m-09/m-14/m-17/m-18/
  m-19/m-21) carry no `packageDir` — their factories resolve it dynamically, internally.
- [x] `scripts/regen-corpus.ts`, `test/e2e/author-emulation/corpus-format.test.ts`,
  `test/e2e/author-emulation-scaffold.e2e.test.ts`, `test/fitness/fit-28-corpus-determinism.
  test.ts`: all 4 `captureRun(scenario.run, scenario.input, scenario.seed)` positional-3rd
  call sites converted to the options bag `{seed: scenario.seed, packageDir:
  scenario.packageDir}` (`captureRun`'s own signature already landed in S-002).
- [x] `test/e2e/author-emulation-scaffold.e2e.test.ts` direct (non-SCENARIOS) call sites:
  `runM02MissingFrom`/`runM02MissingTo` calls dropped their `{client: undefined as never}`
  2nd arg entirely (both fixtures ignore `input` too — their missing-arg rejection fires
  before any run-context/anchor access, verified via `src/scaffold/expander.ts`'s
  `runScaffold`, so no wrapping/packageDir is needed to invoke them directly);
  `runM11OverCap`/`runM16Absolute` (direct, non-scratch) gained an explicit
  `{packageDir: PACKAGE_DIR}` third arg at their `captureRun(...)` call sites, since their
  own export no longer bakes it in.
- [x] `test/fixtures/red/author-emulation/nondeterministic-factory.ts`: converted to bare
  (unblocks `fit-24`/`fit-28`'s red-proof tests — not one of the 28+1 REQ-ATH-20.1-counted
  exports, but a direct consumer of the same bare `captureRun`/`FactoryRunner` contract,
  discovered broken via the self-healing bucket, in scope to fix per this batch's mandate).
- [x] `test/fitness/fit-16-reserved-name-scan.test.ts`: 3rd signal (`hasUntetheredDefineFactory`)
  RETIRED in the same commit as `test/fixtures/red/reserved/untethered-factory.ts`'s deletion
  — 2 ALWAYS_ON_SCAN_ROOTS-loop assertions removed, 2 red-proof `it` blocks removed, the
  now-dead `hasUntetheredDefineFactory` function removed. Reserved-sibling walk (the OTHER
  signal) untouched, still green.
- [x] REQ-ATH-20.1/.3 whole-file bare-identifier scan: added to
  `test/e2e/author-emulation-scaffold.e2e.test.ts` (no dedicated FIT-number per design;
  co-located with this file's other S-004 matrix-row assertions rather than a new fitness
  file). Scans BOTH fixture files for the bare identifier `\bdefineFactory\b` (word-boundary,
  never the `defineFactory(`-with-paren substring the spec's ORIGINAL V2 wording used before
  ruling R-4's amendment — verified per §16b's finding that the paren-anchored form is
  vacuously green against the generic `Identifier<Input>(` call shape). Includes a red-proof
  (a reverted export string), a no-false-negative check (the generic call form IS caught),
  and a no-false-positive check (a fused/merged identifier with no word boundary is NOT
  caught).

### Verification run (this slice, in isolation)

```
bun test test/fitness/fit-16-reserved-name-scan.test.ts test/fitness/fit-24-corpus-purity.test.ts \
         test/fitness/fit-28-corpus-determinism.test.ts test/e2e/author-emulation-scaffold.e2e.test.ts \
         test/e2e/author-emulation/corpus-format.test.ts test/e2e/typed-factory.e2e.test.ts \
         test/fitness/fit-29-sanctioned-definefactory-caller.test.ts test/fitness/fit-08-no-kit-bleed.test.ts
# 114 pass, 0 fail
bun run typecheck   # zero errors — the ENTIRE self-healing bucket (5 files) is now clean
```

Corpus freshness (S-005 preview, not yet formally run): every "matches the committed
corpus" assertion (22 of them, across all non-gated scenarios) already passes against the
committed `test/e2e/author-emulation/corpus/*.json` with ZERO regen — the fixture rewrite
preserved directive-emission behavior byte-for-byte, as intended.

Regression sentinels: `git diff --stat -- test/golden-ir test/core test/conformance
test/dialects test/skeleton` → empty. `src/core/context.ts`: zero diff vs. the S-003 commit
(S-004 touches no production file at all — test/fixtures/**, test/e2e/**, test/fitness/**,
scripts/** only).

## Suite State at End of Batch 3 (S-003 + S-004)

`bun test`: **1275 pass, 6 fail** (was 1217/56 at end of batch 2). Every remaining failure is
the SAME pre-existing S-006-owned bucket, verified byte-identical (same 6 test names) to the
pre-batch-3 baseline — zero unexplained failures, zero regressions:

| Bucket | File | Fails | Owner |
|---|---|---|---|
| explicitly planned red | `test/e2e/installed-consumer.e2e.test.ts` | 6 | S-006 |

`bun run typecheck`: **0 errors** — the self-healing bucket this change itself created at
S-000 (5 files) is now fully resolved; no new errors introduced.

## S-005 — Corpus Regen — byte-identical freshness

### Failing-first finding — the RED leg is vacuous (documented, not manufactured)

Per Executor Context §12/precedent set by the batch-3 evaluator's verify-in-loop-4 finding:
ran `bun test test/fitness/fit-28-corpus-determinism.test.ts` BEFORE any regen — **2 pass, 0
fail**, and `git status --porcelain test/e2e/author-emulation/corpus/` was already empty. The
corpus was ALREADY byte-identical to what S-004's bare fixtures produce — S-004's own
"Corpus freshness (S-005 preview)" note (above) already flagged this. Manufacturing a fake
red (e.g. temporarily corrupting a committed record) would test nothing this slice's real
acceptance criterion cares about; the documented-vacuous-red precedent from verify-in-loop-4
applies identically here. This slice's value is the EXECUTED freshness proof below, not a
red/green transition.

### Executed proof (REQ-ATH-20.2)

```
bun scripts/regen-corpus.ts
# wrote all 22 records (s-00 + 21 matrix rows) — exit 0

git status --porcelain test/e2e/author-emulation/corpus/
# (empty — git-clean, byte-identical regen, no diff)

bun test test/fitness/fit-28-corpus-determinism.test.ts   # fresh-process double-run, post-regen
# 2 pass, 0 fail (unchanged from pre-regen)

bun run typecheck   # 0 errors
git diff --stat -- test/golden-ir test/core test/conformance test/dialects test/skeleton   # empty
```

No file changed as a result of this slice (the regen script's OUTPUT is identical to the
already-committed corpus) — the freshness guarantee (REQ-ATH-20.2) is proven by execution,
not by a diff. Nothing to mark `[x]` beyond running the script and recording this evidence.

## S-006 — Export Removal — FINAL (hard cut, ATOMIC)

### PRE-GATE (design-mandated, run FIRST)

Verified via `rg -n "import.*defineFactory" test/fake/harness-*.test.ts` (empty) and a
targeted re-check of the 5 folded R-9 files + `test/e2e/author-emulation/ir-transcript.
test.ts` (all clean, zero `defineFactory` imports — S-002 already converted them). No
build-order violation found; proceeded.

### Tasks completed

- [x] `src/testing/index.ts`: removed `export { defineFactory } from "../core/context.ts";`
  (the public re-export). The internal `import { defineFactory } from "../core/context.ts"`
  (used at the delegation call site, `:125`) is UNTOUCHED — `defineFactory` remains reachable
  only from `src/core/**` (declaration/barrel), `src/testing/**` (internal use), and
  `src/conformance/**` (FIT-29's allowlist, unchanged).
- [x] `test/fitness/fit-08-no-kit-bleed.test.ts`: `./testing`'s `SCANNED` entry narrowed —
  `valueAllow: ["runFactoryForTest"]` (dropped `"defineFactory"`), `typeAllow` unchanged
  (`["Batch", "Directive"]`). REQ-TES-03.1's fixture updated to the post-removal shape
  (no `defineFactory` re-export line); NEW red-proof `REQ-TES-03.1b` (a fixture re-exporting
  `defineFactory` is now flagged); NEW test pinning REQ-TES-03.3's "shallow-fix rejection"
  clause (the narrowed allowlist can't be achieved by dropping `./testing` from `SCANNED`
  entirely — the path stays present AND its allowlist is the real, narrow one).
- [x] `src/dialects/typescript/index.ts` — **discovery, not in design's §14 doc inventory**:
  `find`'s JSDoc `@example` still showed `import { defineFactory } from "@pbuilder/sdk/testing"`
  wrapping the example factory. Left as-is, this becomes a BROKEN example the moment the
  export is removed (the import would fail to resolve) — fixed to the bare-shape convention
  every other doc surface in this migration already uses (`export const run = async () => {
  ... }`, no wrap, no `defineFactory` import). No REQ/FIT scans this file's JSDoc content
  today (FIT-06 only checks `@example` PRESENCE, and `normalizeDeclarations()` strips comments
  from FIT-04's diff) — so this was a silent gap, not a red test; fixed under the Boy Scout
  rule (trivial, no frozen-range/production-behavior touch) rather than expanding scope via a
  halt.
- [x] `test/e2e/installed-consumer.e2e.test.ts` (the 6 pre-existing reds this slice inverts):
  - `assertWriteOnlyCommit`/`assertAllOrNothingRejection`/`assertDryRunNonEmpty`: scratch
    scripts converted from `defineFactory(() => {...})`-wrapped runners to bare
    `() => {...}` functions passed directly to `runFactoryForTest`; `assertAllOrNothingRejection`'s
    seed argument moved from a bare positional object into the options-bag `{ seed: {...} }`
    shape (it was building the OLD positional-seed shape, which the new options-bag signature
    would have silently misrouted — fixed as part of this same conversion).
  - Resolution probe test (tarball leg): `results.testing?.hasDefineFactory` flipped
    `true` → `false`; title/comment reworded from "REQ-TES-02.1" (repealed) to
    "REQ-TES-08.1" (`defineFactory` unreachable, the restated positive-boundary REQ);
    describe-block title + its cross-leg red-proof string-match updated in lockstep
    (`"REQ-TES-02/06, ADR-0036"` → `"REQ-TES-06/08, ADR-0036"`).
  - NEW shared scenario `assertDefineFactoryImportFailsToResolve` (REQ-TES-06.4): writes a
    scratch `.mjs` with a STATIC `import { defineFactory } from "@pbuilder/sdk/testing"` and
    asserts the spawned process exits non-zero with `defineFactory` named in stderr — uses
    `spawnCapture` directly (not `runScratchScript`, which throws on non-zero exit; the wrong
    shape for a scenario whose entire point is a failing resolution). Added as a 5th shared
    scenario helper (both legs call it, `SHARED_SCENARIO_HELPERS` + the parity red-proof's
    expected-count updated in lockstep) rather than a single-leg one-off, preserving
    REQ-LC-02.3's structural parity invariant.
- [x] dts REMOVAL regen (event 2 of 2, design §4.8): `bun run build`, then copied
  `dist/testing/index.d.ts` → `test/fitness/dts-baseline/testing.index.d.ts` and
  `dist/dialects/typescript/index.d.ts` → `test/fitness/dts-baseline/typescript.index.d.ts`
  (the dialect file's baseline needed regen too, since its JSDoc fix above changed its
  emitted comment text). Diff is the `export { defineFactory }` line disappearing plus the
  JSDoc catching up to S-000/S-002/S-003's already-landed rewrites (the baseline had been
  stale on JSDoc CONTENT since S-000 only regenerated for the signature change, and
  `normalizeDeclarations()` strips comments from the removal-diff check, so the staleness was
  invisible to FIT-04 until this regen). REQ-TES-05.3's positive-signature assertion
  (`fit-04-dts-semver-gate.test.ts`, already added in S-000) needed NO edit — it still passes
  unchanged, satisfying "paired with the positive assertion, not a removal-only diff" without
  new code, since the signature itself didn't change again in this event.
- [x] `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts` — **expected fallout,
  fixed same commit**: its S-000-era positive-control test hard-coded that
  `src/testing/index.ts` resolves `defineFactory` from `../core/context.ts` TWICE (the
  internal import AND the public re-export, per S-000's Deviation #1). With the re-export
  gone, only one occurrence remains; updated the expected array from
  `["../core/context.ts", "../core/context.ts"]` to `["../core/context.ts"]` and reworded the
  comment.

### Failing-first (captured before the fix)

```
bun test test/fitness/fit-08-no-kit-bleed.test.ts
# (after narrowing SCANNED's valueAllow, before touching src/testing/index.ts)
# 22 pass, 1 fail — "src/testing/index.ts exports only its allowlist":
#   kit symbol leaked: defineFactory in export { defineFactory }

bun test test/e2e/installed-consumer.e2e.test.ts   # pre-existing baseline, captured first
# 8 pass, 6 fail (assertWriteOnlyCommit/assertAllOrNothingRejection ×2 legs, dryRun ×2 legs —
# all a double-wrap TypeError: runFactoryForTest's new signature wrapping an
# already-defineFactory-wrapped runner a second time)

bun test test/fitness/fit-04-dts-semver-gate.test.ts
# (after removing the export from src/testing/index.ts, before regenerating the baseline)
# 15 pass, 1 fail — "testing: no breaking removals vs committed baseline":
#   removed: export { defineFactory } from "../core/context.ts";
```

### Verification run (post-fix, this slice)

```
bun test test/fitness/fit-08-no-kit-bleed.test.ts                              # 23 pass, 0 fail
bun test test/fitness/fit-04-dts-semver-gate.test.ts                           # 16 pass, 0 fail
bun test test/e2e/installed-consumer.e2e.test.ts                              # 16 pass, 0 fail
bun test test/fitness/fit-29-sanctioned-definefactory-caller.test.ts          # 23 pass, 0 fail
bun run typecheck                                                              # 0 errors
bun run build                                                                  # clean
```

Regression sentinels: `git diff --stat -- test/golden-ir test/core test/conformance
test/dialects test/skeleton` → empty. `src/core/context.ts`: zero diff (frozen `:293-346`
body AND its `:248-292` JSDoc both untouched — this slice's only production edits were
`src/testing/index.ts`'s export line and `src/dialects/typescript/index.ts`'s JSDoc example).
`package.json#exports`, `pkg-surface-baseline.json`, FIT-09, FIT-14: untouched (§19
reconciliation confirmed — no subpath removed, only `./testing`'s named-symbol allowlist
narrowed, FIT-08's territory).

Repo-wide `defineFactory` scan (outside `src/core/**`, `src/testing/index.ts`,
`src/conformance/index.ts`, `test/support/wrap-parity-support.ts`, `test/fitness/**`, the
regression-sentinel dirs, and prose/historical docs) — every remaining hit is either (a) an
internal comment inside `src/core/session.ts`/`src/scaffold/expander.ts` describing runtime
coupling accurately, (b) `docs/engine-sdk-wire-design.md` — an engineering design doc (not one
of the 5 author-facing surfaces REQ-TSD-01/05 scan) correctly describing `defineFactory` as
runner-internal machinery authors never call, or (c) `CONTRIBUTING.md`/
`test/e2e/author-emulation/corpus/coverage-manifest.md` — accurate test-taxonomy prose and a
historical friction-log entry from a PRIOR change, neither claiming author-facing reachability
via `./testing`. None require edits.

## Suite State at End of Batch 4 (S-005 + S-006 — MIGRATION COMPLETE)

`bun test`: **1285 pass, 0 fail** (was 1275 pass/6 fail — installed-consumer's 6 reds
inverted to green, FIT-08 gained 2 tests, installed-consumer gained 2 tests, net 1281+4=1285).
`bun run typecheck`: **0 errors**. `bun run build`: clean. Regression sentinels: zero diff.
`src/core/context.ts:293-346`: byte-identical to before this change started. The migration's
end state (REQ-ATH-20, REQ-TES-03/05/06/08) is fully green — `defineFactory` is unreachable
from `./testing`, `runFactoryForTest` is the sole author-facing entry, and the corpus is
proven byte-identical fresh from bare fixtures.

## Final-Verify Fix Pass — council-adjudicated (post pass-with-followups)

Applied the 3 surgical fixes the final-verify council adjudicated, exactly as scoped —
no other production or test edits.

- [x] **Fix 1 (REQ-FPS-05.2 re-aim, tech-writer HIGH)**: `src/core/context.ts:282-296`
  `@example` rewritten — dropped `export const run = defineFactory<Input>(...)` +
  "Author against the generated type" framing (the author's OWN path, contradicted by the
  `@internal` tag two paragraphs above). New shape: bin-invocation comment +
  `schema.generated` import unchanged, then `// 2. Internal: wrap a bare author fn into a
  client-driven runner:` — a bare `const bareFactory = (input: Input) => {...}` wrapped via
  `defineFactory<Input>(bareFactory, { packageDir: import.meta.dir })` and driven with
  `await runner(input, { client })`. Frozen impl body (`:298-351`, `export function
  defineFactory<O>(...)`) untouched — edit confined strictly above it; line count of the
  edit is net-zero so the impl's start line (298) didn't shift.
- [x] **Fix 2 (machine-enforce the re-aim)**: `test/fitness/definefactory-jsdoc.test.ts`
  gained 2 assertions — `not.toMatch(/Author against/)` and `toContain("{ client }")`.
  Verified RED-then-GREEN via `git stash` of `context.ts` alone (both new assertions fail
  against the OLD example, pass against the new one) before committing both together.
- [x] **Fix 3 (FIT-29 vacuous-scan guard, QA mutant D)**: `test/fitness/
  fit-29-sanctioned-definefactory-caller.test.ts` gained one assertion —
  `unsanctionedFiles` must `toContain(join(SRC_DIR, "commons/index.ts"))`, a guaranteed-
  present, never-sanctioned file — so widening `ALLOWLISTED_ROOTS` to swallow the whole
  scan surface now fails this assertion instead of silently emitting zero `it()` blocks.
- [x] **Fix 4 (README packageDir coherence, tech-writer MEDIUM)**: `README.md` — (a) added
  one prose line in "Scaffolding a folder" noting `scaffold`/`copyIn`/
  `create({ templateFile })` resolve package-local files and need `packageDir` passed "to
  the call that runs this factory" (runtime-neutral, mirrors the error-message phrasing,
  names no single runner); (b) generalized the `packageDir` closing paragraph in "Testing
  your factory" — it's BOTH the schema-validation opt-in AND the mandatory resolution
  anchor for the package-local verb family, not solely a validation toggle.

### Verification run (this pass)

```
bun test test/fitness/definefactory-jsdoc.test.ts test/fitness/fit-29-sanctioned-definefactory-caller.test.ts \
         test/fitness/fit-06-example-jsdoc.test.ts test/docs/
# 106 pass, 0 fail

bun test    # full suite
# 1288 pass, 0 fail (was 1285/0 — +3 = the 2 definefactory-jsdoc + 1 FIT-29 new assertions)

bun run typecheck   # 0 errors
```

Regression sentinels: `git diff --name-only $(git merge-base main HEAD) -- test/golden-ir
test/core test/conformance test/dialects` → empty. Frozen `defineFactory` impl body
(`src/core/context.ts:298-351`) byte-identical — only the JSDoc block strictly above it
changed.
