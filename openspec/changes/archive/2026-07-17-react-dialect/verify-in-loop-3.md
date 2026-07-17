## Verify In-Loop Result

**Change**: react-dialect
**Iteration**: 3/3
**Scope**: S-001 (`setJsxProp` + validator core) — re-verification after fix iteration 1 (commit `0f1f91d`)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

Both verify-in-loop-2 findings are resolved with discriminating coverage; the fix is
strictly test-only; no regressions and nothing newly exposed. Loop can exit for S-001.

- Tasks in scope complete: 5/5 (S-001.1–.5, all `[x]`)
- Full suite: **1757 pass / 0 fail** (claim confirmed exactly; 1735 → 1757 = +2 shorthand-downgrade tests +20 e2e battery cases)
- Typecheck: `tsc --noEmit` → exit 0
- Spec compliance for scope: 25/25 scenarios (the two ⚠️ PARTIALs from iteration 2 are now ✅; REQ-RXD-11.5 remains accept-as-substance-covered per the iteration-2 adjudication, follow-up routing unchanged)
- Assertion audit (delta test files): clean

Orchestrator action: proceed to S-002 (`addImport`). Carry forward the REQ-RXD-11.5 spec-wording
follow-up (amend the GIVEN example to a delimiter-balanced value at next spec touch).

---

### Fix commit derivation (independent, per instruction to trust nothing)

```
$ git log --oneline 6e02e7c..feat/react-dialect
0f1f91d test(react-dialect): S-001 fix iteration — shorthand-downgrade branch + e2e hostile battery
e257ca7 feat(react-dialect): S-001 setJsxProp op + name-validator core

$ git diff --stat e257ca7 0f1f91d
 openspec/changes/react-dialect/apply-progress.md   | 23 +++++
 test/dialects/react/golden/setprop-shorthand-downgrade-mid.txt | 1 +
 test/dialects/react/golden/setprop-shorthand-downgrade.txt     | 1 +
 test/dialects/react/name-validation.test.ts        | 46 ++++++++++
 test/dialects/react/ops.test.ts                    | 28 +++++++
 5 files changed, 99 insertions(+)     ← ZERO deletions

$ git diff e257ca7 0f1f91d -- src/ bin/ package.json bun.lock
(empty)
```

**Test-only confirmed**: zero production-code diff; no containment files touched; 99 pure
insertions — no pre-existing test or golden was modified or weakened (a deletion-free diff
makes weakening structurally impossible).

### Finding 1 adjudication (CRITICAL, `removeInitializer` branch) — RESOLVED

Two new tests in `ops.test.ts` (lines ~176 and ~190):

1. "REQ-RXD-11.3 (upsert half)": seed `<Input required={maybe} />` + `setJsxProp("Input", "required")`
   → golden `setprop-shorthand-downgrade.txt` (`const el = <Input required />;\n`), byte-exact
   (`toBe` against the loaded golden) + `not.toContain("required=")`.
2. Triangulation twin: MID-position attribute (`type="text" required={maybe} className={cls}`)
   downgrades in place → golden `setprop-shorthand-downgrade-mid.txt` — proves position
   preservation, not just the trivial single-attribute case.

Goldens byte-inspected via `xxd`: plain ASCII, single-space separators, trailing LF matching the
seed convention — committed, clean `git status`.

**Discrimination proven by mutation probe** (executed, then reverted): replacing
`attr.removeInitializer();` with a silent `return;` in `src/dialects/react/ops.ts` fails exactly
the two new tests RED (`bun test test/dialects/react/ops.test.ts` → 16 pass / 2 fail). Not a
tautology — the golden differs from the seed, so a no-op cannot pass.

### Finding 2 adjudication (WARNING, REQ-RXD-06.5 end-to-end) — RESOLVED

New table-driven describe block in `name-validation.test.ts` (lines ~247-287): all 10
HOSTILE_BATTERY values × both name args = 20 end-to-end cases through
`react.find("Button.tsx").setJsxProp(...)` via spy-client. Each case asserts FOUR things:

1. `caught instanceof Error`;
2. **validator-SHAPED message**: `message.toContain(argName)` — this is the load-bearing
   assertion. The accidental-rejection path (hostile elementName → zero-match) produces
   "no element named ..." which does NOT contain the string `elementName`, so an unwired
   validator cannot pass this;
3. zero echo of the hostile value (non-empty, non-denylist cases);
4. `collectModifies(emitted)).toHaveLength(0)` + `client.read(...)` byte-identical to seed.

**Discrimination proven by mutation probe** (executed, then reverted): unwiring
`assertValidElementName(elementName)` from `setJsxProp`'s validators fails EXACTLY the 10
elementName e2e cases RED (`bun test name-validation.test.ts` → 40 pass / 10 fail) — the hostile
elementNames still rejected incidentally via zero-match, and the message-shape assertion caught
the difference, precisely the failure mode iteration 2 flagged. Independently reproduces the
builder's own claimed mutation probe from apply-progress.md.

Post-probe restore verified: `git status --porcelain src/` clean; targeted re-run of all four
S-001 test files → 98 pass / 0 fail.

### Regression / newly-exposed sweep

- Full suite 1757/0 (no pre-existing test regressed; delta is a pure +22).
- `tsc --noEmit` clean.
- Fitness baselines untouched by the fix commit (no `.d.ts` or package-surface change — test-only).
- The new e2e battery reuses the iteration-2-verified spy-client/byte-unchanged machinery; no new
  helpers, no new containment code, no golden rewrites.
- Working tree: only the orchestrator-owned `.sdd/state/react-dialect.json` (not mine) and the
  untracked verify-in-loop reports.

### Strict TDD (in-loop audit)

**Iteration**: 3
**Verdict**: ok
**Delta scope**: 2 test files extended, 2 new goldens, 0 impl files

- Banned assertion patterns in delta: none.
- Triangulation: the previously-untested `removeInitializer` branch now has 2 distinct cases
  (end-position + mid-position); the e2e battery adds 20 cases across both name args. The upsert
  now has all four branches covered (hit+value, hit+omitted, miss+value, miss+omitted).
- Regression: 0.
- TDD evidence: apply-progress documents goldens authored RED-first (wrong content committed
  first, observed failing); the commit is `test:`-prefixed. Both mutation probes above confirm
  the tests are behaviour-driving, which is the substance the RED-first convention protects.

### In-Loop History

| Iteration | Verdict | Issues |
|---|---|---|
| 1 (S-000) | PASS | — |
| 2 (S-001) | NEEDS_FIX | CRITICAL removeInitializer coverage; WARNING 06.5 e2e asymmetry |
| 3 (S-001 re-verify) | PASS | both resolved, mutation-proven |

### Issues Found

**CRITICAL**: None
**WARNING**: None
**SUGGESTION**: None (the REQ-RXD-11.5 spec-wording amendment remains an open follow-up from
iteration 2 — routing unchanged, not a code issue)
