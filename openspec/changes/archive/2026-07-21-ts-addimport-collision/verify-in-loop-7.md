## Verify In-Loop Result

**Change**: ts-addimport-collision
**Iteration**: 7/3 (LAST slice batch — S-005, the 6th and final slice; sequential per-slice
iteration numbering continues past 3 by design of this change's own loop history, per the
orchestrator's launch framing)
**Scope**: S-005 (cross-dialect parity guarantee + release documentation)
**Mode**: in-loop (Strict TDD)
**Commit under review**: `d6e68d1` (baseline `90ba4d6`)

---

### Verdict: PASS

All scope checks green. No CRITICAL findings. Two non-blocking WARNINGs (documentation-format
and battery-coverage gaps) are recorded as followups for `sdd-verify --mode=final` / archive.

- Tasks in scope complete: 4/4 (S-005.1–.4, all `[x]` in slices.md)
- Zero production diff confirmed: `git diff 90ba4d6..d6e68d1 -- src/` = empty; no react-dialect
  file touched anywhere in the diff (react stays byte-sealed per ADR-01)
- Affected tests passed: full suite 2134/0 (up from 2102/191 baseline by exactly +32, +1 file),
  targeted `fit-41-addimport-parity.test.ts` 31/0, `dialect-modify.e2e.test.ts` 7/0,
  `installed-consumer.e2e.test.ts` 16/0
- Typecheck: `tsc --noEmit` clean
- Spec compliance for scope: parity fitness + e2e + CHANGELOG all behaviourally verified (see
  below)
- Assertion audit: clean — no banned patterns (`toBeDefined`/`toBeTruthy`/`objectContaining`/
  `not.toThrow()`-only) in either new/modified test file
- Mutant-resistance: EMPIRICALLY CONFIRMED (see Finding evidence below) — FIT-41 is a real drift
  guard, not a tautology

---

### Verification Detail

**1. Zero production diff** — CONFIRMED.
`git diff 90ba4d6..d6e68d1 -- src/` produced zero lines. `git diff --stat` shows only
`CHANGELOG.md` (new), `openspec/changes/ts-addimport-collision/{apply-progress.md,slices.md}`,
`test/e2e/dialect-modify.e2e.test.ts`, `test/fitness/fit-41-addimport-parity.test.ts` — no
`src/dialects/react/**` file appears anywhere in the diff.

**2. Parity battery integrity** — CONFIRMED, with one coverage caveat (Finding 1).
Read `test/fitness/fit-41-addimport-parity.test.ts` in full (360 lines). Both dialects are
exercised through their real public `find()` handles (`ts.find("a.ts")` /
`react.find("a.tsx")`) via `makeSpyClient` + `defineFactory`, not hardcoded expected strings —
verdicts are derived at runtime from `classifyOutcome(threw, modifies, before, from)`, which
inspects actual thrown/emitted output. All five declared buckets (merge, idempotency, create,
type-only-collision, cross-module-collision) are present and asserted non-vacuous by a sanity
test. The self-alias row (`.15`) is asserted POSITIVELY and separately from the generic loop —
`TS no-ops` / `React rejects`, exactly ADR-01 N1's mandate — never excluded or skipped.

**3. Mutant-resistance spot check** — EMPIRICALLY VERIFIED (not just reasoned).
I temporarily weakened `addImport`'s Step 2 claimed-scan in `src/dialects/typescript/ops.ts`
(scoped the file-wide `ast.getImportDeclarations()` scan down to `declarationsForModule`,
simulating a regression on the cross-module/type-only collision predicate), then ran
`bun test test/fitness/fit-41-addimport-parity.test.ts`. Result: **5 of 31 tests failed RED**
(rows `.16`, `.26`, `.27`, and 2 more type-only-collision rows) — TS started reporting `create`
instead of `reject` while React still rejected, exactly the drift FIT-41 exists to catch. Change
was reverted immediately after (`git diff --stat -- src/` confirmed empty afterward). This proves
FIT-41 is a real drift guard, not a battery of hardcoded strings that could silently agree with a
weakened implementation.

**4. Fixture fidelity** — 8 rows spot-checked against spec's Given/When/Then table
(lines 294–358, 396–430 of `specs/typescript-dialect/spec.md`):
- `.5`, `.22`, `.23`, `.10`, `.13`, `.19`, `.7` — byte-for-byte Given-shape match, verdict match.
- `.9` (the corrected fixture) — spec's Given is `import type { X as XT } from m` (DECLARATION-
  level type-only, ALIASED local name XT ≠ export X); the committed row seeds exactly
  `'import type { X as XT } from "m";\n'` and calls `addImport("X", "m")`, matching the spec
  precisely. Confirms apply-progress's self-corrected-authoring-deviation claim: the row now
  distinguishes declaration-level type-only (claims nothing but XT) from specifier-level
  type-only, correctly.
