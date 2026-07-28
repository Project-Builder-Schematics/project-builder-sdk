## Verify In-Loop Result

**Change**: inline-collection-marker
**Iteration**: 1/3
**Scope**: S-000 (walking skeleton) only — S-001…S-006 out of scope, correctly unbuilt
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit for S-000.

- Tasks in scope complete: 8/8 (S-000.1–.8, all `[x]` in `slices.md`)
- `bunx tsc --noEmit`: clean, zero errors (re-executed directly, matches claim)
- Affected/full-suite tests: 2312–2314 pass / 12 stable-residual fail (count/composition
  verified below) — zero failures attributable to S-000
- Spec compliance for scope: REQ-MFB-01/.1/.2/.3, REQ-RBV-06/.2, REQ-FSC-10.1–.4,
  REQ-RBV-04.1 (minimum subset) all demonstrated GREEN at runtime; REQ-IPF-01.3
  (ordering) implemented correctly in code but not yet proven by a passing test — see
  Finding 1 (non-blocking, in-loop-tolerated)
- Assertion audit: clean — no banned patterns in any delta test file
- Orchestrator action: exit loop, proceed to next slice (S-001) or continue the build

---

### Execution Evidence (re-run myself, not trusted from apply-progress)

**`bunx tsc --noEmit`**: zero output, exit clean. Matches apply-progress's claim.

**`bun test` (full suite, run twice)**: run 1 → 2312 pass / 16 fail; run 2 → 2315 pass /
13 fail (2328 tests total both times). The delta between runs is entirely flaky/timeout
tests unrelated to this change (`react-conformance`, `typescript-conformance`,
`installed-consumer.e2e`, `fit-42-runner-closure-integrity.test.ts` — timing-sensitive,
none touch a file this change modifies). With flakes subtracted, **exactly 12 stable
failures reproduce on both runs**:

| File | Count | Owner (verified against design §6 / slices.md) |
|---|---|---|
| `test/scaffold/expander.test.ts` (`SEC …containment-checked` describe) | 2 | S-003.1 |
| `test/e2e/author-emulation-scaffold.e2e.test.ts` (m-16/m-17 byte-compare + M-16/M-17 matrix rows) | 6 | S-003.7 (M-16 reason flip) + S-004 (M-17 retirement/corpus regen) — see Finding 2 |
| `test/e2e/scaffold.e2e.test.ts` (`REQ-PRC-04/07` describe) | 2 | S-002/S-003 retirement |
| `test/fitness/fit-42-runner-closure-integrity.negative.test.ts` (`REQ-RCD-03.5` ×2) | 2 | Pre-existing, unrelated — confirmed below |

**Pre-existing-failure claim, independently verified**: `git stash push -u`, ran
`bun test test/fitness/fit-42-runner-closure-integrity.negative.test.ts` against clean
`main` (zero files of this change present) → identical 2 EACCES failures, same test
names, same error site (`scripts/derive-runner-closure.ts:307`). `git stash pop` restored
the working tree; `git status --short` confirmed all 25 original entries intact
post-restore. Claim CONFIRMED with direct evidence, not taken on trust.

**Code-level sanity checks** (not just tests): `rg` across `src/**` for
`packageRoot|isWithinCeiling|resolvePackageRoot|validateSourceContainment|`
`validateSourceRootContainment|resolveRealCeiling` outside the allowlisted
`single-instance-probe.ts` → zero hits. The containment retirement is a clean deletion,
no orphaned references. `runCopyIn`'s statement order in `src/scaffold/index.ts` matches
design §4 Q2 exactly (destination → source-lexical → source-hygiene). The three screen
call sites (`readTemplateFile`, `runScaffold`, `runCopyIn`) and `statSourceForRead`'s
error-mapping table match design §4 row-for-row (ENOENT→source-not-found,
ELOOP→symlink-cycle, ERR_INVALID_ARG_VALUE→invalid-character, other
errno→permission-or-I/O, directory/non-file→source-not-regular-file).

---

### TDD Compliance (Strict TDD, in-loop, delta only)

