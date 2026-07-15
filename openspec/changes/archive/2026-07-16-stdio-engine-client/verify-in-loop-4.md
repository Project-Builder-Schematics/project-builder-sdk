## Verify In-Loop Result

**Change**: stdio-engine-client
**Iteration**: 1/3
**Scope**: S-003
**Mode**: in-loop (Strict TDD)
**Date**: 2026-07-15

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 5/5 (S-003.1–.5) — all `[x]` in `slices.md`
- Tests: **1557 pass / 0 fail** (167 files, 3182 expect() calls) — full `bun test` run, matches `apply-progress.md`'s claim exactly (confirmed stable across 3 consecutive clean runs; see Real Execution Evidence for one anomalous first-run flake that did NOT reproduce)
- Typecheck: `bunx tsc --noEmit` — clean, zero errors
- Build: `bun run build` — clean (`tsc -p tsconfig.build.json && bun build ...`), matches `apply-progress.md`'s claim
- Spec compliance for scope: 7/7 REQ-IDs (BRB-01, BRB-02, BRB-03, RUN-08, WPS-09, SEC-02, SEC-09) have named, passing, behaviorally-real tests, each independently grepped and re-executed
- Regression: `test/fitness/` full suite (451 pass / 34 files) unaffected; scoped S-003 file set (37 pass / 6 files) green in isolation; S-000/S-001/S-002's carried-forward closures (EXC-01.3 trio, RUN-02 runtime proof) re-verified passing
- Assertion audit (delta test files): zero banned patterns across all 6 new/modified S-003 test files (`runner.integration.test.ts`'s delta hunk, `runner.unit.test.ts`, `fit-35-sequential-fail-loud.test.ts`, `harness.test.ts`, `fake-engine-harness.e2e.test.ts`, `exit-matrix.e2e.test.ts`, `bridge-bootstrap-stub.ts`) — the sole `toBeDefined()` hit in the file (`runner.integration.test.ts:114`) is pre-existing S-000 code (confirmed via `git log -L`), not S-003 delta, already adjudicated in `verify-in-loop-1.md`
- Triangulation: SEC-02's overlap guard has ≥2 driving cases at both layers (`fit-35`: second-overlap + third-overlap-while-first-still-in-flight; `runner.unit.test.ts`: overlap-while-in-flight + clears-after-completion); BRB-01 has 3 cases (match-handoff / mismatch-rejects-loudly / bridge-params-hit-RUN-02-gate)
- Code smells: zero `TODO`/`FIXME`/`as any` introduced in the S-003 diff (`git diff 1394760..2322045`); the two `as unknown as` casts (`framing.ts:53`'s minimal stdout stub, `sabotage/factory.ts:16`'s adversarial reassignment simulation) are both documented in `apply-progress.md` with sound rationale, independently re-read and confirmed narrow/justified

One Strict TDD process finding below (concern, not a blocker for this iteration — see Strict TDD section).

Orchestrator action: exit loop, proceed to `/evaluate` (mode=final) before archive. **Flag the Strict TDD finding below for final mode's zero-tolerance audit before archive.**

---

### Real Execution Evidence

```
$ bun install --frozen-lockfile
17 packages installed [192ms]        # worktree had no node_modules; installed clean

$ bun test          # RUN 1 (immediately post-install)
 1550 pass
 0 fail
 1 error
 3174 expect() calls
Ran 1550 tests across 167 files. [52.99s]   # ANOMALY — see note below

$ bun test          # RUN 2
 1557 pass
 0 fail
 3182 expect() calls
Ran 1557 tests across 167 files. [50.67s]

$ bun test          # RUN 3
 1557 pass / 0 fail / 3182 expect() calls   [47.83s]

$ bun test          # RUN 4
 1557 pass / 0 fail / 3182 expect() calls   [49.79s]

$ bun test          # RUN 5
 1557 pass / 0 fail / 3182 expect() calls   [47.72s]

$ bunx tsc --noEmit
(clean, no output, exit 0)

$ bun run build
$ rm -rf dist
$ tsc -p tsconfig.build.json && bun build bin/pbuilder-codegen.ts --outfile dist/bin/pbuilder-codegen.js --target node --banner "#!/usr/bin/env node"
Bundled 9 modules in 5ms
  pbuilder-codegen.js  14.29 KB  (entry point)
(exit 0)

$ bun test test/transport/runner.integration.test.ts test/transport/runner.unit.test.ts \
    test/fitness/fit-35-sequential-fail-loud.test.ts test/fake/harness.test.ts \
    test/fake/fake-engine-harness.e2e.test.ts test/fake/exit-matrix.e2e.test.ts
 37 pass / 0 fail / 117 expect() calls across 6 files   # S-003 scoped run

$ bun test test/fitness/
 451 pass / 0 fail / 659 expect() calls across 34 files   # regression guard, matches apply-progress
```

**Anomaly note**: Run 1 (the very first `bun test` invocation after a fresh `bun install` in this worktree) reported `1550 pass / 1 error / 3174 expect()` — 7 fewer tests and an unlocated `1 error` line with no visible stack trace, yet process exit code 0. Runs 2–5 (identical command, same working tree, no code changes between runs) all report the exact `1557 pass / 0 fail / 3182 expect()` that matches `apply-progress.md`'s claim exactly. Given zero reproduction across 4 subsequent clean runs, this reads as a cold-start resource-contention flake (subprocess-spawning e2e tests competing with first-run module compilation/caching), not a real regression — but it is real observed non-determinism in a suite that spawns OS processes for e2e coverage, and is reported here rather than silently discarded. Recommend the orchestrator note it as a watch-item for final mode (re-run the full suite ≥2× there as well) rather than treating a single green run as sufficient.

### Acceptance Spot-Checks (read + executed)

| Acceptance clause | Test | Result |
|---|---|---|
| Version mismatch fails loudly naming both versions (BRB-01.2) | `exit-matrix.e2e.test.ts` "BRB-01 bridge contract version mismatch" | PASS — real spawned `bridge-bootstrap-stub.ts` process, `CRASH_POINTER` fixture throws unconditionally at import (canary), exit 1, stderr contains both version numbers, stderr never contains the crash fixture's own throw text — proves the mismatch check runs before any import, not by inference |
| Bridge params hit the SAME RUN-01..04 gates as argv (BRB-01.3) | `runner.integration.test.ts` BRB-01 describe block | PASS — a non-`file:` scheme bridge param is rejected by the identical `validateFactoryUrl` gate `runner.ts`'s argv path uses; `bootstrap-bridge.ts::toArgv()` converts bridge params into the argv array `parseArgv` already consumes — read in full, confirmed zero duplicated/re-implemented validation logic |
| Overlap rejects `OverlappingRunError`, first run intact (SEC-02.1) | `runner.unit.test.ts` REQ-SEC-02 + `fit-35-sequential-fail-loud.test.ts` (2 tests) | PASS — real concurrent `runRunner()` invocations (not mocked), second/third attempts reject synchronously with zero `writeFrame`/`writeStderr` calls, first run's own promise resolves normally to exit 0 with its committed tree intact |
| Host-issued request frame discarded, never dispatches a run (WPS-09.2) | `harness.test.ts` REQ-WPS-09.2 (characterization) | PASS — a host-injected `type:"request"` frame mid-run is silently discarded per S-001's pre-existing WPS-03 routing-discard mechanism; the run's own reverse-callback sequence completes unaffected |
| Zero non-frame bytes reach the wire on BOTH paths, author sabotage isolated (BRB-02/03, RUN-08, SEC-09) | `fake-engine-harness.e2e.test.ts` "direct-spawn path (RUN-08)" + "bridge path (BRB-02/03)" | PASS — real spawned processes, sabotage fixture calls `process.stdout.write()` directly, `console.log()`, and attempts a `process.stdout` reassignment; BOTH runs still complete the exact `["tree.read","ir.emit","ir.commit"]` sequence with exit 0 (any leaked byte would have desynced the length-prefixed frame stream and broken this sequence or hung), and the sabotage text is confirmed present on stderr (isolated, not silently dropped) |
| Bridge never calls `process.exit` (own-process discipline) | `src/transport/bootstrap-bridge.ts` (read in full) + `test/fixtures/bridge-bootstrap-stub.ts` | PASS — `enterBridge()` only throws/returns; the test-only stub (standing in for the engine's real embedded bootstrap, out of this repo's scope) is the sole `process.exit` caller in the bridge-path tests, matching the documented "engine's own process" constraint (engram discovery obs #2205, cited in the module's own header comment) |

### Deviation Adjudication (apply-progress.md § Discoveries/Deviations)

Re-read all four S-003 deviations against actual source, not trusted from the narrative:

1. **Bridge protection is injectable, not raw top-level module code.** Confirmed: `enterBridge()`'s `protection` parameter defaults to `realProtection` (the real `captureFd1FrameWriter`/`redirectConsoleToStderr` pair) and integration tests inject a no-op stand-in. Functionally equivalent to "before any factory-related code runs" since it fires at the top of `enterBridge`, strictly before `runRunner`'s only `import()` call. **No finding** — sound engineering response to a real in-process test-corruption risk, not a scope violation.
2. **`captureFd1FrameWriter()` now neuters `process.stdout` itself.** Confirmed in `framing.ts:46-58`: captures the real write function first, then replaces the live `process.stdout` with a stderr-redirecting stub via `Object.defineProperty`. The returned writer closure closes over the pre-replacement reference. **No finding** — necessary to satisfy SEC-09's literal "never dispatched as a wire frame" against a direct (non-reassignment) `process.stdout.write()` call, which a reference-capture-only approach cannot stop.
3. **`OverlappingRunError`'s guard is module-level state in `runner.ts`, not per-`StdioEngineClient`-instance.** Confirmed: `let runInFlight = false` at `runner.ts:141`, guarding `runRunner()` itself. The class lives in `stdio-engine-client.ts` per design's Data Model; the guard's realistic trigger (a long-lived engine process re-invoking the bridge) is process-scoped, matching WPS-09's "each process runs exactly one factory" framing. **No finding** — the class-location/guard-location split is documented and the scoping rationale is sound.
4. **`test/fake/harness.test.ts` created in S-003, not S-004.** Confirmed: design's own Test Derivation table (§ 4.6) routes WPS-09 to this exact file; the header comment states S-004 extends it with the FEH-family corpus suite. **No finding** — matches the design's own routing table, not scope creep.

None of the four rise to ARCHITECTURAL or SPEC halt category.

---

### Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: concerns
**Delta scope**: 6 test files (5 new/modified + 1 new fixture-support file with test-adjacent role), 5 impl files (`bootstrap-bridge.ts` [new], `framing.ts`, `runner.ts`, `stdio-engine-client.ts`, `bin/pbuilder-runner.ts`)

#### Findings

1. **Commit `ea9b7e0` ships production code for BRB-02/03/RUN-08/SEC-09's core protection mechanism with ZERO test changes in the same commit — the driving test lands two commits later, breaking this project's own established per-task TDD discipline.**

   `git show --stat ea9b7e0` (the FIRST S-003 commit, "seal fd-1 and console.\* before any factory import") touches exactly two files: `bin/pbuilder-runner.ts` and `src/transport/framing.ts` — no test file. The diff adds the entire stub-neutering mechanism in `captureFd1FrameWriter()` (the `Object.defineProperty(process, "stdout", ...)` replacement) and the new `redirectConsoleToStderr()` function wholesale, in one commit, with no test anywhere in the tree exercising either.

   The commit that finally drives this mechanism, `c72d1ca` ("test: prove sealed stdout/console over real stdio, complete EXC-01.3 trio"), lands two commits later (after `4176cc0`'s unrelated BRB-01/SEC-02 work) and adds `test/fake/fake-engine-harness.e2e.test.ts`'s sabotage tests. Critically, `apply-progress.md`'s own TDD Cycle Evidence table records this task's RED evidence as: *"organic: exit 1 (`no collection.json found` — the new `sabotage/` fixture was initially missing its containment-root marker...)"* — that RED was a **fixture bug** (a missing marker file every sibling fixture already carries), not a failure of the stub-neutering/console-redirect mechanism itself. There is no recorded RED anywhere for the actual protection logic — because by the time its test was written, the implementation had already existed, untested, for two commits.

   This is precisely the anti-pattern `strict-tdd-verify.md`'s TDD Cycle Adherence Audit (Method 1) names: *"tests are added in a separate commit AFTER implementation → Anti-TDD pattern."* It is also a real regression in project discipline — `verify-in-loop-1.md`, `-2.md`, and `-3.md` all independently confirmed (via `git show --stat` on every commit) that S-000/S-001/S-002 paired test+implementation in the SAME commit, every time, with no exception. S-003 breaks that pattern once, undocumented — `apply-progress.md` records no rationale for the ordering anywhere in its Discoveries/Deviations sections.

   **Functional impact**: none observed — the mechanism is correct (independently re-verified above via the e2e sabotage tests, which do genuinely exercise it now) and the retrofitted test is real, not vacuous. This is a process/discipline finding, not a correctness finding.

   **Why this doesn't block the loop now**: per `strict-tdd-verify.md`'s own mode split, "tests added after implementation (anti-TDD pattern from git history)" is listed explicitly under **final mode's** halt conditions ("all in-loop conditions PLUS..."), not under in-loop's halt list. In-loop tolerates it as a flagged concern.

   **Why it cannot simply be "fixed" in the next iteration**: the violation is historical (commit ordering), not a code defect — there is nothing in the current tree to edit that would retroactively make the test have existed first. Recommended handling: the orchestrator should NOT ask for a code fix; either (a) accept this as a documented, isolated one-time discipline lapse (add the missing rationale note to `apply-progress.md`'s S-003 Deviations section, closing the gap in the record), or (b) treat it as a `final`-mode finding to be explicitly adjudicated (not silently passed) when `sdd-verify --mode=final` runs its full, zero-tolerance TDD Cycle Adherence Audit — final mode WILL surface this as a halt-category item per its own rules unless pre-adjudicated.

   **Routing**: LOCAL-documentation (no production code change needed; recommend closing the record gap in `apply-progress.md` before `/evaluate` final mode, since final mode's audit has zero tolerance for this specific pattern and will otherwise re-discover it as an unadjudicated halt).

#### Tolerated for now (flagged for final)

- Finding #1 above.
- TDD cycle granularity remains per-task-within-a-slice-commit for the OTHER four S-003 tasks (S-003.1/.2, S-003.3, S-003.4, and S-003.5's own test-authoring commit `c72d1ca` pairs its OWN new production-adjacent pieces — `bridge-bootstrap-stub.ts` test fixture, `sabotage/factory.ts` — with their driving tests correctly) — consistent with S-000/S-001/S-002's convention; only `ea9b7e0` breaks it.

#### Halts (if verdict = halt)

N/A — no halt. "concerns" reflects Finding #1 only, which is explicitly a final-mode (not in-loop) halt dimension per `strict-tdd-verify.md`'s own mode split.

---

### Slice Audit Notes Cross-Check

`apply-progress.md`'s own Step 7c notes (Groups 1–3, "no Bug/Architecture/MAJOR findings after the two comment-only fit-30 fixes") were spot-verified rather than trusted:

- REQ coverage confirmed independently for all 7 REQs (table above + Acceptance Spot-Checks) via direct grep across the cited test files.
- Zero `TODO`/`FIXME`/`as any` confirmed via `git diff 1394760..2322045` scan of the full S-003 diff (23 files, 1290 insertions/98 deletions).
- Both documented `as unknown as` casts re-read in full and confirmed narrow/justified (see Deviation Adjudication #2 and the sabotage fixture).
- `bun run build` and `bunx tsc --noEmit` re-run independently in this session (not trusted from the report) — both clean, matching claimed evidence.
- `test/fitness/pkg-surface-baseline.json`'s 2 new `dist/transport/bootstrap-bridge.{js,d.ts}` entries confirmed present.
- **One discrepancy found that the slice audit's Group 1/3 sweep did not surface**: the commit-ordering TDD violation in Finding #1 above — the audit's "no Bug/Architecture/MAJOR findings" scope does not cover TDD process discipline (that is this verify pass's own Step 7/10 responsibility, not the slice audit's Groups 1–3), so this is not a contradiction of the slice audit's own claims, just a gap in what that audit was ever scoped to check.

---

Orchestrator action: exit loop, proceed toward `/evaluate` (mode=final) once S-004/S-005 land — or run `/evaluate` now if S-003 is being treated as the terminal in-loop scope for this session. Either way, **pre-adjudicate Finding #1 (or accept it as a documented one-time deviation) before final verify runs**, since final mode's Strict TDD audit has zero tolerance for unadjudicated test-after-implementation patterns.
