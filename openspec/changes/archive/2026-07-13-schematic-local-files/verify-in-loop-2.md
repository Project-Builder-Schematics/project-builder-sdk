## Verify In-Loop Result

**Change**: schematic-local-files
**Iteration**: 2/3
**Scope**: S-000 (walking skeleton) — fix-attempt delta: single commit `ec0c74a`
**Mode**: in-loop (Strict TDD)
**Delta files**: `test/e2e/scaffold.e2e.test.ts` (+93 lines, 3 new tests), `openspec/changes/schematic-local-files/apply-progress.md` (evidence correction + addendum). `src/scaffold/index.ts` untouched — verified via the commit's own file stat (only the two files above changed).

---

### Verdict: PASS

Both iteration-1 findings are resolved with verified evidence. No regressions.

- Tasks in scope complete: 7/7 (unchanged from iteration 1)
- Full suite: 875 pass / 0 fail / 1595 expect() calls (`bun test`) — +3 tests / +14 assertions vs iteration 1's 872/1581, exactly the three branch tests
- Typecheck: clean (`tsc --noEmit`, exit 0)
- Isolated spot-run of the modified file: `test/e2e/scaffold.e2e.test.ts` — 8 pass / 0 fail
- Assertion audit (delta): clean — all three new tests assert exact reason + exact full message + empty committed tree; no banned patterns

Orchestrator action: exit the S-000 loop. Proceed to `/build --scope=slice:S-001`
(final-mode verify happens once, at change completion, per the mode contract).

---

### Finding 1 (CRITICAL, untested branches) — RESOLVED

Each new test was read and its fixture traced to the branch it claims (test names were
not accepted as evidence):

| Branch (`src/scaffold/index.ts`) | New test | Branch-reach verification |
|---|---|---|
| ENOENT / not-found (lines 79-87) | "a templateFile that does not exist rejects invalid-input... (ENOENT branch)" | Fixture never writes `missing.ts.template`, so `statSync` throws ENOENT. The asserted exact message (`"does not exist in the package"`) is emitted ONLY by `templateFileNotFoundMessage` — no other branch can produce it. Also pins REQ-PRC-05 posture: `message).not.toContain(dir)` (no absolute-path leak). |
| Generic non-ENOENT stat failure / unreadable (lines 88-94) | "a non-ENOENT stat failure (ENOTDIR...) rejects invalid-input as unreadable, never as not-found" | `blocker.txt` is a regular file; statting `blocker.txt/nested.template` throws ENOTDIR — deterministic, chmod-free (honors the project's S18 no-chmod-CI-fixture rule). The asserted exact message (`"could not be read"`) is unique to `templateFileUnreadableMessage`; an implementation collapsing this into the ENOENT arm would emit the not-found message and fail the assertion. |
| Serialized-size-only overage (lines 128-136) | "raw bytes under budget but JSON-serialized form over budget rejects invalid-input" | 3 MiB of `\n`: the in-test guard `expect(rawSize).toBeLessThan(BATCH_CAP_BYTES)` proves the stat gate (line 100) passes; newline content passes the sniff (valid UTF-8, no nulls); `JSON.stringify` escapes each `\n` to two chars → ~6 MiB serialized, over the 4 MiB cap. The oversized message is shared between the stat and serialized branches, but the fixture makes the stat branch unreachable, and reason `invalid-input` excludes the only other candidate rejector (the fake's batch cap surfaces as `changes-too-large`) — so only the serialized branch can green this test. |

All six conditional branches of `readTemplateFile` now have at least one driving test
(the original three — no-anchor, raw-stat overage, binary sniff — plus these three).
Triangulation gap closed.

### Finding 2 (WARNING, false TDD citation) — RESOLVED

`apply-progress.md`'s RED-evidence paragraph was rewritten. It now: (a) explicitly states
the commit order does NOT reflect test-first ("both `feat` commits (4558bb2, 3f82bce)
precede the `test` commit (7b3710b) in `git log`"), matching the actual log this verify
re-checked; (b) declares commit history "NOT usable as RED-first evidence for this
slice"; (c) re-grounds the RED claims in in-session runner output (quoted failure
messages) and, for the three new characterization tests, per-branch mutation evidence
(one branch broken at a time, failure observed, mutant reverted, post-revert diff empty).
No remaining claim contradicts a reader's `git log`. The mutation-evidence narrative is
consistent with the commit contents (`src/scaffold/index.ts` absent from the commit's
file stat), though the mutant runs themselves are session-transcript claims — acceptable
at in-loop granularity given the fixture-logic analysis above independently proves each
test is branch-sensitive.

### Regression sweep (delta-focused)

- The commit adds tests and edits a progress artefact only — zero production-code surface.
- Full suite green (875/0), no previously-passing test now fails.
- Typecheck clean.
- Working tree: only the pre-existing orchestrator-owned `.sdd/state/schematic-local-files.json`
  modification and the untracked `verify-in-loop-1.md` report — no code touched by this review.

### In-Loop History

| Iteration | Verdict | Issues |
|---|---|---|
| 1 | NEEDS_FIX | CRITICAL: 3 untested `readTemplateFile` branches; WARNING: false git-history TDD citation |
| 2 | PASS | Both resolved; +3 branch tests, evidence paragraph corrected |
