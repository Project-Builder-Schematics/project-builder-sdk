# ci-optimization

Objective: cut CI time in project-builder-sdk without letting a change that needs testing skip its tests.
Branch: `chore/ci-optimization` (from origin/main 048cd2c). Delivery: PR per slice. Test runner: `bun test`. Risk: item 5 (CI and delivery).

## Specs

- S1 — Analysis first, no workflow edits until the user decides (L1, L2).
- S2 — Stop running CI twice per commit. Today `ci.yml` triggers on `push` to every branch except main and on `pull_request`, so each PR commit runs the full job twice. Proposed triggers: `pull_request`, `push` to `main`, a nightly `schedule`, and `workflow_dispatch`.
- S3 — Cancel superseded runs: a `concurrency` group per PR with `cancel-in-progress` on pull requests only. Runs on main and scheduled runs are never cancelled.
- S4 — Run test files in parallel inside the one job with `bun test --parallel=<N>` (Bun 1.3.14 runs files in worker processes, isolated). This keeps the single `Run tests` step that `test/pyramid/pyramid-codification.test.ts` (REQ-03) and `test/fitness/fit-23-publish-workflow-guard.test.ts` read. The gain must be measured before adoption, since some suites share `dist/` through `test/support/shared-build.ts`.
- S5 — Deferred by the user (L4). Path gate, fail-closed: CI skips the suite only when every changed file is in an explicit allowlist that no job reads (`odd/**`, `.atl/**`, `.github/ISSUE_TEMPLATE/**`, `.github/PULL_REQUEST_TEMPLATE.md`). Any other path runs everything. A gate job that always runs keeps the required check name `Test, typecheck, build` and passes when the suite passed or was skipped by the gate. Low value today (0 of the last 40 merged PRs would have skipped); kept only if the user wants it.
- S6 — Safety net: the full suite runs on every push to main and nightly, whatever the paths. CodeQL default setup and the publish workflow are untouched.
- S7 — The `rules` job that the `sdk` session adds in its R0 slice joins the gate's `needs`, runs in parallel with the suite, and follows the same path gate.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1 | inline | done — analysis below | — |
| T2 | S4 | inline, heavy run needs the slot | pending — measure `--parallel` locally and on a draft PR | — |
| T3 | S2, S3, S6 | inline | pending the user's decision and R0 ordering | — |
| T4 | S5, S7 | inline | S5 deferred (L4); S7 waits for R0 | — |

Route evidence: one understood change per slice, no writer trigger.

## Analysis (2026-11-13, origin/main 048cd2c)

### Workflows and checks

| Workflow | Trigger | Job | What it runs | Avg duration |
|----------|---------|-----|--------------|--------------|
| `ci.yml` | `push` (all branches but main), `pull_request` | `Test, typecheck, build` (one job, no matrix) | install, build, `bun test`, `tsc --noEmit` | 246 s on pull_request, 243 s on push (17 runs each) |
| `publish.yml` | `workflow_dispatch` on main | `publish` (environment `npm`) | install, build, `bun test`, typecheck, validate-release, `npm publish` | 255 s (4 runs) |
| CodeQL default setup (no file) | PRs, main, weekly | `CodeQL` | actions and JS/TS analysis | 93 s (31 runs) |
| CodeQL Code Quality (no file) | dynamic | `Code Quality` | quality analysis | 68 s (31 runs) |

Required status check on main: `Test, typecheck, build`, with `strict: true` (the branch must be up to date). No other check is required. No snyk workflow exists.

Sample: the last 100 workflow runs (since 2026-10-28). All 17 CI commit SHAs in it ran twice, once per trigger.

### Where the minutes go

In one CI run (43401983757) the step times were: tests 228 s, build 2 s, setup-bun 2 s, typecheck 1 s, checkout 1 s, install under 1 s. Caching install or build output would save nothing.

The test step by folder:

| Folder | Seconds |
|--------|---------|
| `test/dialects/typescript` | 69 |
| `test/conformance` | 44 |
| `test/fitness` | 34 |
| `test/dialects/react` | 25 |
| `test/dialects/angular` | 15 |
| `test/e2e` | 13 |
| everything else | 21 |

