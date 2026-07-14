# Verification Report

**Change**: bare-factory-migration
**Mode**: final (Strict TDD)
**Spec version**: V2 — signed (owner, 2026-07-14), all 5 domains
**Triage**: L | **HEAD**: `1da2063` (incl. /simplify `9ee5dd8`)
**Merge-base**: `ebad6a4`

---

### Verdict: pass-with-followups

The complete change (7 slices S-000..S-006 + the post-loop /simplify pass) is fully green
against real execution. All 20 active REQs across 5 domains (56 scenarios) are COMPLIANT.
The two REMOVED REQs (REQ-TES-02, REQ-ATH-13) have their guarantees relocated and covered.
The gating code audit (Step 11b, pre-pr) found zero Bug/Architecture/MAJOR issues. Four
non-blocking followups are enumerated for archive.

`adversarial_review: required` (triage L) — the orchestrator must run judgment-day BLIND
after this pass, before archive.

---

### Completeness
| Metric | Value |
|---|---|
| Slices total | 7 (1 skeleton + 6 SPIDR) |
| Slices complete | 7 (all `[x]` in apply-progress) |
| Active REQs (5 domains) | 20 (+2 REMOVED, guarantees relocated) |
| Scenarios | 56 — all COMPLIANT |

### Build & Tests Execution
| Check | Command | Result |
|---|---|---|
| Full suite | `bun test` | **1285 pass / 0 fail / 0 skip** — 2719 expect() calls, 146 files [21.7s] |
| Typecheck | `bun run typecheck` (`tsc --noEmit`) | **exit 0** — includes all `@ts-expect-error` negative oracles firing |
| Build | `bun run build` | **exit 0** (two-step tsc + bun build; pbuilder-codegen bin emitted) |
| Installed-consumer e2e + FIT-04/06/08/16/28/29 | targeted `bun test` (7 files, fresh pack) | **99 pass / 0 fail** |
| Corpus regen no-op (REQ-ATH-20.2) | `bun scripts/regen-corpus.ts` + `git status corpus/` | **exit 0, git-clean** — 22 records byte-identical |

### Regression-Sentinel Manifest (ruling R-5) — PASS
| Assertion | Command | Result |
|---|---|---|
| Sentinel dirs zero diff | `git diff --name-only <mb> -- test/golden-ir test/core test/conformance test/dialects` | **EMPTY** |
| Frozen `defineFactory` body untouched | `git diff <mb> -- src/core/context.ts` | ONE additive hunk `@@ -259,6 +259,11 @@` — an `@internal` JSDoc block INSIDE the editable `:248-292` range; `:293-346` impl body has **zero** touched lines |
| Deep-import sentinels untouched | (covered by the four globs above) | clean |
| §19 scope fidelity | `git diff --name-only <mb> -- package.json pkg-surface-baseline.json fit-09 fit-14` | **EMPTY** — no subpath/dep drift; only FIT-08's named-symbol allowlist narrowed |

### Adversarial Quality Gate (final mode)

**Code audit (pre-pr mode)** — **Clean (0 gating findings)**. Ran the code-audit engine over the
full production diff (`src/**`) + signed spec:
- Group 2 (Architecture): `src/testing/index.ts` delegates to `defineFactory` (single-wrap-seam,
  ADR-C) and drops the public re-export (ADR-A) — no ADR contradiction. Scaffold/commons wording
  is runtime-neutral (ADR-B). No layer edges added.
- Group 3 (Quality): **zero** untyped casts introduced in production (S-004 in fact REMOVED
  `{client: undefined as never}` casts). No TODO/FIXME/eslint-disable added. No stray
  `.only`/`.skip` introduced anywhere in the test diff.
- Group 4 (Scope): every changed file NOT in design §4.2's table traces to a recorded ruling —
  `harness-options-bag.test.ts` (R-10), the 5 folded consumers (R-9), `typed-factory.e2e.test.ts`
  + `nondeterministic-factory.ts` + `corpus-format.test.ts` + `fit-28` (S-004 recorded),
  `src/dialects/typescript/index.ts` @example (S-006 discovery, necessary consequence). No
  unexplained scope creep → **no MAJOR — scope-creep**.

**Live-app pass**: N/A — no UI surface. The installed-consumer e2e IS the behavioural end-to-end
(fresh pack → scratch install → import by package name → real run), and it passed.

**Adversarial review (judgment-day)**: **required** — triage = L. Orchestrator runs it BLIND
(diff + signed spec + acceptance criteria only) after this verify passes, before archive.

### /simplify commit `9ee5dd8` — specific scrutiny (no in-loop verify saw it)

