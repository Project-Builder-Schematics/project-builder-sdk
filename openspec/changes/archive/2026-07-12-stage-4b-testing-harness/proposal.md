# Proposal: Stage 4b — Testing Harness (`stage-4b-testing-harness`)

**Triage**: L · **Persona lens**: none · **Store**: hybrid

## Intent

Schematic authors cannot test the factories they write. `defineFactory` (`src/core/context.ts:38`) is unreachable from any installed `@pbuilder/sdk` — it lives only in the ADR-0009 internal kit barrel, never in `package.json#exports`. Even if reachable, there is no supported harness: the ONE normative `ContractFake` is repo-internal (`test/support/`, 25 importers, excluded from the build). Without 4b, Stage 4's typed options crystallise as outputs-without-outcome — the founding write-only-factory bug has no author-facing test that would catch it. This delivers on the owner's Stage-4 steward foresight commitment (CQ1, 2026-07-07: COMMITTED-NEXT).

## Scope

### In Scope
- `./testing` facade exporting `runFactoryForTest` and `defineFactory` (the ONLY sanctioned kit name it surfaces; path-scoped FIT-08 carve-out).
- `defineFactory` reachability VIA `./testing` ONLY — `./core` stays unmapped, FIT-09 keeps asserting it undefined; production graduation deferred to Stage 6.
- `runFactoryForTest` result: committed tree + emitted IR `Batch[]` + error, with the documented **unrendered-template non-promise**.
- In-memory-only invariant (harness never touches fs/net/env/argv) frozen as a REQ + fitness.
- `ContractFake` relocated to `src/testing/` as single source; old path becomes a pure re-export shim under a reference-identity parity invariant (fail-closed).
- 4 companion guards: FIT-08 path carve-out, dev-only bundle guard (fail-closed built-graph scan), FIT-04 dts baseline, FIT-09 exports entry.
- Positive docs: README testing section + JSDoc `@example`; revert the README incremental-shipping qualifying-line (sequenced after Stage 4 merges).
- ADR-0009 amendment: literal third audience `author-testing`, own entry `./testing`, 0.x semver-exempt.
- Outcome-proof: installed-consumer-vantage e2e (pack → install → import by package name → run factory).

### Out of Scope
- Wiring `./core` into exports (STRUCK — repeals ADR-0009). Add/remove L2 enforcement. Prompt rendering (Go CLI). Dialects / Stage 5 / L2 composition / real wire. Stage 4's §4.4 example must NOT depend on `./testing`.

## Capabilities (contract with sdd-spec)

### New Capabilities
- `author-test-harness`: `runFactoryForTest` API, result shape (tree + IR Batch[] + error), unrendered-template contract, in-memory-only invariant.
- `testing-entry-surface`: `./testing` export, `defineFactory` reachable via `./testing` only, dev-only bundle containment guards, exports/dts baselines, consumer-vantage e2e proof.
- `fake-single-source-parity`: `ContractFake` relocated to `src/testing/` as single source, re-export shim identity parity, fail-closed enforcement.
- `testing-story-docs`: README testing section, JSDoc `@example`, qualifying-line revert, ADR-0009 third-audience amendment framing.

### Modified Capabilities
- None (no existing spec's REQUIREMENTS change; guards extend, they don't redefine behaviour).

## Approach

Relocate `ContractFake` physically into `src/testing/` (explore Approach A — forced: `tsconfig.build.json` `rootDir:"./src"`/`exclude:["test"]` forbid a `src`→`test` import in the published build). Drag `test/support/rejection-messages.ts` with it; re-point ~25 importers via a pure re-export shim at the old path, guarded by parity-by-identity (reference-identity assertion, not a behavioural suite). `src/testing/index.ts` wraps the relocated fake with spy-style batch recording — mirrors the existing `src/conformance/`, `src/dry-run/` sibling-module pattern. Containment is FAIL-CLOSED: the dev-only guard bun-builds each production entry (`.`/`./commons`/`./conformance`) and asserts the `CONTRACT_FAKE_PREFIX` literal is ABSENT (positive control asserts it IS present in the `./testing` bundle); conditional exports (fail-open) are forbidden as the mechanism. FIT-08 gains a per-path allowlist data model (new machinery, not a blanket skip). The outcome-proof e2e uses `bun pm pack` + scratch-dir install + import-by-package-name (explore C2) — never a relative dist import. **Design must formalise (ADRs)**: ADR-0009 amendment (third audience), the FIT-08 per-path allowlist model, the dev-only-guard mechanic, and the pack/scratch-dir lifecycle (explore technical open question). Next free FIT number: FIT-17; next free ADR: 0032.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `package.json#exports` | Modified | add `./testing` (never `./core`) |
| `src/testing/index.ts` | New | facade: `runFactoryForTest` + `defineFactory` |
| `src/testing/contract-fake.ts` (+ `rejection-messages.ts`) | New (relocated) | single source of the normative fake |
| `test/support/contract-fake.ts` | Modified | pure re-export shim (identity parity) |
| ~25 importer test files | Modified | re-point to relocated path |
| `test/fitness/fit-08-no-kit-bleed.test.ts` | Modified | per-path allowlist |
| `test/fitness/fit-09-*`, `fit-04-*` | Modified | extend fixed arrays incl. `./testing` |
| `test/fitness/fit-17-testing-dev-only-bundle.test.ts` | New | fail-closed containment guard |
| `test/fitness/fit-10-*`, `fit-07-*` | Modified | hardcoded path string; stale dist comment |
| `test/e2e/*installed-consumer*.e2e.test.ts` | New | pack-install-import outcome-proof |
| `openspec/decisions/0009-*.md` | Modified | third-audience amendment (ADR-0032) |
| `README.md` | Modified | testing section + qualifying-line revert |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| 25-importer relocation churn introduces drift | Medium | parity-by-identity shim; mechanical diff |
| Shallow FIT-08 "skip `./testing`" reopens symbol-scoped hole | Medium | per-path allowlist REQ + fitness, not a config skip |
| Dev-only guard silently passes (new, no direct precedent) | Medium | fail-closed + positive control asserting presence in `./testing` |
| README-revert slice undoable if Stage 4 hasn't merged | Medium | sequenced strictly after Stage-4 archive/merge; slice gated |
| Fake enters published tree, raising containment stakes | Medium | dev-only guard is the gate; e2e proves reachability |
| FIT-07 stale "not in dist" comment drifts silently | Low | explicit note, not silent edit |
| Engine-side template rendering assumed but not delivered | Low | unrendered-template documented as explicit non-promise |

