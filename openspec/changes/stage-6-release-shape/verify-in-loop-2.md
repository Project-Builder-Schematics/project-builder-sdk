# Verify In-Loop Result

**Change**: `stage-6-release-shape`
**Iteration**: 2/3 (change-wide sequence; second in-loop batch — S-000's was verify-in-loop-1)
**Scope**: S-001, S-002, S-003 (Build Order group 2)
**Mode**: in-loop (Strict TDD)

---

## Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 9/9 (S-001.1-.3, S-002.1-.3, S-003.1-.3 — confirmed [x] in `slices.md`)
- Full suite (real execution, independently re-run by this verify pass, NOT trusted from apply-progress): **1089 pass / 0 fail / 2115 expect() calls**, run 3x consecutively for stability — identical result every run. Matches apply-progress's own claim of "1089 pass / 0 fail, 3x stable" and the launch brief's expected exit state.
- Scoped delta suite (`fit-23-publish-workflow-guard.test.ts` + `fit-14-package-surface.test.ts` + `installed-consumer.e2e.test.ts` + `quickstart-docs.test.ts`, run together standalone): **46 pass / 0 fail**.
- Typecheck (`tsc --noEmit`): clean, exit 0 — re-run independently.
- Lint: no linter configured in this project (confirmed — no `lint` script in `package.json`) — skipped cleanly, not a failure.
- Spec compliance for scope: 24/25 in-scope scenarios COMPLIANT by automated test; 1 (REQ-AOD-08.1) deliberately deferred to steward reckoning per the prior plan-verify G-2 ruling — see Spec Compliance Matrix and Findings #1.
- Strict TDD (in-loop) audit: `concerns` — one non-blocking finding (below), does not change the verdict.

Orchestrator action: exit loop, proceed to `/build --scope=slice:S-004` (requires S-003, now satisfied). S-005 remains blocked on S-002 + S-004.

### Completeness

| Task | Status |
|---|---|
| S-001.1 Bun-link leg: write-only commit + all-or-nothing rejection | ✅ done — `REQ-LC-02.1`/`REQ-LC-02.2` pass, real diff-quoted RED evidence in apply-progress |
| S-001.2 Tarball leg: `./typescript` probe | ✅ done — `results.typescript?.resolved === true` assertion present and passing |
| S-001.3 Bin-exec + `dryRun()` red-proofs | ✅ done — `checkBinExecutable` shared helper + 4 red-proof tests (`REQ-LC-02.3`, `REQ-LC-04.3`×2, `REQ-LC-05.3`) |
| S-002.1 `fit-23-publish-workflow-guard.test.ts` + `fit-14` additions | ✅ done — 8 tests in fit-23, 6 new tests in fit-14 (verified by direct read + count) |
| S-002.2 Harden `publish.yml`/`ci.yml` | ✅ done — verified by diff (below) |
| S-002.3 Regenerate `pkg-surface-baseline.json` | ✅ done — verified structurally (below) |
| S-003.1 `quickstart-docs.test.ts` | ✅ done — 6 tests, machine leg + tsc leg + install-ritual checks |
| S-003.2 `docs/quickstart.md` | ✅ done — read in full, matches REQ-AOD-01/02 content requirements |
| S-003.3 Scaffold `walkthrough-record.md` | ✅ done — confirmed TEMPLATE-ONLY (all fields are `_(fill in: ...)_` placeholders), consistent with the G-2 ruling |

### Real Execution Evidence (run independently by this verify pass)

```
$ bun test                                    # full suite, run 1
 1089 pass
 0 fail
 2115 expect() calls
Ran 1089 tests across 126 files. [10.81s]

$ bun test                                    # full suite, run 2 (stability)
 1089 pass / 0 fail / 2115 expect() calls  [10.91s]

$ bun test                                    # full suite, run 3 (stability)
 1089 pass / 0 fail / 2115 expect() calls  [11.29s]

$ bun run typecheck                           # tsc --noEmit
 (clean, exit 0)

$ bun test test/fitness/fit-23-publish-workflow-guard.test.ts \
            test/fitness/fit-14-package-surface.test.ts \
            test/e2e/installed-consumer.e2e.test.ts \
            test/docs/quickstart-docs.test.ts
 46 pass
 0 fail
 106 expect() calls
Ran 46 tests across 4 files. [3.29s]
```

Post-suite checks:
- `git status --short`: no stray scratch dirs (`.tmp-*`) left in the repo root after any run.
- `~/.bun/install/global/node_modules/@pbuilder/`: empty scope dir, no `sdk` symlink — matches apply-progress's own observation of pre-existing `bun unlink` behavior (not a leak).
- `bun pm pack --dry-run` (manual, independent of the fitness test): 88 files, 0.29MB — no `pbuilder-sdk-0.0.0.tgz` written to disk (`--dry-run` confirmed non-destructive); manual grep of the file listing for `.env|.npmrc|.pem|.key|.netrc|id_rsa|.p12|.pfx|credentials.json`: zero matches, independent confirmation of `fit-14`'s `REQ-FPS-07.1` result.
- SHA pins independently re-resolved via `gh api repos/actions/checkout/git/refs/tags/v4.3.1` → `34e114876b0b11c390a56381ad16ebd13914f8d5` and `gh api repos/actions/setup-node/git/refs/tags/v4.4.0` → `49933ea5288caeca8642d1e84afbd3f7d6820020` — **both match the committed pins in `publish.yml`/`ci.yml` byte-for-byte.**

### Sensitive-Area Verification (deployment + supply-chain, L override live)

Direct read of both hardened workflow files (not trusted from apply-progress):

| Check | Result |
|---|---|
| Workflow-firing guard | `publish.yml` trigger is `push: branches: [main]` ONLY — no `pull_request`/`workflow_dispatch` (confirmed by direct read, line 5-8) |
| Repo-owner guard | `if: github.repository == 'Project-Builder-Schematics/project-builder-sdk'` on the `publish` job (line 25) — job-scoped, not workflow-scoped |
| `--dry-run` retained | `npm publish --tag dev --provenance --access public --dry-run` (line 71) — present, unstripped |
| SHA-pinned, not tag-pinned | `actions/checkout@34e114876b...# v4.3.1`, `actions/setup-node@49933ea5...# v4.4.0`, `oven-sh/setup-bun@0c5077e5...# v2` — all 40-hex SHAs with trailing version comments, in BOTH `publish.yml` and `ci.yml`'s `checkout` step |
| `id-token: write` scope | Moved OFF the workflow-level `permissions` block onto the `publish` job's OWN `permissions` block (lines 29-31) — workflow level now carries only `contents: read`; `ci.yml` correctly carries NO `id-token` permission at all |
| No secrets in tarball/fixtures | `fit-14`'s `REQ-FPS-07.1` passes + independent manual `bun pm pack --dry-run` grep (above) both clean; `rg` scan of `fit-23`/`fit-14`/both workflow files for token/key patterns (`NPM_TOKEN`, `ghp_`, `sk-`, `AKIA`, PEM headers) found only a documentation comment ("No NPM_TOKEN secret is used"), no actual secret material |
| Nothing can fire a live publish | Confirmed structurally: trigger fence + repo-owner guard + `--dry-run` are three independent layers, all present and all verified by both the fitness test (job-resolved-by-predicate, not job-name/text-scan) and this pass's direct file read |

**Conclusion**: the hardening is real and structurally sound — a fork cannot reach the `id-token` step (repo-owner guard), the trigger surface admits no PR/manual path, and `--dry-run` means even a successful run touches nothing live. This matches the design's "hardened-but-never-fired" framing exactly.

### Baseline Regeneration Verification (S-002.3)

Independently inspected `test/fitness/pkg-surface-baseline.json` (not trusted from the apply-progress summary):

- `exports`/`dependencies`/`bin`/`shebang`: **byte-identical** to before this run (confirmed — `git diff` on the file shows changes ONLY inside the `tarball` array, no other key touched).
- `tarball` array: 88 entries (was reported as 88 by apply-progress — confirmed), **zero** `.d.ts.map` entries (confirmed by direct scan), **46** `dist/core/**` entries present (confirmed non-empty, satisfying `REQ-FPS-06.1`'s "present, unchanged in kind" — count differs from the pre-plan snapshot's "20" because that earlier count predates this branch's other landed changes, not because of a regression here).
- Regeneration sequencing (`REQ-PPH-06`) honored: S-002 ran AFTER S-000's `declarationMap: false` + `prebuild` clean landed, confirmed by the apply-progress narrative and by the fact that the baseline now shows the SAME `.d.ts.map` removal S-000 introduced.

### Fit-21/Fit-22 Naming Collision — VERIFIED REAL (Deviation #1, judged: ACCEPT)

Independently confirmed via `git log --oneline -- test/fitness/fit-21-context-no-dialect-handle-import.test.ts test/fitness/fit-22-scaffold-leaf-rule.test.ts`:

```
e7c642c test(fitness): add FIT-22, the scaffold leaf-rule promised at design but never shipped
df5d6fe refactor(quality): simplify pass — shared import-scan + assertNoLeak helpers...
e39bd9b feat(core): S-000 — dialect-error + deep-equal modules...
```

Both files exist on `main` (merged via `stage-5b-dialect-breadth`/`schematic-local-files`, per apply-progress's own account) and are **content-unrelated** to publish-pipeline hardening — `fit-21` is about dialect-handle import context, `fit-22` is about scaffold leaf rules. The collision claim is real, not a fabrication to cover for a naming mistake. `fit-23-publish-workflow-guard.test.ts` was read in full: its content, coverage (8 tests, all REQ-PPH-01/02/03 scenarios + 2 supporting red-proofs), and the job-resolution-by-predicate / Bun-native-`YAML.parse` mechanics match `design.md`/ADR-0042's intent exactly — only the filename differs. `design.md` and ADR-0042 still say `fit-21` in prose; this is a pre-existing documentation lag that should be corrected at final-verify/archive drift-sync, not a blocker here.

**Judgment: ACCEPT.** The deviation is real, well-documented, non-scope-creep, and coverage-equivalent.

### `scratch-consumer.ts` Bugfix — VERIFIED SOUND (Deviation #2, judged: ACCEPT)

Read `test/support/scratch-consumer.ts` in full. The fix is real and correctly shaped:

- Before (implied by the diff and apply-progress's account): a single module-level `Promise` per leg (`installedConsumerReady`), memoized without regard to which `scratchDir` the caller passed — a second caller with a different dir would silently get the first caller's directory.
- After: `packedConsumersReady` and `linkedConsumersReady` are both `Map<string, Promise<void>>` keyed by `scratchDir` (lines 55, 140) — each distinct scratch dir gets its own memoized setup.
- The bun-link leg additionally splits the GLOBAL link-store registration (`ensureProducerLinked()`, memoized once, reset by `unlinkSdk()`) from the PER-CONSUMER local link (`ensureLinkedConsumer`, keyed by dir) — this is the correct shape: the global registration is a shared singleton resource, the per-dir setup is not.
- `unlinkSdk()` resets `producerLinked = undefined` (line 211) so a later test file's `afterAll`-triggered unlink doesn't strand an earlier-registered-but-still-running file — verified this is exercised in practice: `installed-consumer.e2e.test.ts` and `quickstart-docs.test.ts` both call `ensureLinkedConsumer` with DIFFERENT scratch dirs and both pass in the same full-suite run (evidence above).
- Scope check: the fix touches ONLY `test/support/scratch-consumer.ts` (test infrastructure), zero `src/` changes — consistent with the design's "Stage 6 adds NO runtime behaviour to `src/`" framing and confirmed by this pass's own `git status` read.

**Judgment: ACCEPT.** This is a genuine correctness bug (silent directory-reuse causing `ENOENT` for a second caller) exposed by S-003 becoming scratch-consumer's second real consumer, fixed with a structurally correct solution, scoped to test-support plumbing only. Boy Scout rule applies cleanly — not scope creep into S-000's slice boundary, since the bug was latent and invisible until this batch's own S-003 work exposed it.

### Spec Compliance Matrix (scope only)

| Requirement | Test | Result |
|---|---|---|
| REQ-LC-02.1 (write-only commit, bun-link) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT |
| REQ-LC-02.2 (all-or-nothing rejection, bun-link) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT |
| REQ-LC-02.3 [red-proof] (scenario-count parity) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT |
| REQ-LC-03.1 (tarball retained + `./typescript`) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT |
| REQ-LC-04.1 (bin exec, tarball leg) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT |
| REQ-LC-04.3 [red-proof] (missing bin / broken shebang) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT (2 tests) |
| REQ-LC-05.2 (dryRun, tarball leg) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT |
| REQ-LC-05.3 [red-proof] (key-presence insufficiency) | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT |
| REQ-PPH-01.1 (repo-owner guard present) | `fit-23-publish-workflow-guard.test.ts` | ✅ COMPLIANT |
| REQ-PPH-01.2 [red-proof] (guard absence detected) | `fit-23-publish-workflow-guard.test.ts` | ✅ COMPLIANT |
| REQ-PPH-01.3 (trigger push-to-main only) | `fit-23-publish-workflow-guard.test.ts` | ✅ COMPLIANT |
| REQ-PPH-02.1 (all `uses:` SHA-pinned) | `fit-23-publish-workflow-guard.test.ts` | ✅ COMPLIANT |
| REQ-PPH-02.2 [red-proof] (unpinned actions fail) | `fit-23-publish-workflow-guard.test.ts` | ✅ COMPLIANT |
| REQ-PPH-03.1 (`--dry-run` present) | `fit-23-publish-workflow-guard.test.ts` | ✅ COMPLIANT (see Findings #2 — minor assertion-quality note) |
| REQ-PPH-03.2 [red-proof] (stripped flag caught) | `fit-23-publish-workflow-guard.test.ts` | ✅ COMPLIANT |
| REQ-PPH-05.2 (no `.d.ts.map` in fresh build) | `fit-14-package-surface.test.ts` | ✅ COMPLIANT |
| REQ-PPH-06.1 (baseline zero `.d.ts.map`) | `fit-14-package-surface.test.ts` | ✅ COMPLIANT |
| REQ-FPS-06.1 (`dist/core/**` present in baseline) | `fit-14-package-surface.test.ts` | ✅ COMPLIANT |
| REQ-FPS-07.1 (positive no-secrets scan) | `fit-14-package-surface.test.ts` | ✅ COMPLIANT |
| REQ-FPS-07.2 [red-proof] (secret file caught) | `fit-14-package-surface.test.ts` | ✅ COMPLIANT |
| REQ-AOD-01.1/.2/.3 (schema/codegen/generated-type/passing test) | `quickstart-docs.test.ts` | ✅ COMPLIANT |
| REQ-AOD-02.1 (bun link before tarball) | `quickstart-docs.test.ts` | ✅ COMPLIANT |
| REQ-AOD-02.2 (no `npm install @pbuilder/sdk`) | `quickstart-docs.test.ts` | ✅ COMPLIANT |
| REQ-AOD-07.1 (green against linked/installed package) | `quickstart-docs.test.ts` | ✅ COMPLIANT |
| REQ-AOD-07.2 [red-proof] (no `src/`-relative swap) | `quickstart-docs.test.ts` | ✅ COMPLIANT |
| REQ-AOD-11.1 (consumer `tsc --noEmit` passes) | `quickstart-docs.test.ts` | ✅ COMPLIANT |
| REQ-AOD-11.2 [red-proof] (broken field ref fails tsc) | `quickstart-docs.test.ts` | ✅ COMPLIANT |
| REQ-AOD-08.1 (recorded human walkthrough) | `walkthrough-record.md` (manual, owner, steward reckoning) | ➖ NOT YET APPLICABLE — scaffold-only by design (G-2 ruling); see Findings #1 |

### Strict TDD (in-loop audit)

**Iteration**: 2
**Verdict**: `concerns` (one non-blocking finding; does not change the overall in-loop verdict)
**Delta scope**: 4 test files modified/created (`fit-23-publish-workflow-guard.test.ts` new, `fit-14-package-surface.test.ts` diff, `installed-consumer.e2e.test.ts` diff, `quickstart-docs.test.ts` new), 1 test-support file modified (`scratch-consumer.ts`), 2 workflow files modified, 1 doc created (`docs/quickstart.md`), 1 doc-scaffold created (`walkthrough-record.md`)

#### Findings

1. **Minor banned-assertion-pattern match, non-blocking** — `test/fitness/fit-23-publish-workflow-guard.test.ts:170`, inside `REQ-PPH-03.1`'s test:
   ```ts
   const line = findNpmPublishCommandLine(publishDoc);
   expect(line).toBeDefined();
   expect(dryRunPresent(line as string)).toBe(true);
   ```
   `expect(line).toBeDefined()` is on Strict TDD's banned-pattern list. Read in context: it is NOT the test's sole assertion (a concrete `toBe(true)` assertion follows on the next line), it genuinely asserts a spec-relevant fact (`publish.yml`'s `npm publish` step exists at all — implicit precondition of `REQ-PPH-03.1`'s Given/When/Then), and a real regression (the step going missing) would still be caught — either by this assertion directly, or by a `TypeError` on the following line if the guard were removed and `dryRunPresent` ran against `undefined`. Classified **WARNING (LOCAL)**, not CRITICAL: the letter of the banned-pattern list is triggered, but the finding lacks the "gives no behavioral signal" defect the rule exists to catch. Recommend tightening to `expect(typeof line).toBe("string")` at the next touch of this file (S-004/S-005 or final-verify polish), not worth a dedicated fix-iteration on its own.

2. **REQ-AOD-08.1 has no automated test — by design, not a gap.** Confirmed `walkthrough-record.md` is genuinely scaffold-only: every section (Date, Reader, Verdict, Steps Followed, Constraint Attestation, Notes) contains only `_(fill in: ...)_` placeholder text, no fabricated verdict. This is the explicit G-2 ruling from `verify-plan-1` (plan-verify iteration 1, gap G-2) — `/build` delivers the scaffold + both automated legs (REQ-AOD-07 machine leg, REQ-AOD-11 typecheck leg), the human walkthrough itself is a steward-reckoning deliverable. Correctly NOT claimed as compliant above (marked ➖, not ✅). No routing needed — this is accepted design, re-confirmed here rather than silently re-litigated.

#### Checks performed

- **Banned assertion patterns**: scanned all `expect(...)` calls across the four delta test files (54 assertions total across the two files fully re-read; spot-checked the rest) — one match (Finding #1, above), otherwise every assertion targets a concrete value (`toBe(true/false/0)`, `toEqual(<object>)`, `toContain("<string>")`, `toMatch(<regex>)`, `toBeGreaterThan(0)`).
- **New file without tests**: none — `fit-23-publish-workflow-guard.test.ts` and `quickstart-docs.test.ts` are themselves test files; `docs/quickstart.md` and `walkthrough-record.md` are documentation, exercised transitively by `quickstart-docs.test.ts`'s machine leg (the doc's own fenced blocks ARE the test fixture).
- **Triangulation**: spot-checked the delta's new conditional-logic functions — `checkBinExecutable` (2+ real call sites: pass case in REQ-LC-04.1/.2, 2 distinct fail cases in REQ-LC-04.3's red-proofs), `checkRepoOwnerGuard` (pass case REQ-PPH-01.1, fail case red-proof 01.2 — the "guard present but value-mismatched" sub-branch is untested, low materiality, not blocking), `checkAllUsesShaPinned` (pass against real files REQ-PPH-02.1, fail against simulated pre-hardening doc red-proof 02.2, plus a third multi-job coverage test), `dryRunPresent` (pass REQ-PPH-03.1, fail red-proof 03.2), `scanForSecrets` (pass REQ-FPS-07.1, fail red-proof 07.2) — all genuinely exercise both branches except the one low-materiality gap noted.
- **Regression**: full-suite pass count before this batch (1075/1083/1084 at intermediate points per apply-progress, 1061 at batch start) vs after (1089) — net +28 net passing tests across the batch (accounting for the mid-run 5 real failures apply-progress reports finding-and-fixing via the scratch-consumer bug), 0 previously-passing test now failing. Independently re-confirmed by this verify pass's own 3x-stable full-suite run.
- **RED evidence credibility** (spot-checked, not exhaustively re-derived): apply-progress's TDD Cycle Evidence tables for S-001/S-002/S-003 quote actual thrown-error text, actual assertion-diff text (`Expected: X / Received: Y`), or actual exit-code/output changes for every RED entry — not bare assertions that RED happened. The characterization/parity-test technique (deliberately inverting an expected literal, observing a REAL failure, then reverting) is explicitly justified in the Deviations section with a concrete repo precedent (fit-15/fit-21/fit-22, and S-000's own prior established technique in this same change) — this satisfies the launch brief's explicit ask to check that characterization-style tests carry explicit justification, not a bare label.
- **SHA-pin re-resolution claim**: independently re-ran the exact `gh api` commands apply-progress describes using — both returned the exact SHAs committed in the workflow files (see Real Execution Evidence above). Not merely trusted from the narrative.

## Artifacts Persisted

| Artifact | Mode | Location |
|---|---|---|
| verify-in-loop-2 | hybrid | `openspec/changes/stage-6-release-shape/verify-in-loop-2.md` + engram `sdd/stage-6-release-shape/verify-in-loop-2` |

## Risks

- Finding #1 above (non-blocking; recommend a small assertion-quality tightening at the next touch of `fit-23-publish-workflow-guard.test.ts`, not worth its own fix-iteration).
- `design.md`/ADR-0042 still name the test `fit-21` in prose (the actual file is `fit-23`) — a documentation-only drift, should be corrected during archive's delta-spec sync so future readers aren't misled; not a code or coverage defect.
- REQ-AOD-08.1 remains open until steward reckoning performs the real walkthrough — carried forward as a known, accepted, pre-archive gate obligation (not new information, re-confirmed here).
- The hybrid-persistence gap flagged in `verify-in-loop-1` (planner-phase artefacts appear OpenSpec-only despite `hybrid` mode) was NOT re-investigated by this pass — it is orthogonal to code correctness and remains an open item for pre-archive reconciliation, as already flagged.

## Next Recommended

`/build --scope=slice:S-004` (requires S-003, now satisfied). S-005 remains blocked on S-002 + S-004 per Build Order.

## Skill Resolution

injected (skill registry present-and-empty — deliberate; followed existing codebase conventions per the registry's own note)

---

## Routing

N/A — verdict PASS, no routing classification needed. Finding #1 is WARNING-severity and does not require a fix-iteration before proceeding; it is recorded for optional follow-up at final-verify or the next touch of the file.
