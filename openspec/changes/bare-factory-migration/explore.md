# Exploration: bare-factory-migration (bare-factory-migration)

**Triage**: L
**Persona lens**: none (single-pass explore; architect/qa/tech-writer lenses to be synthesised at council phases)

## Cross-Change Lessons Consulted

- Pattern from `stage-4b-testing-harness`: `./testing` was wired as the ONLY author-testing facade (ADR-0009 amendment) — the removal target for `defineFactory` in this change.
- Decision from `stage-6-release-shape` archive (engram obs #2070, owner direction 2026-07-14): authors export the bare typed function; `defineFactory` graduates to runner/harness-internal. This IS the change's mandate.
- `openspec/pending-changes.md` row 317 ("Author-surface migration to the bare-factory shape") is the pre-existing, owner-authored scope ledger for this exact migration — blast radius was measured there 2026-07-14 and is the single most authoritative predecessor artefact found. It explicitly states: **"NOT migration work: the ~67 internal test files calling `defineFactory` directly — it remains internal API."** This independently confirms the deep-import split found below.
- ADR-0031 (factory-package-shape-discovery): `packageDir` is threaded today at the author's own `defineFactory(fn, {packageDir})` call site — this is the seam this migration must relocate.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author defines + installs a factory package, imports it by package name | `test/e2e/installed-consumer.e2e.test.ts` | Modify |
| Author runs their factory in a unit test via `runFactoryForTest` | `test/fake/harness-*.test.ts` (4 files) | Modify |
| Author follows the quickstart onboarding doc (bin → typed factory → test) | `test/docs/quickstart-docs.test.ts` (fence-extracted, self-contained in the doc) | Modify |
| Author reads `dryRun()`/`authoring-verbs`/`authoring-errors` docs | none (static content assertions only) | Modify |

## Current State

`defineFactory<O>(fn, {packageDir})` (`src/core/context.ts:293`) is exported from the internal kit barrel (`src/core/index.ts`) AND re-exported from the public `./testing` subpath (`src/testing/index.ts:47`). `runFactoryForTest` accepts the **wrapped runner** `defineFactory` produces (`(o, deps:{client}) => Promise<void>`), never the raw author function. `packageDir` — driving schema validation, reserved-name scan, and the containment ceiling (ADR-0031/0046) — is threaded by the AUTHOR at the wrap call site.

Grep confirms `defineFactory` is referenced in ~90 non-archived files, but **the overwhelming majority (~85) import it via a deep path `.../src/core/context.ts` directly**, bypassing the package boundary entirely — these are the SDK's own internal tests exercising framework internals (`test/skeleton/**`, `test/core/**`, `test/dialects/**`, `test/scaffold/**`, `test/conformance/**`, `test/golden-ir/**`, plus `test/e2e/author-emulation/{ir-transcript,m20-conformance-parity}.test.ts` — confirmed by reading their imports directly, answering triage's open question: **both construct via the internal path, neither consumes the public `./testing` shape**). Per `pending-changes.md` row 317, these stay untouched.