## Rollback Plan

The change is a pure additive public-surface + test-infra move; every step is git-reversible with no data or migration. To roll back: (1) revert the `./testing` entry in `package.json#exports` and delete `src/testing/` — the entry never existed before, so consumers cannot depend on it after a clean revert; (2) revert the `ContractFake` relocation by restoring `test/support/contract-fake.ts` as the real file and dropping the shim (the 25 importer paths revert in the same commit — the shim guarantees byte-identical behaviour either way); (3) revert FIT-08/09/04/10/07 edits, the new FIT-17, and the e2e to their pre-change fixtures; (4) revert README + ADR-0009. Validate rollback by a clean `bun run build` + full suite green at the prior FIT baselines (FIT-04/FIT-09 dist-shape assertions confirm `./testing` is absent again). No irreversible step; no unrecoverable data.

## Dependencies

- `feat/stage-4-typed-options` must merge FIRST: 4b rebases on it (FIT-08 same-file contention; FIT-14 pkg-surface baseline) and the README qualifying-line must exist to be reverted. The README-revert slice is gated on that merge.
- Stage-4 archive must promote its ADR drafts (0027-0031) before 4b claims ADR-0032.

## Success Criteria

- [ ] `import { runFactoryForTest, defineFactory } from "@pbuilder/sdk/testing"` resolves from an installed tarball; `@pbuilder/sdk/core` stays unresolvable (FIT-09 green).
- [ ] Installed-consumer-vantage e2e (pack→install→import-by-name→run factory) asserts a golden committed tree, and covers BOTH the write-only-factory scenario and an all-or-nothing rejection (empty tree).
- [ ] `runFactoryForTest` result exposes committed tree + emitted IR `Batch[]` + error; a test asserts templates are stored UNRENDERED.
- [ ] Dev-only bundle guard: `CONTRACT_FAKE_PREFIX` literal ABSENT from every production entry bundle, PRESENT in the `./testing` bundle (positive control).
- [ ] FIT-08 per-path allowlist permits `defineFactory` on `./testing` only; symbol-scoped bleed into other author subpaths still fails.
- [ ] Parity-by-identity: the `test/support/contract-fake.ts` shim and `src/testing/contract-fake.ts` resolve to the same reference.
- [ ] In-memory-only fitness: harness touches no fs/net/env/argv; FIT-11 no-engine-text scan extended to harness error/report output.
- [ ] Full suite green (incl. FIT-04/FIT-09 regenerated baselines) after rebase on merged Stage 4.

## Caveats from Exploration (ready_for_proposal: partial)

- **Caveat: Stage-4 merge sequencing for the README revert** → addressed in Dependencies + Rollback: 4b builds strictly after Stage-4 archives; the README-revert slice is gated on that merge, not assumed. (Owner-ruled: 4b is COMMITTED-NEXT, sequenced after Stage 4.)
- **Caveat: ADR-0009 audience framing** → RESOLVED by owner ruling P4: literal third audience `author-testing` with its own `./testing` entry, 0.x semver-exempt. Encoded in the `testing-story-docs` capability and Approach.
- **Caveat (technical): pack/scratch-dir e2e mechanics** → deferred to `sdd-design`: Approach commits to `bun pm pack` + scratch-dir install + import-by-package-name (explore C2); the concrete `file:` vs tarball-extraction lifecycle and failure-cleanup are a design decision.
