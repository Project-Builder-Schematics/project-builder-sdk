# Apply Progress: bare-factory-migration

**Mode**: Strict TDD | **Artifact store**: hybrid (this file + Engram mirror `sdd/bare-factory-migration/apply-progress`)

## Slice Status

| Slice | Scope tag | Status | Notes |
|---|---|---|---|
| S-000 | walking-skeleton | done | see below |
| S-001 | happy-path | not started | |
| S-002 | happy-path | not started | scope should ABSORB the gap files below (see Scope Gap) |
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

## Suite State at End of S-000

`bun test`: **1162 pass, 99 fail** (baseline before any S-000 work: all green). Every one of
the 99 failures traces to one of the three buckets above (14 files) — zero unexplained
failures, zero diff in regression sentinels, zero touch to the frozen `defineFactory` body.