- `.28` — spec's Given/When is specifically about calling `addImport` with the ALIASED
  specifier's UNDERLYING EXPORT NAME (`Foo`, not local alias `x`) to prove the claimed-scan keys
  on local name only. The committed row instead seeds `import { a as b } from "m";` and calls
  `addImport("c", "m")` — an unrelated name, not the underlying export `a`. The row's own
  description candidly says "unrelated to the alias's exported name," i.e. it does not reproduce
  `.28`'s specific claim. See Finding 1.

**5. E2E case** — CONFIRMED. `test/e2e/dialect-modify.e2e.test.ts:42-62` drives
`ts.find("a.ts").addImport(...)` through the real `ContractFake` + public handle (not `ops.ts`
directly), asserts the dual observable per house convention: synchronous throw,
`"already exists"` substring, `.cause` undefined, `committedTree()` empty, and `fake.read("a.ts")`
byte-identical to the seed after the catch. Ran standalone: 7/0, up from 6 pre-slice.

**6. CHANGELOG accuracy** — CONFIRMED against spec V3.2's behaviour-change note (lines 165–229):
Class A's five members present verbatim in substance (type-only merge; cross-module +
value-namespace collisions; aliased-to-different-name collisions; same-local-name idempotency vs
default/namespace/mixed; directive-prologue placement). Class B's one member (`.20`, side-effect
import) present with the `.modify()` escape note. Shebang entry correctly reflects the FALLBACK
arm that shipped (fail-closed pinned, insertion deferred) and points at the pending-changes
followup row — confirmed present and correctly worded at
`openspec/pending-changes.md:515-524` ("From `ts-addimport-collision` (2026-07-21) — ADR-03
shebang-aware insertion, registered at S-004"). `git log --diff-filter=A --oneline -- CHANGELOG.md`
returns only `d6e68d1` — no pre-existing file was overwritten.

**7. Full suite + typecheck** — CONFIRMED, self-executed (not trusted from apply-progress):
- `bun test --timeout=30000`: **2134 pass, 0 fail, 4725 expect() calls, 192 files** (exact match
  to apply-progress's claim)
- `bun run typecheck` (`tsc --noEmit`): clean, zero errors
- `bun test test/e2e/installed-consumer.e2e.test.ts --timeout=30000`: **16 pass, 0 fail,
  66 expect() calls** (exact match)

**8. Slice-coverage closure** — CONFIRMED at the checkbox level: all 6 slices (S-000–S-005), all
tasks `[x]` in `slices.md`. Full exhaustive Covers-line-to-test mapping is deferred to
`sdd-verify --mode=final` per this mode's scope (in-loop only spot-checks).

---

### Findings

| # | Severity | Area | Evidence | Detail |
|---|---|---|---|---|
| 1 | WARNING | `test/fitness/fit-41-addimport-parity.test.ts` (cross-module-collision bucket, lines 254-286) + `apply-progress.md` S-005 "Deviations from Design" (line 833) | design.md §4.7 line 137 explicitly cross-references the "cross-module + value-namespace collision" bucket as `(.14/.16/.17)`; the implementation's own inline comment (fit-41 line 254) and its `PARITY_ROWS` array only cover `.16` and `.17` (×3) — `.14` (aliased-to-a-different-name collision reject) has zero row in FIT-41. The `.28` row, which cites `.14` in a comment as its "GREEN pair," seeds an aliased clause but calls `addImport` with an unrelated name, explicitly noting it does NOT test the alias's underlying export name — so `.14`'s specific reject semantic gets no cross-dialect parity coverage at all. `apply-progress.md`'s "Deviations from Design" section states "No other deviations — FIT-41 matches design §4.7's bucket cross-reference" — this is factually inaccurate against design's own citation. | `.14` IS covered elsewhere in the change (S-001.3, `ops-addImport.test.ts`, the `.14`/`.28` GREEN/RED pair) so there is no REQ-coverage gap for the change overall — but ADR-01's specific mandate (a cross-dialect PARITY guard against drift on this exact predicate family) has a blind spot on this one collision axis, and the "no deviations" claim should be corrected to either add the `.14` row or honestly note the renumbering. Non-blocking: narrow scope, largely redundant with `.16`'s coverage of the same file-wide claimed-scan code path. |
| 2 | WARNING | `apply-progress.md` S-005 section (lines 734-886) | Every prior slice (S-000 at line 15/28, S-001 at 140/161, S-003 at 250/265, S-002 at 365/384, S-004 at 619/644) includes a `### TDD Cycle Evidence — S-XXX` table and a `### Files Changed` table. S-005's section has neither — the equivalent content is present only as prose (the "Pre-write probe" narrative for TDD evidence; the Status-header sentence + inline task descriptions for files changed). | Content-equivalent and independently verified accurate (I re-ran `git diff --stat` and it matches the prose claim exactly), so this is not a correctness issue — but it breaks the change's own established per-slice documentation structure in its LAST slice, which `sdd-verify --mode=final`'s aggregate TDD audit (per `strict-tdd-verify.md`, which expects to "Read latest apply-progress's TDD Cycle Evidence table") will need to compensate for by reading prose instead of a table. Non-blocking; recommend regularizing before archive if convenient, not worth a loop iteration on its own. |

**CRITICAL**: None.

---

### Strict TDD (in-loop audit)

**Iteration**: 7
**Verdict**: concerns
**Delta scope**: 2 test files (`fit-41-addimport-parity.test.ts` new, `dialect-modify.e2e.test.ts`
modified), 0 impl files (S-005 is test/docs-only by design)

**Findings**:
- No banned assertion patterns in either delta test file.
- Triangulation: `classifyOutcome` (conditional dispatch, 4 branches) has its own dedicated
  5-case red-proof group exercising every branch directly, independent of the 24 indirect battery
  invocations — triangulation is satisfied, not a single-test gap.
- New file (`fit-41-addimport-parity.test.ts`) has no corresponding "implementation" file since
  this slice ships zero production code by design (architectural fitness function) — the
  TDD-adherence check that would normally require a paired impl file does not apply here; the
  "implementation" being tested is the ALREADY-SHIPPED S-000–S-004 code, and this is explicitly a
  pin/drift-guard, not new-code-driving-tests, per the launch prompt's own framing (echoed
  correctly in apply-progress's "pin, not defect-discovery" heading).
- Regression check: all 2102 previously-passing tests still pass (full suite 2134/0, exactly
  +32 new, 0 regressions).
- Concern (not halt): the missing `### TDD Cycle Evidence — S-005` table (Finding 2) means this
  audit relied on prose narrative rather than the established structured table — tolerated for
  in-loop per the module's own rules (sub-critical, flagged for final), not upgraded to halt.

**Tolerated for now (flagged for final)**:
- Finding 1 (FIT-41's `.14` bucket-citation gap) — sub-critical, does not block; final mode's
  REQ-ID coverage audit should confirm `.14` is genuinely covered elsewhere (it is, via
  `ops-addImport.test.ts`) and decide whether FIT-41 itself needs the row added.
- Finding 2 (missing TDD Cycle Evidence / Files Changed tables) — sub-critical, content
  equivalent verified present and accurate in prose.

---

Orchestrator action: exit loop — S-005 is the last slice and this change's in-loop verification
is complete (6/6 slices now built and verified across iterations 1-7). Proceed to `/evaluate`
(simplify gate, then `sdd-verify --mode=final`) before archive. Both WARNING findings above should
be carried into final mode's compliance/TDD audits rather than looped back to Executor — neither
is a CRITICAL local-fix item, and re-invoking `/build` for either would spend an iteration on a
non-blocking documentation/coverage nit on the change's last slice.
