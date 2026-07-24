# Status: PAUSED

**Paused**: 2026-07-25 · **Phase reached**: explore (complete) · **Next phase**: propose

## Why paused

Deprioritised in favour of the engine's **Deliverable 4** — the runner integrity manifest
(`ENGINE-RUNNER-MANIFEST-CONTRACT.md`, engine change `PC-RUN-01` / `production-runner-selection`).
That one is a **build gate**: the engine cannot graduate production to spawn the real
`pbuilder-runner.js` until the SDK publishes `dist/runner-manifest.json`. This change is not a gate
for anything on the engine side, so it yields.

No production code was written. This branch carries planning artefacts only.

## Blocking question — ANSWERED 2026-07-25

Where does the gap-A artefact live? **Owner ruled: (a) — a standalone SDK e2e in `test/e2e/`**,
sibling of `installed-consumer.e2e.test.ts` and `dist-runner-dual-realm.e2e.test.ts`.

Rationale (PM lens, ratified by owner): forcing a package-resolution fixture into
`conformance/corpus.json` fights the relative-source-import convention that `conformance-corpus`
deliberately established, and needs a resolution setup no corpus fixture has. Option (b) is
registered as a followup rather than built now.

**Constraint carried forward**: this e2e must NOT assert manifest verification. Gap A resolves via
`bun link` (SEC-07 realpath), and on that path the manifest is fully self-asserted — asserting it
would encode a guarantee the linked path cannot provide.

No planning blockers remain. Resume goes straight to `sdd-propose`.

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

**Resume point**: the moment `runner-integrity-manifest`'s generator merges to `main` and FIT-14's
`pkg-surface-baseline.json` is regenerated there. That is well before that change archives — the two
are serialised only because both regenerate that baseline and both touch the `dist/` build pipeline.
Running them concurrently guarantees a baseline conflict; that is the whole dependency.

Then run `sdd-propose` (merged mode) with home = (a) and the bun-link / SEC-07 constraint carried in
as a hard requirement.
