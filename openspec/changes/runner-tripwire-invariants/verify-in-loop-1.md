## Verify In-Loop Result

**Change**: runner-tripwire-invariants
**Iteration**: 1/3
**Scope**: S-000
**Mode**: in-loop (Strict TDD)

---

### Verdict: NEEDS_FIX

Scope is close to done — REQ coverage is complete, execution evidence is real, and the
four required red-proofs were independently re-verified as genuine (not narrated). One
concrete Strict TDD triangulation gap in a newly-introduced checker function must be
closed before this loop can exit clean.

### Real execution evidence

- `bun test` (full suite, from worktree root): **2459 pass, 0 fail**, 5497 `expect()`
  calls, 202 files, **74.94s**. Matches apply-progress's own claimed numbers exactly.
- `tsc --noEmit`: clean, 0 errors (0.375s wall — fast because of TS incremental/module
  caching; no output at all, including no warnings).
- Isolated runs (independent of the full-suite run above, to confirm no cross-file
  leakage/ordering masking a failure):
  - `test/fitness/fit-23-publish-workflow-guard.test.ts`: **24 pass, 0 fail**, 38
    `expect()` calls, 87ms.
  - `test/fitness/fit-46-publish-sequence-integrity.test.ts`: **4 pass, 0 fail**, 7
    `expect()` calls, 2.16s.
  - `test/conformance/react-conformance.test.ts`: **4 pass, 0 fail**, 7 `expect()`
    calls, 6.21s.
  - All three match apply-progress's per-file claims exactly.

### Red-proof genuineness audit (real execution, not narrative trust)

| Scenario | Method | Result |
|---|---|---|
| REQ-PPI-01.1 / REQ-PPI-01.2 | Built an inverted scratch copy of `fit-46-publish-sequence-integrity.test.ts` (swapped `regenerateManifestAfterStamp: true`↔`false` between the two test bodies), ran it via `bun test` from inside `test/fitness/` (temp file, deleted after; `git status --porcelain` confirmed clean before and after), then deleted the scratch copy | **Both flipped to failing for the right reason**: PPI-01.1 (now skipping regen) failed with a real `package.json` digest mismatch; PPI-01.2 (now regenerating) failed with an empty mismatch list where `["package.json"]` was expected. Confirms the assertions are governed by real production behaviour in both directions, not vacuous in either. |
| REQ-PPI-02.2 | `git show c6012ad^:test/fitness/fit-23-publish-workflow-guard.test.ts \| rg checkExplicitRebuildStep` → no match | `checkExplicitRebuildStep` did not exist before this slice's commit — the RED state is structural (`ReferenceError`) and the GREEN state is the real logic reachable only from this commit; the logic itself was traced by hand (stamp/publish index search, slice-between check) and matches the assertion exactly. Genuine. |
| REQ-PPI-05.2 | `git diff c6012ad^ c6012ad -- test/fitness/fit-23-publish-workflow-guard.test.ts` on `publishRunSteps` | Pre-fix `publishRunSteps` iterated `Object.values(doc.jobs ?? {})` in raw declaration order (no `needs:` awareness). Traced the PPI-05.2 fixture (`rebuild-job` declared first, `needs: publish-job`) through the OLD implementation by hand: declaration order → `[build, stamp, publish]`, which does NOT match the test's expected `["stamp","publish","build"]` — the pre-fix code fails this test for the right reason. Genuine. |
| REQ-PPI-04.2 | Read (spawns a real child `bun test` against a hand-written fixture with `setDefaultTimeout(300)` and a never-resolving promise; asserts exit code ≠ 0 and stdout/stderr contain the file name + "timed out") | Mechanism is real (a live child process, not a mock); assertions target concrete substrings from genuine subprocess output. Not independently re-run (would duplicate apply-progress's own documented manual verification), but the mechanism and assertion shape are sound — no banned pattern, no vacuity risk. |

### Deviation audit: fit-46's "rebuild" leg (`cwd: PROJECT_ROOT` vs the Build-mechanics note's `cwd: <scratchRoot>`)

**Verdict: ACCEPTABLE deviation — faithful to REQ-PPI-01's intent, not the R1-12
anti-pattern — with one WARNING on apply-progress's own self-report (see Issues).**

Evidence:

1. **The literal deviation is real.** `slices.md`'s Build-mechanics note (S-000 section,
   "plan-verify final batch") states: "every `spawnSync` in the test (version stamp,
   `bun run build`, `npm pack`) passes `cwd: <scratchRoot>`, never `cwd: PROJECT_ROOT`."
   `regenerateManifest()` in `fit-46-publish-sequence-integrity.test.ts:74-82` spawns
   `bun scripts/generate-runner-manifest.ts <scratchRoot>` with `cwd: PROJECT_ROOT` — this
   does not match the note's text.
