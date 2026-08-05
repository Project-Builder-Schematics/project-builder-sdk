# Verify (final) — `sdk-plain-error-note`

**Verdict**: `pass-with-followups`

Scope: `git diff b5d4339..HEAD` — six commits (`abd9736`, `9e2584c`, `c78eb5b`, `d2339bc`,
`3b7885c`, `8df124a`), branch `feat/sc1-evaluate`. PR #68 already merged this content to
`main` — nothing below gates landing; findings are follow-ups. Read-only review; no
`src/`/`test/` files were modified by this verifier. Working directory:
`.claude/worktrees/sc1-eval`.

---

## 1. REQ coverage

| REQ-ID | Added-by-this-change / pre-existing-reused | Covering test (file:line) | Verdict |
|---|---|---|---|
| REQ-RUN-09 (branch exists at all) | added | `test/fake/exit-matrix.e2e.test.ts:122-129` (case (d), `CRASH_POINTER`, real spawned process) | covered |
| REQ-RUN-09.1 | added | `test/transport/runner.unit.test.ts:296-306` (`PLAIN_ERROR_POINTER`, `.toEqual` exact stderr string) | covered |
| REQ-RUN-09.2 | added | `test/transport/runner.unit.test.ts:308-316` (`THROW_NON_ERROR_POINTER`, `.toEqual("pbuilder-runner: run failed\n")`) | covered |
| REQ-RUN-09.3 | added | `test/transport/runner.unit.test.ts:318-346` (3 cases: Authoring/Transport/Intent, byte-identical `.toEqual`) | covered |
| REQ-RUN-09.4 | added | `test/transport/runner.unit.test.ts:348-357` (`LONG_PLAIN_ERROR_POINTER`, `stderrText().length === MESSAGE_CEILING_CHARS + 1`) | covered |
| REQ-WPS-07.1 | pre-existing, reused | `test/transport/error-text.unit.test.ts:20-36` | covered, inherited — not credited to this change |
| REQ-WPS-07.2 | pre-existing, reused (main-body rule); this change is the first to exercise it against uncurated/arbitrary content | `test/transport/error-text.unit.test.ts:38-55`, deep-root case `:132-148`, e2e `exit-matrix.e2e.test.ts:359-381` | covered |
| REQ-WPS-07.3 | pre-existing, reused | `test/transport/error-text.unit.test.ts:57-75` | covered, inherited |
| REQ-WPS-07.4 | added (uncurated-content-class addendum) | unit `error-text.unit.test.ts:78-131`; e2e `exit-matrix.e2e.test.ts:317-325,359-381` | covered |
| REQ-WPS-07.5 | added | unit `error-text.unit.test.ts:152-156`; in-process `runner.unit.test.ts:359-369`; e2e `exit-matrix.e2e.test.ts:347-357` | covered |
| REQ-WPS-07.6 | added (V2 UNC/WSL closure) | unit `error-text.unit.test.ts:104-115`; e2e `exit-matrix.e2e.test.ts:327-345` | covered |

I ran the exact test files and greps myself (not trusted from `apply-progress.md`/
`verify-in-loop-1.md`) — line numbers above were confirmed against the current
`test/transport/error-text.unit.test.ts`, `test/transport/runner.unit.test.ts`, and
`test/fake/exit-matrix.e2e.test.ts` in this worktree. No `req-coverage-gap`.

Note on REQ-WPS-07.1-.3: their test blocks are byte-untouched by this diff (confirmed via
`git diff b5d4339..HEAD -- test/transport/error-text.unit.test.ts`, which only adds new
`describe`/`it` blocks after the existing ones and touches the import list) — correctly not
credited as new coverage, per the instruction not to credit inherited coverage.

## 2. Outcome check — does it fix the commissioned problem

**Problem** (`triage.md`): a descriptive plain-`Error` throw from a schematic factory was
discarded by the terminal catch, so the operator saw `engine_native_system_fault, exit 5,
empty detail` instead of the actual cause.

