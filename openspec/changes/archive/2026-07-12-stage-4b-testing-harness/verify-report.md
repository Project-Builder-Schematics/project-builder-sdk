# Verification Report — stage-4b-testing-harness

**Change**: `stage-4b-testing-harness`
**Mode**: final (Strict TDD)
**Spec version**: V3 signed (owner, 2026-07-10)
**Triage**: L · **Branch**: `feat/stage-4b-testing-harness` (8 commits, `main`=`3c46098`)
**Verdict**: **pass-with-followups**
**adversarial_review**: **required**

---

## Completeness

| Metric | Value |
|---|---|
| Slices total | 7 (S-000..S-006) |
| Slices complete | 7 — S-006 landed (stage-4 archived 2026-07-11, gate satisfied) |
| Tasks complete | all `[x]` across all slices |
| REQ-IDs (self-counted) | **28** (ATH 13 · TES 7 · FSP 4 · TSD 4) — header arithmetic confirmed correct |
| Scenarios (self-counted) | **54** (ATH 22 · TES 18 · FSP 4 · TSD 10) — header confirmed |

REQ count verified by hand from `spec.md` REQ Index + all four `specs/*/spec.md` — no off-by-N.

## Build & Tests Execution (real)

- **Full suite** (`bun test`): **651 pass / 0 fail / 1135 expect() calls**, 84 files, 2.76s. ✅
- **Typecheck** (`bunx tsc --noEmit`): exit 0. ✅
- **Build** (`bun run build`): tsc `-p tsconfig.build.json` clean + `pbuilder-codegen` bundle (9 modules). ✅
- **`dist/testing/index.d.ts`**: emits exactly `RunResult`, `Batch`/`Directive` (type-only), `defineFactory`, `runFactoryForTest`; negative scan `\b(EngineClient|EmitRejection)\b` → clean (no port-name leak). ✅

The suite exercises the heavy sensitive-area machinery for real: FIT-04 dts diff, FIT-17 four-entry minified builds, and the installed-consumer e2e (build→pack→scratch-install→import-by-name) all ran green via the shared build fixture.

## Spec Compliance Matrix (28/28 REQs, 54/54 scenarios COMPLIANT)

| Domain | REQ-IDs | Test(s) | Result |
|---|---|---|---|
| author-test-harness | ATH-01..10, 12 (main) | `test/fake/harness-result.test.ts` (16 tests), `harness-in-memory-invariant.test.ts` (ATH-11.1), `harness-leak-scan.test.ts` (ATH-12) | ✅ COMPLIANT |
| author-test-harness (gated) | ATH-11.2, ATH-13.1/.2 | `test/fake/harness-opted-in.test.ts` | ✅ COMPLIANT (stage-4 merged+archived) |
| author-test-harness | ATH-01.3 (red-proof) | `test/fitness/fit-08-no-kit-bleed.test.ts` | ✅ COMPLIANT |
| testing-entry-surface | TES-01 | `fit-09-pkg-exports-resolution.test.ts` | ✅ COMPLIANT |
| testing-entry-surface | TES-02, TES-06.1/.2/.3 | `test/e2e/installed-consumer.e2e.test.ts` | ✅ COMPLIANT |
| testing-entry-surface | TES-03.1-.4 | `fit-08-no-kit-bleed.test.ts` (+ 2 wildcard red-proofs) | ✅ COMPLIANT |
| testing-entry-surface | TES-04.1-.4 | `fit-17-testing-dev-only-bundle.test.ts` | ✅ COMPLIANT |
| testing-entry-surface | TES-05.1/.2 | `fit-04-dts-semver-gate.test.ts` | ✅ COMPLIANT |
| testing-entry-surface | TES-07.1-.3 | `fit-10-engine-client-port-guard.test.ts` | ✅ COMPLIANT |
| fake-single-source-parity | FSP-01..04 | `fit-18-fake-single-source-parity.test.ts` | ✅ COMPLIANT |
| testing-story-docs | TSD-01, TSD-02, TSD-04 | `test/docs/testing-story-docs.test.ts`, `fit-06-example-jsdoc.test.ts` | ✅ COMPLIANT |
| testing-story-docs | TSD-03.1 (revert) | `test/docs/testing-story-docs.test.ts` + `definefactory-jsdoc.test.ts` (absence guard) | ✅ COMPLIANT (revert DONE, not deferred — stage-4 archived) |