2. **The literal reading is technically impossible.** The scratch target is seeded with
   only `dist/` + `package.json` (`seedScratchTarget`, mirroring `fit-42`'s own
   `pristineRoot` shape) — no `src/`, `tsconfig.build.json`, or `node_modules`. A literal
   `bun run build` (`tsc -p tsconfig.build.json && bun run build:codegen && bun run
   build:manifest`, per `package.json:75-77`) cannot execute with `cwd: <scratchRoot>` —
   `tsc` has nothing to compile and `node_modules` isn't there to resolve. The
   Build-mechanics note's literal instruction is infeasible for this leg specifically,
   independent of what the Executor chose to do.
3. **The substituted step is confined to the scratch path, not `cwd`.** Read
   `scripts/generate-runner-manifest.ts:27-29`: `packageRoot = process.argv[2] ?? ...` —
   when called with an explicit positional argument, every read (`package.json`,
   `deriveRunnerClosure(distRoot, ...)`) and the one write (`writeFileSync(manifestPath,
   ...)`) resolve against that argument, never against `cwd`. `cwd: PROJECT_ROOT` exists
   only so `scripts/generate-runner-manifest.ts` and its imports/`node_modules` resolve —
   it plays no role in what gets read or written. Verified directly against the script
   source, not inferred.
4. **This is the exact, already-audited safe pattern, not the anti-pattern.** `fit-42-
   runner-closure-integrity.test.ts:375-381`'s own `runGenerator` calls the identical
   script the identical way (`cwd: PROJECT_ROOT`, scratch root as explicit CLI arg) and is
   the established, trusted device other REQs already depend on. The REAL anti-pattern
   (R1-12) is at `fit-42-runner-closure-integrity.test.ts:151-161` — the SAME script called
   with **no** positional argument, which makes `packageRoot` default to the real project
   root and mutates the real `dist/runner-manifest.json` mid-suite. `fit-46` always passes
   the scratch root explicitly; it never falls into that default. Confirmed by reading both
   call sites side by side.
5. **The proof's substance survives.** REQ-PPI-01's claim is about the manifest's
   `package.json` digest going stale when the post-stamp regeneration step is skipped. The
   digest that goes stale is a function of `package.json`'s bytes at the time the manifest
   generator runs — not of whether `tsc`/`build:codegen` also reran. Since the scratch
   scenario never touches source files, `dist/*.js` bytes are identical whether or not
   `tsc` reruns, so skipping it changes nothing the digest proof depends on. Confirmed this
   isn't merely assumed: the empirical inversion test above (REQ-PPI-01.1/.2 both flip to
   failing when the flag is inverted) demonstrates the mechanism is genuinely sensitive to
   exactly the thing REQ-PPI-01 claims it is.

