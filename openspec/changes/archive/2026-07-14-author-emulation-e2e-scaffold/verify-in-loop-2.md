## Verify In-Loop Result

**Change**: author-emulation-e2e-scaffold
**Iteration**: 2/3
**Scope**: S-000 (walking skeleton — infra spine)
**Mode**: in-loop (Strict TDD)
**Delta under review**: commit `daccb91` (fix for iteration 1 findings #1/#2)

---

### Verdict: PASS

Both iteration 1 NEEDS_FIX findings are closed with discriminating, runtime-executed
evidence — judged by execution and mutation, not by the commit message's claim. Scope
guard holds (test-only commit, zero `src/` rows). Full suite and typecheck green under
my own execution. Loop can exit for S-000.

#### Real execution evidence (commands run this iteration)

| Command | Result |
|---|---|
| `bun test` (full suite) | **1074 pass / 0 fail**, 2075 expect() calls, 129 files, 9.86s (+4 tests vs iteration 1's 1070, exactly the fix commit's additions) |
| `bunx tsc --noEmit` | **clean**, exit 0 |
| `bun test test/e2e/author-emulation/ir-transcript.test.ts test/e2e/author-emulation/corpus-format.test.ts` | 6 pass / 0 fail |
| **Mutation check** — `sortKeysDeep` neutered to identity (`Object.keys(value)` without `.sort()`), re-run | new ADR-0049 sort test **FAILS** (`1 fail`); restored via `git checkout`, passes again — the test genuinely discriminates, kill confirmed |
| `git show daccb91 --stat` | 2 files, both `test/e2e/author-emulation/*.test.ts` — **zero `src/` rows**, zero support-module edits |
| `bun scripts/regen-corpus.ts` + `git status` on corpus dir | empty — committed `s-00` still byte-identical from a fresh process (GCC-05 strong guard re-confirmed post-fix) |

#### Finding #1 (sortKeysDeep discrimination) — CLOSED

`test/e2e/author-emulation/corpus-format.test.ts` gains a full-string `serializeCorpus`
assertion over an `options` object whose insertion order is deliberately
anti-lexicographic at two depths (`zeta, nested, beta, alpha` at the top;
`gamma, "10", alpha` nested), including the integer-like-key trap (`"10"`) and an array
whose element order must be preserved while its objects' keys sort. The expected literal
pins lexicographic order at every depth. Verified discriminating BY MUTATION: with the
`.sort()` removed from `sortKeysDeep`, the test fails; restored, it passes. This is
exactly the ADR-0049 regression net iteration 1 asked for.

#### Finding #2 (captureRun runtime paths) — CLOSED

New `test/e2e/author-emulation/ir-transcript.test.ts` (3 tests, all runtime through the
real `captureRun`):

1. **REQ-ITC-01.1**: an inline factory with three explicit `session.flush()` calls →
   asserts exactly three batches (`[1, 1, 1]` directive counts), the
   `informative.batchGrouping` triple, AND emission order preserved through BOTH
   `rawDirectives` and the normalized `normative.directives`
   (`first.ts → second.ts → third.ts`). This is the "e2e capture unit (3-flush factory)"
   the design §4.6 table promised.
2. **GCC-09/R-F attributable rejection**: a seeded path-collision drives the real
   `AuthoringError` path → asserts `outcome: "rejected"`, EMPTY `directives`, and the
   verbatim triple `{reason: "path-collision", verb: "create", path: "c.ts"}`, plus
   `tree.size === 0`. The rejected branch of `ir-transcript.ts:85-106` now executes at
   runtime, not only via a static fixture.
3. **R-F null serialization**: `invalidInput(...)` (mints `verb: undefined,
   path: undefined` upstream) → asserts the record serializes `verb: null, path: null` —
   never `undefined`. The absent-field half of R-F's contract, previously untested.

Design-conformance notes on the fix itself: the inline factories are NOT added to
`SCENARIOS` and commit no corpus file — correct per R-E (registry stays data-only,
scenario-count contracts like GCC-01/FIT-26 remain undisturbed) and per GCC-12 (`s-00`
stays the only committed skeleton record). The new file sits inside FIT-27's scanned
graph and performs no corpus write — FIT-27 still passes. No assertion inspects rendered
output or by-reference bytes (ITC-03 boundary respected; only directive-shape/pathTemplate
assertions). No banned assertion pattern introduced (`toBeUndefined()` on line 30 asserts
a specific expected value alongside stronger assertions — not in the banned set).

#### Carried to final (per orchestrator instruction, not re-litigated here)

- Iteration 1 WARNING #3 — TDD commit-order narrative (impl commits before first test
  commit). Note the FIX commit itself repeats the pattern in miniature (tests landed
  after the code they cover — unavoidable here since the code predates them), which is
  expected for a gap-closing commit and adds no new signal. Full TDD Cycle Adherence
  Audit remains a final-mode obligation.
- Iteration 1 INFO #4 — `embedTemplate` >4096-byte digest branch untested; deferred to
  S-003/M-09 by apply-progress's own risk register.

### Spec Compliance Matrix (delta rows only — unchanged rows per iteration 1)

| Requirement | Test | Result |
|---|---|---|
| ITC-01.1 (3 ordered batches) | `ir-transcript.test.ts` (3-flush factory) | ✅ COMPLIANT (was ❌ UNTESTED) |
| GCC-06/ADR-0049 (options key-sort) | `corpus-format.test.ts` full-string sort case | ✅ COMPLIANT — mutation-verified (was untested path) |
| GCC-09 shape via captureRun runtime | `ir-transcript.test.ts` (collision + invalidInput) | ✅ COMPLIANT at capture-contract level (committed rejection CORPUS records remain S-004 scope, correctly deferred) |

**Compliance summary**: 18/20 scope rows compliant; 2 legitimately deferred to later
slices (GCC-09 committed record → S-004/M-13; ITC-01.2 zero-emission → M-14/S-003).
Zero open findings for S-000.

### Completeness

| Metric | Value |
|---|---|
| S-000 tasks complete | 8/8 |
| Iteration 1 findings closed | 2/2 (both NEEDS_FIX) |
| Iteration 1 items carried to final | 2 (WARNING #3, INFO #4) |

---

All scope checks green. Loop can exit.
- Tasks in scope complete: 8/8
- Affected tests passed: 1074/1074 (full suite; 6/6 in the delta's own files)
- Spec compliance for scope: 18/18 non-deferred clauses
- Assertion audit: clean (banned-pattern scan of delta files: zero matches)

Orchestrator action: exit loop for S-000; proceed to `/build --scope=slices:S-001,S-002`
(parallelizable per Build Order), with `/evaluate` (mode=final) only after all slices land.

### Artifacts Persisted
| Artifact | Mode | Location |
|---|---|---|
| verify-in-loop-2 | hybrid | engram `sdd/author-emulation-e2e-scaffold/verify-in-loop-2` + `openspec/changes/author-emulation-e2e-scaffold/verify-in-loop-2.md` |

### Risks
- None new. Carried-to-final items above (TDD commit-order audit, embedTemplate digest
  branch) are logged obligations for `sdd-verify --mode=final`, not S-000 blockers.

### Next Recommended
`/build --scope=slices:S-001,S-002` (S-000 loop closed at iteration 2/3).

### Skill Resolution
none (greenfield project — skill registry empty)
