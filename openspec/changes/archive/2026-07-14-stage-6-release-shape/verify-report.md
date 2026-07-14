# Verification Report — Stage 6: Release shape & DX closure

**Change**: `stage-6-release-shape`
**Mode**: final (Strict TDD)
**Spec version**: local-consumption V2 · publish-pipeline-hardening V3 · author-onboarding-docs V2 · factory-package-shape V2 (all signed)
**Triage**: L · **Verified at**: 2026-07-14

---

### Verdict: pass-with-followups

All 6 slices complete, full suite green and stable (1109/0, twice), typecheck clean, build clean,
fitness suite green, all sensitive-area gates verified against real artefacts, Step 11b code audit
clean of gating findings. 24/25 active REQs proven by passing, correctly-scoped tests; REQ-AOD-08
(human walkthrough) is a steward-reckoning deliverable per the G-2 ruling, not a gap. Followups are
archive-time drift-syncs and one optional test-guard hardening — none block archive.

---

### Completeness
| Metric | Value |
|---|---|
| Slices total | 6 (S-000..S-005) |
| Slices complete | 6 |
| Tasks total | 18 |
| Tasks complete | 18 |

All slice tasks `[x]` in `slices.md`. PPH-07/08 (placeholder) deferred by owner CQ2 descope — out of scope, not counted.

### Build & Tests Execution

**Build** (`bun run build`): PASS — `prebuild` clean fires, `tsc -p tsconfig.build.json` + codegen bundle, exit 0.
**Typecheck** (`tsc --noEmit`, repo root): PASS — zero errors (run twice).
**Tests (full suite `bun test`)**: PASS — **1109 pass / 0 fail / 0 skip**, 2185 expect() calls, 127 files. Run twice consecutively, stable both runs (11.2s / 11.8s).
**Fitness suite** (`test/fitness/`): PASS — 289 pass / 0 fail, 24 files.
**Change-specific legs** (e2e installed-consumer, quickstart-docs, doc-set-content, build-config): PASS — 44 pass / 0 fail. Both e2e legs (bun-link + tarball) exercised.
**Coverage**: no coverage tool configured in `sdd-init` → Not available (not a failure).
**Live-app pass**: N/A — no UI surface (package config / CI / docs).

### Strict TDD (final audit)

**Verdict**: pass

- **TDD cycle adherence** (method: apply-progress evidence tables Runs 1-4 + file-pairing): every implementation/config change was driven by a test observed RED first. Genuine RED evidence quoted per task across all four runs (stub-and-restore for new detectors: `ensureLinkedConsumer`, `fit-23` check fns, `checkBinExecutable`; deliberate-literal-inversion for parity/characterization tests; genuine ENOENT/assertion-mismatch for the doc scans). One self-corrected process deviation at S-000 (real body written before RED captured) — caught, re-RED'd, documented. No anti-TDD (tests-after-impl) pattern found.
- **Assertion quality**: clean. All new tests assert specific literal values / extracted cells / real exit codes — no `toBeDefined()`, `toBeTruthy()`, bare `objectContaining()`, snapshot-only, or `.not.toThrow()`-only patterns anywhere in the change's test files.
- **Triangulation**: adequate. Loop-based tests (REQ-AOD-09.1 6 fragments, 09.4 2 rows, `collectUsesValues` multi-job, `scanForSecrets` red-proof) triangulate their conditional logic; single-case checks are spec-bounded fixed-set assertions with no branch to triangulate.
- **Mutation testing**: not configured in `sdd-init` — skipped cleanly. In lieu, the change carries explicit `[red-proof]` scenarios (LC-02.3/04.3/05.3, PPH-01.2/02.2/03.2, AOD-07.2/11.2, FPS-07.2) that function as hand-authored mutation guards.
- **REQ-ID coverage**: 25/25 active REQs have ≥1 associated test (see matrix). AOD-08 covered by manual walkthrough (deferred to reckoning by design).
- **/simplify cleanup pass** (6 fixes + `fit-23:170` tightening, ran after verify-in-loop-4): reviewed — `fit-23:170` adds `expect(line).toContain("npm publish")` before the `--dry-run` assertion (a strengthening); `markdown-section.ts` `lastTableCell`/`findRowLine` helpers target the Stage-tag cell exactly (strengthening vs whole-line substring). No assertion weakened by the cleanup.