- No banned assertion patterns (`toBeDefined()`, `toBeTruthy()/toBeFalsy()` bare,
  `objectContaining` as whole assertion, `.not.toThrow()` as only assertion) found in any
  delta test file (`inline-collection.test.ts`, `run-boundary.test.ts`, `walk.test.ts`,
  `harness-opted-in.test.ts`, `canary-no-echo.test.ts`, `run-boundary-validation.test.ts`,
  `scaffold.e2e.test.ts`, `harness-in-memory-invariant.test.ts`) — re-grepped directly.
- Triangulation: REQ-FSC-10.4 has 4 driving cases (readdirSync EACCES, readdirSync
  ENOENT, lstatSync EACCES, no-rootRelPath fallback); the S-000.7 canary subset has 6
  cases (3 branch shapes × 2 verbs). Each canary test asserts `caught` is actually an
  `Error` before the no-echo check — non-vacuous by construction, confirmed by reading
  the test bodies, not just apply-progress's table.
- B5 constraint (no `copyIn` committed-byte assertion): verified compliant —
  `inline-collection.test.ts` asserts `copyIn`'s emitted-directive SHAPE only
  (`{op:"copyIn", copyIn:{from,to}}`), never committed bytes; `scaffold`/`create` legs
  correctly assert byte-exact content.
- **TDD-order deviation (walk.ts guard before its RED tests)**: self-reported by the
  executor. Judged NOT a halt: `strict-tdd-verify.md`'s in-loop halt table lists "tests
  added after implementation" as a **final-mode-only** halt condition, not in-loop — and
  the halt conditions that DO apply in-loop ("new file with no tests", "banned pattern",
  "regression", "triangulation gap") are all clean here. The executor's mutation-check
  (guard removed → test failed on the raw uncaught `EACCES`, not an `AuthoringError`;
  guard restored → green) is real, demonstrated non-vacuousness evidence, not an assertion
  taken on faith. **Acceptable-with-note** — flagging for the `final` mode's zero-tolerance
  TDD-cycle-adherence audit, which must weigh this properly (git history shows
  implementation predating its test, even though a later mutation-check proved the test
  non-vacuous).

---

### Findings

| # | Severity | Category | File:Line | Detail |
|---|---|---|---|---|
| 1 | WARNING | req-coverage-precision | `openspec/changes/inline-collection-marker/slices.md:16` | S-000's Covers list states "REQ-IPF-01.3 (ordering)" as covered. The ordering property (screen-before-walk) IS correctly implemented in `src/scaffold/expander.ts` (`validateSourceLexical` runs before `walkFolder`), but the only test that exercises it at runtime — `test/scaffold/expander.test.ts`'s `SEC …containment-checked` describe block — is currently RED (asserts the retired `source-outside-package` reason, and its second case's whole premise — realpath-escape rejection — is now obsolete under ADR-0077's accepted symlink residual). This is the SAME residual failure already disclosed in apply-progress Deviation #3, not a hidden gap, and its fix is correctly routed to S-003.1. Per the compliance rule "code existing is not sufficient evidence," REQ-IPF-01.3 should not be marked fully proven until that slice lands — informational, not blocking S-000. |
| 2 | SUGGESTION | documentation-accuracy | `openspec/changes/inline-collection-marker/apply-progress.md:97-100` | Deviation #3 attributes all 6 `test/e2e/author-emulation-scaffold.e2e.test.ts` failures to "S-004's scenario-matrix renumber/regen." Per design §6's File Changes table and `slices.md` S-003.7, the M-16 reason-flip failures (2 of the 6: "traversal source rejects" + "absolute source rejects") are more precisely owned by S-003.7 (`M-16 reason flip`), while only the M-17 failures (2) and the two byte-compare tests are cleanly S-004 (retirement + corpus regen). Both S-003 and S-004 are later slices either way, so this does not change the verdict — cosmetic attribution nit only, worth tightening before `sdd-verify --mode=final` builds its own compliance matrix. |

No CRITICAL or blocking findings. Both findings above are informational/tracking items,
not fix-now items — routing: none (loop exits clean for S-000).

---

**Skill Resolution**: injected
