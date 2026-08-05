# Verify (in-loop, iteration 1) — `sdk-plain-error-note`

**Verdict**: `pass`

Scope: `git diff b5d4339..HEAD` — five commits (`abd9736`, `9e2584c`, `c78eb5b`, `d2339bc`,
`3b7885c`), branch `feat/sdk-plain-error-note`. Read-only review; no `src/`/`test/` edits made
by this verifier. All working-tree mutations made during verification (stubbing
`error-text.ts` back to earlier commits to re-derive a red proof) were restored byte-identical
before this report was written — confirmed via `diff` producing no output.

---

## 1. REQ coverage

| REQ-ID | Added by this change / pre-existing (reused) | Covering test | Verdict |
|---|---|---|---|
| REQ-RUN-09 (branch exists) | added | `test/fake/exit-matrix.e2e.test.ts:124-130` (case (d), CRASH_POINTER) | covered |
| REQ-RUN-09.1 | added | `test/transport/runner.unit.test.ts:296-306` (`PLAIN_ERROR_POINTER`, exact stderr string) | covered |
| REQ-RUN-09.2 | added | `test/transport/runner.unit.test.ts:308-316` (`THROW_NON_ERROR_POINTER`) | covered |
| REQ-RUN-09.3 | added | `test/transport/runner.unit.test.ts:318-346` (3 cases: `CURATED_AUTHORING/TRANSPORT/INTENT_POINTER`, byte-identical) | covered |
| REQ-RUN-09.4 | added | `test/transport/runner.unit.test.ts:348-357` (`LONG_PLAIN_ERROR_POINTER`, length assertion) | covered |
| REQ-WPS-07.1 | **pre-existing** (untouched by this diff — confirmed via `git diff` hunk headers, only lines after 71 of `error-text.unit.test.ts` changed) | `test/transport/error-text.unit.test.ts:20-36` | covered, inherited — not new coverage from this change |
| REQ-WPS-07.2 | **pre-existing** | `test/transport/error-text.unit.test.ts:38-55` | covered, inherited |
| REQ-WPS-07.3 | **pre-existing** | `test/transport/error-text.unit.test.ts:57-75` | covered, inherited |
| REQ-WPS-07.4 | added (uncurated-content-class addendum) | unit: `error-text.unit.test.ts:77-150`; e2e: `exit-matrix.e2e.test.ts:317-325,359-381` | covered |
| REQ-WPS-07.5 | added | unit: `error-text.unit.test.ts:152-157`; in-process: `runner.unit.test.ts:359-369`; e2e: `exit-matrix.e2e.test.ts:347-357` | covered |
| REQ-WPS-07.6 | added (V2 UNC/WSL closure) | unit: `error-text.unit.test.ts:102-115`; e2e: `exit-matrix.e2e.test.ts:327-345` | covered |

No `req-coverage-gap`. All 4 REQ-RUN-09 scenarios and all 3 new REQ-WPS-07 scenarios
(.4/.5/.6) that this change owns have an executing test. REQ-WPS-07.1-.3 are correctly
NOT credited to this change — verified by diff hunk headers that those test blocks are
byte-untouched (`git diff` for `error-text.unit.test.ts` only touches the import list and
lines after 71; the pre-existing describe blocks start at line 20).

## 2. Proof spot-check (re-derived independently)

Re-derived S-002's red proof myself rather than trusting the transcript:

1. Confirmed `.tmp-shared-build.lock` (pid `610457`) was stale — `ps -p 610457` returned no
   matching process — removed it per the operational discipline this change's own
   `apply-progress.md` documents.
2. `git show c78eb5b^:src/transport/error-text.ts` → diffed against the current file:
   confirmed the pre-S-002 version is exactly the identity stub the transcript describes
   (`return message` unconditionally, `WINDOWS_UNC_ABS_PATH`/`POSIX_ABS_PATH` absent).