Slowest files: `ops-name-validation` 24 s, `ops-addArrayElement` 17 s, `fit-42-runner-closure-integrity` 15 s and its negative twin 10 s, `yaml-conformance` 15 s, `ast-library` 12 s.

### What each job reads

`bun test` reads far more than code. Besides `src/`, `bin/`, `test/`, `scripts/`, `conformance/`, `schemas/` and `tools/verdaccio`, the tests read `package.json`, `bun.lock`, the tsconfigs, `.npmrc`, `.gitattributes`, `.gitignore`, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `ROADMAP.md`, `docs/**` (including `docs/adr/`), every root `*.md` (`fit-raw-sweep`), `.github/workflows/ci.yml` (`pyramid-codification`, `fit-23`), `.github/workflows/publish.yml` (`fit-23`, `manual-publish`, `security-authoring-guard`) and `git ls-files` (`fit-26`). So a docs-only PR still needs the suite: the doc tests pin doc content.

Paths no job reads: `odd/**` (cited in comments only), `.atl/**`, `.github/ISSUE_TEMPLATE/**`, `.github/PULL_REQUEST_TEMPLATE.md`. Of the last 40 merged PRs, none touched only those paths.

Typecheck reads `src/`, `test/`, `bin/`, `scripts/`, `conformance/` and the tsconfigs. Build reads `src/`, `bin/`, `scripts/` and `tsconfig.build.json`. Both take a few seconds, so gating them separately gains nothing.

### Options weighed

- Duplicate triggers (S2). Halves CI minutes at once. Cost: a branch pushed without a PR gets no CI until a PR is opened, unless someone runs it by hand.
- `paths`/`paths-ignore` on the trigger versus a changes job. A trigger filter never creates the run, so the required check stays pending and blocks the merge. A changes job plus an always-running gate keeps the required check reporting. The gate is the only safe form here.
- `dorny/paths-filter` versus a short `git diff --name-only` step. The diff step avoids a new third-party action (`fit-23` requires every `uses:` to be SHA-pinned).
- `bun test --changed` (import-graph selection). Not safe as a gate: it misses tests that read files with `readFileSync` (docs, workflows, package.json) and the fitness scans of the whole tree.
- `--parallel=N` versus a sharded matrix. Sharding by folder (typescript dialect plus e2e, conformance plus react, the rest) would bring wall time near 100 s but adds about 15 s of setup per shard and needs `pyramid-codification` REQ-03 rewritten. `--parallel` keeps one job and one step. Measure it first.
- Concurrency (S3). Saves the minutes of superseded runs. PRs averaged 2.5 commits in the sample.

### Expected savings

- S2: about 50 % of CI minutes (in the sample, 69 of 139 minutes were the push duplicate). Adds one run per merge to main and one nightly run.
- S3: the superseded runs on PRs pushed more than once. Depends on how often commits are pushed in quick succession.
- S4: unknown until measured. GitHub's public Linux runners have 4 vCPUs; a 2 to 3 times faster test step would bring the job from about 245 s to between 90 and 130 s.
- S5: close to zero today.

## Log

- L1 (2026-11-13, user via the orchestrator): "necesito que optimice el CI para mejorar tiempos, que no se corra lo que no se toco o no es necesario"
- L2 (2026-11-13, orchestrator): analyse and propose first; no `ci.yml` edits until the order with the `sdk` session's R0 slice (its `rules` job) is agreed. Heavy runs need the machine slot.
- L3 (2026-11-13, user via the orchestrator, decision a): "Si dale". A branch pushed without a PR gets no automatic CI; `workflow_dispatch` stays available to run it by hand. S2 stands as written. Decisions b (path gate) and c (nightly run) are pending; edits wait for them and for R0.
- L4 (2026-11-14, user via the orchestrator, decision b): "Si me parece". No path gate for now; revisit it later inside R0's gate job, for docs-only PRs. Note for that revisit: the doc tests (`test/docs/*`, `fit-raw-sweep`, `pyramid-codification`) read `docs/**` and the root `*.md`, so a docs-only PR can still break the suite. A docs gate would have to run at least those tests. Decision c (nightly run and time) is pending; edits wait for it and for R0.
