## Verify In-Loop Result

**Change**: stdio-engine-client
**Iteration**: 1/3
**Scope**: S-004
**Mode**: in-loop (Strict TDD)
**Date**: 2026-07-15

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 5/5 (S-004.1–.5) — all `[x]` in `slices.md`
- Tests: **1571 pass / 0 fail** (167 files, 3205 expect() calls) — full `bun test` run, matches `apply-progress.md`'s claim exactly; delta from S-003's baseline (1557 pass) is +14 tests, consistent with the 14 real (non-fragment) `it(...)` cases added in the `harness.test.ts` diff
- Typecheck: `bunx tsc --noEmit` — clean, zero errors
- Spec compliance for scope: 5/5 REQ-IDs (FEH-01, FEH-02, FEH-03, FEH-04, FEH-05) have named, passing, behaviorally-real tests, each independently read and re-executed
- Regression: zero `src/` files touched this slice (confirmed via `git diff 79d5d23..6a21a7f --stat` — only `test/fake/conformance-corpus.ts` [new], `test/fake/harness.test.ts`, `test/fake/fake-engine-harness.ts`, `test/support/frame-host.ts`, plus `slices.md` checkbox/doc updates); FIT-18 and FIT-10 (REQ-FEH-01's own "must stay green" clause) both pass in the full run
- Assertion audit (delta test files): zero banned patterns (`toBeDefined()`, bare `toBeTruthy()/toBeFalsy()`, `objectContaining` as whole assertion, `not.toThrow()` as sole assertion) across the full delta — grepped every added line in `harness.test.ts`'s diff, zero hits
- Triangulation: every new helper function has both a real assertion AND a dedicated red-proof exercising the opposite branch — `noReimplementationViolations` (clean source / planted-violation fixture), `resolveSpecReqIds` (pre-archive-present / pre-archive-absent-falls-back-to-post-archive-glob, 2 real tmp-dir fixtures), `extractCitedReqIds` (real citations / invented `REQ-BOGUS-99`), `uncoveredReqIds` (fully covered / one uncited non-exempt REQ surfaces) — none is a single-path smoke test
- Code smells: zero `TODO`/`FIXME`/`as any`/`as unknown as` introduced in the S-004 diff (grepped both commits)

One WARNING below (stale acceptance text), non-blocking. No CRITICAL findings.

Orchestrator action: exit loop, proceed to S-005 (the only remaining slice), then `/evaluate` (mode=final) before archive.

---

### Real Execution Evidence

```
$ bun test
 1571 pass
 0 fail
 3205 expect() calls
Ran 1571 tests across 167 files. [52.91s]

$ bunx tsc --noEmit
(clean, no output, exit code 0)

$ git log --oneline 79d5d23..6a21a7f
6a21a7f docs(sdd): record S-004 apply progress complete (5/5)
e3b0276 test(fake): build the FEH-01..05 conformance suite (S-004)
169abc3 test(fake): add shared conformance-scenario corpus module (FEH-02)

$ git diff --stat 79d5d23..6a21a7f
 openspec/changes/stdio-engine-client/apply-progress.md | 131 ++++++++++
 openspec/changes/stdio-engine-client/slices.md          |  10 +-
 test/fake/conformance-corpus.ts                         |  43 ++++
 test/fake/fake-engine-harness.ts                        |  10 +-
 test/fake/harness.test.ts                                | 278 ++++++++++++-
 test/support/frame-host.ts                               |  13 +-
 6 files changed, 474 insertions(+), 11 deletions(-)
```

Single clean run — no re-run needed for flake confirmation this iteration (unlike S-003's first-run anomaly in `verify-in-loop-4.md`, this run was stable on first execution against the already-installed `node_modules`).

### Acceptance Spot-Checks (read + executed)

| Requirement | Test | Result |
|---|---|---|
| FEH-01 — transport shell over the ONE `ContractFake`, semantic parity | `harness.test.ts` "Scenario REQ-FEH-01.1 (+REQ-FEH-02.1)" | PASS — both corpus scenarios (`happy` committed, `collide` rejected) run in-process AND over a real spawned process; committed-tree equality and rejection classification (`AuthoringError.reason === "path-collision"` vs wire `emitRejectionCode === "collision"`) checked at each side's own natural altitude, tied together via the pre-existing, read-only `CODE_TO_REASON` map — not re-derived |
| FEH-01.2 — structural no-reimplementation guard | `harness.test.ts` "Scenario REQ-FEH-01.2" + red-proof | PASS — real scan finds zero violations in `fake-engine-harness.ts`; red-proof fixture with a planted `new EmitRejection(...)` is caught, proving the scan is not vacuous |
| FEH-02 — shared scenario corpus, one module | `harness.test.ts` REQ-FEH-02 describe block + FEH-01.1's shared iteration over `CONFORMANCE_CORPUS` | PASS — the real proof of "one corpus, two runners" is structural: `FEH-01.1` iterates the SAME `CONFORMANCE_CORPUS` array against both the in-process and spawned legs. The dedicated `===` re-import test is a language-guarantee pin (see Judgment Calls below), not the primary evidence |
| FEH-03 — spec-derived citation guard, anti-tautology | `harness.test.ts` REQ-FEH-03 describe block + red-proof + archive-fallback test | PASS — real scan resolves all of `harness.test.ts`'s own cited REQ-IDs against the V3 spec's parsed universe (0 unresolved); red-proof (fragmented-string fixture, deliberately not a literal `it(...)` to avoid self-contaminating the real scan) proves an invented `REQ-BOGUS-99` is caught; a real `mkdtempSync` fixture proves the pre-archive/post-archive path-resolution fallback both branches |
| FEH-04 — real spawned process, no Go toolchain | `harness.test.ts` "Scenario REQ-FEH-04.1" | PASS — PATH restricted to `{bunDir}:/usr/bin:/bin`; a same-env `sh -c "command -v go"` probe is asserted empty BEFORE trusting the restriction, then a real spawned runner completes with exit 0. The probe is what makes this non-vacuous — `go` is actually present on this image via linuxbrew, so a naive "runner still exits 0" alone would prove nothing |
| FEH-05 — coverage map, zero uncovered, count tripwire | `harness.test.ts` REQ-FEH-05 describe block + 2 red-proofs | PASS — real scan of the WHOLE `test/` tree (`collectTsFiles`, recursive) finds zero uncovered/non-exempt REQ-IDs; parsed count (41) matches `EXPECTED_REQ_COUNT`; both red-proofs (stale count mismatch, uncited non-exempt REQ) demonstrate the guard actually fails on a real drift |

### Judgment Calls (per orchestrator's request)

1. **FEH-02 identity-guard shape** — `harness.test.ts`'s `[characterization]` test (`await import("./conformance-corpus.ts")` then `toBe` the statically-imported binding) pins a Bun/Node ES-module-cache GUARANTEE, not SDK behavior — under normal module resolution this assertion can never fail regardless of what `conformance-corpus.ts` or the harness do. This mirrors an already-accepted project precedent (FIT-18's own `REQ-FSP-02.1` shim-identity pin, per `apply-progress.md`'s own note). **Verdict: acceptable, not a finding** — REQ-FEH-02's substantive claim ("one corpus, two runners") is actually proven by FEH-01.1's shared iteration over the one array, which IS falsifiable (a second corpus module would show up as two distinct arrays). The dedicated test is a defensible belt-and-suspenders pin, consistent with existing convention, not new unjustified scope.

2. **`PENDING_S005_COVERAGE_EXEMPTIONS` set** — verified the set is EXACTLY `{"WPS-06", "WPS-11", "FEH-06", "LED-01"}` (`harness.test.ts:134`, `new Set([...])` literal, no other members). Cross-checked against `slices.md`'s S-005 section: `**Covers**: WPS-06, WPS-11, FEH-06, LED-01` (line 158) — an exact set match, no extra and no missing REQ-ID. Each of the four genuinely belongs to S-005 per slices.md's own text: WPS-06/FEH-06 are exercised by fit-34 (S-005.3, not yet built), WPS-11 by fit-31 (S-005.3), LED-01 by S-005.4's ledger scan (spec.md's own REQ-LED-01 note pre-announces this exemption). The exemption is documented as shrink-only in both `harness.test.ts`'s own comment (lines 126–133) and `apply-progress.md`'s Deviations section — no mechanism exists in the code to silently GROW this set (it is a literal, hand-maintained `Set`, not derived). **Verdict: sound, matches slices.md exactly.**

### Deviation Adjudication (`apply-progress.md` § Deviations)

1. **FEH-02's `===` identity guard proven via re-import + content-identical-but-reference-distinct red-proof, not by comparing two independently maintained corpus copies.** Confirmed sound — design specifies exactly ONE corpus module; there is no second copy to compare, so the red-proof necessarily uses a synthetic distinct-reference array instead. No finding.
2. **FEH-05's shrink-only exemption set, not literally specified in design's text.** Adjudicated above (Judgment Calls #2) — a necessary, well-documented consequence of the Build Order (S-005 docs/fitness-tests land last), not scope creep. No finding.

None of the two documented deviations rise to ARCHITECTURAL or SPEC halt category.

---

### Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: ok
**Delta scope**: 3 test/test-support files changed (`test/fake/harness.test.ts`, `test/fake/fake-engine-harness.ts`, `test/support/frame-host.ts`) + 1 new file (`test/fake/conformance-corpus.ts`); zero implementation (`src/`) files touched this slice

#### Findings

None. Unlike S-003 (`verify-in-loop-4.md` Finding #1: production code shipped in a test-free commit, driving test landing two commits later), S-004's two commits each pair new test-support surface with its own driving test in the SAME commit:

- `169abc3` adds only `conformance-corpus.ts` (inert scenario data, no dedicated RED per this project's established "characterization" convention for inert data modules — same posture as `test/e2e/author-emulation/scenarios.ts`)
- `e3b0276` adds all of `harness.test.ts`'s FEH-01..05 suite together with the `SpawnedRunSummary.responses` field and `frameHostFactory`'s `env` passthrough it needs — both additive, backward-compatible extensions committed alongside the tests that require them, not split across commits

`apply-progress.md`'s TDD Cycle Evidence table records genuine RED errors per task (`error: not implemented` stub throws for `noReimplementationViolations`, `resolveSpecReqIds`/`extractCitedReqIds`, `scanReqCitationsAcrossTests`; one organic RED for FEH-04's PATH-restriction discovery — see below). Git history cannot independently confirm intermediate RED states (both commits land as final, passing diffs — this project commits per-task-within-a-slice, not per TDD micro-cycle, consistent with Method 1's documented limitation in `strict-tdd-verify.md`), but Method 2 (test-implementation pairing) is clean: every new function in the delta has a co-located, real test.

#### Tolerated for now (flagged for final)

- None new from S-004.
- **Carryover, not this slice's responsibility**: `verify-in-loop-4.md`'s Finding #1 (S-003's `ea9b7e0` commit-ordering anti-TDD pattern) remains unadjudicated as of this report — `apply-progress.md` has not yet added the recommended rationale note, and no `sdd-verify --mode=final` pass has run yet. Flagging again here since final mode's zero-tolerance TDD audit will re-surface it as a halt-category item unless pre-adjudicated before `/evaluate`.

#### Halts (if verdict = halt)

N/A — no halt.

---

### Slice Audit Notes Cross-Check

`apply-progress.md`'s own Step 7c notes (Groups 1–3, "no Bug/Architecture/MAJOR findings") were spot-verified rather than trusted:

- REQ coverage confirmed independently for all 5 REQs (table above) via direct read of the cited tests, not just grep.
- Zero `src/` changes confirmed via `git diff --stat` — matches the claim "S-004 is entirely test/test-support work."
- Zero `TODO`/`FIXME`/`as any`/`as unknown as` confirmed via `git diff 79d5d23..6a21a7f` scan of both commits' diffs — the apply-progress note about eliminating an interim `as unknown as ConformanceScenario[]` cast during REFACTOR is consistent with its absence in the final diff.
- **One discrepancy found that the slice audit's Groups 1–3 sweep did not surface, and that S-004's own task list does not cover**: `slices.md`'s S-004 Acceptance clause (line 144) still reads "coverage map shows zero uncovered **of 40**" — stale text from before the V3 spec amendment added REQ-LED-01, bringing the real total to 41 (as `slices.md`'s own global Coverage Check section, line 204, and `harness.test.ts`'s `EXPECTED_REQ_COUNT = 41` both correctly reflect). The CODE is correct (tests pass against 41, matching the signed V3 spec); only this one acceptance-criteria sentence in `slices.md` was never updated to match. **Classification: WARNING, routing LOCAL** — cosmetic documentation drift, not a functional or spec-compliance defect; harmless to leave for one more iteration but should be corrected (single-word edit: "40" → "41") before `/evaluate` final mode reads `slices.md` as compliance evidence, to avoid final mode flagging a false "acceptance text doesn't match implementation" finding.

---

### Issues Found

**CRITICAL**: None.
**WARNING**: `slices.md` S-004 Acceptance text says "zero uncovered of 40," stale against the V3-amended REQ count of 41 (see Slice Audit Notes Cross-Check above). Fix: one-word edit before final verify.
**SUGGESTION**: None beyond the Judgment Calls already adjudicated as acceptable above.

Orchestrator action: exit loop (PASS), proceed to S-005 (final remaining slice — docs + ledger reconciliation), then `sdd-verify --mode=final` before archive. Carry both the WARNING above and the unadjudicated S-003 Strict TDD carryover finding into final mode's scope.
