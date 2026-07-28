## Verify In-Loop Result

**Change**: inline-collection-marker
**Iteration**: 2/3
**Scope**: S-001 (path-guards TOTAL hardening) only — S-000 verified/committed (`6694754`),
S-002…S-006 out of scope, correctly unbuilt
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit for S-001.

- Tasks in scope complete: 7/7 (S-001.1–.7, all `[x]` in `slices.md`)
- `bunx tsc --noEmit`: clean, zero errors (re-executed directly, matches claim)
- Affected tests: `test/scaffold/path-guards.test.ts` 25/25 pass (127 `expect()`), both
  files combined 51/51 pass (182 `expect()`) — exact match to apply-progress's reported
  counts, re-executed myself, not trusted from the report
- Full suite (re-run once, matches the report's run-2 numbers exactly): **2350 pass / 12
  fail across 197 files** — the SAME 12 stable-residual failures itemized in
  `verify-in-loop-1.md` (2 `fit-42-runner-closure-integrity` REQ-RCD-03.5, 2
  `expander.test.ts` SEC block, 2 `author-emulation-scaffold.e2e.test.ts` byte-compares, 4
  `S-004` matrix-row assertions, 2 `scaffold.e2e.test.ts` REQ-PRC-04/07) — **zero new
  failures, zero regressions from S-001's diff** (verified by direct failure-name diff, not
  by trusting the count alone)
- `src/scaffold/path-guards.ts` confirmed truly untouched by S-001: `git diff --stat -- src/`
  and `git status --porcelain -- src/` both empty — the only src file this change ever
  touched (`S-000.5`) carries no S-001 delta
- Spec compliance for scope: design §4's error-mapping table (rows 0–4) matches
  `statSourceForRead` line-for-line; `validateSourceLexical`/`validateDestinationLexical`
  match the segment-aware predicate. REQ-PSH-01/.1/.3, REQ-PSH-02/.2/.3, REQ-PSH-03/.1/.2,
  REQ-PSH-04/.1, REQ-IPF-01.1/.2/.4/.6, REQ-IPF-02.1, REQ-IPF-03.1, REQ-RBV-04.1 all
  demonstrated GREEN at runtime via `path-guards.test.ts` + the S-001.5
  `canary-no-echo.test.ts` extension. REQ-IPF-01.5's own citation vehicle (M-16) is still
  RED — see Finding 1 (non-blocking, in-loop-tolerated, continuation of
  `verify-in-loop-1` Finding 1/2)
- Assertion audit: clean — no banned patterns (`toBeDefined()`, bare `toBeTruthy()`,
  `objectContaining` as whole assertion, `.not.toThrow()` as sole assertion) in either
  delta test file; `expectReason`/`expectAuthoringReason` assert exact `reason` +
  `message` equality, never shape-only
- B5 constraint (no `copyIn` committed-byte assertion): verified compliant — every new
  `copyIn`-driven canary test (ELOOP/NUL/degenerate `.`) asserts only `caught instanceof
  Error` + no-leak; the two symlink-accept tests (`REQ-PSH-03.1`/`REQ-PSH-04.1`) read bytes
  via `statSourceForRead` + direct `readFileSync`, never through `copyIn`
- Orchestrator action: exit loop, proceed to next slice (S-002) or continue the build

---

### Execution Evidence (re-run myself, not trusted from apply-progress)

**`bunx tsc --noEmit`**: zero output, exit clean.

**`bun test test/scaffold/path-guards.test.ts`**: 25 pass / 0 fail, 127 `expect()`.

**`bun test test/security/canary-no-echo.test.ts`**: 26 pass / 0 fail, 55 `expect()`
(includes the 8 pre-existing S-000.7 canary cases + the 12 new S-001.5 cases + the 6
schema-input canaries unrelated to this slice).

**`bun test` (full suite, one run — sufficient given the exact match to the report's own
two-run pattern)**: 2350 pass / 12 fail across 197 files (2362 tests). Failure names,
independently listed via `rg "^\(fail\)"` on the run output:

| File | Count | Owner (per design §6 / slices.md, unchanged from verify-in-loop-1) |
|---|---|---|
| `test/fitness/fit-42-runner-closure-integrity.negative.test.ts` (`REQ-RCD-03.5` ×2) | 2 | Pre-existing, unrelated (confirmed in iteration 1 via `git stash`) |
| `test/scaffold/expander.test.ts` (`SEC …containment-checked` describe) | 2 | S-003.1 |
| `test/e2e/author-emulation-scaffold.e2e.test.ts` (m-16/m-17 byte-compare) | 2 | S-003.7 / S-004 |
| `S-004 — matrix-row assertions` (M-16 ×2, M-17 ×2) | 4 | S-004 |
| `test/e2e/scaffold.e2e.test.ts` (`REQ-PRC-04/07` describe) | 2 | S-002/S-003 retirement |

Identical set (same file, same test names) to iteration 1's baseline — confirms S-001
introduced zero new failures. No flake noise observed on this run (the deviation log's
5-extra-failure build-race pattern did not reproduce here); given the exact match to the
report's own documented run-2, a second confirmatory run was not needed to distinguish
flake from regression.

**Code-level sanity check**: `src/scaffold/path-guards.ts`'s `statSourceForRead` catch
block maps `ENOENT`→`source-not-found`, `ELOOP`→`source-unreadable`/`"symlink cycle"`,
`ERR_INVALID_ARG_VALUE`→`source-unreadable`/`"path contains an invalid character"`, any
other errno or no-code-at-all→`source-unreadable`/`"permission or I/O error"` — matches
design §4's table rows 0–4 exactly, including the deliberate never-interpolate-the-errno
rule.

