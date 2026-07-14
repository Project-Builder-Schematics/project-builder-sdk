# Design: bare-factory-migration

**Spec**: V1 (signed, owner, 2026-07-14) · **Triage**: L · **Persona lens**: architect + tech-writer (council-synthesised) · **Status**: ok · **Architecture impact**: modifying

## 4.1 Architecture Overview

Authors export a BARE typed `(input: Input) => void | Promise<void>` function; `defineFactory` graduates to runner/harness-internal vocabulary. `runFactoryForTest` becomes the seam that wraps the bare fn by DELEGATING to the one internal `defineFactory` the future runner will also call (single-wrap-seam invariant, REQ-ATH-01/19) — no parallel wrap logic. `defineFactory` stays declared in `src/core/context.ts` and barrelled from `src/core/index.ts` (the `@pbuilder/sdk-kit` extraction boundary), but is REMOVED from the public `./testing` re-export. Two enforcement boundaries change: FIT-08's `./testing` EXPORT allowlist narrows (drops `defineFactory`), and a NEW import-reachability guard (FIT-29) confines `defineFactory` importers, within production code, to `src/core/**`/`src/testing/**`/`src/conformance/**`. No layer, module, port, or dependency direction is added or removed — the change narrows a facade and reclassifies one symbol public→internal. The seam this crosses is the `./testing` public-API contract (0.x semver-exempt, zero external consumers).

## 4.2 File Changes (contract with sdd-slice)

