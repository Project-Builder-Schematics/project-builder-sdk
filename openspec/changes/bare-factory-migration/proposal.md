# Proposal: bare-factory-migration

**Triage**: L | **Persona lens**: none (Council synthesised at spec/design)

## Intent

Every schematic author must wrap their factory in `defineFactory` — ceremony that encodes no decision and adds a forgettable failure point (missing or double-wrap surfaces as a cryptic destructuring `TypeError` under the future runner), and the cost scales with every schematic written. Owner direction (obs #2070, 2026-07-14) fixes the target: authors export the BARE typed `(input: Input) => void | Promise<void>` function; `defineFactory` graduates to runner/test-harness-internal vocabulary, never author-facing. This change lands the migration NOW, before `pbuilder-runner`, so the engine↔SDK wire is designed against the final shape and future author artefacts land already-correct.

## Scope

### In Scope
- Rewrite the 5 author docs (`README`, `docs/{quickstart,dry-run,authoring-verbs,authoring-errors}`) wrapped → bare + their fence-compile tests.
- `runFactoryForTest`: accept the bare fn, wrap internally via the SAME code path the future runner uses (parity-by-identity); `packageDir` as an option.
- Remove `defineFactory` from the public `./testing` exports (breaking, hard cut — no dual-shape shim) + narrow FIT-08/FIT-04/FIT-06 guards and dts baselines.
- Add a sanctioned-caller fitness guard: `defineFactory` importable only from `src/testing/**`, `src/conformance/**`, `bin/**`.
- Migrate the author-emulation corpus (PR #24) + `test/fixtures/{author-emulation,typed-factory}` wrapped → bare; regen via `scripts/regen-corpus.ts`.
- **Rewrite the `defineFactory({packageDir})`-naming error strings in `src/scaffold/{index,expander}.ts`** (OQ-P1, owner-resolved 2026-07-14 — author-facing regression the moment the shape flips).
- Repeal/reword `testing-entry-surface` REQ-TES-02/03/05/06; invert the installed-consumer e2e assertion.

### Out of Scope
- `pbuilder-runner` bin, `StdioEngineClient`, the wire spec (separate plan).
- Go CLI / engine repo, `collection.json`, factory scaffold tooling, npm go-live.
- The ~85 internal test files importing `defineFactory` via the deep `src/core/context.ts` path — it stays internal API (pending-changes row 317).

## Capabilities (contract with sdd-spec)

### New Capabilities
None.

### Modified Capabilities
- `testing-entry-surface`: REMOVE `defineFactory` from `./testing` exports (REQ-TES-02 repealed); `runFactoryForTest` accepts bare fn + optional `packageDir`; ADD sanctioned-caller guard requirement.

## Approach

Hard cut (explore Approach 1) — zero external consumers (0.x, publish still `--dry-run`) means no back-compat obligation, and both prior council lenses converged on it. Walking skeleton first (signature + one opted-in + one untyped fixture + one doc snippet + dts regen), then docs/fences, fitness/guards, corpus regen, error strings; **export removal is the FINAL slice** so the surface stays green until the last step. `runFactoryForTest` wraps the bare fn through the one internal `defineFactory` seam the runner will also call — the wrap-parity commitment is testable NOW as a single-seam assertion (FIT-18 philosophy), not deferred to the runner's existence.

Three decisions the design phase must formalise as ADRs (carried technical open questions): (a) brand/arity guard on `runFactoryForTest` for an already-wrapped runner vs a plain `TypeError` — ADR-0031 amendment; (b) FIT-16's 3rd-signal (`hasUntetheredDefineFactory`) goes vacuously green once the fixture is bare — retire vs redesign; (c) `packageDir` optional (absence = untyped tier, byte-for-byte today) vs required — decides `scenarios.ts` `FactoryRunner` and all 21 scenario entries.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/testing/index.ts` | Modified | drop `defineFactory` re-export; `runFactoryForTest` bare-fn + optional `packageDir` + JSDoc |
| `src/core/context.ts`, `src/dialects/typescript/index.ts` | Modified | JSDoc `@example` → bare; impl unchanged, audience shifts internal |
| `src/scaffold/{index,expander}.ts` | Modified | 3 author-facing error strings naming `defineFactory({packageDir})` rewritten (scope amendment) |
| `README.md`, `docs/{quickstart,dry-run,authoring-verbs,authoring-errors}.md` | Modified | 5 author docs, ~16 occurrences wrapped → bare |
| `test/docs/*`, `test/skeleton/dry-run-public-contract.test.ts` | Modified | doc-fence / story compile tests |
| `test/fitness/{fit-08,fit-06,definefactory-jsdoc}`, `dts-baseline/{testing,typescript}.index.d.ts` | Modified | surface guards + frozen dts baselines; + NEW sanctioned-caller guard |
| `test/fitness/fit-16-reserved-name-scan.test.ts` + red fixture | Modified/Retire | 3rd-signal goes vacuous once fixture is bare |
| `test/fake/harness-{leak-scan,result,opted-in,in-memory-invariant}.test.ts` | Modified | 4 real public-surface consumers |
| `test/e2e/installed-consumer.e2e.test.ts` | Modified | invert REQ-TES-02.1 `hasDefineFactory` assertion (true → false) |
| `test/fixtures/{author-emulation,typed-factory}/factory.ts` | Modified | 21 + 1 exports wrapped → bare |
| `test/e2e/author-emulation/scenarios.ts`, `test/support/ir-transcript.ts`, `scripts/regen-corpus.ts`, corpus `*.json` | Modified | corpus-gen chain + byte-identical regen |
| `openspec/specs/testing-entry-surface/spec.md` | Modified | REQ-TES-02 repealed, 03/05/06 reworded, sanctioned-caller REQ added |

~85 internal deep-import test files stay Read-only / out of scope (pending-changes row 317).

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| FIT-16 3rd-signal goes vacuously GREEN (not failing) once fixture is bare | Medium | design vote: retire the signal explicitly, don't leave it passing on absence |
| Corpus/source drift across a slice boundary | Medium | `regen-corpus.ts` runs AFTER fixture rewrite, BEFORE archive; FIT-28 self-consistent-but-stale won't catch it |
| Removal-only dts gate launders bugs | Medium | pair dts-baseline removal with a POSITIVE assertion on the new `runFactoryForTest` signature |
| Stray internal caller passes a wrapped runner → plain `TypeError` | Low | Accepted (0.x, zero consumers); brand-guard is a design-phase vote |
| `packageDir` opt-out tier semantics regression | Medium | pin explicitly: no `packageDir` = untyped byte-for-byte today; runner always supplies it |
| File count ~30 > triage's ~13-15 | Low | single context; generous 6-7 slicing |
| Wrap-parity claim unverifiable pre-runner | Medium | make testable NOW via single-wrap-seam parity assertion (FIT-18) |

## Rollback Plan

Pure code + spec revert — no data, no migration, no persistent state, and publish is still `--dry-run` so no released artefact to unwind. Revert the change branch (slices are atomic commits). Nothing is forward-compatible to leave behind — the hard cut is fully reversible. **Validate rollback**: full suite green; `import { defineFactory } from "@pbuilder/sdk/testing"` resolves again (REQ-TES-02.1 `hasDefineFactory` back to `true`); dts baselines and the 5 docs restored to wrapped form. No irrecoverable data.

## Dependencies

None. This change is a prerequisite FOR `pbuilder-runner`, not dependent on it.

## Success Criteria

- [ ] `import { defineFactory }` from `@pbuilder/sdk/testing` fails to resolve in a BUILT package; installed-consumer e2e green with the inverted REQ-TES-02.1 assertion (`hasDefineFactory` true → false).
- [ ] `runFactoryForTest` accepts a bare `(input) => void | Promise<void>` and wraps it via the SAME internal `defineFactory` seam the future runner uses — proven NOW by a single-wrap-seam parity assertion (no duplicated wrap logic).
- [ ] Sanctioned-caller fitness guard green: `defineFactory` importable ONLY from `src/testing/**`, `src/conformance/**`, `bin/**`; any other caller fails (MANDATORY — architect halt condition).
- [ ] Zero `defineFactory` occurrences in the 5 author docs + their fence-compile tests; doc-guard fitness tests green.
- [ ] Corpus byte-identity: FIT-28 double-run green AND `scripts/regen-corpus.ts` produces byte-identical corpus `*.json` after the fixture rewrite (no source/corpus drift).
- [ ] Regression sentinels (`golden-ir/*`, `skeleton/*`, `conformance/*`, `core/context` tests) stay GREEN and UNEDITED — the diff touches none of them.
- [ ] dts-baseline change is paired with a POSITIVE assertion on the new `runFactoryForTest` signature (removal-only gate rejected).
- [ ] At archive: pending-changes ledger rows 190/210/226-227 reconciled — `defineFactory`-graduation direction struck/re-pointed; runner + scaffold rows updated to consume the landed bare shape.

## Addendum — Capabilities correction (orchestrator, post-spec V1, 2026-07-14)

The Capabilities section above declared ONE modified capability (`testing-entry-surface`). Spec V1's direct reading of the signed specs corrected this to FIVE affected domains — `testing-entry-surface`, `author-test-harness` (REQ-ATH-13's "packageDir never in runFactoryForTest's call" clause is directly inverted → REMOVED + new REQs), `factory-package-shape` (FPS-04/05 pin the wrapped author shape), `testing-story-docs` (TSD-01/02 require showing defineFactory), and `author-onboarding-docs` (AOD-01; its V2 scope fence "no defineFactory relocation" is lifted by this change's delta). See `specs/*/spec.md` for the authoritative deltas; this addendum keeps the proposal consistent rather than re-drafting it.
