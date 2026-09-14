# Exploration: Engine↔SDK real e2e via package-resolvable demo (engine-e2e-real)

**Triage**: M
**Persona lens**: none

## Cross-Change Lessons Consulted
- `context-singleton-fix` (build-complete, NOT archived): globalThis `Symbol.for("@pbuilder/sdk:core/context#run-als")` ALS registry neutralizes dual-realm identity. Its ADRs are still in-change **ADR-01/ADR-02** — triage's assumption of promoted 0068/0069 was WRONG; correct downstream.
- ADR-0036 (packed-tarball e2e lifecycle) + ADR-0041 (bun link consumption contract): the two resolution vehicles, both already built.

## Affected Flows
Not applicable — no user-facing surface. The "flow" is an internal test/e2e + conformance artifact.

## Current State
The package-resolution machinery gap A calls for **already exists and is tested**:
- `test/support/scratch-consumer.ts`: `ensureLinkedConsumer()` (bun link) + `ensurePackedConsumer()` (tarball), memoized.
- `test/e2e/installed-consumer.e2e.test.ts` (481 lines): resolves all 6 `@pbuilder/sdk` subpaths BY PACKAGE NAME, proves `defineFactory` unreachable via `./testing`, round-trips a write-only commit through the INSTALLED package.
- `package.json` `link:sdk` script (`bun run build && bun link`); `files: ["dist"]`; runner is a THIN non-bundled dist module (`src/bin/pbuilder-runner.ts:1-7`).
- The runner+wire e2e idiom exists: `test/fake/dist-runner-dual-realm.e2e.test.ts` spawns `dist/bin/pbuilder-runner.js` and drives it via `serveSpawnedRunner`/`ContractFake` (`test/fake/fake-engine-harness.ts`), gated by `ensureTscBuild`/`requireDistArtifacts` (`test/support/shared-build.ts`).

**The precise residual gap = the INTERSECTION neither existing test covers**: a factory that resolves `@pbuilder/sdk` AS A PACKAGE **and** is spawned through the real runner+wire. `installed-consumer` has package-resolution but not the runner/wire path; `dual-realm` has runner/wire but imports `../../../../src/index.ts` (source). Gap A = compose the two.

## Architecture Touchpoints (A3)
| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| test e2e harness (`test/fake/**`, `test/support/**`) | extend | new demo run = `ensureLinkedConsumer` + `serveSpawnedRunner` composed | aligns |
| conformance corpus (`conformance/**`) | new (CONTESTED) | IF the fixture must live in the engine-consumed registry — but corpus convention is relative-source-import | deviates (see open question) |
| package surface (`package.json#exports`) | read-only | demo CONSUMES `.` export; adds none | aligns |

## Affected Areas
| Path | Impact | Why |
|---|---|---|
| `test/e2e/` (new demo e2e, name TBD) | Created | the package-resolved factory spawned through the runner |
| demo factory module (location TBD) | Created | authored with SDK public API, imports `@pbuilder/sdk` |
| `test/support/scratch-consumer.ts` | Read-only/reuse | `ensureLinkedConsumer` already does the resolution |
| `test/fake/fake-engine-harness.ts`, `test/support/shared-build.ts` | Read-only/reuse | spawn+feed+assert idiom |
| `conformance/corpus.json` + a fixture dir | Created (CONTESTED) | only if home = corpus registry (open question) |

## Sensitive Areas Crosscheck
No sensitive areas ALTERED. `package.json#files = ["dist"]` → demo/fixture not published; consumes existing `.` export. SEC-07 (single-instance-probe) and the wire are CONSUMED, not altered. No override.

## Approaches
### 1. Reuse `ensureLinkedConsumer` + `serveSpawnedRunner` (the only sane approach)
**Description**: A new demo factory authored with the SDK public API imports `@pbuilder/sdk`. A new e2e (step 0) runs `ensureLinkedConsumer` so the factory's `import "@pbuilder/sdk"` symlinks to the repo's own built `dist/`; then spawns `dist/bin/pbuilder-runner.js --factory file://<linked-demo>/factory.ts` and drives it via `serveSpawnedRunner`+`ContractFake`, asserting the committed tree — mirroring the dual-realm e2e verbatim but with package resolution.
**Pros**: zero new machinery; both halves are production-tested; SEC-07 passes because bun link → same package root.
**Cons**: none material. Tarball is explicitly WRONG here (see risk).
**Effort**: Low. **Pattern fit**: matches `dist-runner-dual-realm.e2e.test.ts` + `scratch-consumer.ts`.

## Recommendation
Use Approach 1 with **bun link** (not tarball). The gap is small: compose two existing, tested halves into the one topology neither covers today.

## Risks
- **SEC-07 rejects tarball**: `single-instance-probe.ts` compares runner vs factory `@pbuilder/sdk` package roots BEFORE import; a tarball copy is a different realpath → fail-closed "not the same package". Demo MUST use bun link (symlink → same root), OR spawn the runner from inside the scratch consumer's own installed copy. This is a DESIGN CONSTRAINT, not just a preference.
- **Fixture-home convention clash**: the conformance corpus documents a FIXED relative-source-import convention (`CONFORMANCE-CORPUS-HANDOFF.md:48-50`); a package-importing factory in `conformance/*` deviates. See open question.
- **Fitness tolerance**: a `package.json`/`node_modules` inside a `conformance/<id>/` dir is new territory for `fit-40` and the package-surface scans — verify at design, don't assume.

## Open Questions
- **type: product** — WHERE does the gap-A artifact live? (a) A standalone SDK e2e in `test/e2e/` (sibling of `installed-consumer` + `dual-realm`), owned by the SDK; OR (b) a fixture registered in `conformance/corpus.json`, consumed by the engine harness (Deliverable 2 of the engine brief) — but this clashes with the corpus's relative-source-import convention and needs a package-resolution setup no corpus fixture has. **why it matters**: (a) and (b) are different files, different owners, different acceptance. (b) satisfies the engine brief literally but fights the corpus convention; (a) proves the SDK claim cleanly but does not hand the engine a consumable fixture. Must be owner-decided before propose commits.
- **type: technical** — does a `package.json`/`node_modules` inside a fixture dir trip any SDK-side fitness check beyond fit-40 (package-surface scan, corpus tree-shape)? Feed to design.

## Ready for Proposal
**Status**: partial
**Reason**: The technical path is clear and low-risk (Approach 1, bun link). The one blocker to a clean proposal is the PRODUCT open question (fixture home a vs b) — it changes what the change delivers and to whom. The orchestrator must surface it to the owner before propose.
**Recommended action**: Surface the product open question to the user; then `sdd-propose` (merged) with the chosen home and the bun-link/SEC-07 constraint as a hard requirement.