### Adversarial Quality Gate (final mode — Step 11b)

**Code audit (pre-pr mode)**: Clean of gating findings (0 Bug / 0 MAJOR / 0 Architecture). Diff surface: workflows, docs, tests, `package.json`, `tsconfig.build.json`, planning docs, regenerated baseline — **zero `src/` changes** (matches design §4.1 "Stage 6 adds NO runtime behaviour to src/"). Non-gating observations only:

| Severity | Location | Finding |
|---|---|---|
| Nit | `test/fitness/fit-23...:171` | `line as string` assertion after a `toContain` guard — harmless in a test, could use non-null assertion pattern. |
| Info | `test/support/markdown-section.ts` | `findRowLine`/`lastTableCell` helpers added (28 lines) not explicitly enumerated in design §4.2 File Changes, but covered by §4.2c Testing touchpoint "extend" — additive test plumbing for the unit-layer doc scans, not production. |
| Suggestion | `test/docs/doc-set-content.test.ts:38` | Wire-term ban helper is case-sensitive (see probe below). |

**Wire-term ban-helper mutation probe** (per launch instruction): empirically ran the `WIRE_INTERNAL_TERMS = ["EmitRejection", "Directive", "Batch", /\bdelete\b/]` guard against 10 leak candidates. Result: the canonical lowercase wire op `delete`, the PascalCase type names `EmitRejection`/`Directive`/`Batch`, are all caught; a **capitalized** leak (`Delete`/`DELETE`) or lowercased `emitrejection` slips through. **Judgment: acceptable, non-blocking.** The case-sensitivity is load-bearing — lowercasing the terms would over-ban REQUIRED author vocabulary: the specs themselves use lowercase "directive" ("before any directive is emitted", REQ-LC-05/AOD-06) and lowercase "batch" (`BATCH_CAP_BYTES`), and `\bdelete\b` word-boundary correctly spares "deleted". The realistic leak form (the actual wire-op string value `delete`, PascalCase type names) is caught; the current docs pass with no leak. Residual gap (capitalized wire-op leak survives) is a SUGGESTION for future hardening, not a defect — REQ-AOD-05.1 is satisfied for all realistic leak forms.

**Adversarial review (judgment-day)**: **required** — triage = L AND two sensitive areas touched (deployment: `publish.yml`/OIDC; supply-chain: tarball surface). Orchestrator should run judgment-day blind before archive.

### Spec Compliance Matrix (25 active REQs / 52 scenarios)

