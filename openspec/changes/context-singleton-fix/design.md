# Design: context-singleton-fix

**Spec version**: V1 (signed) · **Triage**: M · **Persona lens**: none (architect + BA council)
**Architecture impact**: modifying · **Design rev**: 3

**Changelog**
- rev 3: resolve rev-2 self-contradiction (frozen slot descriptor vs tests mutating the process-global slot). Extract the 3-state decision into a PURE `resolveRunAls(slotValue)`; `getRunAls()` is a thin impure shell that keeps the frozen install descriptor unchanged. The two collision rows now unit-test `resolveRunAls` with fake slot values — no globalThis mutation, no `finally`-restore, suite-order-independent.
- rev 2: `getRunAls()` occupied-slot collision contract added (§4.3, ADR-01 addendum) — duck-validate the existing slot + fail-loud on mismatch; +2 Test Derivation rows (collision + valid-reuse). Design-level under REQ-MIS-01's accessor interface contract; no spec unfreeze.
- rev 1: initial design.

## 4.1 Architecture Overview

The M1-blocking bug lives entirely in `src/core/context.ts`: the module-scope
`const als = new AsyncLocalStorage<RunContext>()` (line 74) is realm-local. When the
thin-emit `dist/bin/pbuilder-runner.js` and a src-relative `.ts` factory co-execute in one
Bun process, each realm resolves its OWN `context.ts` module and its OWN `als`. `defineFactory`
(dist) enters one store; the factory's verbs (src) read the other, never-entered store, and
`currentContext()` throws `outside-run`.

The fix keeps `context.ts`'s shape unchanged and swaps ONLY the store's *ownership*: instead of
a module-local instance, the ALS is a process-singleton parked at
`globalThis[Symbol.for(RUN_ALS_REGISTRY_KEY)]`, lazily created on first access. Every realm
resolving `context.ts` reads the SAME instance via the process-wide symbol registry — the one
identity `Symbol.for` deduplicates across module realms. All other collaborators (`Session`,
`DirectiveFactory`, `DialectRegistryImpl`, the run sequence `als.run → drain → flush →
commit/discard`) are untouched; only the two `als` reference sites (`currentContext()` line 93,
`defineFactory` line 340) route through a `getRunAls()` accessor. No boundary is crossed that was
not already crossed — the change stays `@internal`, off `package.json#exports` (ADR-0034).

The second deliverable is a regression e2e that spawns the BUILT dist runner against the
src-relative `happy` fixture — the ONLY topology that exercises the dual-realm split — guarded by
a fail-loud fresh-dist check so a stale/absent build can never false-pass.

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/core/context.ts` | Modify | Replace module-scope `als` with the pure `resolveRunAls(slotValue)` (3-state decision) + impure `getRunAls()` shell reading/installing `globalThis[Symbol.for(RUN_ALS_REGISTRY_KEY)]` (frozen descriptor); export the frozen `RUN_ALS_REGISTRY_KEY` literal (golden test) and `resolveRunAls` (module-internal, test reach only — not on `package.json#exports`) |
| `test/fake/dist-runner-dual-realm.e2e.test.ts` | Create | Two-instance regression e2e: spawn `dist/bin/pbuilder-runner.js` against the src-relative `happy` factory; fail-loud fresh-dist guard |
| `test/skeleton/context-registry.test.ts` | Create | Unit: no-enumerable-pollution, key golden, sequential isolation, outside-run rejection, guard-fails-loud |
| `test/support/shared-build.ts` | Modify | Add `requireDistArtifacts(distDir)` — fail-loud helper naming a missing `dist/bin/pbuilder-runner.js` / `dist/core/context.js` |
| `test/fake/fake-engine-harness.e2e.test.ts` | Read-only | REQ-MIS-03.1 non-regression proof — must stay green, unchanged |
| `test/fixtures/frame-runner/happy/factory.ts` | Read-only | Src-relative import fixture reused verbatim (corpus convention) |
| `test/support/frame-host.ts` | Read-only | Bin-path-agnostic spawn helper reused verbatim |

## 4.2b Flow Changes

Not applicable — this M change has no user-facing surface. `context.ts` stays `@internal`; no
author-visible signature, CLI, or public-API change. The e2e rows below are internal subprocess
regression tests, not user flows (Flow ref `—`).

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `core/context.ts` run-boundary (ALS RunContext) | modify | store ownership moves from module-scope to `globalThis[Symbol.for(...)]` registry | deviates → ADR-02 (first `Symbol.for` idiom; changes the established module-scope-singleton pattern) |
| e2e test surface (`test/fake/**`) | new | dist-runner dual-realm regression e2e reusing `frame-host` + `fake-engine-harness` | aligns |
| build-artifact test dependency (`test/support/shared-build.ts` → `dist/`) | extend | new e2e depends on a fresh dist via `ensureTscBuild()` + artifact guard | aligns (shared-build precedent) |