3. Swapped that stub into `src/transport/error-text.ts`, ran
   `bun test test/transport/error-text.unit.test.ts`:
   ```
   12 pass
   9 fail
   ```
   Failure content matched the claimed transcript exactly, case for case: Windows
   backslash, Windows forward-slash, UNC, `wsl.localhost`, `wsl$`, `file://`-embedded, and
   the "disclosure decision" deep-root case — each received value was literally the
   unscrubbed input, i.e. the stub returning its argument unchanged. (Pass/fail counts
   differ slightly from the S-002 section's `11 pass / 8 fail` because the test file has
   grown since — it now also contains S-003's later-added disclosure-decision case, which
   fails identically for the same reason — this is expected, not a discrepancy.)
4. Restored the real implementation; `diff` against the pre-revert copy produced no output
   — byte-identical restoration, confirmed clean.

**Verdict**: the proof is real, not prose. The claimed red failures are exactly reproducible
against the exact pre-S-002 code the transcript names.

## 3. Test strength (security-bearing assertions)

Reviewed every assertion in `scrubAbsolutePaths` coverage and the live disclosure proof:

- `error-text.unit.test.ts` assertions are overwhelmingly `.toEqual` against the FULL
  composed string (e.g. `error-text.unit.test.ts:92,98,104,109,114`) — these fail on any
  regression, partial match, or over/under-scrub. Strong.
- The prose-survival cases (`error-text.unit.test.ts:122-130`) assert `.toEqual(message)` —
  byte-equality against the ORIGINAL input — which fails if the matcher ever over-matches
  ordinary prose. Strong, not a weak identity-trivially-passes case dressed up as a proof.
- The live e2e leak-absence assertions (`exit-matrix.e2e.test.ts:317-345`) use
  `.not.toContain(canary)` against a per-test randomly-generated canary token
  (`test/support/canary.ts`). Unlike a generic `.not.toContain("/absolute")`, this would
  fail immediately if the scrub regressed to a no-op or partial match, because the canary
  is unique per test run and would appear verbatim in the unscrubbed case. Not weak.
- The POSIX "disclosure decision" e2e case (`exit-matrix.e2e.test.ts:359-381`) uses
  `.toContain` with the FULL exact composed note (not a substring probe) — verified
  independently confirmed by point 2 above. Strong.

No weak assertions found in the security-bearing surface.

## 4. Suite

Ran once, alone, after confirming the working tree was clean and the stale lock was removed:

```
$ bun test
 2676 pass
 0 fail
 7434 expect() calls
Ran 2676 tests across 202 files. [88.69s]

$ bunx tsc --noEmit
(exit 0, no diagnostics)
```

Matches the claimed baseline (`2676 pass / 0 fail`) exactly.

## 5. Scope discipline

`git diff b5d4339..HEAD -- src/transport/exit-codes.ts` — empty. `classifyExitCode` is
untouched; only `src/transport/error-text.ts` and `src/transport/runner.ts` changed in
`src/`, matching design §4.2's file-changes table exactly. No new exit code, no
reclassification, nothing outside `src/transport/` and `test/`. No smuggled scope found.

## 6. The ADR-02 design deviation

Verified directly, not taken on faith. Ran both regexes against
`"config resolved from file:///home/user/project/x.json"`:

- Design §4.4's illustrative regex (`/(?:[A-Za-z]:[\\/]|\\\\)[^\s'"<>]*/g`) matches
  `"e:///home/user/project/x.json"` — the `e` of `file` misread as a drive letter — and
  mangles the message to `"config resolved from fil<outside-project>"`.
- The shipped regex (`/(?:(?<![A-Za-z0-9_])[A-Za-z]:[\\/]|\\\\)[^\s'"<>]*/g`, with the added
  negative lookbehind) does not match that substring at all, leaving it for
  `POSIX_ABS_PATH` to correctly scrub only the `/home/user/project/x.json` segment.