| Path | Action | Purpose |
|---|---|---|
| `src/testing/index.ts` | Modify | `runFactoryForTest(fn, input, {seed?, packageDir?})` bare-fn signature delegating to `defineFactory`; drop `export { defineFactory }`; JSDoc `@example` bare + `@param` options bag |
| `src/core/context.ts` | Modify | JSDoc `:248-292` re-aim: `@internal` + sanctioned-callers note, `@example` → internal wrap+drive. **Impl body `:293-346` UNCHANGED (frozen)** |
| `src/core/index.ts` | Read-only | `defineFactory` barrel export stays (sanctioned-caller allowlist member) |
| `src/dialects/typescript/index.ts` | Modify | JSDoc `@example` wrapped → bare |
| `src/scaffold/index.ts` | Modify | 2 error strings `:22` (templateFile) `:86` (copyIn) → bare-shape wording (REQ-TES-09.1/.2) |
| `src/scaffold/expander.ts` | Modify | error string `:57` (scaffold) → bare-shape wording (REQ-TES-09.3) |
| `src/commons/index.ts` | Modify | JSDoc `:165,234,274,382,385,393` → zero `defineFactory` (REQ-TES-10.1); "inside a defineFactory run" → "inside a factory run started with packageDir" |
| `README.md` | Modify | testing section bare (REQ-TSD-01); **scaffolding-folder example `:40-47` bare (tech-writer finding — outside REQ-TSD-01.5's scoped scan)** |
| `docs/{quickstart,dry-run,authoring-verbs,authoring-errors}.md` | Modify | wrapped → bare; quickstart keeps `export const run`, packageDir moves to the run call (REQ-AOD-01) |
| `test/fitness/fit-08-no-kit-bleed.test.ts` | Modify | `./testing` `valueAllow` drops `defineFactory`; add REQ-TES-03.1b red-proof; fix inline green fixtures |
| `test/fitness/fit-06-example-jsdoc.test.ts` | Modify | `PUBLIC_PATHS` += `src/testing/index.ts`; origin-cascade to `context.ts` (REQ-TSD-02.3) |
| `test/fitness/definefactory-jsdoc.test.ts` | Modify | expect the re-aimed internal `@example` (REQ-FPS-05.2) |
| `test/fitness/fit-16-reserved-name-scan.test.ts` | Modify | RETIRE 3rd-signal `hasUntetheredDefineFactory` + its 2 assertions; reserved-sibling walk stays |
| `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts` | Create | NEW import-reachability guard (see 4.7) + red-proof |
| `test/fitness/dts-baseline/{testing,commons,typescript}.index.d.ts` | Modify | regen: testing (signature + removal), commons/typescript (JSDoc-derived) |
| `test/fixtures/red/reserved/untethered-factory.ts` | Delete | retired with FIT-16 3rd-signal |
| `test/support/import-scan.ts` | Read-only | `specifiersResolvingInto` idiom reused by FIT-29 |
| `test/fake/harness-{leak-scan,result,opted-in,in-memory-invariant}.test.ts` | Modify | 4 public `./testing` consumers → bare fn + options bag (REQ-ATH-01/06/11/14/17/18) |
| `test/fake/harness-wrap-parity.test.ts` | Create | NEW REQ-ATH-19 harness (see 4.6) |
| `test/support/wrap-parity-support.ts` | Create | manual-wrap driver (invokes `defineFactory` DIRECTLY) + faulty-discard fake |
| `test/types/runfactoryfortest-shape.test.ts` | Create | REQ-ATH-01.5 `@ts-expect-error` old wrapped-runner rejected; REQ-ATH-18 pins |
| `test/e2e/installed-consumer.e2e.test.ts` | Modify | invert `hasDefineFactory` (true→false); REQ-TES-06.2/.3 bare; REQ-TES-06.4 stale-import fails |
| `test/docs/{quickstart-docs,testing-story-docs,doc-set-content}.test.ts`, `test/skeleton/dry-run-public-contract.test.ts` | Modify | fence recompiles bare; content scans incl. whole-README zero-`defineFactory` (design-added) |
| `test/fixtures/typed-factory/factory.ts` | Modify | 1 export wrapped → bare |
| `test/fixtures/author-emulation/factory.ts` | Modify | 21 exports wrapped → bare |
| `test/e2e/author-emulation/scenarios.ts` | Modify | `FactoryRunner` → `(input:any)=>void\|Promise<void>`; `ScenarioEntry.packageDir?` threaded per scenario |
| `test/support/ir-transcript.ts` | Modify | `captureRun(run, input, options?)` options bag; keep raw-rethrow divergence (line 108) |
| `scripts/regen-corpus.ts` | Modify | thread `{packageDir}` per scenario; byte-identical regen output |
| `test/e2e/author-emulation/corpus/*.json` | Modify | regen output (22 records, byte-identical — freshness gate) |
| `openspec/specs/testing-entry-surface/spec.md` | Modify | live-spec delta sync (REQ-TES-02 repeal + rewordings) |
| ~85 internal deep-import test files | Read-only | keep `defineFactory` via deep path — OUT of scope (test/** excluded from FIT-29) |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author installs + imports factory package | Modify | REQ-TES-06, REQ-TES-08 | `test/e2e/installed-consumer.e2e.test.ts` (extend) | bare; `defineFactory` never named; stale import fails to resolve |
| Author unit-tests via `runFactoryForTest` | Modify | REQ-ATH-01/06/11/14/17/18/19 | `test/fake/harness-*.test.ts` (extend) | bare fn + options bag; wrap-parity harness added |
| Author follows quickstart onboarding | Modify | REQ-AOD-01, REQ-TSD-01/02 | `test/docs/quickstart-docs.test.ts` (extend) | bin→generated type→bare factory→test; machine-compiled |
| Author reads dry-run/verbs/errors docs | Modify | REQ-TSD-01, REQ-FPS-05 | `test/docs/doc-set-content.test.ts` (extend) | static bare-shape content scans |
| Author error experience (missing packageDir) | Modify | REQ-TES-09 | `test/scaffold/*` unit (per-message) | runtime-neutral wording, no `defineFactory` token |

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/testing/` facade | modify | bare-fn signature; drop `defineFactory` re-export | aligns |
| `./testing` public-API boundary | modify | export set narrows; `defineFactory` reclassified public→internal | aligns (0.x semver-exempt) |
| `src/core/context.ts` `defineFactory` | modify | JSDoc audience only; **impl frozen** | aligns |
| `src/scaffold/`, `src/commons/`, `src/dialects/typescript/` | modify | author-facing error/JSDoc wording (existing `AuthoringError`-message pattern) | aligns |
| fitness layer (FIT-08 narrow, FIT-06 widen, FIT-16 3rd-signal remove, FIT-29 new) | modify/new/remove | export-allowlist narrowing + new import-reachability guard | aligns (joins existing layer; FIT-16 removal is ADR-A consequence) |
| author-emulation corpus chain | modify | packageDir relocates to caller; byte-identical regen | aligns |

No `deviates` rows: explore flagged scaffold error-strings and the FIT-16 3rd-signal as deviations, but design downgrades both to `aligns` — rewording an existing author-facing `AuthoringError` message introduces no architectural boundary (content within an established pattern), and the 3rd-signal retirement is a recorded consequence of ADR-A, not a standalone deviation.

## 4.3 Data Model

```ts
// src/testing/index.ts
export async function runFactoryForTest<O>(
  fn: (input: O) => void | Promise<void>,
  input: O,
  options?: { seed?: Record<string, string>; packageDir?: string | URL }
): Promise<RunResult>; // { tree, emitted, error } unchanged
// internally: defineFactory<O>(fn, options?.packageDir !== undefined ? { packageDir: options.packageDir } : undefined)(input, { client })

// test/e2e/author-emulation/scenarios.ts
export type FactoryRunner = (input: any) => void | Promise<void>;
interface ScenarioEntry { /* ...unchanged... */ packageDir?: string }

// test/support/ir-transcript.ts
export function captureRun<O>(
  run: (input: O) => void | Promise<void>,
  input: O, options?: { seed?: Record<string,string>; packageDir?: string }
): Promise<CaptureResult>;
```

`RunResult` shape and `defineFactory`'s own signature are UNCHANGED. `RunContext.packageAnchors` seeding path is UNCHANGED (packageDir still reaches it via `defineFactory`).

## 4.4 Interface Contracts

Public `./testing` surface: `runFactoryForTest` (new bare signature), `RunResult`, type-only `Batch`/`Directive` — `defineFactory` REMOVED. `import { defineFactory } from "@pbuilder/sdk/testing"` no longer resolves (compile-time signal, REQ-TES-06.4/08). Error taxonomy unchanged: scaffold/copyIn missing-anchor still throws `AuthoringError` `reason: "invalid-input"` — only the message text changes. No engine-wire, no new port.

## 4.5 Architecture Decisions

### ADR-A: `defineFactory` graduates to core-internal, removed from `./testing`

**Status**: Proposed. **Context**: `defineFactory` is author-facing ceremony encoding no decision; owner direction (obs #2070) makes the bare fn the author contract. Zero external consumers (0.x, `--dry-run`). **Decision**: `defineFactory` stays declared in `src/core/context.ts`, barrelled from `src/core/index.ts`; REMOVED from `./testing`'s public re-export; JSDoc gains `@internal` naming the harness + future runner as sanctioned callers. Enforced by FIT-08 (narrowed export allowlist) + FIT-29 (new import-reachability guard). **Consequences**: (+) one author shape, no missing/double-wrap failure mode; (+) engine↔SDK wire designed against the final shape now; (−) breaking `./testing` removal — absorbed by 0.x semver-exemption + zero consumers; (consequence) FIT-16's 3rd-signal `hasUntetheredDefineFactory` is RETIRED — it goes vacuously green once author fixtures are bare (no `defineFactory` token to scan); its threat model (untethered run without packageDir) re-homes to the future runner plan as a registered followup, not this change. **Alternatives**: *Dual-shape shim* (accept wrapped AND bare) — keeps exactly the ambiguity the migration deletes, no consumer to protect; *leave in `./testing` as internal-by-convention* — unenforceable, FIT-29 makes it structural.

### ADR-B: Caller-supplied `packageDir` anchor

**Status**: Proposed. **Context**: `packageDir` (schema validation, reserved-name scan, containment ceiling) is threaded today at the author's `defineFactory(fn, {packageDir})` call site — the seam the migration must relocate. **Decision**: `packageDir` moves to the CALLER that runs the factory — `runFactoryForTest`'s options bag (and the future runner's own invocation). The bare author fn carries no `packageDir`. Scaffold error strings reword runtime-neutrally: `"<verb> has no package directory to resolve … against — pass \`packageDir\` to the call that runs this factory"`, keeping the `invalid input:` prefix. **Consequences**: (+) author fn is pure input→effect; (+) message true in both harness and runner without enumerating either; (−) per-scenario `packageDir` must now be threaded in `scenarios.ts`/`regen-corpus.ts` (was implicit in the fixture wrap). **Alternatives**: *Thread packageDir through the author fn signature* — re-introduces the per-schematic ceremony being removed; *name `runFactoryForTest` in the error string* — lies under the future runner; *explain both runtimes* — confuses both.

### ADR-C: Options-bag signature + single-wrap-seam delegation

**Status**: Proposed. **Context**: `seed` is a positional 3rd arg today; `packageDir` must join it; parity with the runner's wrap must be provable now. **Decision**: `runFactoryForTest(fn, input, { seed?, packageDir? })` — `packageDir` OPTIONAL: absent = untyped tier, byte-identical to today (REQ-TFO-02 opt-out relocated to the caller, REQ-ATH-17.2); present = schema-validated. `runFactoryForTest` DELEGATES to `defineFactory` — never reimplements the wrap. REQ-ATH-19's reference path invokes `defineFactory` DIRECTLY (never re-wraps — a re-wrapping reference would silently reintroduce double-wrap and pass the parity test on a lie). **Consequences**: (+) named options extend without arity churn; (+) parity is structural, not asserted; (−) options-bag migration touches every `./testing` caller + `captureRun`. **Alternatives**: *4th positional arg* — ordering ambiguity, poor extensibility; *parallel wrap reimplementation in the harness* — drifts from the runner seam the parity guard exists to protect.

## 4.6 Test Derivation

REQ-ATH-19 wrap-parity infra: `test/fake/harness-wrap-parity.test.ts` + `test/support/wrap-parity-support.ts` (a manual driver that calls `defineFactory(fn,{packageDir})` DIRECTLY against a hand-built `RecordingClient` over a fresh `ContractFake`, plus a `FaultyDiscardFake` whose `discard()` rejects). Asserts identical `{tree, emitted (Batch[] structural, incl. dialect drain→flush ordering via a dialect-using factory), error (identity)}` and the double-fault path (`error===E1`, `error.cause===E2`).

| REQ-ID | Scenario | Level | Test | Flow |
|---|---|---|---|---|
| REQ-TES-03.1/.1b/.2/.3/.4 | `./testing` allowlist narrowed, `defineFactory`/`Session`/`ContractFake` bans | architectural | `fit-08-no-kit-bleed.test.ts` | — |
| REQ-TES-05.1/.2/.3 | dts baseline diff + positive signature assertion | architectural | `fit-04` + `dts-baseline/testing.index.d.ts` | — |
| REQ-TES-06.1/.2/.3 | installed consumer resolves `./testing`, bare run commits/rejects | e2e | `installed-consumer.e2e.test.ts` | Author installs |
| REQ-TES-06.4 | stale `defineFactory` import fails to resolve | e2e | `installed-consumer.e2e.test.ts` | Author installs |
| REQ-TES-08.1 | `defineFactory` absent from `./testing` exports | e2e | `installed-consumer.e2e.test.ts` | Author installs |
| REQ-TES-09.1/.2/.3 | 3 scaffold/expander rejections rewritten, zero `defineFactory` | unit | `test/scaffold/*` (per-message) | Author error exp. |
| REQ-TES-10.1 | `./commons` JSDoc zero `defineFactory` | architectural | `fit-06-example-jsdoc.test.ts` | — |
| REQ-ATH-01.1/.2 | happy-path shape, exactly 3 keys | unit | `harness-result.test.ts` | Author unit-tests |
| REQ-ATH-01.3 | `ContractFake` not exported | architectural | `fit-08-no-kit-bleed.test.ts` | — |
| REQ-ATH-01.4 | `seed` via options bag read back | unit | `harness-result.test.ts` | Author unit-tests |
| REQ-ATH-01.5 | old wrapped-runner shape rejected at compile | contract | `test/types/runfactoryfortest-shape.test.ts` | — |
| REQ-ATH-06.1/.2 | sync throw + async reject discard | unit | `harness-result.test.ts` | Author unit-tests |
| REQ-ATH-11.1/.2 | no fs/net/env; packageDir reads observed not flagged | integration | `harness-in-memory-invariant.test.ts` | Author unit-tests |
| REQ-ATH-14.1/.2 | scaffold reads in-ceiling allow-listed; outside trips | integration | `harness-in-memory-invariant.test.ts` | Author unit-tests |
| REQ-ATH-17.1/.2/.3 | packageDir present validates / absent byte-parity / fs-read oracle | integration | `harness-opted-in.test.ts` | Author unit-tests |
| REQ-ATH-18.1/.2 | non-function → plain TypeError; zero-arg runs | unit | `harness-result.test.ts` | Author unit-tests |
| REQ-ATH-19.1/.2 | happy + double-fault parity vs direct `defineFactory` | integration | `harness-wrap-parity.test.ts` | Author unit-tests |
| REQ-FPS-04.1 | reference schematic bare, e2e wraps internally | e2e | `test/e2e/typed-factory*` | Author unit-tests |
| REQ-FPS-05.1 | bin usage on no-args/bad-flag | unit | `test/bin/*` | — |
| REQ-FPS-05.2 | quickstart = author path; `defineFactory` `@example` internal | architectural | `fit-06` + `definefactory-jsdoc.test.ts` | — |
| REQ-FPS-05.3 | reserved names documented | unit | `test/docs/doc-set-content.test.ts` | — |
| REQ-TSD-01.1..5 | README testing section: runnable, semver, boundary, seed, zero-token | e2e+arch | `quickstart-docs.test.ts`, `doc-set-content.test.ts` | Author reads docs |
| REQ-TSD-02.1/.2/.3 | JSDoc `@example`/`@param`/semver; origin cascade | architectural | `fit-06-example-jsdoc.test.ts` | — |
| REQ-AOD-01.1/.2/.3 | quickstart schema+bin, bare `factory.ts`, test passes | e2e | `quickstart-docs.test.ts` | Author onboarding |
| — (Success Criterion #3) | FIT-29 sanctioned-caller guard green + red-proof | architectural | `fit-29-sanctioned-definefactory-caller.test.ts` | — |
| — (design-added) | whole-README zero `defineFactory` (tech-writer finding) | architectural | `doc-set-content.test.ts` | Author reads docs |

All signed REQ-IDs (5 domains) covered; every Create/Modify flow has ≥1 e2e row. Removed REQ-TES-02/REQ-ATH-13 need no coverage (repealed; guarantees relocated to REQ-TES-08 / REQ-ATH-17).

## 4.7 Fitness Functions

- **FIT-29 sanctioned-`defineFactory`-caller (NEW)** — owns the proposal's Success Criterion #3, which no signed REQ carries (REQ-TES-03 is the EXPORT allowlist — a different mechanism from import reachability). Reuses `test/support/import-scan.ts`'s `specifiersResolvingInto` to scan PRODUCTION code only (`src/**` + `bin/**`) for imports of the `defineFactory` binding resolving into `src/core/context.ts`/`src/core/index.ts`. Allowlist: `src/core/**`, `src/testing/**`, `src/conformance/**` (architect correction — dropped speculative `bin/**` with zero importers; added `src/core/**`, the definition/barrel site the guard would otherwise flag). `test/**` is categorically OUTSIDE the scan domain — this legitimizes the ~85 deep-import test files AND the parity harness with no annotation convention. Red-proof: a planted `defineFactory` import from `src/commons/**`. Author fixtures need no token scan here — `scenarios.ts`'s bare `FactoryRunner` type COMPILE-enforces their migration (a still-wrapped export fails the type).
- **FIT-08 (narrowed)** — `./testing` `valueAllow` drops `defineFactory`.
- **FIT-06 (widened)** — `PUBLIC_PATHS` += `src/testing/index.ts`; origin-cascade obligation survives at `defineFactory`'s internal `@example`.
- **FIT-16 3rd-signal (RETIRED)** — see ADR-A. Reserved-sibling walk over `ALWAYS_ON_SCAN_ROOTS` stays green (reads the directory, not factory source).
- **FIT-28 (unchanged)** — permanent corpus byte-determinism (fresh-process regen).

## 4.8 Migration / Rollout

**Frozen-set enforcement** (design decision, not ADR): the "regression sentinels stay unedited" property is a VERIFY-PHASE git-diff manifest check (change-scoped, asserted at `sdd-verify --mode=final`, discarded at archive), NOT a committed test. It asserts (a) zero diff under `test/golden-ir/**`, `test/conformance/**`, `test/dialects/**`, `test/core/**`, `test/skeleton/**`, and the ~85 deep-import files; (b) `src/core/context.ts` diff hunks stay ABOVE line 293 (defineFactory impl body untouched). *Rejected*: permanent golden-hash fitness (freezes files that legitimately evolve in future changes) and a committed diff-manifest test (pinned-merge-base brittleness). Corpus byte-determinism stays FIT-28's permanent job — the verify check adds only the orthogonal not-hand-edited assertion.

**Slice ordering** (constraints for `sdd-slice`, target 6-7):
1. **Walking skeleton** — new `runFactoryForTest` signature + 1 opted-in fixture + 1 untyped fixture + 1 doc snippet + dts SIGNATURE regen with positive+negative type assertions + **a minimal-green FIT-29 instance with its red-proof** (skeleton MUST carry the highest-risk new infra).
2. **Fan-out** — docs (README both examples, 4 docs), 4 harness consumers, scaffold/commons/dialect JSDoc + error strings, wrap-parity harness, `captureRun` options bag.
3. **Fixture rewrite** — `typed-factory` + `author-emulation` (21) bare; `scenarios.ts` `FactoryRunner` flip + per-scenario `packageDir`.
4. **Corpus regen** — STRICTLY after fixture rewrite, before archive; freshness gate: `regen-corpus.ts` output is a git-clean no-op in CI (FIT-28).
5. **FINAL slice** — export removal + REQ-TES-06.4 (co-located, never earlier) + dts REMOVAL regen bound to the positive signature assertion in the SAME slice. Hard precondition: zero remaining `./testing`-sourced `defineFactory` references outside sanctioned callers (docs, fences, 4 harness files, installed-consumer e2e all bare first).

dts double-regen coherence: the signature-change regen (slice 1) and the removal regen (final slice) are SEPARATE events; the removal regen must land with the positive `runFactoryForTest`-signature assertion (REQ-TES-05.3).

**Rollback**: atomic-branch — slices are atomic commits; `git revert` the branch range, THEN `bun run scripts/regen-corpus.ts` (restores byte-identical corpus), THEN full suite + FIT-28 + verify manifest green. Post-revert, `import { defineFactory } from "@pbuilder/sdk/testing"` resolves again (`hasDefineFactory` true), dts baselines + 5 docs back to wrapped. No data, no persistent state, publish still `--dry-run`.

## 4.9 Performance Considerations

No significant impact — in-memory harness; `defineFactory` delegation adds one closure hop per test run.

## 4.10 Architecture Impact

**Architecture impact**: modifying
**Rationale**: No new layer/module/port and `src/core` logic is untouched (context.ts impl frozen) — but the `./testing` facade boundary NARROWS (drops a re-export) and `defineFactory` reclassifies public→internal, outdating the baseline's Public API line (`./testing` "re-exported `defineFactory`") and the "defineFactory author-facing" convention. Derived from the 4.2c `modify` rows on `src/testing/` + the `./testing` boundary. The breaking flavour lives on the semver plane, absorbed by `./testing`'s 0.x semver-exemption + zero external consumers. Symmetric counterpart to stage-5's subpath GROWTH (also `modifying`). Triggers `arch_refresh_post_verify` (modifying → prompt baseline refresh).

## 4.11 Open Questions

None.