| Requirement | Scenarios | Test | Result |
|---|---|---|---|
| REQ-LC-01 | .1/.2 | `installed-consumer.e2e.test.ts` (bun-link leg) | ✅ COMPLIANT |
| REQ-LC-02 | .1/.2/.3 | `installed-consumer.e2e.test.ts` (link leg + parity red-proof) | ✅ COMPLIANT |
| REQ-LC-03 | .1 | `installed-consumer.e2e.test.ts` (tarball leg + `./typescript`) | ✅ COMPLIANT |
| REQ-LC-04 | .1/.2/.3[red] | `installed-consumer.e2e.test.ts` (`checkBinExecutable`, both legs) | ✅ COMPLIANT |
| REQ-LC-05 | .1/.2/.3[red] | `installed-consumer.e2e.test.ts` (`dryRun()` both legs) | ✅ COMPLIANT |
| REQ-PPH-01 | .1/.2[red]/.3 | `fit-23-publish-workflow-guard.test.ts` (guard + trigger fence) | ✅ COMPLIANT |
| REQ-PPH-02 | .1/.2[red] | `fit-23...` (SHA pins, both workflows) | ✅ COMPLIANT |
| REQ-PPH-03 | .1/.2[red] | `fit-23...` (`--dry-run` pinned) | ✅ COMPLIANT |
| REQ-PPH-04 | .1 | `build-config.test.ts` (real build, stale-dist marker) | ✅ COMPLIANT |
| REQ-PPH-05 | .1/.2 | `build-config.test.ts` + `fit-14-package-surface.test.ts` | ✅ COMPLIANT |
| REQ-PPH-06 | .1 | `fit-14...` (baseline zero `.d.ts.map`) | ✅ COMPLIANT |
| REQ-AOD-01 | .1/.2/.3 | `quickstart-docs.test.ts` (machine leg) | ✅ COMPLIANT |
| REQ-AOD-02 | .1/.2 | `quickstart-docs.test.ts` (install-ritual order) | ✅ COMPLIANT |
| REQ-AOD-03 | .1 | `doc-set-content.test.ts` (verbs + trichotomy) | ✅ COMPLIANT |
| REQ-AOD-04 | .1 | `doc-set-content.test.ts` (dialect linked not duplicated) | ✅ COMPLIANT |
| REQ-AOD-05 | .1 | `doc-set-content.test.ts` (fields + wire-term ban) | ✅ COMPLIANT |
| REQ-AOD-06 | .1/.2 | `doc-set-content.test.ts` (`dryRun` from `./commons`) | ✅ COMPLIANT |
| REQ-AOD-07 | .1/.2[red] | `quickstart-docs.test.ts` (no src-swap) | ✅ COMPLIANT |
| REQ-AOD-08 | .1 | `walkthrough-record.md` (manual — deferred to reckoning) | ⚠️ DEFERRED (by design, G-2) |
| REQ-AOD-09 | .1–.6 | `doc-set-content.test.ts` (planning reconciliation) | ✅ COMPLIANT |
| REQ-AOD-10 | .1 | `doc-set-content.test.ts` (demo dryRun order) | ✅ COMPLIANT |
| REQ-AOD-11 | .1/.2[red] | `quickstart-docs.test.ts` (consumer `tsc --noEmit`) | ✅ COMPLIANT |
| REQ-AOD-12 | .1/.2/.3 | `doc-set-content.test.ts` (sensitive-areas registry) | ✅ COMPLIANT |
| REQ-FPS-06 | .1/.2 | `fit-14...` + `doc-set-content.test.ts` (dist/core present + rationale) | ✅ COMPLIANT |
| REQ-FPS-07 | .1/.2[red] | `fit-14...` (positive no-secrets scan) | ✅ COMPLIANT |

**Compliance summary**: 51/52 scenarios COMPLIANT via passing runtime tests; 1/52 (REQ-AOD-08.1) DEFERRED to steward reckoning by the plan-verify G-2 ruling (`walkthrough-record.md` confirmed still a pure template — all `_(fill in)_` placeholders, unchecked attestation boxes). **24/25 active REQs machine-proven; 1/25 discharged manually at reckoning.**

### Sensitive-Area Final Pass