Three logical changes, all behavior-preserving; no oracle weakened:
1. **Anchor-message sentence completion** (`src/scaffold/{index,expander}.ts`): replaced the
   literal ellipsis placeholder `"… against"` (S-002 had copied design ADR-B's `…` shorthand
   verbatim into shipped strings) with real clauses ("resolve package-local files / it / its
   source against"). ADR-B's contract is UPHELD: still runtime-neutral ("the call that runs this
   factory"), still names the `packageDir` remedy, still zero `defineFactory` tokens, still keeps
   the `"invalid input: "` prefix. REQ-TES-09.1/.2/.3 per-message tests
   (`not.toContain("defineFactory")` + verb + `packageDir` + prefix) remain green — a genuine
   improvement, not a weakening.
2. **Shared fence extraction** (`test/docs/testing-story-docs.test.ts:140`): swapped an inline
   `matchAll(/```ts.../)` for the file's own pre-existing `extractTsCodeBlocks()` helper (defined
   :39, already used :61/:94). The REQ-TSD-05.1 oracle (find the `runFactoryForTest` fence →
   `not.toContain("defineFactory")` → real `tsc --noEmit` fence-compile) is unchanged. DRY only.
3. **Shared scenario options mapping** (`runOptionsFor()` in `scenarios.ts`, used by 4 call
   sites): pure field-mapping helper `{seed, packageDir}`. Corpus regen git-clean no-op confirms
   byte-identical output. No behavior change.

### Strict TDD (final audit)

**Verdict**: pass (with 2 documented waivers)
- **TDD Cycle Adherence** (method: commit-messages + in-loop aggregate): slices committed
  test-first (`test:` before `feat:` where production changed; S-001 test-only; S-006's reds
  were genuinely red for four batches). Each batch's in-loop verify audited its delta TDD as
  `ok`. **No UNDOCUMENTED test-after found.**
- **Two documented waivers** (carried from verify-in-loop-5, NOT counted as violations):
  (a) `test/fake/harness-options-bag.test.ts` — test-after per ruling R-10 (S-000
  runtime-evidence fix, tagged `[characterization]`; the delegation code predates it and is
  reached through a new entry point); (b) S-005's vacuous red — S-004 was proven
  byte-identity-preserving, so FIT-28 could never go red against the committed corpus;
  documented honestly; the real acceptance (ATH-20.2 no-op regen) verified by execution twice.
- **Assertion quality**: no banned patterns in the delta. Negative type oracles are
  load-bearing: REQ-ATH-01.5's `@ts-expect-error` (old arity-2 wrapped-runner rejected) sits in
  the main `tsc --noEmit` set — typecheck exit 0 proves it fires (an unsatisfied directive is
  itself a tsc error). REQ-TES-06.4 asserts non-zero exit + `defineFactory` in stderr from a
  real bun subprocess against the packed tarball.
- **Triangulation**: red-proofs present for every scan/guard (FIT-29 planted import +
  barrel-route + no-false-positive controls; FIT-08 REQ-TES-03.1b/.2/.4; ATH-20.3 stray-wrap;
  word-boundary no-false-negative/positive pair).
- **REQ-ID coverage**: every active REQ maps to ≥1 passing test (matrix below). 0 uncovered.
- **Mutation testing**: not configured in sdd-init — skipped cleanly.

### Spec Compliance Matrix (all 5 domains, scenario-level)

**Domain: testing-entry-surface (REQ-TES)** — 6 active REQs / 17 scenarios — 17/17 ✅
| Requirement | Scenario | Test (execution evidence) | Result |
|---|---|---|---|
| REQ-TES-02 | (REMOVED — repealed; negative restated as TES-08) | — | n/a |
| REQ-TES-03 | .1/.1b/.2/.3/.4 — per-path allowlist; defineFactory/Session/ContractFake bans; shallow-fix rejection | `fit-08-no-kit-bleed` — 23 pass in gate set | ✅ COMPLIANT |
| REQ-TES-05 | .1/.2/.3 — dts diff, Batch/Directive in baseline, positive signature assertion paired with removal regen | `fit-04-dts-semver-gate` — 16 pass | ✅ COMPLIANT |
| REQ-TES-06 | .1/.2/.3/.4 — installed resolves ./commons+./testing not ./core; bare commit/reject e2e; stale import fails to resolve (real subprocess, non-zero exit + stderr) | `installed-consumer.e2e` — 16 pass vs fresh pack | ✅ COMPLIANT |
| REQ-TES-08 | .1 — defineFactory absent from ./testing's resolved exports | `installed-consumer.e2e` (`hasDefineFactory` false everywhere) | ✅ COMPLIANT |
| REQ-TES-09 | .1/.2/.3 — 3 scaffold/expander rejections rewritten, zero token, bare remedy | `test/scaffold/index.test.ts:151-179`, `expander.test.ts` — in full suite green | ✅ COMPLIANT |
| REQ-TES-10 | .1 — ./commons JSDoc zero defineFactory | `test/commons/jsdoc-bare-contract.test.ts` | ✅ COMPLIANT |

**Domain: author-test-harness (REQ-ATH)** — 8 active REQs / 21 scenarios — 21/21 ✅
| Requirement | Scenario | Test (execution evidence) | Result |
|---|---|---|---|
| REQ-ATH-13 | (REMOVED — relocated to ATH-17) | — | n/a |
| REQ-ATH-01 | .1/.2/.3/.4/.5 — bare shape, exactly 3 keys, ContractFake ban, seed via bag, old shape compile-rejected | `harness-result`, `fit-08`, `harness-options-bag`, `test/types/runfactoryfortest-shape` (`@ts-expect-error` at :49, fires under exit-0 typecheck) | ✅ COMPLIANT |
| REQ-ATH-06 | .1/.2 — sync throw + async reject discard, original error preserved | `harness-result` | ✅ COMPLIANT |
| REQ-ATH-11 | .1/.2 — no fs/net/env/argv; packageDir reads observed-not-flagged | `harness-in-memory-invariant` | ✅ COMPLIANT |
| REQ-ATH-14 | .1/.2 — in-ceiling scaffold reads allow-listed; outside trips [red-proof] | `harness-in-memory-invariant` | ✅ COMPLIANT |
| REQ-ATH-17 | .1/.2/.3 — packageDir validates / absent byte-parity / positive fs-read oracle | `harness-opted-in`, `harness-options-bag` | ✅ COMPLIANT |
| REQ-ATH-18 | .1/.2 — non-function → plain TypeError; zero-arg factory runs | `harness-result`, `test/types/*` (:33) | ✅ COMPLIANT |
| REQ-ATH-19 | .1/.2 — happy + double-fault wrap-parity vs direct defineFactory (dialect drain ordering incl.) | `harness-wrap-parity` (2 pass) | ✅ COMPLIANT |
| REQ-ATH-20 | .1/.2/.3 — fixtures fully bare (word-boundary scan per R-4); regen git-clean no-op (executed this verify); stray wrap fails scan [red-proof] | `author-emulation-scaffold.e2e` + `bun scripts/regen-corpus.ts` → empty `git status` | ✅ COMPLIANT |

**Domain: factory-package-shape (REQ-FPS)** — 2 REQs / 4 scenarios — 4/4 ✅
| Requirement | Scenario | Test (execution evidence) | Result |
|---|---|---|---|
| REQ-FPS-04 | .1 — reference schematic bare; e2e performs the internal wrap | `test/e2e/typed-factory.e2e` — in full suite green | ✅ COMPLIANT |
| REQ-FPS-05 | .1/.2/.3 — bin usage output; quickstart = author path + defineFactory @example internal; reserved names documented | `test/bin/*`, `fit-06` + `definefactory-jsdoc` (3 re-aim tests), `doc-set-content` | ✅ COMPLIANT |

**Domain: testing-story-docs (REQ-TSD)** — 3 REQs / 11 scenarios — 11/11 ✅
| Requirement | Scenario | Test (execution evidence) | Result |
|---|---|---|---|
| REQ-TSD-01 | .1/.2/.3/.4/.5 — README copy-runnable, 0.x semver, boundary line, seed example, zero token | `quickstart-docs`, `testing-story-docs` (copy-runnable executes README code verbatim), `doc-set-content` (whole-README scan) | ✅ COMPLIANT |
| REQ-TSD-02 | .1/.2/.3 — @example/@param options.seed/semver; origin cascade to context.ts survives @internal | `fit-06-example-jsdoc` (regex updated per R-6) | ✅ COMPLIANT |
| REQ-TSD-05 | .1/.2/.3 — dry-run fence bare + real tsc fence-compile; prose softened; zero-token ×3 docs [red-proof] | `testing-story-docs` REQ-TSD-05 block | ✅ COMPLIANT |

**Domain: author-onboarding-docs (REQ-AOD)** — 1 REQ / 3 scenarios — 3/3 ✅
| Requirement | Scenario | Test (execution evidence) | Result |
|---|---|---|---|
| REQ-AOD-01 | .1/.2/.3 — schema.json + bin invocation; bare factory.ts (zero token); test passes verbatim | `quickstart-docs` (assertion inverted S-000: `not.toContain("defineFactory")` + bare-shape match) | ✅ COMPLIANT |

**Compliance summary**: **56 / 56 scenarios COMPLIANT** (20 active REQs; 2 REMOVED REQs'
guarantees relocated and covered by TES-08 / ATH-17).

### Coherence (Design)
| Decision | Followed? | Notes |
|---|---|---|
| ADR-A — defineFactory core-internal, removed from ./testing | ✅ | public re-export dropped, internal import kept (`src/testing/index.ts:11`); FIT-08 + FIT-29 enforce; reachability matches ADR-A exactly |
| ADR-B — caller-supplied packageDir, runtime-neutral wording | ✅ | 3 strings runtime-neutral, zero token; /simplify completed the ellipsis sentences WITHOUT breaking the contract |
| ADR-C — options-bag + single-wrap-seam delegation | ✅ | delegates to `defineFactory`; untyped tier preserved via `packageDir !== undefined` conditional (REQ-ATH-17.2); parity reference invokes `defineFactory` DIRECTLY |
| §4.2 File Changes table | ✅ with recorded deltas | all design rows present; every extra file traces to R-9/R-10/S-004-deviation/S-006-discovery rulings |
| §4.8 dts double-regen (signature S-000 / removal S-006) | ✅ | two separate events; removal regen paired with the positive signature assertion (REQ-TES-05.3) |
| §4.8 frozen-set verify manifest | ✅ | executed this verify (table above), all empty |
| R-11 (supersedes R-3) — scratchFactoryRunner redesign | ✅ | re-anchor + finally-restore implemented; drift risk registered as followup #1 |

### Drift / Cross-Change
| Module | Status | Notes |
|---|---|---|
| FIT-28 corpus byte-determinism | ✅ green | fresh-process double-run + this verify's regen no-op |
| FIT-08/06/16/29 fitness layer | ✅ green | allowlist narrowed / PUBLIC_PATHS widened / 3rd-signal retired with fixture / new guard + red-proofs |
| Frozen `defineFactory` impl body (`context.ts:293-346`) | ✅ untouched | byte-identical to merge-base |
| `test/skeleton/dry-run-public-contract.test.ts` | ✅ reconciled | prior-change REQ-DRE-04.1 pin updated (S-002 discovery #1, recorded) — file is NOT in the sentinel set |

### In-Loop History
| Batch | Verify | Verdict | Notes |
|---|---|---|---|
| 1 (S-000) | in-loop-1/2 | PASS after R-10 fix | runtime-evidence gap closed with 3 characterization tests |
| 2 (S-001+S-002) | in-loop-3 | PASS | 9-file consumer set per R-9 |
| 3 (S-003+S-004) | in-loop-4 | PASS | scratchFactoryRunner redesign adjudicated (R-11 supersedes R-3) |
| 4 (S-005+S-006) | in-loop-5 | PASS | hard-cut atomic; 6 carried-to-final items (all addressed in this report) |

### Issues Found
**CRITICAL** (must fix before archive): None
**WARNING** (should fix): None
**SUGGESTION** (non-blocking, registered as followups): 4 — see below

### Followups for Archive (register in project/pending-changes)
1. **R-11 scratch-replica drift risk** — the scratch-anchor replica in the author-emulation
   fixture path skips `validateAtRunBoundary`, hardcodes the containment ceiling
   (`packageRoot === packageDir`), and lacks `checkReservedNames`' scan-failure wrapper.
   Register a lockstep pin test OR a shared helper between `defineFactory`'s gate and the
   replica. Behavior preservation is proven today (git-clean regen); the two paths can silently
   diverge in a future change.
2. **Lessons-learned candidate — inventory undercounts** — two independent design-inventory
   undercounts in one change (R-9: 5 unclaimed harness-convention consumers from a too-narrow
   `fd . test/fake | rg harness` search; §14 docs table missed the `src/dialects/typescript`
   `@example`). Promote "inventory claims need multi-pattern sweeps + verify-side re-derivation"
   to `project/lessons-learned`.
3. **Cosmetic comment-level tokens** — 4 prose/comment mentions of `defineFactory` remain in
   `test/fake/harness-opted-in.test.ts` (:5, :17) and `test/scaffold/classify-transport.test.ts`
   (:5, :18), describing the migration itself. No spec scenario scans test comments; optional
   cleanup only. (`src/core/context.ts:288`'s `@example` showing `defineFactory<Input>` is
   CORRECT per REQ-FPS-05.2 — the re-aimed internal example, not a missed token.)
4. **Observation (harmless) — `commons.index.d.ts` baseline not regenerated** — design §4.2
   listed a commons dts-baseline regen for the JSDoc rewrite, but FIT-04's
   `normalizeDeclarations()` strips comments before diffing, so a JSDoc-only change produces no
   detectable baseline drift; the omission is invisible and harmless. No action required; noted
   for completeness. The live-spec delta sync (design row `openspec/specs/testing-entry-surface/
   spec.md`) is `sdd-archive`'s job, as usual.

### Verdict
**pass-with-followups** — the complete bare-factory migration is behaviourally green (1285/0),
spec-compliant across all 5 domains (56/56 scenarios), architecturally coherent with ADR-A/B/C,
sentinel-clean, and quality-clean under the gating pre-pr audit; four non-blocking followups are
registered for archive. `adversarial_review: required` (triage L).
