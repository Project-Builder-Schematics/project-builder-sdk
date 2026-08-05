## Verify In-Loop Result

**Change**: runner-tripwire-invariants
**Iteration**: 2/3
**Scope**: S-000 delta since `verify-in-loop-1` (commit `f8d6444` — 2 files:
`test/fitness/fit-23-publish-workflow-guard.test.ts`, `apply-progress.md`)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

The single `NEEDS_FIX` finding from iteration 1 (`checkSuiteGate` triangulation gap) is
closed with 3 genuinely distinct negative-case tests. Both SUGGESTION-level notes were
addressed in the artefact. Loop can exit.

### Real execution evidence (re-run independently, not trusted from the claim)

- `bun test` (full suite): **2462 pass, 0 fail**, 5503 `expect()` calls, 202 files, 68.73s.
  Matches the Executor's claim exactly (2462/2462).
- `tsc --noEmit`: clean, no output.
- `test/fitness/fit-23-publish-workflow-guard.test.ts` alone: **27 pass, 0 fail**, 44
  `expect()` calls. Matches the claim exactly (24 prior + 3 new).

### (2) Each new test drives a DISTINCT `checkSuiteGate` branch — traced by hand against the actual function source

```
function checkSuiteGate(doc) {
  for (const job of ...) {
    ...
    if (publishIndex === -1) continue;
    if (suiteIndex === -1) return {ok:false, reason:"no full-suite (bun test) step found..."};   // branch A
    if (suiteIndex > publishIndex) return {ok:false, reason:"the suite step runs after..."};      // branch B
    if (steps[suiteIndex]?.["continue-on-error"] === true) return {ok:false, reason:"...continue-on-error: true"};  // branch C
    return {ok:true};
  }
}
```

| Test | Fixture steps | Trace | Branch reached |
|---|---|---|---|
| "fails when no `bun test` step exists" | `[npm publish]` | publishIndex=0; suiteIndex=-1 (no `bun test` anywhere) | **A** only |
| "fails when the suite step runs after publish" | `[npm publish, bun test]` | publishIndex=0; suiteIndex=1 (found this time, so A is skipped); 1>0 → true | **B** only |
| "fails when continue-on-error: true" | `[bun test {continue-on-error:true}, npm publish]` | publishIndex=1; suiteIndex=0; 0>1 is false (B skipped); `continue-on-error===true` → true | **C** only |

Each fixture is constructed so the earlier branches' guard conditions evaluate false before
reaching its target branch — none of the three share an early return, confirmed by hand
execution of the actual (not simulated) function body against the actual (not summarised)
new fixtures read from `test/fitness/fit-23-publish-workflow-guard.test.ts:546-589`
(commit `f8d6444`).

**Whole-verbatim assertions**: all 3 use `expect(result.reason).toBe("<full string>")` —
matches this file's established convention (every sibling checker's red-proof test in the
same file uses `toBe`/`toEqual` against the complete reason string, never `toContain` on a
tripwire/reason message).

Not independently re-inverted via a scratch mutation this round — the claimed red-proof
process (invert each expected string, confirm each fails with its own correct-but-mismatched
`Received:`, restore) is corroborated by the hand-trace above, which independently confirms
each fixture cannot reach any branch but its own; re-running the identical inversion
apply-progress already performed would not add evidence beyond that trace.

### (3) Baseline: no assertion in the pre-existing 24 weakened

`git show f8d6444 -- test/fitness/fit-23-publish-workflow-guard.test.ts` is **purely
additive** — 0 removed lines in the test file (only the 3 new `it()` blocks appended inside
the existing `"FIT-23 S-000 — REQ-PPI-03.1..."` describe block). No existing assertion,
describe block, or fixture was touched. Confirmed by diff, not by re-reading descriptions.

### (4) apply-progress.md edits match what iteration 1 demanded

Read `git show f8d6444 -- openspec/changes/runner-tripwire-invariants/apply-progress.md` in
full:

- **"Deviations / halts" reconciled**: no longer states bare "None" against its own
  documented `cwd` deviation. Now explicitly names the deviation, explains why the literal
  `cwd: <scratchRoot>` reading is infeasible, and **cites `verify-in-loop-1.md`'s ACCEPTABLE
  ruling by name** ("ruled it **ACCEPTABLE — faithful to REQ-PPI-01's intent, not the R1-12
  anti-pattern**"). Matches exactly what iteration 1 asked for.
- **Residual narrow-proof risk sentence added**: new "Residual note: manifest-only rebuild
  shortcut's narrow-proof risk" section reproduces the SUGGESTION's substance (today's
  proof is sound because `dist/*.js` bytes don't depend on the stamped version; a future
  version-coupling would slip past this narrower proof) without overclaiming it as a live
  defect. Matches.
- **New "Verify in-loop iteration 1" / "Fix: checkSuiteGate triangulation gap" sections**:
  accurately summarise the `NEEDS_FIX` finding and the fix, with a fixture→branch table
  matching the actual 3 tests, and per-file counts (27/27, 44 expects) matching the
  independently re-run numbers above.
- Gate-results numbers updated (2459→2462, 24→27 for fit-23) and cross-referenced with a
  before/after note — accurate against the re-run.

No unaddressed demand from iteration 1 remains open.

### (5) Leftover TEMP/inverted markers

Scanned the full delta (`test/fitness/fit-23-publish-workflow-guard.test.ts`,
`apply-progress.md`, plus `fit-46-publish-sequence-integrity.test.ts`,
`react-conformance.test.ts`, `publish.yml` for completeness) for `TEMP`, `TODO`, `FIXME`,
`XXX`, `__TMP__`, `inverted`, and any stray scratch-file naming (`zz-scratch`,
`scratch-fit-46`, etc.). Matches found are all legitimate: `TEMPLATE_LITERAL_LOOKALIKE`
(unrelated fixture name), `mkdtempSync` (real Node API), and `apply-progress.md` narrative
prose describing the (already-reverted) manual inversion process — no residual code
mutation, no stray files. `git status --porcelain -uall` is clean (no untracked or modified
files in the worktree beyond what's committed).

---

### Issues

None.

### Routing: none — verdict PASS

Orchestrator action: exit the in-loop GAN cycle for S-000. Proceed to `/evaluate`
(`sdd-verify --mode=final`) before archive, per the standard PASS path.
