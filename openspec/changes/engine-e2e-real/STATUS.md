# Status: PAUSED

**Paused**: 2026-07-25 · **Phase reached**: explore (complete) · **Next phase**: propose

## Why paused

Deprioritised in favour of the engine's **Deliverable 4** — the runner integrity manifest
(`ENGINE-RUNNER-MANIFEST-CONTRACT.md`, engine change `PC-RUN-01` / `production-runner-selection`).
That one is a **build gate**: the engine cannot graduate production to spawn the real
`pbuilder-runner.js` until the SDK publishes `dist/runner-manifest.json`. This change is not a gate
for anything on the engine side, so it yields.

No production code was written. This branch carries planning artefacts only.

## Blocking question to answer on resume

Where does the gap-A artefact live?

- **(a)** A standalone SDK e2e in `test/e2e/` — sibling of `installed-consumer.e2e.test.ts` and
  `dist-runner-dual-realm.e2e.test.ts`. SDK-owned, low risk. Does NOT hand the engine a consumable
  corpus fixture.
- **(b)** A fixture registered in `conformance/corpus.json`, consumed by the engine harness —
  satisfies the engine brief's Deliverable 2 literally, but clashes with the corpus's
  relative-source-import convention and needs a package-resolution setup no corpus fixture has.
- **(c)** Both.

This is a product decision, not a technical one — the technical path is settled (see `explore.md`).

## What exploration already settled

- The package-resolution machinery **already exists and is tested**: `ensureLinkedConsumer()` /
  `ensurePackedConsumer()` in `test/support/scratch-consumer.ts`, exercised by
  `test/e2e/installed-consumer.e2e.test.ts`.
- The runner-spawn + wire idiom **already exists**: `test/fake/dist-runner-dual-realm.e2e.test.ts`
  driving `serveSpawnedRunner()` / `ContractFake`.
- The residual gap is the **intersection neither covers**: a factory that resolves `@pbuilder/sdk`
  as a PACKAGE *and* runs through the spawned runner + wire. `installed-consumer` runs in-process
  via `runFactoryForTest`; `dist-runner-dual-realm` spawns the runner but imports
  `../../../../src/index.ts` by relative source.
- **Hard design constraint**: the demo MUST resolve via `bun link`, not a packed tarball. SEC-07
  (`src/transport/single-instance-probe.ts`) compares the runner's and the factory's resolved
  `@pbuilder/sdk` package roots before importing; a tarball is a physical copy at a different
  realpath and fails closed. A symlink shares the root and passes.

## Correction recorded during exploration

`context-singleton-fix` is **not archived** (state: build-complete). Its ADRs are still in-change
`ADR-01` / `ADR-02` — they have **not** been promoted to global `0068` / `0069`, contrary to what
this change's `triage.md` assumed.

## Resume

Answer the blocking question above, then run `sdd-propose` (merged mode) with the chosen home and
the bun-link / SEC-07 constraint carried in as a hard requirement.
