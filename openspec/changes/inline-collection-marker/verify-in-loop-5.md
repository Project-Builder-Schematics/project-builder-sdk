## Verify In-Loop Result

**Change**: inline-collection-marker
**Iteration**: 5/3 (cumulative slice-verify count — S-000=1, S-001=2, S-002=3, S-003=4, S-004=5; no single slice required more than one fix-loop pass, so the 3-in-loop-retry escalation rule was never triggered)
**Scope**: slice:S-004 (scenario-matrix corpus renumbered and regenerated — the last 6 S-003-baseline residuals closed)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 7/7 (S-004.1–S-004.7, `slices.md` all `[x]`)
- Affected tests passed: full suite (2363 pass / 0 fail, two independent back-to-back uncontended runs, byte-identical) + isolated `fit-28-corpus-determinism.test.ts` (3/3 pass, including the empirically re-verified FIT-28b stray-check)
- Spec compliance for scope: REQ-SCM-01/REQ-SCM-02 substance covered (the scenario-level fit-26 proof is correctly excluded — fit-26-gated, archive-sync only, per the slice's own Covers note)
- Assertion audit: clean, no banned patterns in the delta test files

Orchestrator action: exit loop, proceed to `/build` for S-005 (parallel-eligible per Build Order — already independently gated on S-001+S-002, not S-004), then S-006 last, then `/evaluate` (mode=final) before archive.

---

### Per-Dimension Verdicts

| Dimension | Verdict | Evidence |
|---|---|---|
| S-004.1 — `scenarios.ts` renumber | ✅ PASS | Read the file directly: no `m-17`/no-existence-oracle row exists; `m-17` now carries slug `missing-package-local-source` bound to `runM18`; `m-18→symlinked-dir-skipped`, `m-19→conformance-parity-copyin`, `m-20→cross-chunk-atomicity` bound to `runM19`/`runM20Valid`/`runM21` respectively — ids shifted, function bindings unchanged, exactly as claimed. Range comment (`:56-58`) reads `m-01..m-20`. |
| S-004.2/.3 — corpus regen (manual delete + `regen-corpus.ts`) | ✅ PASS | Re-ran `bun scripts/regen-corpus.ts` myself: wrote all 21 files (`s-00` + 20 rows); `git status --porcelain` on the corpus dir was EMPTY afterward — the working tree was already byte-identical to what the script produces. `ls` on the corpus dir confirms the 5 old-filename transcripts (`m-17.no-existence-oracle-nonexisting`, `m-18.missing-in-ceiling-source`, `m-19.symlinked-dir-skipped`, `m-20.conformance-parity-copyin`, `m-21.cross-chunk-atomicity`) are gone, replaced by the new-filename set. Zero hand-edited transcript content — the no-op re-run is direct proof. |
| S-004.4 — `fit-28` SCENARIOS list + FIT-28b stray/duplicate check | ✅ PASS, empirically re-verified non-vacuous | Read `fit-28-corpus-determinism.test.ts:75-110` — a real `readdirSync(CORPUS_DIR)` vs. `scenarios.ts`-derived expected-id-set diff, modeled on `fit-40`'s posture. I independently injected a stray file (`cp m-01... m-99.stray-test.transcript.json`), re-ran — FAILED with the exact expected message (`FIT-28b: stray transcript file "m-99.stray-test.transcript.json" matches no scenarios.ts id/slug...`); removed the stray, re-ran — 3/3 pass again; confirmed `git status` clean throughout. Not theatre — a genuinely discriminating guard. |
| S-004.5 — `corpus-format.ts` comment | ✅ PASS | `:75` reads `scenarioId: string; // "s-00" \| "m-01".."m-20"` — confirmed via diff and direct read. |
| S-004.6 — `coverage-manifest.md` renumber (a)-(d) | ✅ PASS | Direct read + `git show 4561f95 -- coverage-manifest.md`: (a) M-17 row carries BOTH `REQ-BRC-06.1` and `REQ-PSH-02.1` (lines 52-53), other shifts are plain re-keys (`REQ-FSC-09.1→M-18`, `REQ-ATH-16.1→M-19`, batch-cap `REQ-05.1→M-20`); (b) M-16 row gained `REQ-IPF-01.1`/`REQ-IPF-01.2` (diff confirms these replace the retired `REQ-PRC-04.1`/`REQ-PRC-04.6`); (c) `REQ-PRC-06` bullet is absent from NOT-EXERCISED (confirmed by direct read); (d) `rg -n "no collection.json found at or above" test/ src/` — zero hits; the FRICTION section's line now reads "missing containment-ceiling marker" instead. All four sub-points landed exactly as the task and Deviation-log describe. |
| S-004.7 — `bun test` green | ✅ PASS (re-executed independently, see Suite) | — |
| Deviation #9 — `test/fixtures/author-emulation/factory.ts` orphan cleanup (outside design §6's S-004 file list) | ✅ RULED LEGITIMATE — see Findings | `rg -n "runM17NonExisting\|runM17Existing\|m17SiblingPath" .` — zero hits repo-wide, confirming the builder's "zero remaining consumers" claim. Diff confirms exactly the disclosed scope: the ~37-line M-17 fixture block + the now-unused `dirname` import removed (`join` retained); `scratchFactoryRunner`'s `teardown`-param JSDoc reworded to drop the now-deleted example; "M-17" dropped from the S-004 section-header row list; `runM18`/`runM19`/`runM20Valid`/`runM21` function names deliberately left unrenamed (matching the disclosed policy and the existing `M21_COLLISION_SEED_PATH` precedent). Note that `factory.ts` IS already a row in design §6 (for the unrelated S-002/S-003 "drop marker fabrication" edit) — so this is a second, distinct edit to an already-in-scope file, not a wholly new file entering the change. |
| Slices/apply-progress honesty | ✅ PASS | All 7 S-004 checkboxes `[x]` in `slices.md`. Spot-checked 4 apply-progress claims against the actual `4561f95` diff: (1) M-16's reason-flip to `invalid-input`/`path: null` — confirmed against `src/core/authoring-error.ts:286-288`'s `invalidInput()` (mints `verb: undefined, path: undefined` unconditionally, serialized as `null`/`null` by the transcript layer) and the e2e-test diff; the builder's own self-caught first-draft failure (literal path asserted, corrected to `null` after an actual test run) is corroborated by the TDD Cycle Evidence table; (2) the `factory.ts` orphan-cleanup diff matches Deviation #9's description line-for-line; (3) `coverage-manifest.md`'s diff matches S-004.6(a)-(d) exactly; (4) `fit-28`/`corpus-format.ts` diffs match S-004.4/.5 exactly. No discrepancies found. |
| TDD discipline | ✅ PASS | Apply-progress's TDD Cycle Evidence table for S-004 (lines 163-178) frames this correctly as corpus-regen/renumber work inheriting stable pre-existing RED from S-003's baseline, not fabricated RED-first theatre — consistent with the nature of the slice (data renumbering + a new fitness guard, not new production logic). The one genuinely new test (FIT-28b) has its own documented, and now independently re-confirmed, non-vacuousness proof. |
| Full-suite execution (real, re-run independently) | ✅ PASS | Two back-to-back UNCONTENDED runs in a single shell invocation: 2363 pass / 0 fail both times, byte-identical — matching the builder's claim exactly. See Suite section for the flake-posture note. |
| `tsc --noEmit` | ✅ PASS | Re-run independently — clean, zero errors. |

### Findings

No CRITICAL findings. No SPEC, ARCHITECTURAL, or SENSITIVE findings.

**SUGGESTION #1 — flake reproduction note (non-blocking, informational only)**
- Category: N/A (observation, not a defect)
- During this verification I ran the full suite more than twice across separate tool invocations interleaved with other read/rg activity (git status, file reads) and observed one transient failure on 3 of those interleaved runs — `test/conformance/react-conformance.test.ts::REQ-RXD-08.1` (a JSX round-trip test, completely unrelated to this slice's diff — not in the design's S-004 file list, not touched by commit `4561f95`). It passed cleanly in isolation and on the two dedicated back-to-back UNCONTENDED runs (see Suite), matching the builder's claimed 2363/0 byte-identical twice. This reproduces — rather than contradicts — the project's own disclosed contention-flake posture (Deviation #5 across S-000–S-003): a different, diff-unrelated test intermittently fails under concurrent tool/system load and self-heals when re-run uncontended. Not counted as a finding against S-004's diff; noted for completeness since the orchestrator's verify instructions specifically flagged this posture as worth re-confirming.

### Suite

**Run A (uncontended, back-to-back with Run B, no other command in between)**: 2363 pass / 0 fail / 5252 expect() calls — 2363 tests across 197 files, 75.59s
**Run B (uncontended, tie-break, immediately following Run A in the same shell invocation)**: 2363 pass / 0 fail / 5252 expect() calls — 2363 tests across 197 files, 76.42s

Byte-identical pass/fail counts across both uncontended runs — matches the builder's Verification Evidence claim for S-004 exactly. All 6 of S-003's disclosed residuals (2 corpus byte-compares + 4 matrix-row assertions, all citing the old `m-16`/`m-17` reasons) are gone — confirmed absent from both runs' output. The 2 pre-existing `fit-42-runner-closure-integrity` `REQ-RCD-03.5` failures from the S-000–S-002 baseline did not recur in either run.

Three additional interleaved (contended) runs during the course of this verification showed 1 transient failure each in `react-conformance.test.ts` (see Suggestion #1) — none in a file this slice's diff touches, none reproducing on isolated re-run, none affecting the S-004 acceptance criterion.

**`bunx tsc --noEmit`**: clean, zero errors (independently re-run).

Orchestrator action: exit loop, proceed to `/build` for S-005, then S-006 last, then `/evaluate` (mode=final) before archive.

skill_resolution: injected, registry-empty (per launch prompt — greenfield project, generic TS/Bun conventions applied; no project-specific compact rules to inject).
