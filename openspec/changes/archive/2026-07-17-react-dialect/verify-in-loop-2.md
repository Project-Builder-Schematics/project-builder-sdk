## Verify In-Loop Result

**Change**: react-dialect
**Iteration**: 2/3
**Scope**: S-001 (`setJsxProp` + validator core)
**Mode**: in-loop (Strict TDD)

---

### Verdict: NEEDS_FIX

Both findings are LOCAL (Executor-fixable in the next iteration — add tests, no design or spec
change needed). Everything else checked is clean; see evidence below.

| Issue | Slice | Severity | File:Line | Detail |
|---|---|---|---|---|
| 1 | S-001 | CRITICAL | `src/dialects/react/ops.ts:59` | The `existingAttr` + `value === undefined` branch (`attr.removeInitializer()` — downgrading an already-valued attribute to boolean shorthand) is real production logic documented in slices.md's own Upsert contract, but has **zero test coverage**. Every `setJsxProp(el, "propName")` (no third arg) call in the S-001 test suite targets an element where that attribute does not yet exist (insert path, `addAttribute({initializer: undefined})`), never one where it already has a value. Independently probed: the branch *does* work correctly (`<Button disabled={isBusy} />` → `setJsxProp("Button","disabled")` → `<Button disabled />`), so this is a coverage gap, not a functional bug — but it is a genuine Strict TDD triangulation gap on the security-anchor slice (an untested branch of the exact op the slice exists to harden). |
| 2 | S-001 | WARNING | `test/dialects/react/name-validation.test.ts` (HOSTILE_BATTERY loop) | REQ-RXD-06.5's signed-spec THEN clause is "**WHEN each op is applied** THEN every case rejects ... zero directives, file byte-unchanged" (spec.md:404-408) — an end-to-end/handle-level property. The 20-combination battery (10 hostile values × elementName/propName) is exhaustively tested only at the bare-function level (`assertValidAttributeName`/`assertValidElementName` called directly, not through `setJsxProp`/`react.find()`). End-to-end zero-directives proof exists for only 1 of the 10 canonical battery values as `propName` ("Foo bar", via REQ-RXD-13.2) and for 0 as `elementName`. Because targeting is by tag-text equality, a hostile `elementName` would incidentally still produce a "no element found" reject even if `assertValidElementName` were never wired — so the missing elementName end-to-end case is the one place this asymmetry actually matters (it is the only way to prove REJECTION IS VALIDATOR-SHAPED, not an accidental zero-match). Independently probed: `react.find("Button.tsx").setJsxProp("__proto__","x","{1}")` correctly throws `` `elementName` "__proto__" is a reserved name... ``, 0 directives, file unchanged — the wiring is correct, this is a coverage gap only. |

Orchestrator action: re-invoke `/build` (SDD-light) targeting S-001 to add: (a) one test
exercising the `removeInitializer()` downgrade path (existing valued attribute + omitted third
arg → boolean shorthand, ideally against a committed golden), and (b) one end-to-end
`setJsxProp` test with a hostile `elementName` (denylist or grammar-invalid) asserting the
validator-shaped message + zero directives + byte-unchanged file, mirroring REQ-RXD-06.1's
propName pattern. Both are additive test-only changes; no production code implicated. Iteration
2 of 3 used.

---

### What was verified clean (real execution evidence)

**Full suite**
```
$ bun test
 1735 pass
 0 fail
 3611 expect() calls
Ran 1735 tests across 178 files. [30.31s]
```
Matches the apply claim exactly (entering baseline 1674/0 → 1735/0, net +61, 0 regressions).

**Typecheck**
```
$ bunx tsc --noEmit
(exit 0, no output)
```

**Fitness functions touched by this slice's changed `.d.ts`/package-surface baselines**
```
$ bun test test/fitness/fit-04-dts-semver-gate.test.ts test/fitness/fit-09-pkg-exports-resolution.test.ts \
    test/fitness/fit-14-package-surface.test.ts test/fitness/fit-36-spike-deps-absent.test.ts \
    test/fitness/fit-37-core-commons-ast-free.test.ts test/fitness/fit-38-parser-construction-confinement.test.ts
 65 pass
 0 fail
```

**Working tree**: `git status --porcelain` clean except the orchestrator-owned `.sdd/state/react-dialect.json`
and the untracked prior-iteration `verify-in-loop-1.md` — all S-001 source/test/golden files are
committed in a single commit `e257ca7` on top of S-000's `6e02e7c`. `git diff 6e02e7c e257ca7 --name-only`
confirms the touched-file set is EXACTLY: the two new kit-internal core files
(`jsx-name-validator.ts`, `reject-tail.ts`), `src/dialects/react/{index,ops}.ts`, the new test
files, 10 new goldens, and the two regenerated fitness baselines (`react.index.d.ts`,
`pkg-surface-baseline.json`) — **zero changes to `src/core/{dialect-handle,define-dialect,dialect-error}.ts`**,
confirming the Shared Contracts claim that "NO new containment code is written anywhere in this
change".

### Completeness

