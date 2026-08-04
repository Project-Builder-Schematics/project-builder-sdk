# Apply Progress: Runner Tripwire Invariants

## Slice: S-000 — Walking Skeleton, Publish path proves what it ships

**Status**: complete. Covers REQ-PPI-01, REQ-PPI-02, REQ-PPI-03 (S-000 leg), REQ-PPI-04,
REQ-PPI-05 — 22 signed scenarios' worth of behaviour realised as 11 new tests (11/11 of
S-000's own Test Derivation row count: PPI-01 x2, PPI-02 x2, PPI-03 x1 structural + x2
behavioural, PPI-04 x2, PPI-05 x2).

### Scenarios covered, red → green evidence

| REQ-ID | Scenario | Test | Red evidence | Green evidence |
|---|---|---|---|---|
| REQ-PPI-05.1 | execution order read, not textual position | `fit-23-*.test.ts` "an order-irrelevant step... does not disturb their relative order" | n/a (positive path, already true of the array-order filter) | pass |
| REQ-PPI-05.2 [red-proof] | textual/execution divergence caught | `fit-23-*.test.ts` "a step reordered only in execution (via `needs:`), not text, is caught" | Failed against the old declaration-order `publishRunSteps`: expected `["stamp","publish","build"]`, received `["build","stamp","publish"]` | Passes after `publishRunSteps` was rewritten to topologically order jobs by `needs:` (new `topologicalJobOrder`), preserving within-job step position |
| REQ-PPI-02.1 | rebuild step present + positioned | `fit-23-*.test.ts` "publish.yml declares an explicit rebuild step..." | `ReferenceError: checkExplicitRebuildStep is not defined` (function didn't exist), then `{ok:false}` against the un-hardened `publish.yml` | Passes once `checkExplicitRebuildStep` was added and `publish.yml` gained the explicit "Rebuild after version stamp" step |
| REQ-PPI-02.2 [red-proof] | absence caught | `fit-23-*.test.ts` "a simulated workflow with the stamp immediately followed by publish... is caught" | Same `ReferenceError` as above during the RED phase | Passes: `{ok:false, reason:"no explicit rebuild step declared between the version stamp and the publish step"}` |
| REQ-PPI-03.1 | suite gates publish (structural) | `fit-23-*.test.ts` "publish.yml declares a `bun test` step strictly before the publish step..." | `ReferenceError: checkSuiteGate is not defined`, then `{ok:false}` (no suite step in publish.yml) | Passes once `checkSuiteGate` was added and `publish.yml` gained the "Run test suite" step (`bun test`, no `continue-on-error`) before publish |
| REQ-PPI-03.2 [red-proof] | violating closure never reaches publish (S9, S-000 leg: any suite-check failure) | `fit-46-*.test.ts` "a failing suite check blocks the publish step — no publish-step log line ever appears" | Manually inverted the assertion (`expect(publishReached).toBe(true)`) to confirm the mechanism genuinely blocks: failed with `Expected: true, Received: false` | Passes with the correct assertion (`publishReached === false`, `log === []`) restored |
| REQ-PPI-03.3 | clean closure reaches publish — sibling positive | `fit-46-*.test.ts` "a clean closure reaches the publish step — sibling positive" | n/a (positive path; validated by construction against the same harness that failed correctly above) | pass |
| REQ-PPI-04.1 | per-file timeout declared | `fit-23-*.test.ts` "react-conformance.test.ts calls setDefaultTimeout with a value distinct from Bun's 5000ms default" (structural) | `expect(match).not.toBeNull()` failed — `react-conformance.test.ts` declared no timeout | Passes once `setDefaultTimeout(20000)` was added to `react-conformance.test.ts` |
| REQ-PPI-04.2 [red-proof] | non-resolving fixture fails at the boundary | `react-conformance.test.ts` "a fixture that never resolves fails at its declared per-file timeout, naming the file" | Manually verified the underlying mechanism first (a scratch fixture with `setDefaultTimeout(300)` and a never-resolving promise): child `bun test` exits 1, output contains `hanging-fixture.test.ts` and "this test timed out after 300ms" | Test passes, asserting exactly that child-process behaviour |
| REQ-PPI-01.1 | packed digests match packed bytes | `fit-46-*.test.ts` "packed digests match packed bytes after the real stamp -> rebuild -> pack sequence" | Manually inverted (`expect(...length).toBeGreaterThan(0)`) — failed with `Received: 0`, proving the normal path is genuinely clean before restoring the correct `toEqual([])` | Passes: 0 mismatched digests across all 24 manifest-recorded files |
| REQ-PPI-01.2 [red-proof] | `--ignore-scripts` (modelled as skip-rebuild) breaks the implicit dependency | `fit-46-*.test.ts` "skipping the rebuild after the stamp leaves the package.json digest stale, naming the field" | Manually inverted (`expect(...).toEqual([])`) — failed with `Received: ["package.json"]`, proving the skip-rebuild path genuinely goes stale before restoring the correct assertion | Passes: exactly `["package.json"]` mismatches, nothing else |

### Key engineering decision: fit-46's "rebuild" step

`slices.md`'s own Build-mechanics note pins the scratch target to `dist/` + `package.json`
only (same shape as `fit-42`'s `pristineRoot`), which makes a literal `tsc` rebuild
impossible inside the scratch tree (no `src/`, no `tsconfig.build.json`, no `node_modules`).
The part of `bun run build` that actually determines REQ-PPI-01's outcome is its LAST step —
`bun scripts/generate-runner-manifest.ts`, which regenerates the manifest against
`dist/` + `package.json` only (no `src/` dependency) — so `fit-46` invokes that script
directly as the "rebuild" leg, exactly reusing `fit-42-runner-closure-integrity.test.ts`'s
own established safe pattern at lines 375-381 (`runGenerator`): `cwd: PROJECT_ROOT` so
`scripts/`/`node_modules` resolve, with the scratch root passed as an explicit CLI argument
so the script only ever WRITES inside that argument path. This is deliberately NOT the R1-12
anti-pattern the same slices.md note warns against (`REQ-BPI-04.1`'s existing test at
`fit-42-runner-closure-integrity.test.ts:151-161`, which passes NO root argument and
therefore mutates the real `dist/` in place). `npm version`/`npm pack` genuinely need
`cwd: <scratchRoot>` (no CLI argument redirects them elsewhere), so those two run there
directly. Verified manually end-to-end (stamp → regenerate → pack → extract → compare) in an
ephemeral `/tmp` scratch dir before writing the test, confirming: `npm pack` writes exactly
the tarball filename to stdout (nothing else); the tarball's `package.json`/manifest
`packageVersion` both reflect the stamp; skipping the regenerate step leaves exactly
`package.json`'s digest stale, nothing else — matching REQ-PPI-01.2's scenario text exactly.

### REQ-PPI-03.2/.3 S-000 leg: gate-mechanism proof

Per `specs/publish-pipeline-hardening/spec.md`'s dated note under REQ-PPI-03.2 and
`slices.md`'s own S-000.4 task text: CAP-01..06 (S-001..S-004) do not exist at S-000 build
time, so this leg proves the MECHANISM only — a failing suite check blocks publish,
structurally, independent of which check fails — using a planted `expect(1).toBe(2)`
failure, never a Constraint-4 fixture. Implemented as a child `bun test <scratchRoot>`
invocation (`cwd: PROJECT_ROOT`, scratch directory as the positional filter argument),
mirroring `test/docs/testing-story-docs.test.ts:69`'s child-process shape (adapted from a
single scratch file to a whole scratch directory — verified empirically that `bun test
<absoluteDirPath>` correctly scopes discovery to that directory). The S-001 leg (re-running
this scenario against a real Constraint-4-violating fixture) is scheduled as S-001.10 per
`slices.md`, not built here.

### Red-proof tag convention

All 5 new `[red-proof]`-tagged tests use the NEW convention ratified in `slices.md`'s
plan-verify final batch (B3): `"REQ-<ID> [red-proof]: <description>"` — REQ-ID first. The 18
S-000-tier survival red-proofs in `fit-42-*.negative.test.ts` are untouched by this slice
(they belong to S-001/S-002) and were not retitled.

### Gate results (full worktree)

- `bun test` (full suite): **2459 pass, 0 fail**, 5497 `expect()` calls, across 202 files, 76.21s.
- `tsc --noEmit`: clean, no errors.
- Lint: no lint tool/config present in this repo (`package.json` has no `lint` script,
  no `.eslintrc*`/`eslint.config*`/`biome.json*` found) — skipped per the task's
  "if configured" instruction.
- `fit-23-publish-workflow-guard.test.ts`: **24/24 pass** — the pre-existing 18/18 baseline
  (`REQ-PPH-*`, `REQ-BPI-03.1`) is unaffected; 6 new S-000 tests added
  (REQ-PPI-05.1/.2, REQ-PPI-02.1/.2, REQ-PPI-03.1, REQ-PPI-04.1).
- `fit-46-publish-sequence-integrity.test.ts` (new): **4/4 pass** (REQ-PPI-01.1/.2,
  REQ-PPI-03.2/.3).
- `test/conformance/react-conformance.test.ts`: **4/4 pass** — 3 pre-existing +
  1 new (REQ-PPI-04.2).

### Files changed

- `.github/workflows/publish.yml` — explicit "Rebuild after version stamp" step (`bun run
  build`) between the version stamp and publish; explicit "Run test suite" step (`bun test`,
  no `continue-on-error`) strictly before publish.
- `test/fitness/fit-23-publish-workflow-guard.test.ts` — `JobDef` gained `needs`/
  `continue-on-error`; `publishRunSteps` rewritten via new `topologicalJobOrder` to read
  execution order (REQ-PPI-05, R1-13); new `checkExplicitRebuildStep` (REQ-PPI-02) and
  `checkSuiteGate` (REQ-PPI-03.1) predicates; 6 new tests.
- `test/conformance/react-conformance.test.ts` — `setDefaultTimeout(20000)` at module scope
  (REQ-PPI-04.1); 1 new red-proof test (REQ-PPI-04.2).
- `test/fitness/fit-46-publish-sequence-integrity.test.ts` (new) — REQ-PPI-01 behavioural
  proof + REQ-PPI-03.2/.3 S-000 leg, 4 tests.
- `openspec/changes/runner-tripwire-invariants/slices.md` — S-000 task checkboxes marked done.

### Commits (branch `feat/tripwire-s000`, based on `main` @ `f7428e8`)

1. `c6012ad` — `feat(publish): harden publish sequencing with explicit rebuild and suite gate`
   (publishRunSteps rewrite, publish.yml hardening, react-conformance timeout declaration —
   REQ-PPI-02, PPI-03.1, PPI-05)
2. `edd66bd` — `test(conformance): red-proof the react-conformance per-file timeout boundary`
   (REQ-PPI-04.2)
3. `3046cd9` — `test(fitness): add FIT-46, behavioural publish-sequence integrity`
   (REQ-PPI-01, REQ-PPI-03.2/.3 S-000 leg)

### Deviations / halts

None. No table growth, no exclusion widening, no scope beyond S-000's REQ-PPI-01..05 set.
`REQ-BPI-03.1`'s existing tests in `fit-23-*.test.ts` were left untouched — they still pass
correctly, and REQ-BPI-03.1 is a `runner-integrity-manifest`-owned REQ, out of S-000's scope.

### Next recommended

Per `slices.md`'s Delivery mechanics: orchestrator opens the S-000 PR (house pattern); the
mechanism branch (S-001..S-005) may base off this branch immediately, without waiting for
merge.
