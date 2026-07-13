## Verify In-Loop Result

**Change**: schematic-local-files
**Iteration**: 1/3
**Scope**: S-000 (walking skeleton — `packageRoot` ceiling + `create({templateFile})` e2e)
**Mode**: in-loop (Strict TDD)
**Branch under review**: `feat/schematic-local-files` — delta = `git diff main...HEAD` (4 commits: `4558bb2`, `3f82bce`, `7b3710b`, `d59069c`)

---

### Verdict: NEEDS_FIX

Scope is functionally correct and REQ-compliant with real execution evidence, but Strict
TDD's triangulation check found untested conditional branches in new delta code, and the
apply-progress artefact makes a git-history claim that the actual commit log contradicts.
Both are Executor-fixable without touching design/spec.

- Tasks in scope complete: 7/7 (verified against actual code, not just checkmarks)
- Affected tests passed: 872/872 (full suite — `bun test`), typecheck clean (`tsc --noEmit`)
- Spec compliance for scope: 7/7 claimed REQ-scenarios COMPLIANT (see matrix)
- Assertion audit: clean (no banned patterns in delta test files)
- Strict TDD triangulation: 1 gap found (CRITICAL, delta code)
- Migration no-op claims (S-000.3): all verified TRUE against live code

#### Issues

| # | Issue | Slice | Severity | File:Line | Detail |
|---|---|---|---|---|---|
| 1 | Triangulation gap: 3 of `readTemplateFile`'s error branches are never exercised by any test | S-000 | CRITICAL | `src/scaffold/index.ts:79-94`, `:128-136` | `readTemplateFile` (new delta file) has 6 conditional branches. Only 3 are tested: no-`packageDir` (e2e "no resolution anchor" case), raw stat-size overage (REQ-FEH-02.2 via `huge.ts.template`), and binary/null-byte content (REQ-FEH-02.1). Untested: (a) ENOENT — `templateFileNotFoundMessage`, lines 79-87; (b) non-ENOENT stat/read failure — `templateFileUnreadableMessage`, lines 88-94; (c) the serialized-only overage path — lines 128-136, reached only when raw stat size is under `BATCH_CAP_BYTES` but `Buffer.byteLength(JSON.stringify(content))` exceeds it (heavy escape-char content). None of these is individually REQ-tagged for S-000, but all three are live, reachable code paths shipped in this iteration — Strict TDD's Triangulation Audit treats an untested branch in delta code as a halt-worthy gap regardless of REQ tagging, and this is a security-flagged domain (`file-escape-hatches` Sensitive Areas table marks REQ-FEH-02 "security (input validation): Yes"). Fix: add a test per branch (a missing `templateFile`, an injected read-failure per the project's own S18 precedent for `source-unreadable` — never chmod-based CI fixtures — and a template whose content is short but escape-heavy enough to fail only the serialized check). If (b)/(c) are judged genuinely out of S-000's acceptance scope, apply-progress should say so explicitly instead of leaving the gap unacknowledged. |
| 2 | apply-progress's TDD evidence table cites git history that contradicts the actual commit log | S-000 | WARNING | `openspec/changes/schematic-local-files/apply-progress.md:65` | The RED-evidence note states: "confirmed via the actual `bun test` run before any S-000 code existed (see commit history: e2e test file predates the `src/core/context.ts`/`src/scaffold/` commits)". The actual `git log` order is the opposite: `4558bb2 feat(context)` (15:04:08) → `3f82bce feat(scaffold)` (15:04:17) → `7b3710b test(scaffold)` (15:04:25) → `d59069c chore(apply-progress)` (15:06:22) — the test commit lands AFTER both implementation commits, ~2 minutes after the first. All four commits landed within a ~2-minute window, consistent with a single end-of-slice batch commit rather than per-cycle commits, so git-history is inherently a weak TDD-adherence signal here (`strict-tdd-verify.md`'s own caveat for projects that don't commit per RED/GREEN cycle) — this is not proof of an anti-TDD pattern. But the specific citation to "commit history" as corroborating evidence is factually wrong and should not stand uncorrected; it undermines the credibility of the rest of the (plausible, but now unverifiable-from-git) RED-evidence claims in that table. Fix: either correct/remove the commit-history citation, or (recommended for future slices) commit the test file before/with the implementation it drives so the claim is actually checkable. |

**Routing**: LOCAL (Executor SDD-light) for both issues — neither requires a design or spec change.
Orchestrator action: re-invoke `/build` targeting S-000 with these two fixes. Iteration 1 of 3 used.

---

### Spec Compliance Matrix (scope: S-000 only)

| Requirement | Test | Result |
|---|---|---|
| REQ-FEH-01.1 | `test/e2e/scaffold.e2e.test.ts` — "renders templateFile content through the create IR, commits, and dry-run tags it 'rendered'" | ✅ COMPLIANT |
| REQ-FEH-02.1 | `test/e2e/scaffold.e2e.test.ts` — null-byte templateFile rejects `invalid-input` | ✅ COMPLIANT |
| REQ-FEH-02.2 | `test/e2e/scaffold.e2e.test.ts` — oversized templateFile rejects `invalid-input` | ✅ COMPLIANT |
| REQ-PRC-02.1 | `test/scaffold/run-boundary.test.ts` — `existsSync` call-count spy, 1-create vs 2-create run | ✅ COMPLIANT (proxy via `create` calls only — `scaffold`/`copyIn` don't exist until S-001/S-003; mechanism verified is run-scoped caching in `defineFactory`, op-agnostic) |
| REQ-PRC-03.1 | `test/scaffold/run-boundary.test.ts` + `test/e2e/scaffold.e2e.test.ts` — missing-ancestor fail-loud, message is package-relative | ✅ COMPLIANT |
| REQ-RBV-06.1 | `test/scaffold/run-boundary.test.ts` + `test/e2e/scaffold.e2e.test.ts` — sentinel `"body-ran"` never surfaces; missing-ancestor rejection wins | ✅ COMPLIANT |
| REQ-DRE-05.3 | `test/e2e/scaffold.e2e.test.ts` — `dryRun()` entry `kind: "rendered"` for `create({templateFile})` | ✅ COMPLIANT |
| REQ-AEC-12 (partial: templateFile fail-loud, missing-ancestor) | as above | ✅ COMPLIANT for the 2 modes S-000 claims (zero-files-after-filter is S-001 scope) |

**Compliance summary**: 8/8 claimed scope items COMPLIANT at the REQ/scenario level. The
CRITICAL finding above is an engineering-quality gap (untested branches) orthogonal to REQ
coverage — no REQ demands those 3 scenarios, but Strict TDD's own triangulation rule does.

---

### Migration Verification (S-000.3 no-op claims)

Independently re-checked against live code, not trusted from apply-progress:

- `test/fake/harness-in-memory-invariant.test.ts`: confirmed — both `defineFactory` call
  sites (lines 121, 139) omit `options` entirely. No-op claim TRUE.
- `test/fitness/fit-12-schema-parity.test.ts` / `bin/pbuilder-codegen.ts`: confirmed —
  `generateSchema`/`checkParity` never call `defineFactory`. No-op claim TRUE.
- `test/fitness/fit-16-reserved-name-scan.test.ts`: confirmed — purely structural
  (`findReservedSibling` + substring scan), never executes a factory. No-op claim TRUE.
- The 5 real-edit sites (2 static fixtures + `canary-no-echo.test.ts` local helper +
  `scratch-dir.ts`'s `scratchDirFactory` covering both `run-boundary-validation.test.ts`
  and `reserved-lifecycle-names.test.ts`) all verified present and seeding
  `collection.json` correctly.
- `test/fake/harness-opted-in.test.ts`'s `isDeclaredOptedInRead` predicate: widened to
  the exact 3-tuple set claimed (`existsSync`/`readFileSync`/`readdirSync`), confirmed by
  reading the predicate and its assertion.

### Build & Test Execution

**Full suite**: ✅ 872 pass / 0 fail / 1581 expect() calls (`bun test`, 8.27s)
**Typecheck**: ✅ clean (`tsc --noEmit`)
**Targeted re-run** (`scaffold.e2e.test.ts`, `run-boundary.test.ts`,
`harness-opted-in.test.ts`, `harness-in-memory-invariant.test.ts`,
`run-boundary-validation.test.ts`, `plan.test.ts`, `dry-run.e2e.test.ts`): ✅ 35 pass / 0
fail, isolated from the full-suite run for a clean signal on the exact delta.

### Assertion Quality Audit (delta test files)

`test/e2e/scaffold.e2e.test.ts`, `test/scaffold/run-boundary.test.ts` scanned for banned
patterns (`toBeDefined`, unqualified `toBeTruthy`/`toBeFalsy`, `objectContaining` as the
whole assertion, `not.toThrow()` alone, mock-mirrors-implementation). None found — every
assertion targets a concrete value (`toEqual`, `toBeInstanceOf`, `toContain`,
`toBeGreaterThan`, exact string/boolean checks). Clean.

### Working tree

Clean except the pre-existing `.sdd/state/schematic-local-files.json` diff (owned by the
orchestrator's apply-phase state mirror, not touched by this verify pass). No `src/`/`test/`
files were modified during this review.

---

Orchestrator action: re-invoke `/build --scope=slice:S-000` (SDD-light) to add the 3 missing
branch tests in `readTemplateFile` and correct the apply-progress TDD-evidence citation, then
re-run `sdd-verify --mode=in-loop --iteration=2 --scope=slice:S-000`.