Tasks S-001.1–.5 all `[x]` in `slices.md`; all five files/behaviours they name exist and are
exercised.

### Spec Compliance Matrix (scope: S-001, 25 verbatim scenarios — REQ-RXD-04×6, -10×6, -11×5, -12×1,
-06×4 elementName/propName portion, -13×3)

| Requirement | Test | Result |
|---|---|---|
| REQ-RXD-04.1 | `ops.test.ts:23` | ✅ COMPLIANT |
| REQ-RXD-04.2 | `ops.test.ts:36` | ✅ COMPLIANT |
| REQ-RXD-04.3 | `ops.test.ts:51` | ✅ COMPLIANT |
| REQ-RXD-04.4 | `ops.test.ts:67` | ✅ COMPLIANT |
| REQ-RXD-04.5 | `ops.test.ts:88` | ✅ COMPLIANT |
| REQ-RXD-04.6 | `ops.test.ts:109` (golden `setprop-boolean-namespaced.txt`, byte-verified) | ✅ COMPLIANT |
| REQ-RXD-10.1 | `dialect.test.ts` (golden `setprop-after-className.txt`, byte-verified) | ✅ COMPLIANT |
| REQ-RXD-10.2 | `dialect.test.ts` (golden `setprop-after-spread.txt`) | ✅ COMPLIANT |
| REQ-RXD-10.3 | `dialect.test.ts` (golden `setprop-update-position-preserved.txt`) | ✅ COMPLIANT |
| REQ-RXD-10.4 | `dialect.test.ts` | ✅ COMPLIANT |
| REQ-RXD-10.5 | `dialect.test.ts` | ✅ COMPLIANT |
| REQ-RXD-10.6 | `dialect.test.ts` (goldens `setprop-multiline-{before,after}.txt`) | ✅ COMPLIANT |
| REQ-RXD-11.1 | `ops.test.ts:141` (golden `setprop-string-value.txt`) | ✅ COMPLIANT |
| REQ-RXD-11.2 | `ops.test.ts:152` (golden `setprop-expression-value.txt`) | ✅ COMPLIANT |
| REQ-RXD-11.3 | `ops.test.ts:163` | ✅ COMPLIANT |
| REQ-RXD-11.4 | `ops.test.ts:176` (golden `setprop-value-form-replaced.txt`) | ✅ COMPLIANT |
| REQ-RXD-11.5 | `ops.test.ts:187` + `ops.test.ts:211` | ⚠️ PARTIAL — accepted deviation, see below |
| REQ-RXD-12.1 | `ops.test.ts:232` | ✅ COMPLIANT |
| REQ-RXD-06.1 | `ops.test.ts:246` | ✅ COMPLIANT |
| REQ-RXD-06.2 | `ops.test.ts:268` (golden `setprop-widened-propnames.txt`) | ✅ COMPLIANT |
| REQ-RXD-06.5 (setJsxProp portion) | `name-validation.test.ts` (unit, exhaustive) + `name-validation.test.ts:184` (1/20 end-to-end) | ⚠️ PARTIAL — see Finding 2 |
| REQ-RXD-06.6 | `ops.test.ts:121` | ✅ COMPLIANT |
| REQ-RXD-13.1 | `canary-no-echo.test.ts` (canary 24 chars, `surfaceContains`) | ✅ COMPLIANT |
| REQ-RXD-13.2 (setJsxProp paths) | `name-validation.test.ts:184-240` (validator/zero-match/multi-match, all 3) | ✅ COMPLIANT |
| REQ-RXD-13.3 | `name-validation.test.ts:128` | ✅ COMPLIANT |

**Compliance summary**: 23/25 fully compliant, 2 partial (both independently re-verified as
behaviourally correct; gaps are test-coverage, not defects — see Findings 1/2 and the deviation
adjudication below).

### Security floor (independently re-verified, not trusted from apply-progress)

- **Hostile battery completeness**: `HOSTILE_BATTERY` = the 10 values from REQ-RXD-06.5 verbatim,
  run as BOTH `elementName` and `propName` (20 cases) — confirmed present and all passing.
- **Denylist mechanism**: `JSX_NAME_DENYLIST: ReadonlySet<string> = new Set([...])`, checked via
  `.has()` — confirmed a real `Set`, not an object literal or regex (`src/core/jsx-name-validator.ts:16,29-35`).
- **Set-key-safety static scan — proven non-tautological**: I injected a forbidden pattern
  (`counts[elementName]++`) into `src/dialects/react/ops.ts`, re-ran the scan test alone, and it
  failed RED (`Expected: false, Received: true`) exactly as it should; reverted, suite back to
  green. The scan is a real negative check, not decorative.
- **Zero-echo canary**: `canaryToken` ≥24 chars asserted in-test; swept via the existing
  `surfaceContains` helper (message, own props, `.cause`, stack) — REQ-RXD-13.1 case added to
  `test/security/canary-no-echo.test.ts`, passing.
