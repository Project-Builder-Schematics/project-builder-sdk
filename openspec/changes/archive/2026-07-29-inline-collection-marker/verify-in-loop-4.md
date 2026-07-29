## Verify In-Loop Result

**Change**: inline-collection-marker
**Iteration**: 4/3 (cumulative slice-verify count — S-000=1, S-001=2, S-002=3, S-003=4; no single slice required more than one fix-loop pass, so the 3-in-loop-retry escalation rule was never triggered)
**Scope**: slice:S-003 (full suite realigned — no stale ceiling/marker assertion survives)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 8/8 (S-003.1–S-003.8, `slices.md` all `[x]`)
- Affected tests passed: targeted runs all green (see Evidence) + full suite (2359 pass / 6 fail, two independent uncontended runs, byte-identical failure set, both S-004-owned)
- Spec compliance for scope: 8/8 REQ groups covered (REQ-BRC-02/.1, REQ-BRC-06.1, REQ-BRC-07.1, REQ-FSC-09/.1/.2, REQ-CSC-02.1/.2, M-16 re-cite)
- Assertion audit: clean except one WARNING (comment staleness, non-blocking — see Findings)

Orchestrator action: exit loop, proceed to `/build` for the S-004+S-005 batch (parallel per Build Order), then S-006 last, then `/evaluate` (mode=final) before archive.

---

### Per-Dimension Verdicts

