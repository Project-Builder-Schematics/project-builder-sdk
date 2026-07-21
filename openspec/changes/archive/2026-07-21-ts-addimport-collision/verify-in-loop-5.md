## Verify In-Loop Result

**Change**: ts-addimport-collision
**Iteration**: 5/3-per-batch (this is the first in-loop pass on the S-002 batch)
**Scope**: S-002 (injection-safety validation gate, REQ-TSD-13)
**Mode**: in-loop (Strict TDD)
**Commit under review**: `b37ec48` ("feat(typescript-dialect): add injection-safety validation gate to addImport (S-002)")
**Pre-slice baseline**: `075ec5d`

---

### Verdict: PASS

All scope checks green. Loop can exit for this batch.

- Tasks in scope complete: 5/5 (S-002.1–.5, all `[x]` in `slices.md`)
- Affected tests: `bun test test/dialects/typescript/ops-addImport.test.ts` → 39 pass, 0 fail, 254 expect() calls
- Full suite (also run, see below): 2098 pass, 0 fail
- Typecheck: clean (`tsc --noEmit`, no output)
- Spec compliance for scope: 7/7 clauses (13.1–13.6 + 13.x-neg)
- Assertion audit (delta): clean — no banned patterns in the new tests
- Validator untouched: `git diff 075ec5d..b37ec48 -- src/core/jsx-name-validator.ts` → empty

---

### Step 1 — Completeness

All 5 S-002 tasks marked `[x]` in `slices.md`. `apply-progress.md` reports S-002 status "complete (5/5 tasks)".

### Step 2 — Independent RED re-proof (empirical, not trusted from apply-progress)

Restored `src/dialects/typescript/ops.ts` to `075ec5d` (pre-slice) via `git show 075ec5d:... > ops.ts`, ran `bun test test/dialects/typescript/ops-addImport.test.ts` against it, then restored via `git checkout b37ec48 -- src/dialects/typescript/ops.ts` and confirmed clean `git status` on both touched files afterward.

Result: **30 pass, 9 fail** (142 expect() calls). The 9 failures are exactly the 9 `it()` blocks the executor claimed as RED-first:

1. `REQ-TSD-13.1` (confirmed injection breakout)
2. `REQ-TSD-13.2` (11-word reserved-word battery)
3. `REQ-TSD-13.2` (3-entry denylist battery)
4. `REQ-TSD-13.3` (5-case grammar battery)
5. `REQ-TSD-13.6` (precedence)
6. `REQ-TSD-13.x-neg` grammar
7. `REQ-TSD-13.x-neg` reserved-word
8. `REQ-TSD-13.x-neg` denylist
9. JSDoc trust-boundary guard

The 2 tests NOT in the failure list are exactly the 2 claimed green-on-arrival cases: `REQ-TSD-13.2` lookalike-substrings and `REQ-TSD-13.4` (`from`-escaping). Failure messages independently observed match the executor's quoted evidence (e.g. `Received value: undefined` for `caught`; the 13.6 case genuinely returned the COLLISION message — `"...already exists..."` — pre-gate, proving the ordering assertion is real, not vacuous). **The RED-evidence table in `apply-progress.md` is accurate, not fabricated.**

### Step 3 — Precedence (13.6)

Read the production code directly (`ops.ts:196-201`): `assertValidImportBinding(name);` is the literal first statement of `addImport`, executed before `declarationsForModule` is even computed (Step 1/idempotency) and long before the Step-2 claimed-scan. This is a structural guarantee, not merely test-observed — a `name` that is both invalid and claimed cannot reach Step 2 at all. Confirmed against the design's algorithm order (§4.3/JSDoc "0. Validation... runs FIRST").

### Step 4 — Dual observable