- **Load-bearing raw-splice pin**: `name-validation.test.ts` "Load-bearing raw-splice pin" test
  bypasses `setJsxProp`/`validatedOp` and calls ts-morph's `addAttribute` directly with a hostile
  name — confirms it writes raw unescaped text. This is what makes the validator load-bearing,
  proven independent of this change's own code, not a tautology.
- **Zero-emit-on-reject / no new containment code**: confirmed via `git diff --name-only` (no
  touches to `dialect-handle.ts`/`define-dialect.ts`/`dialect-error.ts`) and via the three
  representative-reject tests (validator, zero-match, multi-match) all asserting
  `collectModifies(emitted)).toHaveLength(0)` + `client.read(...)` byte-identical to `before`.

### Goldens

10 goldens under `test/dialects/react/golden/*.txt`, committed (clean `git status`), byte content
spot-verified via `xxd` (plain space/LF separators, no encoding surprises). All comparisons in
tests use `toEqual`/`toBe` against the loaded golden content, never a length-only or
`toContain` check.

### Deviation Adjudication — REQ-RXD-11.5

**Builder's finding** (slices.md line 204, apply-progress.md): the spec's literal example —
`setJsxProp("Button", "data-x", "{")`, an unterminated delimiter — cannot succeed via ts-morph's
structured API; `addAttribute`/`setInitializer` reparse-and-reconcile the whole file after every
structural edit, and an unclosed `{` breaks that reconcile before `print()` runs.

**Independently reproduced** (bypassing the SDK, calling ts-morph directly against the same
parse/print pair used by `react/ast.ts`):
```
element.addAttribute({ name: "data-x", initializer: "{" });
→ THREW: Manipulation error: A syntax error was inserted.
  TS1161: Unterminated regular expression literal.
  TS1005: '}' expected.
```
Confirmed: this is intrinsic to ts-morph@28's own edit-reconciliation, not an SDK choice, and
there is no ADR-03-compliant (structured-API-only) workaround.

**Verdict: accept-as-substance-covered.** The op's actual test (`ops.test.ts:187`, value
`'{1+}'` — delimiter-balanced but semantically malformed) proves the scenario's real substance
("no output re-validation of `value`") without hitting the ts-morph reconcile ceiling, and a
second test (`ops.test.ts:211`) pins that the true unterminated case still fails SAFELY
(contained via the existing `#invokeContained` wrap, zero directives, file byte-unchanged — not
a silent corruption). Both are real, passing, independently-reproduced-behaviour tests, not a
hand-wave.

**Required follow-up routing**: amend REQ-RXD-11.5's GIVEN example to a delimiter-balanced value
(e.g. `'{1+}'`) at the next spec touch (S-002 or later) — a wording-only fix, zero
scope/behaviour change. Register in `project/pending-changes` if not closed before archive.

### Strict TDD (in-loop audit)

**Iteration**: 2
**Verdict**: concerns (Findings 1/2 above; both tolerated-with-flag per in-loop rules, not a full
architectural halt — LOCAL/Executor-fixable)
**Delta scope**: 4 new test files/sections (`ops.test.ts`, `name-validation.test.ts`, +1 canary
case, +1 `dialect.test.ts` describe block), 3 new/modified impl files (`jsx-name-validator.ts`,
`reject-tail.ts`, `ops.ts`), 10 new goldens

- Banned assertion patterns: none found. The `.not.toThrow()` calls in `name-validation.test.ts`'s
  grammar-happy-path test are the ONLY meaningful assertion available for a void-returning
  validator on a known-good input (no output to assert beyond "did not reject") — not a smoke-test
  evasion of a real assertion elsewhere.
- Triangulation: `matches.length` trio (0 / 1 / >1) — all 3 branches tested. `existingAttr` found
  + value-provided (`setInitializer`) — tested (04.2, 11.4). `existingAttr` found + value-omitted
  (`removeInitializer`) — **0 tests** (Finding 1). `existingAttr` miss (`addAttribute`) — tested
  extensively (insert path is the majority of the suite).
- Regression: all 1674 previously-passing tests still pass; suite delta is a pure +61, 0 red.
- New-file-has-tests: both new core files (`jsx-name-validator.ts`, `reject-tail.ts`) and the new
  op file (`ops.ts`) are exercised.
- TDD-cycle-adherence (Method 1, git history): single commit `e257ca7` for the whole S-001 batch
  — not discriminating, consistent with this project's established per-slice commit granularity
  (same as S-000's `verify-in-loop-1.md` finding). Method 2 (test-implementation pairing) used
  instead: clean except the two branch-level gaps above.

### Issues Found

**CRITICAL**: 1 (Finding 1 — untested `removeInitializer` branch)
**WARNING**: 1 (Finding 2 — REQ-RXD-06.5 end-to-end asymmetry, elementName leg unproven)
**SUGGESTION**: None

Orchestrator action: re-invoke `/build` SDD-light for S-001, targeting the two additive test
gaps above. Do not proceed to S-002 until iteration 3 confirms both closed (or an explicit owner
override is recorded) — S-001 is the security-anchor slice and both gaps sit directly in its op
and its hostile-name battery.