Residual, non-blocking note (SUGGESTION, not a defect): if a future build step ever made
`dist/*.js` bytes depend on the stamped version (they don't today), this narrower
"regenerate manifest only" proof would not catch a resulting staleness — the manifest
would be regenerated from stale-but-internally-consistent bytes and no mismatch would
surface. This is a latent property of the chosen shortcut, not a live gap; flagging for
awareness only.

### REQ coverage matrix (all 11 S-000-scoped scenarios)

| REQ-ID | Scenario | Test | File:Line | Assertion strength |
|---|---|---|---|---|
| REQ-PPI-01.1 | packed digests match packed bytes | "packed digests match..." | `test/fitness/fit-46-publish-sequence-integrity.test.ts:132` | Exact (`toEqual([])`) — matches scenario |
| REQ-PPI-01.2 [red-proof] | `--ignore-scripts` (modelled) breaks the dependency | "skipping the rebuild..." | `test/fitness/fit-46-publish-sequence-integrity.test.ts:143` | Exact, names the field (`toEqual(["package.json"])`) — matches scenario |
| REQ-PPI-02.1 | rebuild step present + positioned | "publish.yml declares an explicit rebuild step..." | `test/fitness/fit-23-publish-workflow-guard.test.ts:516` | Exact (`toEqual({ ok: true })`) — matches scenario |
| REQ-PPI-02.2 [red-proof] | absence caught | "a simulated workflow with the stamp immediately followed by publish..." | `test/fitness/fit-23-publish-workflow-guard.test.ts:522` | Exact reason string — matches scenario |
| REQ-PPI-03.1 | suite gates publish (structural) | "publish.yml declares a `bun test` step..." | `test/fitness/fit-23-publish-workflow-guard.test.ts:539` | Exact, but see Issues below (checker function undertested on its own failure branches) |
| REQ-PPI-03.2 [red-proof] (S-000 leg) | violating closure never reaches publish | "a failing suite check blocks the publish step..." | `test/fitness/fit-46-publish-sequence-integrity.test.ts:179` | Exact, real child-process behaviour — matches scenario, and matches the S-000-leg constraint (generic planted failure, not a Constraint-4 fixture) |
| REQ-PPI-03.3 | clean closure reaches publish (sibling positive) | "a clean closure reaches the publish step..." | `test/fitness/fit-46-publish-sequence-integrity.test.ts:198` | Exact, real child-process behaviour — matches scenario |
| REQ-PPI-04.1 | per-file timeout declared | "react-conformance.test.ts calls setDefaultTimeout..." | `test/fitness/fit-23-publish-workflow-guard.test.ts:547` | Exact — matches scenario |
| REQ-PPI-04.2 [red-proof] | non-resolving fixture fails at boundary, naming the file | "a fixture that never resolves fails at its declared per-file timeout..." | `test/conformance/react-conformance.test.ts:212` | Real subprocess, content-targeted `toContain` on genuine output — matches scenario |
| REQ-PPI-05.1 | execution order read, not textual position | "an order-irrelevant step... does not disturb their relative order" | `test/fitness/fit-23-publish-workflow-guard.test.ts:483` | Exact — matches scenario |
| REQ-PPI-05.2 [red-proof] | textual/execution divergence caught | "a step reordered only in execution... is caught" | `test/fitness/fit-23-publish-workflow-guard.test.ts:495` | Exact — matches scenario |

**Coverage summary**: 11/11 scenarios have a test; 0 untested; 0 asserting weaker than
their scenario text. No scenario without a test, no vacuous scenario.

### Workflow YAML sanity

- `publish.yml` parses cleanly under Bun's native `YAML.parse` (exercised live by
  `fit-23`'s `beforeAll`, all 24 tests in that file pass, including the two structural
  checks run directly against the real file).
- `publish.yml` has a single job (`publish`), so `needs:`-based topological reordering is
  a no-op on the real file today — `publishRunSteps` on the real doc is declaration-order
  and execution-order simultaneously. The execution-vs-declaration distinction (REQ-PPI-05)
  is correctly proven against simulated multi-job fixtures (PPI-05.1/.2) rather than
  against the real (single-job) file, which is the right test shape given the real file
  can't currently exercise that distinction.
- Rendered order on the real file, confirmed via `checkExplicitRebuildStep`/
  `checkSuiteGate` both returning `{ok: true}` against the real parsed doc: Build → Set dev
  version (stamp) → **Rebuild after version stamp** (build) → **Run test suite** (`bun
  test`, no `continue-on-error`) → Publish (`--dry-run`). Rebuild sits strictly between
  stamp and publish (REQ-PPI-02); suite sits strictly before publish with no
  `continue-on-error` (REQ-PPI-03.1).

### Baseline regression check

