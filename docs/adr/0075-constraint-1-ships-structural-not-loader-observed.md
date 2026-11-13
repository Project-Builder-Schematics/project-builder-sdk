# ADR-0075: Constraint 1 Ships Structural — Never by Loader Observation, Never by Naming a Tool

**Status**: Accepted · **Date**: 2026-07-25 · **Change**: `runner-integrity-manifest` (originally ADR-03)

## Context

"No bundler with code-splitting" is the integrity lemma's first precondition, and a bundler
**already runs in this build** (`build:codegen` writes `dist/bin/pbuilder-codegen.js`, legitimately,
into the runner's own directory). Any all-of-`dist` 1:1 check fails on it immediately. The realistic
drift is not "someone adopts a bundler" but "someone points the bundler already here at the runner
for startup performance".

## Decision

Three closure-scoped structural checks in `fit-42`:

1. **Graph-preserving emit** — per-file relative-specifier multiset equality modulo type-only erasure.
2. A committed **closure-graph baseline** carrying `{nodes, edges, builtins}`, so a redirected edge
   with an unchanged node set still fails.
3. **Bundler-output disjointness** — every `--outfile`/`--outdir`/`-o` target in `package.json#scripts`
   is outside the closure path set, non-vacuous today.

## Rejected

- **Loader observation under Bun.** Feasible (the engine confirmed Bun definitively) but ruled a
  followup: it would gate this change on runtime instrumentation research while the structural shape
  already breaks CI.
- **"No bundler in `devDependencies`".** Names a tool; survives no tool swap; vacuous the day
  `bun build` (already present) is aimed at the runner.
- **An all-of-`dist` 1:1 source-correspondence check.** Fails on the legitimate codegen bundle.
- **Asserting `src → dist` too.** Would fail on `dist/core/engine-client.js`, which legitimately
  exists outside the closure.

## Consequences

Constraint 1 is a **CI-time**, not build-time, guarantee — a bundler-rewritten graph still produces a
manifest; only `bun test` sees it. Stated as a limit on the docs page.

**Known open (judgment-day R2-6)**: path normalisation in the disjointness comparison still admits
`.//dist/x` and `--outdir .`. Registered in `pending-changes.md`; leg 3 is one of three, and the
baseline and graph-preserving legs remain as backstops.