**(a) Real** — confirmed by direct execution, not inference. **(b) Correctly fixed** —
confirmed; the lookbehind excludes exactly the false-positive case and nothing else
(residual precision cost — a drive letter with zero delimiter before it, e.g.
`seeC:\Users\x.ts` — is explicitly named as an accepted, out-of-scope gap in
`apply-progress.md`'s Known Gaps). **(c) Documented** — yes, extensively: the code comment
at `src/transport/error-text.ts:53-58` explains the lookbehind's purpose in terms of the
code's own behavior (not workflow), and `apply-progress.md`'s S-002 "Deviations" section
gives the full before/after reasoning.

**design.md recommendation**: **correct the regex**, don't just annotate it. Design §4.4
labels its regex "illustrative (not final)" and disclaims exact-behavior authority to
`sdd-apply` — but the specific bug here isn't a harmless simplification, it directly
contradicts the design's OWN stated intent one paragraph later (§4.2/§4.6: "the embedded
`/home/user/project/x.json` segment is already matched by the existing `POSIX_ABS_PATH`
pass — no new matching logic"). A footnote annotation would still leave a regex in the doc
that, if copy-pasted by a future reader implementing something similar, reproduces the
exact bug this slice had to hand-verify and fix. The fix is a one-line diff
(`+(?<![A-Za-z0-9_])` before the drive-letter branch) — cheap enough that correcting beats
annotating.

## 7. Comment hygiene

Scanned every added comment in the diff for workflow/slice-number references (forbidden per
project convention — REQ-IDs are fine, they describe what requirement the code satisfies;
slice IDs describe HOW the code was built, which is workflow provenance).

**Findings** (`followup`, not blocking):

- `test/transport/error-text.unit.test.ts:133` — `// S-002's own shallow case (...)` 
- `test/transport/error-text.unit.test.ts:145` — `// Depth survives: ... (not S-002's single-level case).`
- `test/transport/error-text.unit.test.ts:153` — test description string: `"...same as the prose-survival cases above (S-002's own precedent)"`
- `test/fake/exit-matrix.e2e.test.ts:303` — `// REQ-WPS-07.4/.5/.6 (S-003) — disclosure rule holds, ...`

All four are new-to-this-diff (confirmed via `git diff` — not pre-existing header comments
carried from earlier changes, which the file does also contain at lines 1/6/8/85 and which
are correctly out of scope for this review). Each references a slice number to explain a
test's relationship to another test's history, rather than describing the code/test's
present behavior. Low severity — test-only, doesn't touch runtime behavior or spec
conformance — but a literal instance of the forbidden pattern. Fix: reword to describe the
CASE being contrasted (e.g. "the earlier shallow-root case above", "the earlier
single-level case") instead of the slice label.

No other comment-hygiene issues found; the extensive REQ-ID/ADR-ID comments throughout the
diff (`REQ-RUN-09.1 fixture`, `ADR-02`, etc.) are the established project convention for
naming which requirement a piece of code satisfies, not workflow narration, and are not
flagged.

---

## Findings summary

| # | Severity | Evidence | Fix |
|---|---|---|---|
| 1 | followup | `design.md` §4.4 illustrative `WINDOWS_UNC_ABS_PATH` regex mis-fires on `file://` (reproduced directly, section 6 above); shipped code already fixes it | Add the negative lookbehind `(?<![A-Za-z0-9_])` to design.md's illustrative regex so it matches the shipped code |
| 2 | followup | 4 new comments/test-descriptions reference slice IDs (`S-002`/`S-003`) instead of describing the code — `test/transport/error-text.unit.test.ts:133,145,153`, `test/fake/exit-matrix.e2e.test.ts:303` | Reword to describe the contrasted test case, not its slice label |

No blockers. Neither finding blocks a signed REQ or the change's stated outcome (a
descriptive schematic-factory error reaching the operator instead of
`engine_native_system_fault, exit 5, empty detail`) — both are documentation/hygiene
polish.

## proof_spotcheck

Re-derived S-002's red proof (see section 2) by reverting `src/transport/error-text.ts` to
the exact pre-S-002 identity stub (`c78eb5b^`) and running
`bun test test/transport/error-text.unit.test.ts`. Observed failure content — which cases
fail and what they receive vs. expect — matched the claimed transcript exactly. Working
tree restored byte-identical afterward (`diff` empty).

## risks

None new. The documented residual (non-path-shaped secrets pass through unscrubbed,
REQ-WPS-07.5) is a deliberate, spec-mandated, explicitly-tested contract, not an
undocumented risk.

## skill_resolution

`injected` — `.atl/skill-registry.md` for `project-builder-sdk` present and empty
(`skills: []`), greenfield project, not a halt condition.
