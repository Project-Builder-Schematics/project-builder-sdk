# Slices: context-singleton-fix

**Triage**: M
**Spec version**: V1 (signed)
**Total slices**: 2 (1 walking skeleton + 1 SPIDR)

---

## S-000: Walking Skeleton — Module-identity-safe run-context (dual-realm fix + regression e2e)

**Scope**: walking-skeleton
**Dimension**: —
**Covers**: REQ-MIS-01.1, REQ-MIS-03.1, REQ-MIS-05.1, REQ-MIS-05.2, REQ-MIS-06.1
**Requires**: nothing
**Test layers**: e2e

**Acceptance**:
- GIVEN the built `dist/bin/pbuilder-runner.js` spawned against the `happy` fixture factory (src-relative import convention, real dual-realm topology)
- WHEN the run executes post-fix
- THEN it exits 0 with `[tree.read, ir.emit, ir.commit]`, committed output matches the fixture, the existing source-runner e2e stays green, and the SAME e2e is proven to have failed pre-fix (evidence captured in the PR description)

### Tasks
- [x] S-000.1 `test/support/shared-build.ts`: add `requireDistArtifacts(distDir)` — throws naming the missing path if `dist/bin/pbuilder-runner.js` or `dist/core/context.js` is absent.
- [x] S-000.2 Create `test/fake/dist-runner-dual-realm.e2e.test.ts` — reuse `frameHostFactory()` (`test/support/frame-host.ts`) + `serveSpawnedRunner`/`dispatchToFake` (`test/fake/fake-engine-harness.ts`) to spawn `dist/bin/pbuilder-runner.js` against `test/fixtures/frame-runner/happy/factory.ts`; call `ensureTscBuild()` then `requireDistArtifacts()` before spawning.
- [x] S-000.3 [RED capture, dev-run only — NOT committed] Run the new e2e against the CURRENT (pre-fix) `src/core/context.ts`. Record exit code + stderr verbatim into the PR description under "Pre-fix RED proof (REQ-MIS-05.2)". No commit happens at this point. **Actual evidence** (`openspec/changes/context-singleton-fix/red-evidence.md`): spawned runner exits `4` (not the anticipated `outside-run`-labelled exit); stderr reads `"pbuilder-runner: run failed"` — the cross-realm `instanceof AuthoringError` miss in `runner.ts`'s catch (a second, distinct symptom of the SAME dual-realm identity bug, documented residual per design Non-Goals/FU-4) masks the outside-run label at that layer. Mechanism traced and confirmed in the evidence file; the failure is real and for the right reason (RED confirmed).
- [x] S-000.4 `src/core/context.ts` (design rev 3 §4.3 two-function split — BOTH land here, atomically): (a) PURE `resolveRunAls(slotValue: unknown): AsyncLocalStorage<RunContext>` — 3-state: `undefined` → fresh ALS; duck-valid (`typeof .run === "function" && typeof .getStore === "function"`) → return slotValue verbatim; else → throw plain `Error` naming key + offending `typeof`. Exported as module-internal symbol (reachable via direct `src/core/context.ts` import for S-001's tests; NOT on any public surface). (b) Impure shell `getRunAls()`: read `globalThis[Symbol.for(RUN_ALS_REGISTRY_KEY)]` → `resolveRunAls(slot)` → `Object.defineProperty` install ONLY when slot was absent (non-enumerable, non-configurable, `writable:false`). Export frozen `RUN_ALS_REGISTRY_KEY = "@pbuilder/sdk:core/context#run-als"`; route `currentContext()` (line 93) and `defineFactory`'s `als.run` (line 340) through `getRunAls()`, replacing module-scope `als` (line 74).
- [x] S-000.5 Re-run the new e2e against the fixed `context.ts` — confirm GREEN (REQ-MIS-05.1).
- [x] S-000.6 Re-run `test/fake/fake-engine-harness.e2e.test.ts` unchanged — confirm it stays GREEN (REQ-MIS-03.1 non-regression).
- [x] S-000.7 Run full `bun test` suite — confirm 100% green, then commit `context.ts` + `shared-build.ts` + the new e2e file together as ONE atomic all-green commit. Commit `326668b`.

---

## S-001: Registry Correctness Guardrails

**Scope**: edge-case
**Dimension**: R (Rule)
**Covers**: REQ-MIS-01.2, REQ-MIS-02.1, REQ-MIS-03.2, REQ-MIS-04.1, REQ-MIS-06.1, REQ-MIS-07
**Requires**: S-000
**Test layers**: unit

**Acceptance**:
- GIVEN the registry-backed `context.ts` from S-000
- WHEN the golden/isolation/outside-run/pollution/guard checks run
- THEN globalThis gains no enumerable key, the key literal is pinned, sequential runs never leak, genuine outside-run misuse still throws exactly as before, and the fail-loud guard names a missing artifact

### Tasks
- [x] S-001.1 Create `test/skeleton/context-registry.test.ts` — assert `Object.keys(globalThis)` unchanged around first registry access; only a symbol-keyed entry exists (REQ-MIS-01.2).
- [x] S-001.2 Add golden assertion: `RUN_ALS_REGISTRY_KEY === "@pbuilder/sdk:core/context#run-als"` (REQ-MIS-02.1).
- [x] S-001.3 Add sequential-isolation test: two sequential runs in-process; the second run's `currentContext()` never returns the first run's context (REQ-MIS-03.2).
- [x] S-001.4 Add outside-run test: `currentContext()` with no run in progress throws `AuthoringError{origin:"authoring-rejected", reason:"outside-run"}` with the unchanged message (REQ-MIS-04.1).
- [x] S-001.5 Add unit-level fail-loud test: `requireDistArtifacts(bogusDir)` throws naming the missing artifact (REQ-MIS-06.1, unit angle complementing S-000's e2e usage).
- [x] S-001.5b Add collision unit test (design rev 3 §4.3, PURE function — no globalThis mutation): `resolveRunAls({})` (and other non-ALS values) throws a plain `Error` naming the key + offending `typeof` (NOT AuthoringError). Import `resolveRunAls` directly from `../../src/core/context.ts` (REQ-MIS-01, accessor contract).
- [x] S-001.5c Add reuse/absent unit tests (pure, suite-order-independent): `resolveRunAls(realAls)` returns that SAME instance verbatim; `resolveRunAls(undefined)` returns a fresh `AsyncLocalStorage` (REQ-MIS-01, accessor contract).
- [x] S-001.6 Run full `bun test` suite — confirm green; commit.
- [x] S-001.7 Append the design's Non-Goals section verbatim to the PR description (Hazard #2 → FU-4; `single-instance-probe` false-negative → FU-5; sibling-singleton sweep verdict) so REQ-MIS-07 is traceable at verify-final/archive. Staged in `openspec/changes/context-singleton-fix/red-evidence.md` under "## PR description material" (PR does not exist yet).

---

## Executor Context Map

Everything an executor needs beyond this file — read BEFORE the first line of code:

| Need | Where |
|---|---|
| Authoritative REQ text (Given/When/Then, all MIS-01..07) | `openspec/changes/context-singleton-fix/specs/module-identity-safe-run-context/spec.md` (V1 signed) |
| Design contracts: `getRunAls()` shape (@internal, NOT exported from `./commons`/public surface; only `RUN_ALS_REGISTRY_KEY` is exported for the golden test), ADR-01 (unqualified key + collision contract addendum), ADR-02 (Symbol.for vs unique-Symbol boundary), Non-Goals verbatim (for S-001.7), Test Derivation table, §4.3 `resolveRunAls`/`getRunAls` split | `openspec/changes/context-singleton-fix/design.md` (rev 3) |
| Current `als` code, `RunContext` type, `currentContext()`, `defineFactory`'s `als.run` | `src/core/context.ts` (line anchors 74/93/340 are indicative — re-locate by symbol, code may drift) |
| `AuthoringError` construction + exact outside-run message | `src/core/authoring-error.ts` (originFor ~107-128, messageFor ~191-195) |
| Harness helper contracts | `test/support/frame-host.ts` (`frameHostFactory`), `test/fake/fake-engine-harness.ts` (`serveSpawnedRunner`, `dispatchToFake`), `test/support/shared-build.ts` (`ensureTscBuild` — memoized, no-op when built; `distDir` = repo-root `dist/`, absolute path resolved there) |
| Dual-realm topology proof (ONE child process: dist runner loads `.ts` factory → factory imports resolve `src/`; `Symbol.for` shared per-process — empirically verified) | `openspec/changes/context-singleton-fix/explore.md` §registry mechanics |
| Build mechanics (tsc thin-emit, unbundled ESM; runner spawned under Bun) | `openspec/changes/context-singleton-fix/explore.md` + `tsconfig.build.json` |
| `happy` fixture + expected transcript/golden | `test/fixtures/frame-runner/happy/` (factory imports `../../../../src/index.ts`); expected ops `[tree.read, ir.emit, ir.commit]` per existing source-runner e2e assertions |
| Branch / PR | Work on existing branch `fix/context-singleton` (off main `6db2f5e`); PR created AFTER S-001 lands; S-000.3 RED evidence goes in that PR's description (stage it in `openspec/changes/context-singleton-fix/red-evidence.md` until the PR exists) |
| In-process run driver (for S-001.3/.4/.5b/.5c) | Pattern in `test/skeleton/context.test.ts` (KIT-05): `const run = defineFactory<T>(fn); await run(input, { client: new ContractFake({ seed }) })` — `ContractFake` (`test/support/contract-fake.ts`) is directly usable as the `EngineClient`; no spawn needed |
| Engram context | topics `sdd/context-singleton-fix/{triage,explore,proposal,spec,design,north-star,slices}` |

## Build Order

| Order | Slice | Depends on | Parallelizable |
|---|---|---|---|
| 1 | S-000 (skeleton) | — | no — implicit blocker |
| 2 | S-001 (edge-case) | S-000 | no — reuses the fixed `context.ts` |

## Upstream Publication

`spec_source: internal` — Step 8b is a no-op; no Confluence/Jira artefacts are created for this change.
