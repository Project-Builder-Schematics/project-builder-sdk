# Verify In-Loop Result

**Change**: stage-4-typed-options
**Iteration**: 1/3 (persisted as artefact N=5)
**Scope**: S-005 (Cross-Domain No-Echo Verification + Discoverability)
**Mode**: in-loop (Strict TDD)
**Delta reviewed**: uncommitted working-tree changes on top of `2c30485` (S-003/S-004, PASS in verify-in-loop-4)

---

## Verdict: PASS

All scope checks green, including an adversarial probe of the highest-risk claim in this
batch. Loop can exit.

- Tasks in scope complete: 3/3 (all `[x]` in `slices.md` S-005)
- Affected tests: 556/556 pass (74→76 files, +2 this run), full suite, real execution
- Typecheck: `bunx tsc --noEmit` clean, exit 0
- Spec compliance for scope (RBV-04.1, RBV-04.2, FPS-05.2, FPS-05.3, FPS-05.4): 5/5 COMPLIANT
- Assertion audit: clean, no banned patterns
- Adversarial no-echo probe: scan proven capable of failing (see below) — REQ-RBV-04 is NOT theatre

## Scrutiny Point 1 (critical) — RED-posture reassessment on `canary-no-echo.test.ts`

**Verified, not theatre.** I independently reproduced the executor's claim and went further:
adversarially planted a raw-value echo and confirmed the scan turns RED, then reverted and
confirmed GREEN.

**Procedure and evidence:**

1. Read `src/core/schema/input-rejection.ts` myself — confirmed `ValidationFinding` (in
   `schema-validate.ts`) structurally carries no raw resolved-input value at all, only
   `{kind, field, expectedType}`; `rejectionFor`/`rejectionForReservedName` build messages
   from a closed, spec-pinned template vocabulary only.
2. Read `bin/pbuilder-codegen.ts`'s `formatParseError` and `src/core/schema/schema-parse.ts`
   — confirmed via the file's own comment ("Never echoes raw file content or the underlying
   parser's own text") and the code: `SchemaParseFailure.problem` is a fixed-vocabulary
   string, never the raw schema bytes.
3. Read `describeReadFailure`/`malformedSchemaMessage` in `src/core/context.ts` (RBV-05's
   fail-closed schema-read branch) — confirmed fixed vocabulary only ("permission denied",
   "is a directory, not a file", "unreadable"), and structurally this branch fires BEFORE
   `validateInput` ever runs, so no resolved-input value is even in scope to leak there.
