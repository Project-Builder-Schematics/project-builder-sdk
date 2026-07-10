# Verification Report

**Change**: stage-4-typed-options
**Mode**: final (Strict TDD)
**Spec version**: V5 signed (owner 2026-07-07; AEC amendment applied 2026-07-10) · design rev 6 · slices rev 4
**Commit range**: `413b2aa..HEAD` (7 commits) on `feat/stage-4-typed-options`
**Date**: 2026-07-11

---

### Verdict: pass-with-followups

All 7 slices (S-000..S-006, incl. the coordinated Stage-2 AEC amendment) complete; full suite green; typecheck clean; every REQ-ID behaviourally covered; Step 11b code audit surfaced zero gating findings. Six non-blocking followups registered below.

**adversarial_review: required** — triage = L AND two sensitive areas touched (security/input-validation at the run boundary; public-api/supply-chain via the new `#bin` distribution primitive). The bar for `not-required` is not remotely met.

---

### Completeness
| Metric | Value |
|---|---|
| Slices total | 7 (S-000..S-006) |
| Slices complete | 7 |
| Tasks total | 34 |
| Tasks complete | 34 (all `[x]`) |

S-006's external gate (Stage-2 archive + coordinated AEC amendment) opened 2026-07-10 (commit `1c1188d`) and S-006 landed the same day. No incomplete/deferred tasks remain.

### Build & Tests Execution

**Typecheck** (`bunx tsc --noEmit`): ✅ Passed — exit 0, no output.

**Tests (full suite, `bun test`)**: ✅ **563 pass / 0 fail / 0 skipped** — 940 expect() calls across 76 files (1.90s).
```
 563 pass
 0 fail
 940 expect() calls
Ran 563 tests across 76 files. [1.90s]
```
Matches the expected baseline exactly (563/76). The `[pbuilder] factory at …: no schema.json found …` lines in the run are expected RBV-03 opt-out warnings emitted by test fixtures, not failures.

**Coverage tool**: ➖ Not available — no line-coverage tool configured (`sdd-init`); this project enforces coverage structurally via fitness functions (FIT-04..16) + Strict-TDD per-REQ test derivation. Reported cleanly, not a failure.

**Mutation testing**: ➖ Not configured in `sdd-init` — skipped cleanly. (Adversarial mutation was performed manually in-loop; see TDD audit.)

### Adversarial Quality Gate (final mode)

**Code audit (pre-pr mode, code-audit.md — GATING)**: **Clean of gating findings (0 Bug / 0 Architecture / 0 MAJOR)**. One Nit-severity quality followup + administrative items (below).