| Gate | Evidence | Result |
|---|---|---|
| W3 repo-owner guard | `publish.yml:25` `if: github.repository == 'Project-Builder-Schematics/project-builder-sdk'` on the `id-token: write` job | ✅ |
| Job-scoped `id-token` | workflow-level `permissions: contents: read` only; `id-token: write` inside `publish` job block (`publish.yml:29-31`) | ✅ |
| Trigger fence | `publish.yml` `on: push: branches: [main]` only — no `pull_request`/`workflow_dispatch` | ✅ |
| `--dry-run` pinned | `publish.yml:71` `npm publish ... --dry-run` — only publish command in repo; no un-dry-run publish anywhere | ✅ |
| SHA pins verified vs upstream | checkout `34e1148…`→v4.3.1, setup-node `49933ea…`→v4.4.0, setup-bun `0c5077e…`→v2.2.0 — all resolve to real published tags via `gh api` | ✅ |
| ci.yml pins | `actions/checkout` + `setup-bun` SHA-pinned; no `id-token` permission | ✅ |
| Tarball: zero `.d.ts.map` | `bun pm pack --dry-run` → 0 matches | ✅ |
| Tarball: `dist/core/**` present | present (ship-not-strip, ADR-0034 amendment) | ✅ |
| Tarball: no secrets | positive scan (`.env*`/`.npmrc`/`*.pem`/`*.key`/…) → 0 matches; no non-dist stray files | ✅ |
| Zero registry-write reachability | only `npm publish --dry-run`; publish.yml never-fireable in this repo state (guard + push-to-main-only + no live trust) | ✅ |
| Engine-gated ledger rows | 74/56/142/175 re-tagged OPEN (not closed) — confirmed | ✅ |

### Coherence (Design rev 3)

| Decision | Followed? | Notes |
|---|---|---|
| ADR-0034 amendment (dist/core ship-not-strip, declarationMap:false) | Yes | tarball ships dist/core, 0 `.d.ts.map` |
| ADR-0041 (link:sdk script, no `prepare`) | Yes | `package.json#scripts.link:sdk`; no lifecycle hook |
| ADR-0042 (guard + SHA pins + job-scoped id-token) | Yes | all three parts in workflows |
| PPH-07/08 placeholder deferred (CQ2) | Yes | zero placeholder artefacts; zero registry writes |
| Zero src/ change | Yes | verified — no `src/` file in diff |

### Drift / Cross-Change

| Item | Status | Notes |
|---|---|---|
| Fitness function `fit-23` (was `fit-21` in design) | Accepted drift | filename collision on `main` (fit-21/22 taken); shipped `fit-23` is content-identical, coverage-identical. design.md rev 3 + ADR-0042 prose still say `fit-21` — **archive drift-sync followup**. |
| Verb/reason vocab count | Accepted drift | docs document 7 verbs / 12 reasons (current `main` after `schematic-local-files`); plan's Executor Context said 6/8. REQ-AOD-03 names 6 as a floor (superset satisfies). Doc content correct; plan prose stale — **archive drift-sync followup**. |
| Architecture impact | additive | `arch_refresh_post_verify` applies — hardened publish posture + tarball shrink (−34 `.d.ts.map`) warrant a baseline refresh at archive. |

### In-Loop History

| Iteration | Verdict | Scope | Notes |
|---|---|---|---|
| 1 | PASS | S-000 | skeleton; known interim fit-14 red left for S-002.3 (sequencing) |
| 2 | PASS | S-002,S-001,S-003 | fit-23 rename accepted; cross-file scratch-consumer bug found+fixed in-loop |
| 3 | PASS | S-004 | reference docs; wire-term ban scoping accepted |
| 4 | PASS | S-005 | planning reconciliation; 2 self-caught test-code bugs, re-RED'd |

### Issues Found
**CRITICAL** (must fix before archive): None.
**WARNING** (should fix): None blocking.
**SUGGESTION / Followups** (for archive to register in `project/pending-changes`):
1. Archive drift-sync: update `design.md` rev 3 + ADR-0042 prose `fit-21` → `fit-23` (filename only; coverage unchanged).
2. Archive drift-sync: reconcile design/slices Executor-Context verb/reason counts (6/8 → 7/12) with the current `main` vocabulary the docs correctly document.
3. Optional test hardening: consider case-insensitive matching for PascalCase wire-type names in `doc-set-content.test.ts`'s ban helper (keep `directive`/`batch` case-sensitive to avoid author-vocab false positives).
4. Reminder (not a followup): REQ-AOD-08 human walkthrough is discharged at steward reckoning — `walkthrough-record.md` must be filled with a real verdict before archive.

### Verdict
**pass-with-followups** — complete, green, stable, sensitive gates verified, code audit clean; the four followups above are non-blocking and archive-owned.