Only ~4 test files import `defineFactory` from the PUBLIC path (`../../src/testing/index.ts`): `test/fake/harness-{leak-scan,result,opted-in,in-memory-invariant}.test.ts`. These, plus docs, fence-tests, guard/fitness tests, the installed-consumer e2e, the author-emulation corpus pipeline, and the live `testing-entry-surface` spec are the REAL affected surface.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/testing/` (author-testing facade) | modify | drop `defineFactory` re-export; `runFactoryForTest` gains bare-fn + `packageDir` option | aligns |
| `src/core/context.ts` (`defineFactory` impl + JSDoc) | modify | implementation unchanged; becomes exclusively runner/harness-internal, JSDoc audience shifts | aligns |
| `src/dialects/typescript/index.ts` (JSDoc `@example`) | modify | shows the author pattern, must go bare | aligns |
| `src/scaffold/`, `src/commons/` (author-facing error strings/JSDoc) | modify | 3 runtime error messages literally instruct authors to call `defineFactory({packageDir})` — becomes wrong guidance | **deviates** — no existing pattern for describing ambient runner behaviour inside an author-visible error string |
| `test/fitness/` (FIT-08/FIT-04 guards) | modify | allowlist + dts baselines narrow with the export removal | aligns |
| `test/fitness/fit-16-reserved-name-scan.test.ts` (3rd-signal heuristic) | modify or retire | `hasUntetheredDefineFactory` scans `ALWAYS_ON_SCAN_ROOTS` (`test/fixtures/typed-factory`) for a literal `defineFactory(` token — that token disappears once this fixture goes bare, turning the guard vacuously green | **deviates** — SEC-2c/Gap-10's threat model assumed an author-visible `defineFactory(...packageDir)` call; migration removes that call site structurally |
| `openspec/specs/testing-entry-surface/spec.md` (REQ-TES-02/03/05/06) | modify | live spec repeal in lockstep with export removal (delta-spec mechanism) | aligns |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/testing/index.ts` | Modify | drop `defineFactory` re-export; `runFactoryForTest` signature + JSDoc |
| `src/core/context.ts`, `src/dialects/typescript/index.ts`, `src/scaffold/{index,expander}.ts` | Modify | JSDoc `@example`s + 3 author-facing error strings naming `defineFactory` |
| `README.md`, `docs/quickstart.md`, `docs/dry-run.md`, `docs/authoring-verbs.md`, `docs/authoring-errors.md` | Modify | the 5 author docs (16 occurrences total, per `pending-changes.md` row 317) |
| `test/docs/quickstart-docs.test.ts`, `test/docs/testing-story-docs.test.ts`, `test/skeleton/dry-run-public-contract.test.ts` | Modify | 3 doc-fence/story compile tests |
| `test/fitness/fit-08-no-kit-bleed.test.ts`, `fit-06-example-jsdoc.test.ts`, `definefactory-jsdoc.test.ts`, `dts-baseline/{testing,typescript}.index.d.ts` | Modify | public-surface guards + frozen dts baselines (FIT-08/FIT-04/FIT-06) |
| `test/fitness/fit-16-reserved-name-scan.test.ts`, `test/fixtures/red/reserved/untethered-factory.ts` | Modify/Retire | 3rd-signal heuristic + its red fixture, see A3 |
| `test/fake/harness-{leak-scan,result,opted-in,in-memory-invariant}.test.ts` | Modify | 4 real consumers of the public `./testing` re-export |
| `test/e2e/installed-consumer.e2e.test.ts` | Modify | generated fixture source strings + `REQ-TES-02.1`'s `hasDefineFactory` assertion (that REQ is repealed) |
| `test/fixtures/author-emulation/factory.ts` (21 exports), `test/fixtures/typed-factory/factory.ts` (1 export, the reference schematic + FIT-16's ONLY `ALWAYS_ON_SCAN_ROOTS` entry) | Modify | wrapped → bare |
| `test/e2e/author-emulation/scenarios.ts` (`FactoryRunner` type), `test/support/ir-transcript.ts` (`captureRun`), `scripts/regen-corpus.ts`, `test/e2e/author-emulation/corpus/*.json` (22 records), `corpus/coverage-manifest.md` | Modify | corpus-generation chain; `captureRun`'s type derives from `runFactoryForTest`'s signature automatically, but per-scenario `packageDir` threading needs explicit design |
| `openspec/specs/testing-entry-surface/spec.md` | Modify | REQ-TES-02 repealed, REQ-TES-03/05/06 reworded |
| ~85 internal test files (`test/skeleton/**`, `test/core/**`, `test/dialects/**`, `test/scaffold/**`, `test/conformance/**`, `test/golden-ir/**`, `test/e2e/author-emulation/{ir-transcript,m20-conformance-parity}.test.ts`, `src/core/index.ts`) | Read-only | confirmed via import-path grep: ALL use `defineFactory` via a deep import from `src/core/context.ts`, never the public surface — explicitly OUT of migration scope per `pending-changes.md` row 317 |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| public-api (contract) | `package.json#exports` `./testing`, `openspec/specs/testing-entry-surface/spec.md` | Yes — `state.yaml`'s `sensitive_override` |

No other sensitive-area rows touched.

## Approaches

### 1. Hard cut, no transition guard (recommended)
**Description**: `runFactoryForTest` accepts only the bare shape + an optional `packageDir`; `defineFactory` is deleted from `./testing`'s exports outright; FIT-16's 3rd-signal retired (its failure mode is now structurally impossible).
**Pros**: matches both council lenses already recorded at triage; 0.x + zero external consumers means no real back-compat obligation; smallest surface.
**Cons**: any stray internal caller still passing a wrapped runner gets a plain runtime TypeError, not an educational one.
**Effort**: Medium. **Pattern fit**: matches the owner-ruled direction (obs #2070) directly.

### 2. Hard cut + defensive brand-check guard
**Description**: same as (1), plus `runFactoryForTest` detects an already-`defineFactory`-wrapped value (by shape/arity) and throws an educational "you passed a wrapped factory, pass the bare function" error — mirrors `pending-changes.md` row 317's "brand-detect an already-wrapped export" language (written for the future runner, but the same risk exists here).
**Pros**: closes exactly the failure mode the problem statement names ("missing/double-wrap → cryptic TypeError").
**Cons**: extra machinery for a guard `pending-changes.md` itself says "retires once the export is gone" — arguably immediate, since the export IS gone at the end of this change.
**Effort**: Medium+. **Pattern fit**: new, no precedent for a shape-brand check in this codebase.

### 3. Dual-shape compatibility (rejected)
Accept both wrapped and bare shapes indefinitely. Already rejected by both council lenses at triage (`state.yaml`) — no live consumers to protect, and it keeps the exact ambiguity the migration exists to remove. Not pursued further.

## Recommendation

**Approach 1** (hard cut, no guard) — the codebase has zero external consumers (0.x, publish still `--dry-run`), and both prior council passes already converged on hard-cut. Approach 2's guard is worth one explicit design-phase vote (open question below) rather than defaulting into it, since it reintroduces exactly the kind of machinery this migration is designed to delete.

## Risks

- **File count materially exceeds triage's ~13-15 estimate**: pinned list is ~30 files across src/docs/tests/specs/corpus (still ONE context — the author-testing surface — no new subsystem). Recommend generous slicing (6-7 slices): (a) `src/testing` signature + core/dialect JSDoc, (b) docs + fence tests, (c) fitness/guard updates, (d) installed-consumer e2e + spec repeal, (e) author-emulation fixture + `scenarios.ts` rewrite, (f) corpus regen, (g) scaffold/commons error-string wording.
- **FIT-16's 3rd-signal goes silently vacuous**, not silently failing — a design-phase blind spot if not addressed explicitly (see Architecture Touchpoints).
- **Corpus regen ordering**: `scripts/regen-corpus.ts` must run AFTER the fixture rewrite and BEFORE archive, or the 22 committed records drift from source (FIT-28 determinism guard would still pass on stale-but-self-consistent data — it does not catch source/corpus staleness across a slice boundary).
- Author-facing error strings in `src/scaffold/index.ts`/`expander.ts` reference `defineFactory({packageDir})` — will read as wrong guidance the moment authors stop calling it (found here, not in the original triage scope wording).

## Open Questions

- type: technical — Approach 1 vs 2: does `runFactoryForTest` need a double-wrap brand-check guard, or is a hard cut with a plain TypeError acceptable given 0.x/zero consumers? Feeds design's ADR-0031 amendment.
- type: technical — FIT-16's 3rd-signal (`hasUntetheredDefineFactory`) and `test/fixtures/red/reserved/untethered-factory.ts`: retire outright, or redesign to scan the harness/runner's own invocation instead? Feeds design's fitness-guard plan.
- type: technical — Should `packageDir` become a REQUIRED parameter on `runFactoryForTest` now that it is the only place an author-run test can supply it, or keep ADR-0031's two-opt-out-tier semantics? Feeds design's Interface Contracts, and directly determines how `test/e2e/author-emulation/scenarios.ts`'s `FactoryRunner` type and all 21 scenario entries thread `packageDir`.
- type: product — Do the author-facing error strings in `src/scaffold/index.ts`/`expander.ts` (naming `defineFactory({packageDir})`) get rewritten in THIS change or deferred as a followup? Technically outside triage's named scope wording but will read as incorrect the moment this ships.

## Ready for Proposal

**Status**: yes
**Reason**: No sensitive-area miss (public-api row was already flagged at triage), no architectural conflict — the two `deviates` rows are exactly the kind of local, ADR-worthy touchpoints exploration exists to surface, not blockers. The file-count overrun is real but stays within a single context/surface; L holds, XL not warranted.
**Recommended action**: Proceed to `sdd-propose`, carrying the three `type: technical` open questions into spec/design and surfacing the one `type: product` question to the user before propose.