All three STAGE-4-MERGED-DEPENDENT scenarios now pass on the merge base (stage-4 archived 2026-07-11, ADRs 0027-0031 Accepted). TSD-03 executed the revert (not the deferral branch).

## Licensed-Deviation Validation (validated against spec + design + production code)

1. **ATH-11.2 predicate widened to two fs reads** (readdirSync + readFileSync, not just schema.json). VALIDATED: `src/core/context.ts:202-206` runs BOTH `checkReservedNames`→`readdirSync(<packageDir>)` and `validateAtRunBoundary`→`readFileSync(<packageDir>/schema.json)` under the single `options.packageDir !== undefined` gate — neither optional, both the factory-under-test's own opted-in behaviour, not harness machinery. `test/fake/harness-opted-in.test.ts:141-146` allowlists exactly those two resolved paths; `[must-fail-first]` RED proven (single-path predicate fails on the readdirSync event). Within REQ-ATH-11's harness-machinery carve-out. LICENSE HOLDS.
2. **ATH-13 asserts `AuthoringError`, not interim plain `Error`** (`[characterization]`). VALIDATED: `src/core/schema/input-rejection.ts` (`rejectionFor`, git `6bbd9f2`, stage-4's own now-archived S-006) constructs `new AuthoringError({...reason,message})`. REQ-ATH-13's own text authorizes re-verify against the `AuthoringError` shape "post-S-006"; that window has closed on this merge base. `error: AuthoringError | unknown` typing accommodates it unmodified. LICENSE HOLDS.

## Design Conformance (ADRs 0033-0036)

| Decision | Followed? | Notes |
|---|---|---|
| ADR-0033 third audience `author-testing`, own `./testing`, 0.x exempt | ✅ | exports entry + amendment stub in `0009` present; drafts status `Proposed` (promote at archive) |
| ADR-0034 six containment guards | ✅ | FIT-17 (dev-only bundle), FIT-08 per-path allowlist + wildcard-ban-by-form, FIT-10 single-path, FIT-07 pinned `src/core/**`, FIT-04 entry-only dts + negative port-name scan |
| ADR-0035 fake relocation + parity-by-identity | ✅ | `src/testing/contract-fake.ts` shipped; old paths pure shims; FIT-18 `===` identity |
| ADR-0036 packed-tarball e2e lifecycle | ✅ | `--ignore-scripts` + non-routable registry + repo-lockfile hash guard + `afterAll` cleanup |
| RunResult shape `{tree, emitted, error}`; facade names no port symbol | ✅ | `src/testing/index.ts` uses local `RecordingClient`; matches design §4.3/§4.4 verbatim |

Architecture impact `modifying` (two documented `deviates` rows → ADR-0033/0035). Triggers `arch_refresh_post_verify`.

## Sensitive-Area Rows (both live)

- **public-api (contract)** — new `./testing` subpath: FIT-09 widened 3→4 exact keys (`./core` still absent); FIT-04 `testing.index` dts baseline pair + companion negative declaration scan. Enforcing. ✅
- **security (supply-chain)** — published subpath carrying test machinery: FIT-17 asserts `CONTRACT_FAKE_PREFIX` ABSENT from `.`/`./commons`/`./conformance` minified bundles AND PRESENT in `./testing` (positive control), literal sourced structurally from `rejection-messages.ts`, `sideEffects` absence asserted. e2e install discipline (`--ignore-scripts`, non-routable `BUN_CONFIG_REGISTRY=http://127.0.0.1:9`, repo-lockfile-hash-unchanged) all present and enforcing. ✅

## Strict TDD (final audit)

- **Cycle adherence**: per-slice commits → Method 1 (per-cycle RED/GREEN) unavailable; **Method 2 (test-implementation pairing)** applied — every REQ has a driving test, all present and paired. `[must-fail-first]` on genuinely new behaviour (relocation, result contract, invariants, guards, ATH-11.2). `[characterization]` correctly reserved for behaviour predating the slice reached through a NEW entry point (ATH-13.1/.2 — stage-4's already-shipped `AuthoringError` via the harness facade). S-004 e2e carries no `[must-fail-first]` tag but is a pure installed-vantage outcome-proof (golden-tree equality, consumer-side `AuthoringError` narrowing) elaborating the S-000 spike — legitimate characterization.
- **Assertion quality**: banned-pattern scan across all change test files → one `toBeDefined()` (`harness-result.test.ts:190`), a precondition guard that the escaped callback was captured, immediately followed by real `toBeInstanceOf(AuthoringError)` + `reason` assertions. NOT a tautology. No snapshots, no `not.toThrow`-only, no truthiness-without-context.
- **REQ-ID coverage**: 28/28 covered.
- **Mutation testing**: not configured — skipped cleanly.

## Adversarial Quality Gate — Step 11b Stage A (code-audit, pre-pr mode)

| Group | Result |
|---|---|
| 1 Spec/req alignment | Clean — all 28 REQs traceable + tested |
| 2 Architecture | Clean — deviations recorded (ADR-0033/0035); FIT-07 pinned, FIT-10 single-path, FIT-08 per-path allowlist; sensitive areas REQ-covered |
| 3 Code quality | Clean — production `src/testing/index.ts` has no untyped casts / magic numbers / TODO/FIXME (test-side `as unknown as` for spy rigs is standard idiom) |
| 4 Scope | 1 Nit — `test/fitness/definefactory-jsdoc.test.ts` modified but not in `design.file_changes` |

**No Bug / Architecture / MAJOR findings → gate PASSES.**

### Nit N-1 — scope: file modified outside design.file_changes
**Location**: `test/fitness/definefactory-jsdoc.test.ts`
**What**: Stage-4-owned guard flipped from presence→absence assertion on the reverted README qualifying line; not listed in `design.file_changes`.
**Why**: minimal — the flip is a mandatory consequence of TSD-03's revert under binding constraint #7 (leave the suite green); the scenario's own text anticipated it; kept as a permanent regression guard. Documented in S-006 deviation note #3. Informational, no fix required.

## Live-app pass
N/A — no UI surface (library + fitness/e2e change).

## Adversarial review (judgment-day)
**required** — triage = L AND two live sensitive-area rows (public-api contract, supply-chain). The orchestrator should run judgment-day BLIND before archive.

## Issues Found
- **CRITICAL**: None
- **WARNING**: None
- **SUGGESTION/Nit**: N-1 (scope, informational)

## Followups to register at archive
1. Rewrite/retire pending row **W1** — subsumed by REQ-TES-06 (design §4.8).
2. Update `sensitive-areas.md` row 1 (supply-chain: `./testing` published entry carrying the fake) and row 6 (public-api: FIT-10 allow-list note now spans `src/**`).
3. Register **Stage-6 `./core` production graduation** as a pending change (PM M4).
4. Promote ADRs **0033-0036** from `Proposed`→`Accepted` at archive.

## Verdict
**pass-with-followups** — complete change (all 7 slices, S-006 landed), suite/typecheck/build green with real evidence, 28/28 REQs and 54/54 scenarios compliant, both licensed deviations validated against production code, sensitive-area guards enforcing. Only archive-grooming followups remain; no blocking defect.