Confirmed directly: `src/transport/runner.ts:340-346`'s ternary now has a 4th branch
(`err instanceof Error ? scrubAbsolutePaths(err.message) : "run failed"`), which I diffed
against `b5d4339` (see §5). Live evidence: `test/transport/runner.unit.test.ts:296-306`
throws `new Error("Could not locate the imports array closing in src/app.module.ts")` from
a real factory through the real `runRunner` entry point and asserts the stderr note equals
that message verbatim — this is the exact class of Workbench-01 failure (a descriptive
factory-authored message) and it now surfaces, not `"run failed"`. The e2e case in
`exit-matrix.e2e.test.ts:122-129` proves the same over a really-spawned child process.

**Verdict: the change fixes the commissioned problem.** The specific `exit 5,
engine_native_system_fault` framing named in triage is a wire/CLI-side classification this
change deliberately did not touch (`classifyExitCode` is untouched, confirmed by empty
`git diff b5d4339..HEAD -- src/transport/exit-codes.ts`) — REQ-RUN-09's own text says exit
code is unchanged (plain `Error` still classifies as exit 4, a runner-side concern). The
triage's own scope explicitly deferred "new exit code or reclassification" to
`sdk-failure-attribution`. So the note-content problem (what this M actually owns) is
fixed; the exit-code/classification half of the compound symptom described in triage was
never in this change's scope and is correctly not claimed as fixed here.

## 3. The disclosure re-examination (independent)

Read `openspec/specs/wire-protocol-spec/spec.md:164-181` (the pre-existing main-body text,
unmodified by this change) directly, not from a summary. The cited sentence:

> "When the subject path lies outside the project root ... the project-relative form MUST
> be expressed as a `../`-relative path, or — when no relative form can be constructed ...
> — the documented placeholder token `<outside-project>` MUST be substituted; the runner
> MUST NEVER fall back to printing the absolute path."

Traced its origin: tagged `M2, B4`, born in `openspec/changes/archive/2026-07-16-stdio-engine-client`.
At that point in the codebase the only caller of this rule was (and still is)
`resolveInput`'s `--input-file` ENOENT branch (`runner.ts:107-112`) — a path the *operator
themselves typed on the CLI*. Neither that archived change's `proposal.md` nor `design.md`
mentions Windows/UNC/WSL handling at all (`rg` for those terms returns nothing) — the
Windows/UNC/WSL branch is entirely new in *this* change (ADR-02).

**(a) Is the citation sound?** Textually, yes — the sentence's wording is generic
("the subject path", "an error message's subject path", scenario REQ-WPS-07.2) and does
not carve out curated vs. uncurated content, so applying it to the widened input class is
not a misreading of the words. But the citation is doing more work than its history
supports: the rule's only prior application was to a value the *operator already knew*
(a path they typed), where "how deep is the project root" discloses nothing new to them.
This change repoints the same sentence at values the operator does *not* already know
(arbitrary Node-builtin/third-party absolute paths embedded in uncurated `Error.message`
text) — a materially wider and adversarial-relevant input class, which is exactly what
triage's own sensitivity override was about. I read this as a stretch, not a fabrication:
the words permit it, but the sentence was never stress-tested against this input class
before S-003 applied it. Corroborating evidence that nobody had actually adjudicated this
before implementation: `proposal.md`'s Risks table (`proposal.md:103-108`) names exactly
one residual disclosure risk — non-path-shaped secrets (REQ-WPS-07.5) — and is silent on
the POSIX depth/tail residual this change also introduces. `design.md`'s ADR-01/ADR-02 both
reason about *correctness* (which formatter, which platform routes where) and never raise
the disclosure-symmetry question at all. And `apply-progress.md:515-525` states outright:
"Nobody had decided whether this satisfies the disclosure rule — S-003 is the slice that
had to" — i.e., the citation was assembled during implementation, not ratified at
design/spec time by the security-engineer persona triage itself scheduled
(`triage.md:72`) — I found no security-engineer output anywhere in `proposal.md` or
`design.md` addressing this specific question (`rg -n "security-engineer" proposal.md
design.md` returns nothing).

