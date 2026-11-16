# ci-optimization

Objective: cut CI time in project-builder-sdk without letting a change that needs testing skip its tests.
Branch: `chore/ci-optimization` (from origin/main 048cd2c). Delivery: PR per slice. Test runner: `bun test`. Risk: item 5 (CI and delivery).

## Specs

- S1 — Analysis first, no workflow edits until the user decides (L1, L2).
- S2 — Stop running CI twice per commit. Today `ci.yml` triggers on `push` to every branch except main and on `pull_request`, so each PR commit runs the full job twice. Proposed triggers: `pull_request`, `push` to `main`, a nightly `schedule` at 06:00 UTC (`cron: "0 6 * * *"`, L5), and `workflow_dispatch`.
- S3 — Cancel superseded runs: a `concurrency` group per PR with `cancel-in-progress` on pull requests only. Runs on main and scheduled runs are never cancelled.
- S4 — Run test files in parallel inside the one job with `bun test --parallel=<N>` (Bun 1.3.14 runs files in worker processes, isolated). This keeps the single `Run tests` step that `test/pyramid/pyramid-codification.test.ts` (REQ-03) and `test/fitness/fit-23-publish-workflow-guard.test.ts` read. The gain must be measured before adoption, since some suites share `dist/` through `test/support/shared-build.ts`.
- S5 — Deferred by the user (L4). Path gate, fail-closed: CI skips the suite only when every changed file is in an explicit allowlist that no job reads (`odd/**`, `.atl/**`, `.github/ISSUE_TEMPLATE/**`, `.github/PULL_REQUEST_TEMPLATE.md`). Any other path runs everything. A gate job that always runs keeps the required check name `Test, typecheck, build` and passes when the suite passed or was skipped by the gate. Low value today (0 of the last 40 merged PRs would have skipped); kept only if the user wants it.
- S6 — Safety net: the full suite runs on every push to main and nightly at 06:00 UTC, whatever the paths. CodeQL default setup and the publish workflow are untouched.
- S7 — The `rules` job that the `sdk` session adds in its R0 slice joins the gate's `needs`, runs in parallel with the suite, and follows the same path gate. With S5 deferred there is no gate: the `rules` job (R0, #188) sits in the same workflow, so it takes the S2 triggers and the S3 concurrency.
- S8 — R0's review warnings, folded into this PR because they touch `ci.yml` (L7): "the designed pass runs after an install failure (ci.yml:102-104)" and "same-repo runs without the secret (ci.yml:56-63)"; plus the test-side findings in `architecture-checkout.test.ts`: "catalog vacuity :43-57, pin vs checkout :26-30, URL pathname :13".

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1 | inline | done — analysis below | — |
| T2 | S4 | inline, heavy slot | measured, not adopted (L9) | this commit |
| T3 | S2, S3, S6, S7 | inline | done — actionlint clean, fit-23 and pyramid pass | 385fce9 |
| T4 | S5 | inline | deferred (L4) | — |
| T5 | S8 | inline | done — RED seen for the pin check, acceptance self-tests 25/25, actionlint clean | this commit |

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
- L5 (2026-11-14, user via the orchestrator, decision c): "si dale, a las 06:00 UTC". The nightly full run is `schedule: cron: "0 6 * * *"`. All three CI decisions are made; `ci.yml` edits wait for R0 to land, and measuring `bun test --parallel` waits for the heavy slot.
- L6 (2026-11-14, user via the orchestrator): "we're pausing once each session finishes its current slice... Don't start the CI-optimization edits or R1. Leave both feature docs resumable, with the next steps, and then stop." Paused before any `ci.yml` edit. The branch `chore/ci-optimization` (local, not pushed) holds only this document. Next steps on resume: (1) wait for R0 (`feat/architecture-rules-suite`) to merge, then rebase this branch onto main; (2) ask the orchestrator for the heavy slot and measure `bun test --parallel=N` (T2, S4); (3) write T3 (S2 triggers incl. cron "0 6 * * *", S3 concurrency, S6) and S7 (the R0 `rules` job joins the gate) in `ci.yml`, keeping the "Run tests" step name, SHA-pinned actions and the required check "Test, typecheck, build"; (4) one PR after the light fitness checks (fit-23, pyramid).

- L7 (2026-11-16, via the orchestrator): "R0 (#188) is merged, and SDK main is bb50762." Order: "(1) CI optimization on chore/ci-optimization, rebased onto main, with the decisions the user made: triggers: PR, push to main, nightly at cron "0 6 * * *", and dispatch; concurrency cancels in-progress PR runs; no path filter. Then ask me for the slot to measure `bun test --parallel`. (2) Fold R0's review warnings into that same CI PR, since they touch ci.yml: the designed pass runs after an install failure (ci.yml:102-104); same-repo runs without the secret (ci.yml:56-63). Fold the test-side findings in architecture-checkout.test.ts (catalog vacuity :43-57, pin vs checkout :26-30, URL pathname :13) in as well. (3) After that, R1: json and yaml." Rebased onto bb50762. T3 writes S2, S3 and S6 in `ci.yml`; the concurrency group is the PR number, else the ref, and only `pull_request` runs cancel. S7 needs nothing more without a gate.
- L8 (2026-11-16): T5. In the `rules` job, `IS_FORK` becomes `SECRETS_WITHHELD`, which is also true for `github.actor == 'dependabot[bot]'`, since Dependabot runs get no Actions secrets; any other run of this repository without the token still fails. The designed pass now runs only after a successful install (`steps.install.outcome == 'success'`), still even when the self-tests or the strict pass fail. In `architecture-checkout.test.ts`: the project root comes from `join(import.meta.dir, ...)` instead of a URL pathname (which keeps percent-encoding); a new test asserts the checkout's HEAD is the gitlink commit (RED: with the submodule at `HEAD~1` it fails, then passes back at v0.17.0); a floor of 600 catalog phrases (638 at v0.17.0) stops an empty catalog from passing the catalog checks vacuously. Next: ask the orchestrator for the heavy slot to measure `bun test --parallel` (T2, S4), then the full gate and one PR.
- L9 (2026-11-16, heavy slot): S4 measured on the branch head after a build, with every run pinned to 4 cores (`taskset -c 0-3`) to match the 4-vCPU ubuntu-latest runner; this machine has 16. Serial `bun test`: 4192 pass, 0 fail, 199 s. `--parallel=4`: 117 s, 4111 pass, 18 fail. `--parallel=2`: 157 s, 4185 pass, 1 fail. Wall times are indicative only: another session's `bun test` and a short engine run overlapped them. The failures are structural, not flaky: several test files call `bun run build` through `test/support/shared-build.ts` and the codegen guards, and the build starts with `rm -rf dist`, so a second worker process deletes the first one's `dist/` mid-run (here `build:manifest` failed with "closure file could not be read"). `shared-build.ts` documents that the suite keeps one shared real `dist/` on purpose and holds a per-process lock, so worker processes collide by design. Adopting `--parallel` needs that fixture redesigned (one build before the workers start, read-only after it), which is outside this slice. `Run tests` stays serial. S2 and S3 still cut CI minutes by about half.