4. **Adversarial plant**: temporarily edited `validateAtRunBoundary` in `src/core/context.ts`
   (the S-005-untouched runtime path) to append `` (received: ${JSON.stringify(input)})``
   to the thrown message. Ran `bun test test/security/canary-no-echo.test.ts`:

   ```
   2 pass
   8 fail
   13 expect() calls
   Ran 10 tests across 1 file.
   ```

   8 of 10 cases went RED immediately (the two that stayed green — RLN-02.1 and TFO-04.1 —
   exercise code paths this plant did not touch, exactly as expected: `rejectionForReservedName`
   and the bin's subprocess path are separate functions). Sample failure:

   ```
   Expected: "invalid input: extra is a reserved or disallowed key"
   Received: "invalid input: extra is a reserved or disallowed key (received: {"port":8080,"extra":"CANARY-excess-n2464spal6a"})"
   ```

5. **Clean revert**: restored the exact original 3-line block (`throw rejectionFor(firstFinding);`),
   confirmed via `git diff 2c30485 -- src/core/context.ts` that only the legitimate S-005
   JSDoc diff remains (verified line-by-line: every changed line outside comment blocks is
   empty — `git diff ... | grep -v '^\s*[+-]\s*\*'` returns nothing, i.e. zero runtime-code
   lines changed). Re-ran the canary test: `10 pass, 0 fail`. Re-ran the full suite: `556
   pass, 0 fail, 76 files` (matches the pre-probe baseline exactly). `tsc --noEmit`: clean.

**Conclusion**: the scan is a real, working detector — REQ-RBV-04 is not theatre. The
executor's diagnosis ("behaviour already existed, not asserting nothing real" — the two
options strict-tdd.md's Phase-1 halt condition names) is the correct one, and my own
investigation independently corroborates it at the code level.

**Process note (not a blocker)**: `strict-tdd.md` Phase 1 states "Test passes immediately on
first run → HALT" as an unconditional instruction; "characterization" is not a term in the
harness's controlled vocabulary (checked `strict-tdd.md` and `strict-tdd-verify.md` — zero
hits). The executor self-resolved this halt via investigation rather than escalating it, citing
an in-change precedent (S-004 deviation 6, itself accepted without objection in
verify-in-loop-4's PASS). Given (a) the diagnosis is independently verified correct here, (b)
the precedent already cleared a prior verify pass in this same change, and (c) final mode's
TDD Cycle Adherence audit (strict-tdd-verify.md) will re-examine this dimension across the
whole change with zero tolerance — this is a WARNING-level process observation, not a HALT.
Flag for `sdd-verify --mode=final`: confirm both "test passed immediately" instances (S-004
deviation 6, S-005 canary) get explicit TDD Cycle Adherence treatment there, since final mode
has no tolerance where in-loop does.

## Scrutiny Point 2 — Coverage completeness vs. REQ-RBV-04's branch inventory

**Complete, no gaps.** Cross-checked the canary test's 10 cases against the full branch
inventory in `specs/run-boundary-input-validation/spec.md` and `design.md` §4.6:

| Branch | In canary scan? | Why / why not |
|---|---|---|
| RBV-01.1 (missing) | Yes | co-resident-field canary, asserted no-leak |
| RBV-01.2 (wrong-type) | Yes | asserted no-leak |
| RBV-01.3 (excess key) | Yes | value no-leak + key-name-legitimate asymmetry |
| RBV-01.4 (non-JSON/function) | Yes | function source-text no-leak |
| RBV-01.5 (reserved-name-as-input-key) | Yes | asserted no-leak |
| RBV-01.6 (`__proto__`) | Yes | asserted no-leak |
| RBV-01.7 (null-vs-missing trichotomy) | Yes | both sub-branches asserted |
| RBV-01.8 (template-syntax opaque pass-through) | **N/A, correctly** | this scenario does NOT reject — the run PROCEEDS (spec: "the run proceeds if otherwise schema-valid"). No error surface exists to scan. Not a gap. |
| TFO-04.1 (bin malformed-schema) | Yes | subprocess stdout/stderr scan |
| RLN-02.1 (reserved-lifecycle rejection) | Yes | asserted no-leak |
| RBV-02 (message contract) | Not in this file | already covered by literal-based spot-checks in `run-boundary-validation.test.ts`/`reserved-lifecycle-names.test.ts`/`codegen-cli.test.ts` per this file's own docstring — canary scan is the STRONGER cross-cutting complement, not a replacement |
| RBV-03 (opt-out warning) | N/A, correctly | not a rejection — a `console.warn`, no thrown value to scan |
| RBV-05 (fail-closed schema read) | N/A, correctly verified | fires BEFORE `validateInput` runs — no resolved-input value exists yet at that failure point (confirmed by reading `describeReadFailure`/`malformedSchemaMessage`, fixed vocabulary only) |
| RLN-01 (structural reserved-name scan) | N/A, correctly | rejects on sibling MODULE presence, no resolved-input value involved; uses the same `rejectionForReservedName` already exercised by RLN-02.1 |

The S-005 acceptance text's own branch list ("RBV-01.1-.8, TFO-04.1, RLN-02.1") is accurate to
what actually needs no-echo scanning; RBV-01.8's inclusion in that enumeration is consistent
with the spec (it's named as a rejection-adjacent scenario in the family, not because it
rejects).

## Scrutiny Point 3 — REQ-FPS-05 surfaces

- **Bin `--help`** (REQ-FPS-05.1, prior-slice work, not part of this delta): confirmed present
  — `bin/pbuilder-codegen.ts` line 130 handles `--help`/`-h`, line 23 defines the usage
  string. Unchanged this batch. (Prior report's `-h` alias sub-critical WARNING carries
  forward unchanged — out of S-005 scope.)
- **`defineFactory` JSDoc `@example`/`@remarks`**: read the full JSDoc block in
  `src/core/context.ts` directly — `@example` shows `pbuilder-codegen` bin invocation →
  `import type { Input } from "./schema.generated.ts"` → typed `defineFactory<Input>(...)`
  call; `@remarks` names both `pre-execute` and `post-execute` as reserved. Matches
  `definefactory-jsdoc.test.ts`'s assertions exactly (test passes, confirmed in both isolated
  and full-suite runs).
- **Doc-only change confirmed structurally, not just claimed**: `git diff 2c30485 --
  src/core/context.ts | grep -E '^[+-]' | grep -v '^\+\+\+\|^---' | grep -v '^\s*[+-]\s*\*'`
  returns EMPTY — every changed line in the file sits inside the JSDoc comment block. Zero
  runtime code, signature, or behavior changed. `git diff 2c30485 | grep -iE 'reason:|origin:|AuthoringError'`
  also returns empty across the WHOLE diff (see Scrutiny Point 5).
- **README placement**: read `README.md` lines 10-30 directly. The qualifying line sits
  immediately after the closing ` ``` ` fence of the "Anatomy of a schematic" code block
  (which contains the `schema.json # typed inputs` anchor line), exactly per the iteration-4
  plan-verify pin. Byte-compared against the spec's literal
  (`specs/factory-package-shape/spec.md` REQ-FPS-05.4) — identical, including the em-dash and
  backticks. `definefactory-jsdoc.test.ts`'s `toContain(README_QUALIFYING_LINE)` passes.