---

### TDD Compliance (Strict TDD, in-loop, delta only)

- No banned assertion patterns in `test/scaffold/path-guards.test.ts` (new file) or the
  S-001.5 addition to `test/security/canary-no-echo.test.ts` — re-grepped directly.
- Triangulation: the resource-exhaustion errno branch loops 5 distinct codes
  (EACCES/EPERM/EMFILE/ENFILE/EINTR) plus a no-`.code` fallback in one test; the lexical
  escape predicate is driven by 7 escaping forms + 1 Windows-drive form + a
  non-escaping preservation-pin + 2 substring-non-match cases. Each design-table row (0,
  1, 2a, 2b, 3a/3b) has its own dedicated test — the TOTAL guard as a whole is
  multiply-triangulated even though several individual rows are single-condition
  branches (expected — a TOTAL guard's rows are mutually exclusive error-mapping arms,
  not parallel paths through shared logic).
- **TDD-order deviation (S-001's entire suite passed first-run, not RED-first)**:
  self-reported by the executor, in detail, with the same discipline as S-000.6's
  identical deviation (already judged acceptable-with-note in `verify-in-loop-1`).
  Judged NOT a halt here either, for the same reason: `strict-tdd-verify.md`'s in-loop
  halt table lists "tests added after implementation" as a **final-mode-only** halt
  condition — the halts that DO apply in-loop ("new file with no tests", "banned
  pattern", "regression", "triangulation gap") are all clean. The architectural
  justification is sound and independently checkable: `statSourceForRead` and
  `isLexicallyEscaping` are genuinely SHARED across three call sites wired in S-000.5;
  growing either incrementally per S-001 sub-task would have left the guard non-total
  mid-slice, which the design's own step 4+5 merge note anticipates. The three disclosed
  mutation-checks (ELOOP/NUL special-casing removed → the exact two tests fail on the
  exact `detail` text, not a coincidental failure; allow-list branch removed → all 4
  affected tests fail on `undefined` where `AuthoringError` was expected; `..`-segment
  check removed → exactly the 6 `..`-segment cases fail while the untouched absolute
  check keeps rejecting `../x`/`/abs/x`, proving the mutation was correctly scoped) are
  real, falsifiable, scoped evidence — not an assertion taken on faith. **This is now
  the SECOND instance of the same disclosed process deviation in this change
  (S-000.6, S-001)**: acceptable-with-note per iteration, but the pattern itself
  (implementation landing ahead of its own tests, non-vacuousness proved after the fact)
  should be weighed as a trend, not two isolated incidents, when `final` mode runs its
  zero-tolerance TDD Cycle Adherence audit across the whole change's git history.

---

### Findings

| # | Severity | Category | File:Line | Detail |
|---|---|---|---|---|
| 1 | WARNING | req-coverage-precision | `openspec/changes/inline-collection-marker/slices.md:36` | S-001's Covers list states "REQ-IPF-01.1/.2/.4/.5/.6" as covered. REQ-IPF-01.5's own text says its proof is "re-cited from `scenario-matrix` M-16" and that "M-16's citation moves to this REQ" — but the M-16 test vehicles (`test/e2e/author-emulation-scaffold.e2e.test.ts`'s byte-compare + the `S-004` matrix-row assertions) are still RED today, still asserting the retired `source-outside-package` reason. This is the exact same residual already disclosed in `verify-in-loop-1` Findings 1/2 and `apply-progress.md` Deviation #3 — not a new or hidden gap, and its fix is correctly routed to S-003.7/S-004, both later in the build order (S-001 → S-002 → S-003 → S-004). REQ-IPF-01.1/.2/.4/.6 and REQ-IPF-02.1/REQ-IPF-03.1 ARE demonstrated at runtime via `path-guards.test.ts`'s module-level calls to `validateSourceLexical`/`validateDestinationLexical` (proving the predicate) plus S-000.7's pre-existing verb-level canary cases (`scaffold`/`copyIn` `'../escape'`, proving 2 of 3 wiring sites); only REQ-IPF-01.5's specific M-16-cited scenario remains not-yet-green. Non-blocking for S-001; carry into `sdd-verify --mode=final`'s compliance matrix so it isn't marked COMPLIANT before S-003/S-004 land. |
| 2 | SUGGESTION | tdd-trend | `openspec/changes/inline-collection-marker/apply-progress.md:64-81,152-163` | Two slices in a row (S-000.6, S-001 entire) landed implementation ahead of RED tests, substituting mutation-check proof after the fact. Each instance individually is disclosed and non-vacuous (judged acceptable-with-note above and in iteration 1), but as a trend it is worth a deliberate look at `final` mode: is the shared-TOTAL-guard architecture forcing this pattern structurally (as claimed), or would a differently-sequenced slice boundary (e.g., landing `statSourceForRead`'s skeleton RED-first with a deliberately-incomplete/throwing default arm, then filling rows incrementally) avoid it for the remaining slices (S-002+)? Not a fix-now item — S-002 onward do not appear to share this same "TOTAL guard, 3 call sites" structural constraint per the design's own File Changes table. |

No CRITICAL or blocking findings. Both findings above are informational/tracking items,
not fix-now items — routing: none (loop exits clean for S-001).

---

**Skill Resolution**: injected