## 4.3 Data Model

No new domain data. One module-level accessor and one frozen constant:

```ts
export const RUN_ALS_REGISTRY_KEY = "@pbuilder/sdk:core/context#run-als"; // frozen on ship (REQ-MIS-02)

// PURE 3-state decision — no globalThis, no side effects. Takes the current slot value
// (undefined when absent) and returns the ALS to use, or throws loud on a foreign occupant.
function resolveRunAls(slotValue: unknown): AsyncLocalStorage<RunContext>;
//   undefined                          → return a freshly-created AsyncLocalStorage<RunContext>
//   duck-valid (typeof v.run === "function" && typeof v.getStore === "function")
//                                      → return slotValue as-is (cross-realm reuse)
//   anything else                      → throw loud (see occupied-slot contract below)

// IMPURE thin shell — reads the slot, delegates to resolveRunAls, installs ONLY when the slot
// was absent (frozen descriptor unchanged), returns the resolved ALS.
function getRunAls(): AsyncLocalStorage<RunContext>;
//   const slot = (globalThis as any)[Symbol.for(RUN_ALS_REGISTRY_KEY)];
//   const als  = resolveRunAls(slot);
//   if (slot === undefined) Object.defineProperty(globalThis, Symbol.for(...), {
//     value: als, writable: false, enumerable: false, configurable: false });
//   return als;
```

