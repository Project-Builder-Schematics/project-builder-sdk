## Verify In-Loop Result

**Change**: react-dialect
**Iteration**: 4/3 (batch iteration 1 for S-002; scope-batch numbering per orchestrator, not a repeat of S-001's 3)
**Scope**: S-002 (`addImport` — merge/create/idempotent, coalescing, exact op-set closes) — commit `fcd24d7`
**Mode**: in-loop (Strict TDD)

---

### Verdict: NEEDS_FIX

One signed-spec scenario is only partially covered (9/10 hostile values missing an end-to-end
`addImport` case the spec explicitly requires); everything else in scope is green, mutation-proven,
and boundary-clean. This is a LOCAL, mechanically-fixable gap — not architectural, not spec-ambiguous.

- Tasks in scope complete: 4/4 (S-002.1–.4, all `[x]` in `slices.md`)
- Full suite: **1769 pass / 0 fail** (claim confirmed exactly; 1757 → 1769 = +12)
- Typecheck: `tsc --noEmit` → exit 0
- Spec compliance for scope: 9/10 scenarios ✅ COMPLIANT, 1/10 ⚠️ PARTIAL (REQ-RXD-06.5 addImport
  portion — see Finding 1)
- Assertion audit (delta test files): clean, no banned patterns
- Mutation probes (3, run and reverted): all discriminate correctly

Orchestrator action: re-invoke `/build` SDD-light on the single finding below (extend one test
file, no production-code change needed), then re-verify batch S-002.

---

### Commit derivation (independent, trusting nothing from any summary)

```
$ git log --oneline e257ca7..fcd24d7
fcd24d7 feat(react-dialect): S-002 addImport — merge/create/idempotent, coalescing, exact op-set

$ git show fcd24d7 --stat -M
 openspec/changes/react-dialect/apply-progress.md   | 71 +++++++++++-
 openspec/changes/react-dialect/slices.md           |  8 +-
 src/dialects/react/index.ts                        | 12 +-
 src/dialects/react/ops.ts                          | 42 ++++++-
 test/dialects/react/dialect.test.ts                | 18 +++
 test/dialects/react/golden/addimport-fresh.txt     |  3 +
 test/dialects/react/golden/coalesce-setprop-addimport.txt | 3 +
 test/dialects/react/golden/setprop-shorthand-downgrade*.txt (2 files, S-001 carry, untouched by fcd24d7 content)
 test/dialects/react/name-validation.test.ts        | 115 +++++++++++++++++-
 test/dialects/react/ops-exact-set.test.ts          | 34 ++++++
 test/dialects/react/ops.test.ts                    | 121 +++++++++++++++++++
 test/fitness/dts-baseline/react.index.d.ts         |  1 +

$ git show fcd24d7 --stat  (rename-blind, S-002-only files)
 11 files changed, 317 insertions(+), 14 deletions(-)

$ git diff e257ca7..fcd24d7 -- package.json bun.lock
(empty — no new deps)

$ git show fcd24d7 --stat | grep -i typescript
(empty — TS dialect untouched)
```

Boundary confirmed clean: no changes outside the S-002 file set, no new dependencies, TS dialect
untouched.

### Spec Compliance Matrix (10 S-002 scenarios)

| Requirement | Test | Result |
|---|---|---|
| REQ-RXD-05.1 (fresh insert) | `ops.test.ts` "REQ-RXD-05.1" — byte-exact vs `addimport-fresh.txt` | ✅ COMPLIANT |
| REQ-RXD-05.2 (merge into existing clause) | `ops.test.ts` "REQ-RXD-05.2" | ✅ COMPLIANT |
| REQ-RXD-05.3 (idempotent, no duplicate) | `ops.test.ts` "REQ-RXD-05.3" | ✅ COMPLIANT (mutation-proven, see below) |
| REQ-RXD-05.4 (named-only, never default) | `ops.test.ts` "REQ-RXD-05.4" | ✅ COMPLIANT |
| REQ-RXD-06.3 (hostile `name` breakout rejected) | `ops.test.ts` "REQ-RXD-06.3" | ✅ COMPLIANT (mutation-proven) |
| REQ-RXD-06.4 (hostile `from` escaped as one literal) | `ops.test.ts` "REQ-RXD-06.4" | ✅ COMPLIANT (mutation-proven) |
| REQ-RXD-06.5 (addImport portion of hostile battery) | `name-validation.test.ts` line 267 (1 value only) | ⚠️ PARTIAL — see Finding 1 |
| REQ-RXD-07.1 (setJsxProp+addImport coalescing, one directive) | `dialect.test.ts` "REQ-RXD-07.1" | ✅ COMPLIANT (mutation-proven) |
| REQ-RXD-13.2 (addImport validator reject + in-run extension gate) | `name-validation.test.ts` lines 267/286 | ✅ COMPLIANT |
| REQ-RXD-01.1 full (exact 2-op set, `toEqual`) | `ops-exact-set.test.ts` | ✅ COMPLIANT |

**Compliance summary**: 9/10 compliant, 1/10 partial.

---

### Finding 1 — CRITICAL — req-coverage-gap — REQ-RXD-06.5 (addImport portion), signed spec not fully implemented

**File**: `test/dialects/react/name-validation.test.ts`
**Signed spec** (`openspec/changes/react-dialect/specs/react-dialect/spec.md:398-408`), verbatim:

> GIVEN each of `__proto__`, `constructor`, `prototype` ..., `"Foo bar"`, `"Foo=1}"`,
> `"a><script>alert(1)</script>"`, `""`, `"   "`, `"foo\nbar"`, `"123abc"` supplied as
> `elementName` and as `propName` (and, **where the grammar applies, as `addImport.name`**)
> ... THEN every case rejects via `dialectError` pre-mutation — zero directives, file
> byte-unchanged ...

`slices.md`'s own S-002 acceptance section (line 230) restates this as a required scenario:
"REQ-RXD-06.5 (addImport portion) — the hostile battery of S-001, where the grammar applies,
as `addImport.name` — every case rejects pre-mutation, zero directives, byte-unchanged."

I verified `IMPORT_BINDING_GRAMMAR = /^[A-Za-z_$][A-Za-z0-9_$]*$/` against all 10
`HOSTILE_BATTERY` values — **the grammar rejects (or the denylist catches) all 10**, so "where
the grammar applies" scopes to the full battery, identically to elementName/propName:

```
__proto__ → grammar matches (denylist catches) | constructor → same | prototype → same
"Foo bar" → grammar rejects | "Foo=1}" → rejects | "a><script>alert(1)</script>" → rejects
"" → rejects | "   " → rejects | "foo\nbar" → rejects | "123abc" → rejects
```

**What exists**: `HOSTILE_BATTERY` (name-validation.test.ts:26-37) is referenced in exactly two
loops — the bare-function battery (line 42, `assertValidAttributeName`/`assertValidElementName`
only) and the end-to-end handle battery (line 336-351, `setJsxProp` propName/elementName only,
10×2=20 cases). **Neither loop touches `addImport` or `assertValidImportBinding`.** The only
`addImport`-specific hostile-value coverage is:
- line 91-109: a bare-function smoke test, 2 of the 10 values only (`"123abc"` grammar,
  `"__proto__"` denylist), asserting message content only — no zero-directive/byte-unchanged
  check, not through the handle.
- line 267 (S-002-added, `REQ-RXD-13.2`): ONE value (`"123abc"`) through
  `react.find(...).addImport(...)`, asserting zero-directives + byte-unchanged.
- `ops.test.ts` REQ-RXD-06.3: a distinct hostile string (`'x } from "evil"; import { y'`,
  NOT a `HOSTILE_BATTERY` member) through the handle, zero-directives + byte-unchanged.

Net: **1 of 10** `HOSTILE_BATTERY` values gets the full end-to-end
(handle → zero-directives → byte-unchanged) treatment through `addImport`; the other 9
(`constructor`, `prototype`, `"Foo bar"`, `"Foo=1}"`, `"a><script>..."`, `""`, `"   "`,
`"foo\nbar"`, and `"__proto__"` at the handle level) are untested against `addImport`.

For comparison, S-001 built exactly this loop for `setJsxProp` (`verify-in-loop-3.md`,
"Finding 2 adjudication" — the same REQ-RXD-06.5 requirement, same battery, same discipline).
S-002 did not extend it to the third argument the spec named.

**Failure scenario this leaves open**: if a future change (or a bug reintroduced by refactor)
silently un-wires `assertValidImportBinding` for any value other than `"123abc"` — e.g. it stops
rejecting `"foo\nbar"` or a whitespace-only name — no test in the suite would catch it. (My own
Finding-1-adjacent mutation probe, below, proves the wiring is CURRENTLY correct — it does not
substitute for the missing regression coverage the signed spec demands.)

**Fix demand**: add a table-driven loop mirroring `name-validation.test.ts:315-352`
(`REQ-RXD-06.5 — end-to-end: every hostile value rejects THROUGH the handle...`) for `addImport`,
iterating `HOSTILE_BATTERY` as the `name` argument through
`react.find(seedPath).addImport(hostile, "react")`, asserting (matching the existing pattern):
`caught instanceof Error`, `message.toContain("name")`, no-echo for non-denylisted/non-empty
values, `collectModifies(emitted)).toHaveLength(0)`, and byte-unchanged file. Test-only change,
no production code implicated (my mutation probes below already show the validator itself works
correctly for the untested values — this is a coverage gap, not a behavior bug).

Routing: **LOCAL** (Executor SDD-light, test-only).

---

### Independent mutation probes (executed against `src/dialects/react/ops.ts`, then reverted)

Per the task's TDD-adjudication instruction, and because no retro-RED evidence for S-002 could be
located in either the openspec `apply-progress.md` or its more detailed engram twin (obs #1077 —
see "TDD Adjudication" below), I ran my own probes rather than accept the claim as documentation.
All three probes were reverted; `git status --porcelain src/dialects/react/ops.ts` is clean and a
`diff` against the pre-probe copy is empty.

**Probe A — whole-body no-op stub** (`addImport`'s mutation body replaced with a comment, no AST
call):
```
$ bun test test/dialects/react/
93 pass / 6 fail
```
Failed exactly: REQ-RXD-05.1, .05.2, .05.3, .05.4, REQ-RXD-06.4, REQ-RXD-07.1 (coalescing).
REQ-RXD-06.3 correctly still passed (its reject fires in the validator, before the stubbed body
ever runs — expected, not a gap).

**Probe B — idempotency check removed** (`existing.addNamedImport(name)` called unconditionally,
dropping the `alreadyPresent` guard):
```
$ bun test test/dialects/react/
98 pass / 1 fail
```
Failed exactly: REQ-RXD-05.3 (the duplicate-detection scenario). Precise triangulation — no other
test moved.

**Probe C — `assertValidImportBinding` call removed from the validator closure**:
```
$ bun test test/dialects/react/
97 pass / 2 fail
```
Failed exactly: REQ-RXD-06.3 and the REQ-RXD-13.2 addImport-validator-reject test (line 267).
Confirms these two are validator-shaped rejects, not accidental ones — consistent with S-001's
established pattern (message names the argument).

**Conclusion**: every test that DOES exist for S-002 is real and discriminating — no tautologies,
no smoke-only assertions found in the delta. The gap is coverage BREADTH (Finding 1), not test
quality of what was written.

### Set-key-safety regex fix — verified as a genuine precision fix, not a weakening

Independently reproduced the false-positive claim: the OLD regex
(`/\[\s*(?:propName|elementName|name|tag)\s*\]/`) flags `src/dialects/react/ops.ts` as committed
in `fcd24d7` (`true`); the NEW regex
(`/[\w$)\]{]\[\s*(?:propName|elementName|name|tag)\s*\]/`) does not (`false`). Confirmed the new
regex still matches `record[name]`, `{[name]: v}`, `counts[tag]++` and correctly excludes
`namedImports: [name]`, `([name]) => {}`, `const [name] = args;` (its own self-tests, re-run
green). The underlying security property (never index an object/Map by these names) is
unweakened — only scanner precision changed, as claimed.

### Baseline hygiene

- `test/fitness/dts-baseline/react.index.d.ts`: diff is a single ADDED line
  (`addImport: (ast: SourceFile, name: string, from: string) => void;`) inside `ReactOps` —
  additive-only, confirmed via `git diff e257ca7..fcd24d7`.
- `test/fitness/pkg-surface-baseline.json`: zero diff between `e257ca7` and `fcd24d7` — confirmed
  via `git diff --stat`, matches the "zero new dist files" claim (`ops.ts`/`.js`/`.d.ts` already
  existed from S-001).

### TDD Adjudication (Strict TDD Mode enabled)

The orchestrator's state-mirror note (`.sdd/state/react-dialect.json`) reads: "builder
self-reported a TDD self-correction (impl ahead of tests, retro RED via no-op stub) — adjudicate."

I could not substantiate this claim. Neither `openspec/changes/react-dialect/apply-progress.md`
(read in full — the S-002 section, lines 68-113, describes files changed and one unrelated
apply-time finding about the Set-key-safety regex, nothing about an implementation-before-tests
sequence) nor its engram counterpart (topic `sdd/react-dialect/apply-progress`, obs #1077, read in
full — states plainly "S-002 clean through in this apply pass, no fix iteration needed") documents
a retro-RED/no-op-stub self-correction for S-002. (Obs #1077's "Learned" point 3 — "Strict-TDD RED
for `toThrow()`-only negative tests is vacuous against an always-throwing stub" — is a general
lesson, not a self-report of this specific event, and isn't tied to S-002 in the text.)

Given "trust nothing from any summary" and the absence of any documented evidence, I ran my own
mutation probes (A/B/C above) instead of adjudicating the (unfound) retro-RED narrative. On QUALITY
grounds — the only grounds the task asked me to judge on — the S-002 delta tests are real and
discriminating. I am flagging the undocumented claim itself as a process finding (below) because
Strict TDD requires evidence to be captured in the artefact, not asserted in a state note with
nothing behind it; it does not change the verdict beyond Finding 1.

### Finding 2 — WARNING — unsubstantiated TDD self-correction claim in state mirror

**File**: `.sdd/state/react-dialect.json` (orchestrator-owned state note, not an apply-progress
artefact)
**Claim**: "builder self-reported a TDD self-correction (impl ahead of tests, retro RED via
no-op stub) — adjudicate."
**Evidence checked**: `openspec/changes/react-dialect/apply-progress.md` S-002 section (full read)
and engram obs #1077 (full read, `sdd/react-dialect/apply-progress`) — neither documents this
event. Obs #1077 instead states S-002 required no fix iteration.
**Impact**: not a code defect (my own probes vindicate current test quality — see above), but the
claim cannot be adjudicated as instructed because its supporting evidence does not exist where
Strict TDD requires it to be captured. If the event genuinely happened, `apply-progress.md` is
missing the required RED-proof paragraph (S-001's fix-iteration precedent, e.g. line 45-64 of
`apply-progress.md`, is the documentation bar). If it did not happen, the state note is inaccurate
and should not carry forward into `verify-report`'s final TDD audit.
**Fix demand**: orchestrator to either (a) locate/re-supply the actual RED-proof documentation
and re-attach it to `apply-progress.md`'s S-002 section, or (b) correct the state note. Not
blocking S-002's re-verify on its own (Finding 1 is); flag for final-mode TDD cycle adherence
audit either way.

Routing: **LOCAL** (documentation correction, orchestrator/Planner-side, non-code).

---

### Regression / newly-exposed sweep

- Full suite 1769/0 (1757 → 1769, net +12, matches apply-progress's own count).
- `tsc --noEmit` clean.
- Working tree clean except the orchestrator-owned `.sdd/state/react-dialect.json` (not mine) —
  confirmed via `git status --porcelain` before and after all probes.

### Strict TDD (in-loop audit)

**Iteration**: 4 (S-002 batch)
**Verdict**: concerns
**Delta scope**: 4 test files extended (`ops.test.ts`, `dialect.test.ts`, `name-validation.test.ts`,
+1 new `ops-exact-set.test.ts`), 1 impl file extended (`ops.ts`, +`addImport`)

- Banned assertion patterns in delta: none found (scanned all diff hunks for
  `toBeDefined`/`toBeTruthy`/`toBeFalsy`/`objectContaining`-as-whole-assertion/bare
  `not.toThrow()`/snapshot-only — zero matches).
- Triangulation: merge-vs-create branch has 2 distinct cases (05.1 create, 05.2 merge);
  idempotency has a dedicated case (05.3, mutation-proven); named-only has a dedicated case
  (05.4). No single-test conditional-logic gaps found in what was written.
- Regression: 0.
- **Concern (not a halt)**: REQ-RXD-06.5's addImport portion — see Finding 1. Under in-loop
  tolerance rules this is "tolerated for now, flagged for final" only if it were a sub-critical
  quality nuance; because it is a named, verbatim, signed-spec scenario with 90% of its cases
  untested, I am elevating it to a CRITICAL finding now rather than deferring to final — deferring
  would let it ride quietly through S-003/S-004/S-005 and only surface at the comprehensive gate.

### In-Loop History

| Iteration | Verdict | Issues |
|---|---|---|
| 1 (S-000) | PASS | — |
| 2 (S-001) | NEEDS_FIX | CRITICAL removeInitializer coverage; WARNING 06.5 e2e asymmetry |
| 3 (S-001 re-verify) | PASS | both resolved, mutation-proven |
| 4 (S-002) | NEEDS_FIX | CRITICAL REQ-RXD-06.5 addImport-portion coverage gap; WARNING unsubstantiated TDD claim in state note |

### Issues Found

**CRITICAL**: Finding 1 — REQ-RXD-06.5 addImport-portion hostile-battery coverage gap (1/10 values tested e2e; signed spec requires all 10 where grammar applies).
**WARNING**: Finding 2 — unsubstantiated TDD self-correction claim in `.sdd/state/react-dialect.json`; no retro-RED evidence found in `apply-progress.md` or its engram twin.
**SUGGESTION**: None. (REQ-RXD-11.5 spec-wording follow-up from S-001 remains open, unrelated to this batch, routing unchanged.)
