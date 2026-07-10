## Verify In-Loop Result

**Change**: stage-4-typed-options
**Iteration**: 1/3 (persisted as verify-in-loop-6)
**Scope**: Sub-scope A (coordinated Stage-2 AEC amendment code, `authoring-error.ts` reason
union six→eight + originFor/messageFor + REQ-AEC-09 template handling) + Sub-scope B (S-006 —
`input-rejection.ts` upgraded from interim plain `Error` to `AuthoringError{origin,reason}`)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green, with two documented WARNING followups (non-blocking) carried into
verify-final / the archive record.

- Tasks in scope complete: S-006 GATE + 3 upgrade tasks = 4/4 (slices.md); Sub-scope A amendment
  code complete (not a slices.md task, authorized by the amended main spec directly)
- Full suite: **563 pass / 0 fail / 940 expect() calls / 76 files** (baseline before this batch:
  556 green — delta of +7 tests exactly matches the new/extended cases: +5 in
  `authoring-error.test.ts` (REQ-AEC-07.1/08.1 ×2, REQ-AEC-09 ×3), +2 in
  `fit-11-whole-object-leak-scan.test.ts` (invalid-input, reserved-name leak-scan rows))
- Typecheck: `bunx tsc --noEmit` — clean, exit 0
- Spec compliance for scope: REQ-AEC-01/02/07/08/09 (amended V3) and REQ-RBV-01/02/RLN-02 S-006
  facets — all COMPLIANT (see matrix below)
- Assertion audit (delta): clean — no banned patterns in any new/changed test assertion

Orchestrator action: exit loop, proceed toward `/evaluate` (mode=final) before archive. Carry
the two WARNING followups into verify-final scope and the archive's ADR record for
authoring-error-contract.

---

### Scrutiny Point 1 — THE decision: optional `message?: string` constructor override

**Verdict on the decision: spec-consistent and additive, PASS WITH A NOTE — not
`architectural-conflict`.**

Evidence and reasoning:

- REQ-AEC-04's frozen-type clause pins `verb: AuthoringVerb | undefined` and
  `path: string | undefined` as MUST-declare fields; it does not close the field set against
  additions, and the spec's own semver framing throughout (REQ-AEC-01's "adding a 9th value is
  MAJOR", REQ-AEC-04.2's "additive-only" FIT-04 check) treats field/member ADDITIONS as the
  explicitly-sanctioned additive case — only the closed `reason` enum's *growth* is called out
  as the breaking axis. FIT-04 confirms the actual diff is exactly two additive deltas (see
  Scrutiny Point 2) — nothing removed, nothing narrowed.
- REQ-AEC-06 (extended by REQ-AEC-09) freezes the OUTPUT — `.message` must render one of five
  templates — not a specific INPUT mechanism for reaching that output. REQ-AEC-09 itself creates
  the tension the executor's own apply-progress flags explicitly: the two new template rows need
  `{field}`/`{expectedType}`/`{name}`, data `messageFor` cannot derive from `verb`/`path` alone.
  Some caller-supplied-text mechanism is unavoidable; the spec does not prescribe which shape.