| Dimension | Verdict | Evidence |
|---|---|---|
| Acceptance — zero `packageRoot`/`realCeiling`/marker assertions | ✅ PASS | `rg -n "packageRoot" test/ src/` — 4 hits, ALL in `single-instance-probe.ts`/its own unit test (an unrelated npm-root-walk concern, explicitly design-allowlisted §3: "symbol-allowlisted, never touched") + one unrelated `closure-integrity-checks.ts` param name. Zero hits in `src/scaffold/**` or any collection-marker test. `rg -n "realCeiling"` — zero hits anywhere. `rg -n "collection\.json"` in `test/` — all surviving hits are either (a) inert on-disk fixture description prose (`run-boundary.test.ts`, `inline-collection.test.ts` — explicitly permitted by S-003.3's marker-fixture-survival rule) or (b) `coverage-manifest.md`'s pre-existing prose line, itemized as S-004.6(d)'s job, not S-003's. `checkCollectionJsonMarker` — zero hits repo-wide (deleted per S-003.4/S-003.5). |
| M-16 ruling-5 citation | ✅ PASS | `scenario-matrix/spec.md:70` — M-16 row cites `ir-path-well-formedness REQ-IPF-01.1; REQ-IPF-01.2`, "the ruling-5 lexical screen cited (not containment — `package-root-containment` retired)." Test-side: `test/e2e/scaffold.e2e.test.ts:158` comment confirms the `invalid-input` reason, never `source-outside-package`. |
| REQ-BRC-02/.1 (no SDK-resolved root on wire) | ✅ PASS | `test/scaffold/expander.test.ts:181-206` — new describe block, `toEqual` exact-match on the emitted `copyIn` directive `{op, copyIn: {from, to}}`, no root/ceiling/anchor field. Mutation-checked (apply-progress): adding a `packageRoot` field to `DirectiveFactory.copyIn`'s wire object made the test fail with the exact expected diff, reverted, re-confirmed green — non-vacuous by construction. |
| REQ-BRC-06.1 (missing source → `source-not-found`) | ✅ PASS | `test/conformance/copyin-parity.test.ts:80` strengthened to assert `{verdict, reason}` exactly (not verdict-only); `test/e2e/scaffold.e2e.test.ts:445`, `test/fake/copyin-fidelity.test.ts:38` also cite it — all green in targeted + full runs. |
| REQ-BRC-07.1 (no absolute path on wire) | ✅ PASS | `test/scaffold/scaffold-fake.test.ts:99` describe block, unaffected by this slice's edits, confirmed still green (not in the 6 residuals). |
| REQ-FSC-09/.1/.2 (symlink skip, entry-count bound) | ✅ PASS (behavioural) / ⚠️ WARNING (rationale text) | `test/scaffold/walk.test.ts:30-71` — both scenarios pass; bound-arithmetic corrected (2/3-entry trees, per S-003.3's `scratch-dir.ts` no-longer-seeding-marker consequence). BUT: the slice's own task text promised "rationale-only — behaviour unchanged, comment rewritten," and the file's header comment (`:1-4`) and the REQ-FSC-09.1 describe title (`:30`) both still read "in-ceiling," the retired containment framing the signed V3 MODIFIED REQ-FSC-09 explicitly says no longer applies ("there is no longer a containment ceiling... rationale rewrites to enumeration-determinism/cycle-safety"). See Findings #1. |
| REQ-CSC-02.1/.2 (preservation-pins, unaffected by marker retirement) | ✅ PASS | `test/fitness/fit-40-conformance-corpus-integrity.test.ts:146,150` + `.negative.test.ts:130,145` — both scenarios' tests present and green, untouched by this slice (correctly — they're preservation-pins, only REQ-CSC-02.3 retired). `checkCollectionJsonMarker` import/describe block fully removed from both files (S-003.4/.5). |
| No scope creep into S-004 | ✅ PASS | `git diff a51dd2f^..a51dd2f -- test/e2e/author-emulation/scenarios.ts` — empty, zero changes. No transcript hand-edits (`test/e2e/author-emulation/corpus/*.transcript.json` not in the commit's file list). Renumbering (`m-17→m-16` etc.) untouched — confirmed by the still-live `m-16`/`m-17` slugs in the corpus and the 6 residual failures still citing the OLD reason. |
| Slices/apply-progress honesty | ✅ PASS | All 8 S-003 checkboxes `[x]` in `slices.md`. Spot-checked 5 apply-progress claims against the actual diff/tree: (1) `src/scaffold/containment.ts` + `test/scaffold/containment.test.ts` both confirmed deleted; (2) `test/support/scratch-dir.ts`/`test/fixtures/author-emulation/factory.ts` — marker-fabrication `writeFileSync(collection.json)` calls confirmed absent (only descriptive comments remain); (3) REQ-BRC-02.1 test body matches the claimed mutation-check description exactly; (4) REQ-AEC-11.2 test body (`index.test.ts:151-166`) matches the claimed destination-wins assertion exactly; (5) `bunx tsc --noEmit` independently re-run clean, matching the claim. |
| TDD discipline | ✅ PASS | Apply-progress's own RED-evidence table for S-003 checked against 2 genuinely-new tests (REQ-BRC-02.1, REQ-AEC-11.2) — both mutation-checked, reverted, re-confirmed (not taken on faith). Realignment tasks correctly framed as "stable pre-existing RED inherited from verify-in-loop-3's baseline," not fabricated RED-first theatre. |
| Full-suite execution (real, twice) | ✅ PASS | Two independent, UNCONTENDED runs: 2359 pass / 6 fail both times, byte-identical failure names and order (see Suite section). A third contended run (concurrent with this verify's own `rg`/file-read activity) showed 7 fail — the extra failure did not recur on either clean run and is consistent with the project's own disclosed `bun run build` SIGTERM-race / resource-contention flake posture (Deviation #5); not counted as a regression. |
| `tsc --noEmit` | ✅ PASS | Clean, zero errors. |

### Findings

**WARNING #1 — stale "in-ceiling" rationale language not rewritten (`test/scaffold/walk.test.ts:1-4,30`)**
- Category: LOCAL (cosmetic — comment/describe-title text only, zero behavioural or assertion impact)
- The slice's own task text (`slices.md` S-003.1) explicitly promised: "re-verify REQ-FSC-09.1/.2 (`walk.test.ts`, rationale-only — behaviour unchanged, **comment rewritten**)." The signed spec's MODIFIED REQ-FSC-09 states the "in-ceiling" containment framing is retired ("there is no longer a containment ceiling... the rationale rewrites to enumeration-determinism/cycle-safety"). The file's header comment (`:3`, "even in-ceiling, REQ-FSC-09.1") and the describe title (`:30`, "REQ-FSC-09.1 — in-ceiling symlinked directory is skipped, not descended") were NOT updated — they still use the retired framing verbatim. Apply-progress's own S-003.1 row documents only the bound-arithmetic fix, silently omitting the promised comment rewrite.
- Does NOT violate the slice's literal acceptance criterion ("zero assertion references `packageRoot`/`realCeiling`/the marker") — "ceiling" is descriptive prose, not one of those three banned identifiers, and no assertion or behaviour is affected.
- Related, same-vintage prose also survives in `test/scaffold/expander.test.ts` (`:209,251,285` — "out-of-ceiling"/"in-ceiling" in test names/comments), but that file was never promised a comment rewrite by any S-003 task — noted for completeness, not counted as a second instance of this finding.
- Recommended fix (trivial, next touch of this file — e.g. folded into S-005's fit-43 sweep or done standalone): rewrite the two "in-ceiling" occurrences in `walk.test.ts` to the enumeration-determinism/cycle-safety framing the signed spec now uses.

No CRITICAL findings. No SPEC, ARCHITECTURAL, or SENSITIVE findings.

### Suite

**Run A (uncontended)**: 2359 pass / 6 fail / 5262 expect() calls — 2365 tests across 197 files, 78.86s
**Run B (uncontended, tie-break)**: 2359 pass / 6 fail / 5262 expect() calls — 2365 tests across 197 files, 86.50s
**Run C (contended — concurrent verify activity, not counted per project posture)**: 2357 pass / 7 fail — 2364 tests, 1055.58s (the +1 extra failure did not recur in either clean run; consistent with the disclosed `bun run build` SIGTERM-race flake pool, not this slice's diff)

The 6 stable residuals (identical names, both clean runs) — ALL S-004-owned, per the describe blocks' own naming:
1. `test/e2e/author-emulation-scaffold.e2e.test.ts` — "m-16 (traversal-source-rejected) matches the committed corpus byte-for-byte"
2. `test/e2e/author-emulation-scaffold.e2e.test.ts` — "m-17 (no-existence-oracle-nonexisting) matches the committed corpus byte-for-byte"
3. `test/e2e/author-emulation-scaffold.e2e.test.ts` — "S-004 — matrix-row assertions... > M-16 ... > traversal source rejects (corpus-canonical), full triple asserted"
4. `test/e2e/author-emulation-scaffold.e2e.test.ts` — "S-004 — matrix-row assertions... > M-16 ... > absolute source rejects with the SAME reason (e2e-inline-only)"
5. `test/e2e/author-emulation-scaffold.e2e.test.ts` — "S-004 — matrix-row assertions... > M-17 ... > non-existing target rejects (corpus-canonical), full triple asserted"
6. `test/e2e/author-emulation-scaffold.e2e.test.ts` — "S-004 — matrix-row assertions... > M-17 ... > an EXISTING out-of-ceiling target rejects with the IDENTICAL reason and message shape"

All 6 unreachable before S-004's scenario renumbering + corpus regen lands (`scripts/regen-corpus.ts` rewrites the transcripts; `m-17`'s scenario is deleted, not fixed, per S-004.1). The 2 `fit-42-runner-closure-integrity` `REQ-RCD-03.5` failures present in the S-000/S-001/S-002 baseline did NOT recur in either clean run here (environment-dependent, unrelated to this change either way, per Deviation #4).

**`bunx tsc --noEmit`**: clean, zero errors (independently re-run).

Orchestrator action: exit loop, proceed to `/build` for S-004+S-005 (parallel), then S-006 last.

skill_resolution: injected (registry search not performed by this sub-agent — no registry text was provided in the launch prompt; proceeded generic per protocol. Flagging for orchestrator re-injection on next launch.)