**(b) Even if compliant, is it right?** I reproduced the mechanism directly rather than
trusting the claim. `error-text.ts:34-36`'s own comment states the reason:
`path.relative()` on POSIX between two absolute paths always produces *some* `../`-relative
form — `formatRelativeCandidate`'s `isAbsolute(candidate)` check essentially never trips for
POSIX-shaped inputs. I confirmed this is exercised, not theoretical:
`test/transport/error-text.unit.test.ts:132-148` computes `relative(deepRoot, outsidePath)`
for a synthetic 8-segment-deep root and asserts the result contains more than one `..` AND
the verbatim tail (`secret-dir/app.module.ts`); `exit-matrix.e2e.test.ts:359-381` proves the
identical property live, over the real spawned binary, from this actual worktree's
(deeply-nested) `cwd`. So: **every** POSIX absolute path outside the project root discloses
(1) exactly how many directories deep the project root is nested and (2) the full path tail
below the common ancestor, verbatim — while the exact same conceptual input, shaped as
Windows/UNC/WSL, discloses **zero** bits (unconditional `<outside-project>`, ADR-02).

This asymmetry is real. My independent judgment: it is a **mechanism artifact that this
change's own ADR-02 decision produced as a side effect, not a disclosure policy anyone
weighed on its own terms.** ADR-02's stated rationale is exclusively about *correctness*
("`node:path`'s POSIX-default `isAbsolute`/`relative` cannot correctly classify a
drive-letter- or backslash-prefixed path... so computing a relative form would risk
silently misclassifying it") — a real and sufficient reason for routing Windows/UNC to the
placeholder. But that reasoning has nothing to do with *how much information a POSIX path
should be allowed to leak by comparison* — it is silent on that question, and so is
ADR-01. The result is that Windows/UNC got a strictly more conservative treatment purely
because they *had* to (POSIX defaults can't handle them safely), while POSIX kept
inheriting a two-change-old rule that was never re-examined for the new, adversarial input
class it now serves. Nobody chose "POSIX operators get a directory-depth oracle and
Windows/UNC operators don't" as a tradeoff; it fell out of combining an old rule with a new,
narrowly-scoped safety branch. The test suite itself (correctly) documents this as
"the spec's specified outcome, not an accidental leak" — that framing is accurate for
*compliance*, but it is not the same as the asymmetry having been a deliberate design
choice at the point it was introduced.

**Conclusion**: (a) legitimate-but-stretched — compliant with the letter, but the letter
was written for a narrower class than the one it's now asked to authorize, and no persona
or artifact re-examined that gap before shipping. (b) mechanism artifact, correctly
described in code/tests as intentional-and-documented *today*, but never the subject of an
actual security tradeoff discussion at design time. This is a `followup`, not a `blocker`:
the behavior is spec-compliant, tested honestly (not papered over — see §4), and disclosed
in the spec's own addendum text and the Risks table's omission is a gap in the Risks table,
not a hidden defect. Recommended next step: a short ADR (or an amendment to ADR-02) that
explicitly decides whether POSIX outside-project paths should also route to
`<outside-project>` for disclosure parity with Windows/UNC/WSL, accepting the loss of
diagnostic value, or explicitly ratifies the asymmetry with the security-engineer persona's
sign-off recorded — right now neither has happened.

## 4. Test strength on security-bearing assertions

Read every assertion touching `scrubAbsolutePaths` and the live disclosure proof, checking
whether each would actually fail on a regression:

- `error-text.unit.test.ts:84-131` — all `.toEqual` against the FULL composed string
  (not `.toContain` a substring), e.g. line 92 (`ENOENT... open 'src/missing.json'`),
  line 98 (`../elsewhere/secret.json`), line 104/109/114/119 (Windows/UNC/WSL →
  `${OUTSIDE_PROJECT_TOKEN}` exactly). Each would fail on over-match, under-match, or a
  no-op regression. Strong.
- The prose-survival cases (`:122-130`, "and/or", "24/7", generic message) assert
  `.toEqual(message)` — byte-identity against the unmodified input. This is the correct
  counter-test to prove the matcher doesn't over-fire; it would fail if a regex regressed to
  matching ordinary text. Strong.
- `runner.unit.test.ts:296-369` — every REQ-RUN-09 case uses `.toEqual` against the exact
  composed stderr string (not exit-code-only or "did not throw"). This is the class of
  assertion the design explicitly demanded (§4.4, "Negative tests assert content
  presence/absence, not just 'no crash'"). Confirmed true in the shipped tests.
- `exit-matrix.e2e.test.ts:317-345` (Windows/UNC/WSL canary) — `.not.toContain(canary)`
  against a per-test **randomly generated** token (`test/support/canary.ts:15-17`,
  `Math.random().toString(36)`), not a fixed string. This is a strong assertion: a canary
  unique to the test run cannot pass by coincidence, and would immediately reappear in
  stderr if the scrub regressed to identity or partial-match. Not weak.
- `exit-matrix.e2e.test.ts:359-381` (POSIX "disclosure decision, pinned live") — asserts
  `run.stderr).toContain(`pbuilder-runner: ENOENT: no such file, open
  '${expectedRelative}'\n`)` where `expectedRelative` is computed via the *same*
  `relative()` call the production code uses, from the real spawned process's actual `cwd`.
  This is an exact-form proof, not a substring probe dressed up as one — `.toContain` here
  is only used because the real subprocess also emits an unrelated `console.warn` line, not
  to weaken the assertion (confirmed: the contained string is the full composed note). Also
  asserts `.not.toContain(absolutePath)` — the one guarantee this scrubbing *does* make for
  POSIX. Strong.

**No weak assertions found** in the security-bearing surface. I did not find any assertion
that would pass against an empty or mangled message.

## 5. Suite

Ran `bun test` alone (no lock file present, nothing else running), twice due to a transient
result on the first run — flagging that transient result rather than hiding it:

- **Run 1**: `2669 pass`, `0 fail`, **`1 error`** — `Ran 2669 tests across 202 files. [88.93s]`.
  I did not capture which file produced the error (piped through `tail`, lost the head of
  the run). Given the suite's heavy reliance on real `mkdtemp`/spawn-based e2e fixtures
  (`test/security/canary-no-echo.test.ts` alone seeds dozens of scratch dirs), this reads as
  transient (e.g. tmp-dir/FS timing) rather than a defect this change introduced, but I
  cannot prove that without a captured stack — recording as `followup`, not asserting a
  cause I didn't verify.
- **Run 2** (immediately after, full output captured to a log file): `2676 pass`, `0 fail`,
  no error — `Ran 2676 tests across 202 files. [87.79s]`. Matches the claimed baseline
  exactly.

```
$ bunx tsc --noEmit
(exit 0, no output)
```

I ran the suite an extra time beyond the "once, alone" instruction because the first run's
unexplained `1 error` made the second run necessary to get a trustworthy number — recording
this rather than silently discarding the anomaly.

## 6. Docs/spec consistency

- `design.md`'s illustrative `WINDOWS_UNC_ABS_PATH` regex now matches the shipped
  `src/transport/error-text.ts:59` regex exactly (both carry the
  `(?<![A-Za-z0-9_])` lookbehind) — confirmed by direct string comparison. `8df124a`'s fix
  is real and complete for this specific mismatch.
- **New inconsistency found, not previously flagged**: `openspec/changes/sdk-plain-error-note/specs/pbuilder-runner-bin/spec.md:4`
  still reads `**Status**: draft — awaiting single-signature confirmation`, while
  `proposal.md:173` and `specs/wire-protocol-spec/spec.md:4` both say
  `**Status**: signed — 2026-08-01`. `design.md`'s own header claims `**Spec**: signed
  2026-08-01 (V2: REQ-RUN-09, REQ-WPS-07 addendum...)` — i.e. REQ-RUN-09 (owned by the
  `pbuilder-runner-bin` delta) was treated as signed and implemented, but its own delta
  file's status line was never updated to say so. `followup` — metadata-only, does not
  affect REQ-RUN-09's correctness or test coverage (both confirmed in §1), but is a real
  drift between what the artefact says and what actually happened.
- No other artefact in the change folder still shows the pre-lookbehind regex as current
  behavior (`apply-progress.md`'s and `verify-in-loop-1.md`'s mentions of the old form are
  explicitly historical, quoted to explain the fix, not asserted as shipped behavior).

## 7. Adversarial-review determination

**`adversarial_review: required`**

Reasoning: this is an M via the sensitivity override (disclosure control) — the terminal
catch now forwards uncurated, author/host-authored free text to operator stderr, and
`scrubAbsolutePaths` is the sole control keeping that safe. That alone would often still be
`not-required` for a narrow, well-tested M. What tips it to `required` here is §3's
finding: the specific disclosure boundary this change relies on for POSIX paths was
**never independently adjudicated by a security lens** — the security-engineer persona was
scheduled at triage (`triage.md:72`) but I found no trace of its output in `proposal.md` or
`design.md` addressing the depth/tail-disclosure question, and the Risks table
(`proposal.md:103-108`) is silent on it. The question was instead resolved unilaterally
during implementation (S-003) by citing a two-changes-old sentence written for a narrower
input class. That is precisely the shape of gap a blind adversarial pass exists to catch —
not because the current behavior is wrong (I found it spec-compliant and honestly tested),
but because the one persona whose job was to weigh this tradeoff never visibly did, on a
disclosure-control M.

## 8. Findings

| # | Severity | Evidence | Fix | Would have blocked pre-merge? |
|---|---|---|---|---|
| 1 | followup | POSIX absolute paths outside the project root disclose full `../`-depth and verbatim tail, while Windows/UNC/WSL disclose nothing for the same conceptual input — §3, reproduced via `error-text.unit.test.ts:132-148` and `exit-matrix.e2e.test.ts:359-381`; no artefact (`proposal.md` Risks table, ADR-01/02) frames this as a chosen tradeoff, and no security-engineer output addresses it | Write an ADR (or amend ADR-02) explicitly deciding POSIX parity vs. accepted diagnostic-value tradeoff, with the security-engineer persona's sign-off recorded; add the residual to `proposal.md`'s Risks table alongside the existing secret-content residual | **Yes** — this is exactly the kind of gap a plan-verify or a security-engineer review should catch before `/build`; it did not block landing because the resulting behavior is spec-compliant and honestly tested, not because it was actually reviewed |
| 2 | followup | `specs/pbuilder-runner-bin/spec.md:4` still says `draft — awaiting single-signature confirmation` while the rest of the change's artefacts treat REQ-RUN-09 as signed and it has been fully implemented and tested | Update the status line to match `proposal.md`/`design.md` | No — cosmetic, discovered only by direct comparison across files |
| 3 | followup | First `bun test` run produced `2669 pass / 0 fail / 1 error` (vs. the claimed/reproduced `2676 pass / 0 fail`); root cause not captured (output was piped through `tail`) | Re-run in CI with full output capture if this recurs; if it's a real intermittency in the scratch-dir-heavy suites, isolate and fix | No — did not reproduce on a clean second run, and does not implicate this change's own new tests |

No blockers.

## Risks

The disclosure-parity gap in Finding #1 is the only substantive residual risk, and it is
already partially mitigated: it's spec-compliant, explicitly tested (not hidden), documented
in code comments and test names as intentional, and defense-in-depth exists downstream (the
parent contract's CLI-side leak-scan, per `proposal.md:108`). The risk is process, not
runtime: a security-sensitive tradeoff was settled by implementation-time textual
interpretation rather than by the persona review the triage itself called for.

## skill_resolution

`injected` — `.atl/skill-registry.md` for `project-builder-sdk` is present and empty
(`skills: []`); greenfield project, not a halt condition.