| Group | Result |
|---|---|
| G1 Spec/Requirements alignment | All 23 distinct REQ-IDs trace to ≥1 passing test; no REQ without upstream trace; no upstream AC without a REQ. No spec drift. |
| G2 Architectural integrity | `input-rejection.ts` is the SOLE Stage-2-coupled module (constraint 1 held). ADR-0030 formally scope-amends ADR-0018 (author-input conformance SDK-owned upstream; wire judgments engine-owned) — no ADR contradiction. FIT-07 recursive walk now covers `src/core/schema/`; FIT-15 guards bin→core direction. No layer violations. Sensitive areas (input-validation, supply-chain, api-stability) each carry covering REQs. |
| G3 Code quality | No untyped casts (`as any`/`as unknown as`) in change source; no magic numbers; no TODO/FIXME/eslint-disable; no dead code (`messageFor`'s two throw-arms are proven reachable by the REQ-AEC-09 no-message tests). **One Nit**: `AuthoringError` constructor's `message?: string` is ungated across all 8 reasons (F-01 below). |
| G4 Scope & process | Zero scope creep — every touched production file (`src/core/schema/*`, `bin/*`, `context.ts`, `authoring-error.ts`, `package.json`, `tsconfig.json`) appears in the design §4.2 File Changes table. FIT-04 `.d.ts` baseline regen (reason-union six→eight) is a spec-sanctioned MAJOR delta (REQ-AEC-01 stance), not a leak. |

**Live-app / CLI behavioural pass**: No UI surface (N/A). The CLI surface (`bin/pbuilder-codegen`) IS exercised behaviourally end-to-end via real subprocess `spawn` of the built `dist/bin/pbuilder-codegen.js` in `test/bin/codegen-cli.test.ts` (usage/exit/stream discipline, malformed-schema, write-containment, symlink-escape) — real process execution, not stubbed.

**Adversarial review (judgment-day)**: **required** — triage L / sensitive areas security-input-validation + public-api-supply-chain. Orchestrator runs it blind before archive.

### Spec Compliance Matrix (final)

23 distinct REQ-IDs across 6 domains → 59/59 scenarios COMPLIANT (test PASSED at runtime).

| Requirement | Test (primary) | Result |
|---|---|---|
| REQ-TFO-01 (.1,.2 schema-derived type + mutation-resistant) | `test/types/typed-factory-options.test.ts` (@ts-expect-error in main tsc set), `test/e2e/typed-factory.e2e.test.ts` | ✅ COMPLIANT |
| REQ-TFO-02 (.1 untyped opt-out) | `test/types/typed-factory-options.test.ts` | ✅ COMPLIANT |
| REQ-TFO-03 (.1,.2,.3 bin discipline + static parse-as-data) | `test/bin/codegen-cli.test.ts`, `test/bin/codegen-static-scan.test.ts` | ✅ COMPLIANT |
| REQ-TFO-04 (.1–.6 bin error/success/stderr/locator/non-destructive) | `test/bin/codegen-cli.test.ts`, `test/skeleton/schema-locate.test.ts` | ✅ COMPLIANT |
| REQ-TFO-05 (.1–.3 write containment + symlink-escape) | `test/bin/codegen-cli.test.ts` | ✅ COMPLIANT |
| REQ-SCP-01 (.1–.4 digest parity, non-destructive) | `test/fitness/fit-12-schema-parity.test.ts` | ✅ COMPLIANT |
| REQ-SCP-02 (.1–.6 sufficiency hard-fail matrix + proto-keys) | `test/fitness/fit-13-schema-sufficiency.test.ts` | ✅ COMPLIANT |
| REQ-RBV-01 (.1–.8 fail-closed site matrix) | `test/skeleton/schema-validate.test.ts`, `test/skeleton/run-boundary-validation.test.ts` | ✅ COMPLIANT |
| REQ-RBV-02 (.1 no-echo message) | `test/skeleton/run-boundary-validation.test.ts` | ✅ COMPLIANT |
| REQ-RBV-03 (.1 stateless per-run opt-out warning) | `test/skeleton/run-boundary-validation.test.ts` | ✅ COMPLIANT |
| REQ-RBV-04 (.1,.2 canary-seeded no-echo scan) | `test/security/canary-no-echo.test.ts` | ✅ COMPLIANT |
| REQ-RBV-05 (.1,.2 fail-closed malformed/empty schema) | `test/skeleton/run-boundary-validation.test.ts` | ✅ COMPLIANT |
| REQ-RLN-01 (.1–.4 module-structure enforcement) | `test/skeleton/reserved-lifecycle-names.test.ts`, `test/skeleton/schema-discovery.test.ts`, `test/fitness/fit-16-reserved-name-scan.test.ts` | ✅ COMPLIANT |
| REQ-RLN-02 (.1 rejection shape, distinguishable) | `test/skeleton/reserved-lifecycle-names.test.ts`, `test/skeleton/input-rejection.test.ts` | ✅ COMPLIANT |
| REQ-RLN-03 (.1,.2 collection-level boundary pin) | `test/skeleton/reserved-lifecycle-names.test.ts` | ✅ COMPLIANT |
| REQ-FPS-01 (.1 canonical discovery) | `test/skeleton/schema-discovery.test.ts`, `test/bin/codegen-cli.test.ts` | ✅ COMPLIANT |
| REQ-FPS-02 (.1,.2 package-surface guard + tarball) | `test/fitness/fit-14-package-surface.test.ts` | ✅ COMPLIANT |
| REQ-FPS-03 (.1 bin→core direction) | `test/fitness/fit-15-bin-core-direction.test.ts` | ✅ COMPLIANT |
| REQ-FPS-04 (.1 in-repo e2e typed factory) | `test/e2e/typed-factory.e2e.test.ts`, `test/fixtures/typed-factory/*` | ✅ COMPLIANT |
| REQ-FPS-05 (.1–.4 discoverability + README qualifier) | `test/bin/codegen-cli.test.ts`, `test/fitness/definefactory-jsdoc.test.ts` | ✅ COMPLIANT |
| REQ-AEC-07 (.1 `invalid-input` reason) | `test/skeleton/authoring-error.test.ts`, `test/types/authoring-reason.test.ts`, `test/skeleton/input-rejection.test.ts` | ✅ COMPLIANT |
| REQ-AEC-08 (.1 `reserved-name` reason) | `test/skeleton/authoring-error.test.ts`, `test/skeleton/input-rejection.test.ts` | ✅ COMPLIANT |
| REQ-AEC-09 (.1,.2 message-template rows, byte-exact) | `test/skeleton/authoring-error.test.ts`, `test/skeleton/input-rejection.test.ts`, `test/fitness/fit-11-whole-object-leak-scan.test.ts` | ✅ COMPLIANT |

**Compliance summary**: 59/59 scenarios COMPLIANT.
**Amendment sub-total**: REQ-AEC-07/08/09 verified live in the amended main spec `openspec/specs/authoring-error-contract/spec.md` V3 (3/3).

> **REQ-count note (non-blocking doc nit)**: the planning artefacts (spec §"REQ-ID Stability", slices Coverage Check) label the set "25 REQ-IDs". The actual distinct REQ-IDs are **23** (TFO×5, SCP×2, RBV×5, RLN×3, FPS×5, AEC×3) — an off-by-two arithmetic label in the planning docs. Every distinct REQ-ID is covered; the miscount does not affect coverage. Listed as followup F-06.

### Coherence (Design rev 6)

| Decision | Followed? | Notes |
|---|---|---|
| src/core/schema cluster (parse/validate/sufficiency/digest/discovery/locate) | ✅ | All 9 modules present as designed |
| Codegen bin outside `src/`, bin→core only (ADR-0027, FIT-15) | ✅ | `bin/*.ts`; FIT-15 green |
| ADR-0032 hand-rolled JSON position locator (rev 6, superseding ADR-0027 Gap-8) | ✅ | `schema-locate.ts` + `schema-locate.test.ts`; dead `locateFromSyntaxError` regex deleted |
| Option A plain-`Error` interim → S-006 `AuthoringError` upgrade, isolated to `input-rejection.ts` | ✅ | Confirmed sole Stage-2-coupled module; upgrade byte-preserves AEC-09 literals |
| ADR-0030 ADR-0018 scoping amendment | ✅ | Recorded; pre-archive arch audit input |
| Two opt-out tiers (bare vs `{packageDir}`) | ✅ | `context.ts` `defineFactory<O>(fn, options?)` |
| `message?: string` override on AuthoringError ctor | ⚠️ | Works & spec-consistent, but ungated across 8 reasons (F-01) — a deviation from the file's own exhaustive-switch idiom, self-flagged in apply-progress |

### Architecture Impact — validation of design's `modifying` classification

Design rev 6 declared `architecture_impact: modifying`. **VALIDATED.** The change introduces a new executable distribution primitive (the codegen bin — a component the single-layer-library baseline lacks) and scope-amends ADR-0018's ownership boundary (ADR-0030) → beyond `additive`. No documented boundary is removed and the IR-seam pattern is intact → not `breaking`. Baseline read from engram `sdd/project-builder-sdk/architecture` (obs #652, post-stage-3). Triggers `arch_refresh_post_verify` (new component + modifying) — orchestrator should refresh the baseline post-verify before archive.

### Strict TDD (final audit)

**Verdict: pass-with-followups**

**TDD Cycle Adherence** — Method: file-pairing + documented per-task RED evidence (commits are slice-grained conventional commits `feat(schema): stage-4 S-00N …`, so per-cycle git ordering is not observable; apply-progress records RED evidence + GREEN + triangulation per task). No implementation file lacks a paired test. **Two "test-passed-immediately" cases adjudicated (carried from verify-in-loop-4/5):**

- **S-004 `rejectionForReservedName` (apply-progress deviation 6)** — leaf pure function (one-line constant-return from a spec-pinned literal, zero branching) implemented alongside its sibling before its *own* unit test; the driving BEHAVIOUR was RED-first at the integration layer (`reserved-lifecycle-names.test.ts` → `checkReservedNames` wiring). **Adjudication: characterization, NOT an anti-TDD violation** — no production logic was shaped to fit an after-the-fact test (nothing to shape in a constant-return), and the observable behaviour was test-driven. Non-triangulatable (no conditional logic). Tolerated with finding.
- **S-005 canary suite (apply-progress deviation 9)** — 10/10 passed on first run; the no-echo property was genuinely built correctly by S-000/S-003/S-004. **verify-in-loop-5 performed an independent adversarial mutation** (planted `(received: ${JSON.stringify(input)})` on the throw path → 8/10 cases went RED, then cleanly reverted → 10/10 green, full suite restored to baseline). **Adjudication: characterization ("behaviour already exists" — a legitimate strict-TDD Phase-1 outcome), NOT vacuous and NOT anti-TDD** — proven non-theatre by mutation; reverting prior-slice verified work to fabricate RED would be dishonest. Tolerated with finding.

Both are honest sequencing/verification classifications, corroborated by adversarial evidence at in-loop; neither meets the final-mode anti-TDD halt bar (no code written to fit a pre-written-then-passing test). Registered as process followups, not blockers.

**Assertion Quality** — Tests scanned: all change test files. Banned-pattern matches: **0** (no `toBeDefined`/`toBeTruthy`/`toBeFalsy`-without-context/`objectContaining`-as-whole/`not.toThrow`-sole/snapshot-only). Assertions use exact `toEqual`/`toBe`/`toContain` on pinned literals and a real generic `surfaceContains(...).toBe(false)` canary scan. Clean.

**Triangulation** — Conditional/iterative production logic (schema-validate finding matrix, sufficiency rules, JSON locator scanner, reserved-name normalization, origin/message switches) each driven by ≥2 distinct cases across distinct branches (e.g. locator: unquoted-key/multi-line/EOF/trailing-comma/malformed-number + bad-`\u` fallback; validate: missing/wrong-type/excess/non-JSON/reserved/proto + null-trichotomy). No triangulation gaps.

**Mutation Testing** — Not configured; skipped. Manual adversarial mutations performed and cleanly reverted at in-loop (canary echo-plant; FIT-11 leak-family plant; FIT-04 9th-reason exhaustive-switch break — all produced the expected RED then byte-identical revert).

**REQ-ID Coverage** — 23/23 distinct REQ-IDs have ≥1 associated passing test. Uncovered: 0.

### Drift / Cross-Change

| Module | Status | Notes |
|---|---|---|
| FIT-04 .d.ts semver gate | ✅ | Reason-union six→eight flagged breaking (spec-sanctioned MAJOR, baseline regenerated); `message?` addition is additive |
| FIT-07 no-tree-in-core | ✅ | Now recursive — covers new `src/core/schema/` cluster |
| FIT-09/10/11 (Stage 1/2 gates) | ✅ | Untouched; FIT-11 extended to 8 leak-families, still green |
| Stage-2 `authoring-error.ts` | ✅ | Amended only via owner-authorized coordinated `sdd-spec` amendment (spec V3); no rogue edit |

### In-Loop History

| Iteration | Scope | Verdict | Notes |
|---|---|---|---|
| 1–2 | S-000..S-002 | (see reports 1-2) | in-loop-2 HALTED **SPEC** on REQ-TFO-04.4 (Bun/JSC `JSON.parse` emits no byte offset → dead locator regex) → resolved by re-design rev 6 / ADR-0032 (hand-rolled locator), not re-spec |
| 3–4 | S-003, S-004 | PASS | run-boundary matrix + reserved-name enforcement |
| 5 | S-005 | PASS | canary no-echo + discoverability; adversarial echo-plant proved scan non-theatre |
| 6 | AEC amendment + S-006 | PASS | reason enum six→eight + `input-rejection.ts` upgrade; 2 WARNINGs raised (both carried here) |

### Issues Found

**CRITICAL** (must fix before archive): **None.**

**WARNING** (should fix, non-blocking → followups):
- **F-01** `src/core/authoring-error.ts` — the `message?: string` constructor field is ungated across all eight `reason` values (compiles for any reason, weaker than the file's own exhaustive-switch idiom). No exploit today (both internal call sites correct; frozen-template output satisfied). Recommend a discriminated union making `message` compile-time required for `invalid-input`/`reserved-name` and forbidden for the six legacy reasons. Category: **quality (minor)**.
- **F-02** `bin/pbuilder-codegen.ts` — the `-h` short-flag alias is handled in code (line 130, `first === "--help" || first === "-h"`) but only `--help` has a test in `codegen-cli.test.ts`. Add a `-h` case. Category: **test-coverage (minor)**.

**SUGGESTION** (never blockers → followups):
- **F-03** Register the coordinated Stage-2 AEC amendment (reason enum six→eight + REQ-AEC-09 rows) as a pending change at archive — administrative, per the change spec's own "Administrative Notes".
- **F-04** `isErrnoException` duplicated 3× (`context.ts`, `schema-discovery.ts`, `bin/pbuilder-codegen.ts`), each a 3-line type-guard; consolidation declined in-slice (would force a cross-module utility or a backwards bin→src import). Revisit as a cleanup.
- **F-05** Reconcile `triage.md`'s scope block (predates the 4.5/D7 `stage-4b-testing-harness` carve-out) at archive — BA cross-artefact finding.
- **F-06** Doc nit: planning artefacts label the REQ set "25 REQ-IDs"; the true distinct count is 23. Correct the label at archive (also design §4.12 row 19's `options.port` vs Glossary input/options wording).

### Verdict

**pass-with-followups** — all 59 scenarios across 23 REQ-IDs COMPLIANT with real execution evidence (563/0/76, tsc clean); Step 11b code audit clean of gating findings; TDD discipline honest with two adjudicated characterization cases (corroborated by adversarial mutation). Six non-blocking followups registered for archive. Architecture impact `modifying` validated; `arch_refresh_post_verify` due. **adversarial_review: required.**