- The `AuthoringError` constructor is not a consumer-facing construction API — authors only
  `catch` + `instanceof` + `switch`; the class is constructed at exactly two internal call sites
  in this codebase (`toAuthoringError`, `input-rejection.ts`), both verified correct (byte-exact
  templates, see Scrutiny Point 3). The theoretical hole (an ungated `message` override that
  could, in principle, also override the six legacy reasons' templates) is real but not
  exploitable by any external contract today, and `messageFor`'s throw-on-missing-message arm
  for `invalid-input`/`reserved-name` is a fail-loud (not fail-silent) guard against the mirror
  mistake (constructing those two reasons with no message).
- **However**: this is genuinely less type-safe than the codebase's own established idiom in the
  SAME file — `originFor`/`messageFor`'s exhaustive `switch` + `never`-default pattern gives
  compile-time enforcement everywhere else. A discriminated union on the constructor parameter
  (`{reason: SixLegacyReasons; verb; path} | {reason: "invalid-input"|"reserved-name"; message:
  string; verb: undefined; path: undefined}`) would make `message` compile-time REQUIRED for the
  two new reasons (replacing the current runtime-throw fallback) and compile-time FORBIDDEN for
  the six legacy ones (closing the override hole), matching the file's own idiom exactly.

**Disposition**: PASS — additive, spec-consistent, behaviourally correct at every call site that
exists today. **WARNING (followup, not blocking)**: tighten the constructor to a discriminated
union at the next available touch of `authoring-error.ts`, restoring compile-time enforcement of
REQ-AEC-06's frozen-template guarantee for all eight reasons uniformly. Register this as a
followup at archive and note it in the `authoring-error-contract` ADR record (the D2/ADR-0020
lineage already documents reason-union stance; this is a natural addendum). The executor's own
apply-progress already self-flagged this exact tension (not a silent deviation) — corroborated
independently here.

---

### Scrutiny Point 2 — FIT-04 baseline diff: exactly two deltas

**CONFIRMED clean.** `git diff -- test/fitness/dts-baseline/core.authoring-error.d.ts` shows
precisely:
1. `AuthoringReason` union line growth, six → eight values (`invalid-input`, `reserved-name`
   added) + JSDoc comment/example update reflecting the count and new switch cases.
2. One new optional constructor field, `message?: string`, with its JSDoc.

Nothing else changed in the baseline. No third delta.

---

### Scrutiny Point 3 — S-006 acceptance criteria

**CONFIRMED.** Across `input-rejection.test.ts`, `run-boundary-validation.test.ts`,
`reserved-lifecycle-names.test.ts`, `typed-factory.e2e.test.ts`:
- Rejections are now `instanceof AuthoringError` with `origin: "authoring-rejected"` and exact
  `reason` strings `"invalid-input"` / `"reserved-name"` (string-equality assertions, not
  substring).
- The three AEC-09 message literals are byte-UNCHANGED from interim: `"invalid input: port must
  be number"`, `"invalid input: extra is a reserved or disallowed key"`, `"reserved lifecycle
  name: pre-execute is reserved and cannot be declared by a factory module"` — verified via diff,
  only the thrown value's *shape* changed (`Error` → `AuthoringError`), not its text.
- `test/security/canary-no-echo.test.ts` and `test/support/canary.ts`: **zero diff** (confirmed
  via `git diff --stat`), suite re-run in isolation: **10 pass / 0 fail** — untouched and green,
  as required.

---

### Scrutiny Point 4 — REQ-RBV-05 / RLN unreadable-dir intentionally NOT upgraded

**CONFIRMED spec-correct, not a missed requirement**, with one documentation nit found.

- The domain spec files (`openspec/changes/stage-4-typed-options/specs/run-boundary-input-validation/spec.md`,
  `.../reserved-lifecycle-names/spec.md`) carry an explicit "AuthoringError shape deferred to
  S-006" status caveat on REQ-RBV-01/02 and REQ-RLN-02 — and conspicuously do NOT carry that
  caveat on REQ-RBV-05 (malformed/unreadable schema.json) or the RLN "non-ENOENT unreadable
  package dir" scenario. REQ-AEC-07 (`invalid-input`) is scoped strictly to "a factory run's
  *resolved input* fails schema-derived validation" — a corrupt/unreadable `schema.json` is a
  different failure class the closed 8-member `AuthoringReason` enum has no member for. Upgrading
  it would require either misclassifying it under an existing reason or inventing a 9th member —
  neither authorized by any signed REQ. The executor correctly left these paths as plain `Error`
  (`context.ts`'s `malformedSchemaMessage` throw sites), and the corresponding tests still assert
  `.not.toBeInstanceOf(AuthoringError)`.
- **WARNING (documentation defect, found independently and cross-checked against the executor's
  own self-report)**: `src/core/context.ts:100-101` still carries a stale comment — "every other
  read/parse failure fails closed as a plain Error (upgraded to AuthoringError in S-006)" — left
  over from design.md §4.8's imprecise "Read-path posture" prose, which was never reconciled
  against the domain specs' actual (narrower) S-006 scoping. The comment now contradicts the
  shipped behaviour (this path was deliberately NOT upgraded) and will mislead a future reader.
  Non-blocking (behaviour is correct; only the comment is wrong) — flag for a one-line comment
  fix before archive.

---

### Scrutiny Point 5 — FIT-11 eight-family coverage, adversarial proof

**CONFIRMED, with a live adversarial mutation performed and cleanly reverted.**

- Static check: `REQ-AEC-05.1`'s case table in `fit-11-whole-object-leak-scan.test.ts` now lists
  eight `{label, build}` entries — the six original families plus `invalid-input` and
  `reserved-name`, each built via direct `new AuthoringError(...)` construction (no `EmitRejection`
  path exists for these two SDK-side reasons).
- Adversarial plant: temporarily edited `invalidInputRejection()`'s `message` field in the test
  file to interpolate `CONTRACT_FAKE_PREFIX` (a real leak-dictionary fragment), ran
  `bun test test/fitness/fit-11-whole-object-leak-scan.test.ts` in isolation:
  ```
  (fail) REQ-AEC-05.1 — no leak across any rejection family > invalid-input — zero dictionary
  strings anywhere in the object graph [0.21ms]
    - []
    + ["property "message" leaks fragment "ContractFake:"", "property "stack" leaks fragment "ContractFake:""]
   13 pass / 1 fail
  ```
  Confirms the scan genuinely exercises the new family, not a decorative list entry. Reverted the
  edit; diffed against a pre-mutation backup copy — **byte-identical**, confirmed via `diff`
  (`REVERT CONFIRMED IDENTICAL`). Re-ran the full suite post-revert: 563 pass / 0 fail, unchanged.

---

### Scrutiny Point 6 — Exhaustive-switch compile pin

**CONFIRMED via live adversarial mutation, cleanly reverted.**

- Temporarily added a 9th `AuthoringReason` member (`"adversarial-ninth-member"`) to
  `src/core/authoring-error.ts` and ran `bunx tsc --noEmit`:
  ```
  src/core/authoring-error.ts(95,13): error TS2322: Type '"adversarial-ninth-member"' is not assignable to type 'never'.
  src/core/authoring-error.ts(172,13): error TS2322: Type '"adversarial-ninth-member"' is not assignable to type 'never'.
  test/types/authoring-reason.test.ts(30,17): error TS2322: Type '"adversarial-ninth-member"' is not assignable to type 'never'.
  test/types/authoring-reason.test.ts(55,7): error TS2344: Type '...' does not satisfy the constraint '...'.
  ```
  Four independent compile breaks (both `authoring-error.ts` internal switches, plus the
  dedicated `test/types/authoring-reason.test.ts` pin file's `switch`-with-`never` proof and its
  `expectTypeOf` union pin) — the mechanism is real and lands in the MAIN `tsc --noEmit` set
  (not excluded), confirming a 9th/removed member breaks the build as REQ-AEC-01's semver note
  requires.
- Reverted; diffed against a pre-mutation backup — **byte-identical** (`REVERT CONFIRMED
  IDENTICAL`). Re-ran `bunx tsc --noEmit`: clean, exit 0.

---

### Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: ok
**Delta scope**: 7 test files touched, 2 impl files touched (`authoring-error.ts`,
`input-rejection.ts`)

**Findings**: none.

- TDD adherence (light): every new/changed implementation line (reason union growth, `originFor`
  new arms, `messageFor` new arms + `message` override field, `input-rejection.ts`'s two upgraded
  throw sites) has corresponding delta tests; no new implementation without tests.
- Banned assertion patterns (delta only): scanned all added `+` lines across the seven changed
  test files for `.toBeDefined()`, `.toBeTruthy()`/`.toBeFalsy()` without context,
  `objectContaining` as a whole assertion, `.not.toThrow()` as sole assertion, snapshot-only
  tests — **zero matches**.
- Triangulation: `originFor`'s new branch and `messageFor`'s new throw-arms are each driven by 2
  distinct cases (`invalid-input`, `reserved-name`) — not a single incidental pass. S-006's
  upgrade is triangulated across 3 distinct call sites (missing/wrong-type, disallowed-key,
  reserved-name) plus 3 distinct wiring paths (RBV integration, RLN integration, e2e site-proof).
- Regression: previously-passing suite (556) fully subsumed in the new green run (563); 0
  failures.

**Tolerated for now (flagged for final)**: none beyond the two WARNINGs already logged above
(constructor type-safety followup, stale comment) — both are sub-critical per in-loop tolerance
rules and are carried forward explicitly, not silently dropped.

---

### Spec Compliance Matrix (scope only)

| Requirement | Test | Result |
|---|---|---|
| REQ-AEC-01 (8-value closed enum) | `authoring-reason.test.ts`, `authoring-error.test.ts::REQ-AEC-01.2` | ✅ COMPLIANT |
| REQ-AEC-02 (origin derivation, new reasons → authoring-rejected) | `authoring-error.test.ts::REQ-AEC-07.1/08.1` | ✅ COMPLIANT |
| REQ-AEC-04.2 (FIT-04 additive-only) | `fit-04-dts-semver-gate.test.ts` + manual baseline diff (Scrutiny 2) | ✅ COMPLIANT |
| REQ-AEC-05 / REQ-AEC-05.1 (8-family leak scan) | `fit-11-whole-object-leak-scan.test.ts` + adversarial plant (Scrutiny 5) | ✅ COMPLIANT |
| REQ-AEC-07.1 (invalid-input classification) | `authoring-error.test.ts`, `input-rejection.test.ts`, `run-boundary-validation.test.ts`, `typed-factory.e2e.test.ts` | ✅ COMPLIANT |
| REQ-AEC-08.1 (reserved-name classification) | `authoring-error.test.ts`, `input-rejection.test.ts`, `reserved-lifecycle-names.test.ts` | ✅ COMPLIANT |
| REQ-AEC-09 (message templates, byte-exact) | `input-rejection.test.ts`, `run-boundary-validation.test.ts`, `reserved-lifecycle-names.test.ts` | ✅ COMPLIANT |
| REQ-RBV-01/02 S-006 facet (instanceof/origin/reason) | `run-boundary-validation.test.ts::REQ-RBV-01.2` | ✅ COMPLIANT |
| REQ-RBV-05 (unreadable/malformed schema stays plain Error) | `run-boundary-validation.test.ts::REQ-RBV-05` (unchanged) | ✅ COMPLIANT (Scrutiny 4) |
| REQ-RLN-02.1 (reason-based in-kind distinguishability) | `reserved-lifecycle-names.test.ts::REQ-RLN-02` | ✅ COMPLIANT |

---

### Real Execution Evidence

```
$ bun test
 563 pass
 0 fail
 940 expect() calls
Ran 563 tests across 76 files. [1.78s]

$ bunx tsc --noEmit
(no output — exit 0)
```

Baseline before this batch (per session bundle): 556 tests green / 76 files, typecheck clean.
Delta: +7 tests, 0 files added (all extensions to existing files), 0 regressions.

---

### Issues Found

**CRITICAL**: None.

**WARNING** (should fix, non-blocking, carried to verify-final/archive):
1. `src/core/authoring-error.ts` constructor's `message?: string` field is ungated across all
   eight `reason` values (compiles for any reason, not just `invalid-input`/`reserved-name`) —
   recommend a discriminated union to restore compile-time enforcement of REQ-AEC-06's
   frozen-template guarantee, matching the file's own exhaustive-switch idiom. No current
   exploit — both real call sites are correct.
2. `src/core/context.ts:100-101` — stale comment ("upgraded to AuthoringError in S-006") that
   contradicts the actual (spec-correct) shipped behaviour for the RBV-05/unreadable-schema
   path. One-line comment fix.

**SUGGESTION**: None beyond the above.

---

### Routing

**LOCAL** (both WARNINGs) — neither blocks this iteration; both are followup-tracked for
verify-final and the archive's ADR record for `authoring-error-contract`. No re-invocation of
the Executor is required for this iteration to close.

Orchestrator action: exit loop, proceed toward `/evaluate` (mode=final) before archive, carrying
these two WARNINGs into that pass's issue tracking.