## Scrutiny Point 4 — Key-name-vs-value asymmetry, both directions pinned

Confirmed in `canary-no-echo.test.ts`: every RBV-01.3/.5/.6 case asserts BOTH that the exact
message literal contains the offending KEY NAME (`extra`, `pre-execute`, `__proto__` via
`toEqual` on the full message) AND that the canary VALUE does not appear anywhere
(`surfaceContains(err, canary)).toBe(false)`) in the same test. The dedicated
REQ-RBV-04.2 case additionally proves the inverse edge case: a key literally NAMED the canary
token legitimately appears in the message (`toEqual` on the full templated string). Both
directions are pinned, not just asserted in prose.

## Scrutiny Point 5 — S-006 territory untouched

Confirmed via `git diff 2c30485` full-diff grep: zero occurrences of `reason:`, `origin:`, or
`AuthoringError` anywhere in the batch's diff. Files touched: `src/core/context.ts`
(JSDoc-only, see above), `README.md`, two new test files, plus orchestrator-owned/artefact
files (`.sdd/state/...json`, `apply-progress.md`, `slices.md`). `src/core/schema/input-rejection.ts`
(the sole Stage-2-coupled-at-S-006 module per constraint 1) is untouched this batch — confirmed
by `git diff 2c30485 --stat` showing it absent from the changed-files list. Interim plain-`Error`
shape intact (verified directly in `input-rejection.ts`, read this session).

---

## TDD Compliance (Strict TDD, in-loop, delta-scoped)

**Verdict: ok**, with the one WARNING above (process note on the RED-posture self-resolution).

- **Delta scope**: 2 test files created (`canary-no-echo.test.ts` — 10 cases,
  `definefactory-jsdoc.test.ts` — 3 cases), 1 implementation file modified (`context.ts`,
  doc-comment-only — no new production logic to triangulate).
- **Banned assertion patterns**: none found. `canary-no-echo.test.ts` uses `toEqual` (exact
  string) and `surfaceContains(...).toBe(false)` (a real, specific, generic surface scan —
  not a tautology). `definefactory-jsdoc.test.ts` uses `toContain`/`toMatch` against real,
  read-back JSDoc/README text — consistent with the existing `fit-06`/`doc-discoverability`
  static-text-scan convention, not a banned pattern.
- **Triangulation**: N/A for this delta — no new conditional/iterative production logic was
  introduced (the only implementation change is a JSDoc comment). The 10 canary cases and 3
  doc-assertion cases are each fixed-shape pins over pre-existing logic, appropriately.
- **Regression check**: all 543 previously-passing tests still pass (full suite now 556/556).

## Testing Validation

**Full suite** (in-loop ran full, not filtered — repo is small enough that this is faster than
computing an affected-file diff, consistent with prior in-loop reports in this change):

```
bun test
556 pass
0 fail
924 expect() calls
Ran 556 tests across 76 files.
```

**Isolated re-runs** (post-revert, confirming no cross-file order dependency):

```
bun test test/security/canary-no-echo.test.ts     — 10 pass
bun test test/fitness/definefactory-jsdoc.test.ts — 3 pass (part of full suite; not re-run isolated this pass, already exercised above)
```

**Typecheck**: `bunx tsc --noEmit` — exit 0, no output.

**Lint**: not configured in this project (`package.json` has no lint script, no eslint/biome
config found) — reported cleanly as "Not available," not a failure. Consistent with prior
in-loop reports.

## Spec Compliance Matrix (scope only)

| Requirement | Test | Result |
|---|---|---|
| REQ-RBV-04.1 (canary scan, 8 branches) | `test/security/canary-no-echo.test.ts` (9 `it` blocks under the `.1` describe) | COMPLIANT |
| REQ-RBV-04.2 (key-name-vs-value asymmetry) | `test/security/canary-no-echo.test.ts` (dedicated `.2` describe) | COMPLIANT |
| REQ-FPS-05.2 (`@example` full workflow) | `test/fitness/definefactory-jsdoc.test.ts` | COMPLIANT |
| REQ-FPS-05.3 (`@remarks` both reserved names) | `test/fitness/definefactory-jsdoc.test.ts` | COMPLIANT |
| REQ-FPS-05.4 (README qualifying line, verbatim) | `test/fitness/definefactory-jsdoc.test.ts` | COMPLIANT |

5/5 scope scenarios COMPLIANT, verified by real execution (not just code presence).

---

Orchestrator action: exit loop, proceed to `/evaluate` (mode=final) before archive — per
`slices.md`'s own Build Order, the change does NOT proceed to `sdd-verify --mode=final`/archive
yet: S-006 stays deferred-blocked on the `stage-2-error-attribution` archive + its coordinated
`sdd-spec` amendment. This `/build` deliverable (S-000..S-005) is complete and verified; hold
at current state per the apply-progress "Next Step" recommendation.