**Occupied-slot contract (REQ-MIS-01 accessor interface — rev 3).** The global slot is a shared
resource; a foreign/corrupted occupant (accidental pollution, or a genuinely incompatible object
parked under the same well-known key) must FAIL LOUD, not be trusted or clobbered. On a
duck-validation mismatch `resolveRunAls` throws a plain `Error` (NOT an `AuthoringError`: this is an
environment/integration corruption, not author-input misuse — the closed reason enum has no member
for it, mirroring `validateAtRunBoundary`'s read-path posture) whose message names the key and the
offending `typeof`, e.g. `[pbuilder] run-context registry slot Symbol.for("…") is occupied by an
incompatible value (expected an AsyncLocalStorage, got {type}) — another module may have polluted
globalThis`. The throw surfaces on the SDK's existing failure path: `getRunAls()` is called on first
access (`currentContext()` / `defineFactory` entry), so the throw propagates through `defineFactory`'s
catch to the runner's top-level handler and its non-zero exit — no new exit code, no new catch site.

**Purity split (rev 3 — why two functions).** The install descriptor is deliberately frozen
(`writable:false, configurable:false`) as the pollution defense. But `Symbol.for` is process-global:
once ANY test in the full `bun test` run triggers the real install, the slot is frozen for the rest
of the process — so a collision test that mutates the live slot and restores it in `finally` is
impossible (the restore would throw on the frozen slot, and order-dependence would make it flaky).
Splitting the decision into the PURE `resolveRunAls(slotValue)` lets the collision + reuse cases be
unit-tested by PASSING fake slot values directly — zero globalThis mutation, no restore ceremony,
suite-order-independent — while the production frozen descriptor stays exactly as rev 2 chose.
`resolveRunAls` is module-internal (NOT on any public/`exports` surface); tests reach it via a direct
`../../src/core/context.ts` import, consistent with `test/skeleton/context.test.ts`.

`requirePackageAnchors`, `currentContext`, and `defineFactory` keep their signatures; internally
`als.getStore()`/`als.run()` become `getRunAls().getStore()`/`getRunAls().run()`.

> Placement note: this occupied-slot guard is a defensive, realm-internal detail of an `@internal`
> accessor — a design-level interface contract under REQ-MIS-01's umbrella, NOT a new behavioural
> promise to consumers, so it lands in design without a spec unfreeze.

## 4.4 Interface Contracts

No external interface changes. `RUN_ALS_REGISTRY_KEY` and `getRunAls` are `@internal` (off
`package.json#exports`). Error taxonomy unchanged: outside-run still throws
`AuthoringError{origin:"authoring-rejected", reason:"outside-run"}` with the existing message.

## 4.5 Architecture Decisions

### ADR-01: Unqualified registry key (no version qualification)

**Status**: Proposed

**Context**: The `Symbol.for` key deduplicates the ALS across realms. If two loaded copies at
different SDK *major* versions shared one key, they would merge RunContext state whose shape may
have diverged. No runtime version constant exists (`package.json.version` is `"0.0.0"`); the only
qualification mechanism would be a hand-maintained integer mirroring `WIRE_PROTOCOL_VERSION`.

**Decision**: Ship an UNQUALIFIED key literal — `"@pbuilder/sdk:core/context#run-als"`. This repo
is a single package; the dual-copy scenario is dist-vs-src of the SAME version, which is exactly
what we want to merge. Version qualification is registered as a followup, not M1-reachable.

**Consequences**:
- (+) Zero new hand-maintained constant; the dist/src split at one version merges correctly.
- (−) A real consumer holding two SDK majors in `node_modules` would silently share one ALS — a
  documented residual (Non-Goals), acceptable because it is not M1-reachable.
- Enables a clean later upgrade: appending `@{major}` when a runtime version constant exists.

**Alternatives Considered**:
- **Version-qualified key via new `SDK_ALS_VERSION` constant**: rejected — invents a constant with
  no source of truth (`0.0.0`), guards a cross-major scenario this single-package repo cannot hit.

**Addendum (rev 2) — occupied-slot validation.** An unqualified key demands the accessor decide
what to do when the slot is ALREADY occupied. Weighed: (a) trust blindly, (b) minimal
duck-validation (`typeof .run`/`.getStore` are functions), (c) brand-check the ALS. Decision: (b) +
fail-LOUD throw on mismatch (§4.3). (a) is the same silent-corruption trap the version-qualification
rejection above already condemned — a bare trusted slot lets accidental global pollution masquerade
as the store. (c) rejected: `AsyncLocalStorage` is a Node built-in we do not construct-brand, and a
brand would defeat the cross-realm sharing that is the whole point (a legitimate dist/src pair of the
SAME ALS class must pass). Honest limit stated for the record: duck-validation guards *pollution*
(non-ALS junk in the slot), NOT *version skew* — a genuine cross-major incompatible `AsyncLocalStorage`
would still duck-PASS (both majors expose `.run`/`.getStore`) and merge. Version skew therefore
remains the documented ACCEPTED risk of the unqualified key; the duck-check does not close it and is
not claimed to.

### ADR-02: `globalThis`/`Symbol.for` registry for the ALS — while the factory brand stays a unique `Symbol`

**Status**: Proposed

**Context**: `context.ts` already holds `DEFINE_FACTORY_BRAND: unique symbol = Symbol(...)`
(line 82), a DELIBERATELY realm-unique, unforgeable marker. Introducing `Symbol.for` (realm-SHARED)
in the same file risks a future agent "fixing" one with the other's pattern.

**Decision**: Use `globalThis[Symbol.for(key)]` for the ALS ONLY. The boundary is identity intent:
the ALS is **shareable infrastructure** — every realm MUST see one instance, so a well-known,
re-derivable global key is correct. The brand is **unforgeable capability** — `Symbol("...")` mints
a value no string key can reconstruct, which is the entire point of RUN-06 double-wrap detection;
`Symbol.for` would let a caller forge it. Shareable-infra → `Symbol.for`; unforgeable-brand →
unique `Symbol`. This rationale is recorded so the two are never unified.

**Consequences**:
- (+) Dedupes the store across realms with the standard cross-realm idiom.
- (−) First `Symbol.for` usage in the codebase (no local precedent) — mitigated by this ADR and the
  golden test pinning the key.
- Enables the sibling-singleton followups (FU-2..) to reuse this exact, now-documented pattern.

**Alternatives Considered**:
- **Bundle the runner (inline one copy of everything)**: rejected — out of scope, engine-rejected;
  contradicts the thin-emit build shape (ADR baseline F-5).
- **Make the brand also `Symbol.for`**: rejected — destroys unforgeability, breaks RUN-06.

## 4.6 Test Derivation (outside-in)

| REQ-ID | Scenario | Level | Test (name/path) — failing-first strategy | Flow ref |
|---|---|---|---|---|
| REQ-MIS-01.1 | Run entered realm A, read realm B | e2e | `test/fake/dist-runner-dual-realm.e2e.test.ts` — RED on `main` (dual `als`, exit 4); GREEN post-fix | — |
| REQ-MIS-01.2 | No enumerable global pollution | unit | `test/skeleton/context-registry.test.ts` — assert `Object.keys(globalThis)` unchanged, only symbol entry; RED against a naive string-keyed draft | — |
| REQ-MIS-01 (accessor contract, rev 3) | Foreign slot value → fail loud | unit | `test/skeleton/context-registry.test.ts` — call PURE `resolveRunAls({})` (and other non-ALS values), assert it throws naming the key + `typeof`; no globalThis touched. RED against the trust-blindly draft | — |
| REQ-MIS-01 (accessor contract, rev 3) | Valid ALS slot value → returned verbatim; absent → fresh ALS | unit | `test/skeleton/context-registry.test.ts` — `resolveRunAls(realAls)` returns that SAME instance; `resolveRunAls(undefined)` returns a fresh `AsyncLocalStorage`. Pure inputs, no restore ceremony, suite-order-independent | — |
| REQ-MIS-02.1 | Key literal pinned | unit (golden) | `test/skeleton/context-registry.test.ts` — assert `RUN_ALS_REGISTRY_KEY === "@pbuilder/sdk:core/context#run-als"`; RED until literal frozen | — |
| REQ-MIS-03.1 | Existing source-runner e2e unchanged | e2e | `test/fake/fake-engine-harness.e2e.test.ts` (unchanged) — stays GREEN; a regression turns it RED | — |
| REQ-MIS-03.2 | Sequential runs stay isolated | unit | `test/skeleton/context-registry.test.ts` — two sequential `runFactoryForTest`; second `currentContext()` returns second ctx; RED if store leaks | — |
| REQ-MIS-04.1 | Verb outside any run still throws | unit | `test/skeleton/context-registry.test.ts` — `currentContext()` with no run → `AuthoringError{outside-run}`, exact message; RED if dedupe masks it | — |
| REQ-MIS-05.1 | Two-instance happy path exits clean | e2e | `test/fake/dist-runner-dual-realm.e2e.test.ts` — exit 0, `[tree.read, ir.emit, ir.commit]`, committed content matches fixture | — |
| REQ-MIS-05.2 | Pre-fix RED proof | e2e (dev-evidence) | Same e2e run once against pre-fix `context.ts` → non-zero/outside-run; captured in the PR description, NOT standing CI | — |
| REQ-MIS-06.1 | Missing dist artifact fails loud | unit | `test/skeleton/context-registry.test.ts` — `requireDistArtifacts(bogusDir)` throws naming the artifact; RED against a silent-skip draft | — |
| REQ-MIS-07.1 | Non-Goals section present & traceable | architectural | This §Non-Goals + PR description; checked at `sdd-verify --mode=final`/archive — absence is a finding | — |

All 7 REQ-IDs covered (12 rows; +2 rev-2 accessor-contract rows under REQ-MIS-01's umbrella).
Flow ref `—` throughout: no user-facing flow (§4.2b).

## 4.7 Fitness Functions

- **Fresh-dist fail-loud**: the new e2e calls `ensureTscBuild()` (memoized `bun run build`, throws
  on build failure) THEN `requireDistArtifacts(distDir)` asserting `dist/bin/pbuilder-runner.js`
  and `dist/core/context.js` exist — a pretest build makes staleness structurally impossible
  (fresh in-process build every run), and the existence assertion names any missing artifact. No
  mtime/hash check needed. Works identically local and CI (CI already builds-then-tests).
- No new architectural-test rule; existing FIT-21 (context imports nothing from dialect-handle) and
  FIT-29 (sanctioned `defineFactory` callers) remain valid and unaffected.

## 4.8 Migration / Rollout

No migration, no schema, no persisted state, no feature flag. Pure in-process module wiring.

**Rollback**: single-commit revert of the `context.ts` change restores the module-scope `als` with
ZERO consumer-visible difference in the single-instance topology (source runner + source factory) —
that path never observed the split. The new e2e reverts in the same commit set. Validate by
re-running `test/fake/fake-engine-harness.e2e.test.ts` (green = no regression). The engine pin
simply is not advanced.

## 4.9 Performance Considerations

Negligible. One `globalThis[Symbol.for(...)]` lookup per `getRunAls()` call (two call sites,
once-per-run each); the ALS itself is created once per process. No hot-path change.

## 4.10 Architecture Impact

**Architecture impact**: modifying
**Rationale**: The `core/context.ts` touchpoint (§4.2c) is `deviates` — it changes the established
module-scope-singleton pattern of a foundational core module to a `globalThis`/`Symbol.for`
registry. No boundary is removed and no public contract breaks (stays `@internal`), so it is not
`breaking`; but a documented pattern shifts, so it exceeds `additive`. Post-verify baseline refresh
of the `core/context.ts` run-boundary description is warranted (`arch_refresh_post_verify`).

## Non-Goals (REQ-MIS-07)

- **Residual Hazard #2** — a SRC-constructed `AuthoringError` via `requirePackageAnchors`
  (`create({templateFile})`/`scaffold`/`copyIn`) still crosses the dist/src `instanceof` boundary
  misclassified; that class-identity split lives in `authoring-error.ts`, is NOT M1-reachable →
  **FU-4**.
- **`single-instance-probe.ts` same-package-root false-negative** → **FU-5**.
- **Sibling singletons** (`hadBom`, `astHandlePaths`, `runInFlight`, `realFd1Write`) — swept in
  exploration, verified benign-split, no fix required here.
- **Version-qualified registry key** (ADR-01) — followup once a runtime version constant exists.

## 4.11 Open Questions

None.

---

**ADR numbering note**: ADR-01/ADR-02 are per-change; on archive promote to the next free global IDs
(current highest in `openspec/decisions/` is 0062 → 0063, 0064).