`expectCollisionReject` (shared helper, reused from S-001) asserts: `caught instanceof Error`, `err.cause === undefined`, and `client.read()` byte-identical to seed. `ContractFake.read()` consults `#tree` (staging), which is mutated on `emit()`, not gated behind `commit()` — so a byte-unchanged read-back is a strong proxy for zero directives ever having been emitted (this is the same pattern S-001's tests already used and iteration 3 already accepted; not a new deviation in S-002). Combined with Step 3's structural guarantee (validation runs before any `ast` mutation call), the "zero directives" dimension is soundly covered even though these particular tests don't call `collectModifies(emitted)` directly.

### Step 5 — Shape separation (validation vs collision)

- Validation rejects (13.1–13.3, 13.6, 13.x-neg): sourced from `assertValidImportBinding` → `jsx-name-validator.ts`'s `dialectError(nameRuleTail(...))` / `assertNotReservedWord` / `assertNotDenylisted` — none of these take or reference `ast`/path; confirmed no `on "..."` substring possible.
- Collision rejects (S-001, still green): built inline in `ops.ts` with `on "${handlePathFor(ast)}"` — unchanged by this diff.
- 13.x-neg tests assert `.not.toContain('on "a.ts"')` for grammar/reserved-word/denylist rejects — ran independently, all pass against the current code.
- The mutant this pin claims to kill ("unify the two shapes" by adding a path param to `assertValidImportBinding`) would require changing that function's exported signature — a cross-dialect, shared-with-React change design explicitly frames as out of scope (ADR-02, ratified). No such change exists in this diff. Pin is genuine, not decorative.

### Step 6 — Guard test (S-002.5) genuineness

`ops.ts`'s only `/**...Trust boundary...*/` span is the single large `addImport` JSDoc block (lines 148–195); the regex `/\/\*\*[\s\S]*?Trust boundary[\s\S]*?\*\//` captures it whole. The guard doesn't just check presence of a comment — it separately asserts `.toContain("addFunction")`, `.toContain("addVariable")`, `.toContain("addClass")`, `.toContain("RAW-SPLICED")`, and `.not.toContain("not covered here")`. A weakening edit (e.g. rewording to a passive "not covered here" disclaimer, or dropping the sibling-op names) would fail at least one of these five assertions — confirmed by code inspection, consistent with the independently-reproduced RED run in Step 2 (this exact test failed `toBeDefined()` against the pre-slice file, which had no such block at all).

### Step 7 — Validator untouched

`git diff 075ec5d..b37ec48 -- src/core/jsx-name-validator.ts` → empty (confirmed empty diff, exit 0). `assertValidImportBinding` is consumed verbatim, matching ADR-02's explicit "no TS-specific narrowing, widening, or reimplementation" decision.

### Step 8 — Full suite + typecheck (independently run)

- `bun test` (full suite): **2098 pass, 0 fail, 4673 expect() calls, 191 files** — matches `apply-progress.md`'s claim exactly.
- `bun run typecheck`: clean, no output/errors.

### Step 9 — Spec fidelity (scope: REQ-TSD-13.1–.6, 13.x-neg)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-TSD-13.1 | Confirmed injection breakout, zero echo | `ops-addImport.test.ts::REQ-TSD-13.1` — asserts absence of `evil`, `x }`, `import { y` specifically (not just generically) | ✅ COMPLIANT |
| REQ-TSD-13.2 | Reserved-word/strict-mode battery (11 sampled) | `ops-addImport.test.ts::REQ-TSD-13.2` (reserved-word) | ✅ COMPLIANT |
| REQ-TSD-13.2 | Denylist battery (3, separate check) | `ops-addImport.test.ts::REQ-TSD-13.2` (denylist) | ✅ COMPLIANT |
| REQ-TSD-13.2 | Substring lookalikes accepted | `ops-addImport.test.ts::REQ-TSD-13.2` (lookalikes, green-on-arrival) | ✅ COMPLIANT |
| REQ-TSD-13.3 | Grammar battery (5 cases), zero echo | `ops-addImport.test.ts::REQ-TSD-13.3` | ✅ COMPLIANT |
| REQ-TSD-13.4 | `from`-escaping regression pin | `ops-addImport.test.ts::REQ-TSD-13.4` (green-on-arrival, legitimate per spec's own "pinned... never assumed silently" framing) | ✅ COMPLIANT |
| REQ-TSD-13.5 | Trust-boundary JSDoc, affirmative | `ops-addImport.test.ts::JSDoc trust-boundary guard` | ✅ COMPLIANT |
| REQ-TSD-13.6 | Precedence — validation before collision | `ops-addImport.test.ts::REQ-TSD-13.6` | ✅ COMPLIANT |
| 13.x-neg | Validation reject never carries path clause | `ops-addImport.test.ts::REQ-TSD-13.x-neg` (3 cases) | ✅ COMPLIANT |

All 9 rows (7 spec clauses, counting 13.2's 3 sub-batteries as one clause) map to a test asserting the exact normative behaviour, not incidental coverage.

### Strict TDD (in-loop audit)

**Delta scope**: 1 test file (`ops-addImport.test.ts`, 116 new lines), 1 impl file (`ops.ts`, 30 new lines).

**Findings**: none blocking.
- Banned assertion patterns: none in the delta (`rg` scan for `.toBeDefined()`/`.toBeTruthy()`/`.toBeFalsy()`/`objectContaining`/`.not.toThrow()` in the new S-002 describe blocks found only one `.toBeDefined()`, immediately followed by 5 real content assertions — not a smoke-only pattern).
- Triangulation: batteries of 11/3/5/5 forcing cases per rule family — well triangulated.
- Regression: all previously-passing tests (28 pre-S-002 in this file, 2087 project-wide) still pass.

**Tolerated for now** (flagged for final, not halting):
- The self-flagged process deviation (production code briefly drafted before RED, then fully reverted and redone) — see below.

### Process-integrity note (self-flagged deviation, judged)

`apply-progress.md` discloses that the executor drafted the import/JSDoc/call-site edits before writing RED tests, caught the violation before running any test against the draft, fully reverted to a byte-identical S-003 baseline (confirmed via its own `git diff --stat` showing 0 lines), then redid the correct RED→GREEN cycle. Judgment: **no integrity problem in the final state**. The disclosure is transparent (not hidden), the correction happened before any test evidence was generated against the tainted draft (so no fabricated-RED risk), and this verify pass independently reproduced the same 9-fail/2-pass RED split the executor reported — which would not be possible if stale, premature code had leaked into the committed diff. This is honest self-correction, not a violation to route as a finding.

---

**Findings**: none (blocker/warning/suggestion) — clean pass.

**Orchestrator action**: exit loop for S-002, proceed per Build Order (S-004, then S-005 once S-004 lands) toward `/evaluate` (mode=final) before archive.