`git diff c6012ad^ c6012ad -- test/fitness/fit-23-publish-workflow-guard.test.ts` shows the
change is purely additive to this file — no existing `it()`/`describe()` block's assertion
text was touched. The pre-existing 18 tests (`REQ-PPH-*`, `REQ-BPI-03.1`) are unchanged in
intent, confirmed by diff, not by re-reading descriptions. Full-suite run confirms all 18
plus the 6 new ones (24 total) pass.

### Banned assertion pattern scan (delta only)

Scanned all new lines across `fit-46-publish-sequence-integrity.test.ts` (new file),
`fit-23-publish-workflow-guard.test.ts` (diff), and `react-conformance.test.ts` (diff) for
`toBeDefined()`, `toBeTruthy()`/`toBeFalsy()`, whole-assertion `objectContaining`, lone
`not.toThrow()`. **Zero matches.** All new assertions use `toEqual`/`toBe` against concrete
expected values, or content-targeted `toContain` against real subprocess output (not a
tripwire-message assertion site, so the `toContain` ban on tripwire messages does not
apply here).

---

### Issues

| Issue | Slice | Severity | File:Line | Detail |
|---|---|---|---|---|
| `checkSuiteGate` triangulation gap | S-000 | WARNING (Strict TDD) | `test/fitness/fit-23-publish-workflow-guard.test.ts:215-234` | New function with 4 conditional branches (1 success path, 3 distinct failure-reason returns: "no full-suite step found", "suite step runs after publish", "continue-on-error: true"). Exactly ONE test (`REQ-PPI-03.1`, line 539) exercises it, and only against the real (already-hardened) `publish.yml`, which only reaches the success branch. None of the 3 failure branches are exercised by any test in the suite — confirmed by grep across both new test files, zero other references to `checkSuiteGate`. This breaks the pattern every sibling checker in the same file follows (`checkRepoOwnerGuard`, `checkAllUsesShaPinned`, `checkPublishOrdering`, `checkExplicitRebuildStep` — every one of these pairs its positive assertion with at least one red-proof/negative case). Per `strict-tdd-verify.md`'s Triangulation Audit: "is this function genuinely driven by tests, or did one test pass and the rest is uncovered branches?" — here, 3 of 4 branches are uncovered. Not a spec gap (REQ-PPI-03.1 has only one signed scenario, no red-proof tag — the behavioural red-proof obligation for REQ-PPI-03 is satisfied elsewhere, by `fit-46`'s PPI-03.2/.3), so this does not block REQ coverage — but it is a genuine Strict TDD code-level gap in the delta. |
| apply-progress's own "Deviations / halts: None" is inconsistent with its own documented deviation | S-000 | SUGGESTION (documentation) | `openspec/changes/runner-tripwire-invariants/apply-progress.md:26-46` vs `:109-113` | The "Key engineering decision: fit-46's 'rebuild' step" section documents a real, literal deviation from `slices.md`'s Build-mechanics note (`cwd: PROJECT_ROOT` vs the note's `cwd: <scratchRoot>` for the rebuild leg) — judged ACCEPTABLE above. But the dedicated "Deviations / halts" section two paragraphs later states "None." These two statements are in tension: the engineering-decision section is itself a deviation disclosure, and should be cross-referenced from (or folded into) the Deviations section rather than living only under a "key engineering decision" heading. Not a code defect — a self-consistency nit in the artefact. |
| Residual narrow-proof risk if `dist/*.js` bytes ever become version-coupled | S-000 | SUGGESTION | `test/fitness/fit-46-publish-sequence-integrity.test.ts:74-82` | See Deviation audit above — not a current defect, flagged for awareness only. |

### Routing: LOCAL (Executor SDD-light)

Orchestrator action: re-invoke `/build` with SDD-light targeting the `checkSuiteGate`
triangulation gap — add 2-3 negative-case tests mirroring the sibling checkers' pattern
(e.g., a simulated doc with no `bun test` step before publish; one with the suite step
positioned after publish; one with `continue-on-error: true` on the suite step), asserting
the three distinct `reason` strings the function already returns. The two SUGGESTION-level
notes do not block — the Executor may fold the documentation nit into the same pass at its
discretion, or leave it as a followup. Iteration 1 of 3 used.
