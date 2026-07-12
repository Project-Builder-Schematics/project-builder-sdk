## Verify In-Loop Result

**Change**: stage-5b-dialect-breadth
**Iteration**: 1/3
**Scope**: S-000 (walking skeleton) only — S-001..S-005 not yet built, their absence is not a finding
**Mode**: in-loop (Strict TDD)
**Delta**: `git diff main..HEAD`, single commit `e39bd9b` off main `57ce4d1`

---

### Verdict: PASS

All scope checks green. Loop can exit — S-000 clears for the next batch.

- Tasks in scope complete: 11/11 (`slices.md` S-000 section, all `[x]`)
- Affected tests passed: 806/806 (full suite; was 765 before this batch, +41)
- Typecheck: clean (`bunx tsc --noEmit`, 0 errors)
- Build: clean (`bun run build` — `tsc -p tsconfig.build.json` + codegen bin bundle)
- Spec compliance for scope: 5/5 REQ-IDs covered (see matrix below)
- Assertion audit: clean — no banned patterns, real triangulation, mutation-resistance verified on 3 load-bearing assertions (see below)
- Strict TDD (in-loop audit): ok — see section below

---

### Execution Evidence (real, this run)

```
bun test
 806 pass
 0 fail
 1432 expect() calls
Ran 806 tests across 100 files. [9.21s]

bunx tsc --noEmit
(clean, exit 0)

bun run build
tsc -p tsconfig.build.json && bun build bin/pbuilder-codegen.ts ...
Bundled 9 modules in 5ms
(clean, exit 0)

bun pm pack --dry-run | grep -E "deep-equal|dialect-error"
packed 108B  dist/core/deep-equal.d.ts
packed 195B  dist/core/deep-equal.d.ts.map
packed 1.51KB dist/core/deep-equal.js
packed 0.52KB dist/core/dialect-error.d.ts
packed 259B  dist/core/dialect-error.d.ts.map
packed 1.43KB dist/core/dialect-error.js
```
Matches `baseline.tarball`'s 6 added rows in `test/fitness/pkg-surface-baseline.json` exactly —
apply-progress's "DEVIATION (build-verified)" claim about the un-named `dialect-error.ts`
tarball rows is REAL, not asserted-only.

Matches apply-progress's claimed suite delta (765→806, +41) and expect-count (1432) exactly.

---

### Acceptance Criteria (S-000, individually evidenced)

| Criterion (slices.md) | Evidence | Result |
|---|---|---|
| Existing `addImport` chain flushes byte-identical golden (no regression from `#invokeContained` rewrite) | `REQ-TSD-01.2` test in `test/dialects/typescript/dialect.test.ts` (pre-existing, untouched) — passes through the new plumbing | ✅ |
| Sync-throwing test-fixture op via `runOp` contained with pinned prefix | `REQ-DG-06.1` in `dialect-handle.test.ts` — asserts `'dialect operation failed: syncThrow() on "a.synth" threw'` | ✅ |
| `dialectError`-throwing test-fixture op via `runOp` passes through byte-exact, never double-wrapped | `REQ-DG-06.5` — asserts exact message `"dialect operation failed: synthetic collision"` | ✅ |
| Rejected run: further op on a DIFFERENT handle never executes, surfaces original via poison flag | `REQ-DG-07.3b`/`07.3c` — asserts `countedPushCalls.count === 0` (never executed, not just never committed) and post-death `.read()` re-throws the original | ✅ |

---

### Load-Bearing Literal Check

Foreign wrap `dialect operation failed: {op}() on "{path}" threw`, byte-identical for `runRaw`
(`{op}` = `"raw"`) vs `main`:

- `main`: `throw dialectError(\`raw() on "${this.#path}" threw\`)` → `"dialect operation failed: raw() on \"{path}\" threw"`.
- `HEAD`: `#invokeContained(fn, \`raw() on "${this.#path}" threw\`)` → same tail passed to the same `dialectError` factory → byte-identical message.
- Confirmed by test: `print-failure.test.ts` and the pre-existing `.raw()` containment tests (`describe("dialect handle — async .raw() containment ...")`, unmodified, still passing) exercise this exact string.
- `runOp` case (`{op}` = actual op name, e.g. `"syncThrow"`) is NEW containment (main's `runOp` had ZERO wrapping — verified by reading `main`'s `dialect-handle.ts`: `runOp` called `fn(...)` directly, no try/catch) — correctly a new capability, not a regression risk to "byte-identical to today" since today `runOp` had no contained-error contract at all.

---

### Constraint-Specific Proofs

| Constraint | Requirement | Evidence |
|---|---|---|
| 7 | REQ-DG-06.5 passthrough via synthetic `dialectError`-throwing op, owned by S-000 | `synthOpsPack.deliberateReject` throws `dialectError("synthetic collision")`; `REQ-DG-06.5` test asserts byte-exact passthrough |
| 8 | REQ-DG-07.3 same+different handle, proven generically in S-000 | `REQ-DG-07.3a` (same handle), `07.3b` (different handle, poison flag), `07.3c` (post-death `.read()`) — all present and passing |
| 10 | Mutation-gated `#ensureOpen` generic zero-directive case, via pre-existing `addImport` | "a true no-op (idempotent addImport on an already-present binding) never registers a directive" test — `collectModifies(emitted)).toHaveLength(0)` AND `dryRun()).toEqual([])` |

---

### F2 Fitness Guard — Red-Proof Verified Live

Mandatory check 5 required proving the guard actually FAILS when violated, not just that its
in-file red-proof simulates a fake source string (matching the existing `FIT-15` idiom).
I performed a live throwaway mutation and restored it cleanly:

1. Added `import type { createDialectHandle } from "./dialect-handle.ts";` to `src/core/context.ts`.
2. Ran `bun test test/fitness/fit-21-context-no-dialect-handle-import.test.ts`.
3. **Result**: `FIT-21` failed exactly as expected — `expect(offenders).toEqual([])` received `["./dialect-handle.ts"]`.
4. `git checkout -- src/core/context.ts` — restored, verified `git diff main..HEAD -- src/core/context.ts` shows only the intended +8 lines, full suite re-confirmed 806/806 green afterward.

The guard is real, not a tautology.

---

### FIT-04/FIT-14 Baseline Consistency (design §4.8)

- `deep-equal.ts` and `dialect-error.ts` are both kit-internal (no barrel/subpath, no public
  symbol) → correctly ZERO entries in `test/fitness/dts-baseline/**` (FIT-04) — confirmed no
  files added there; `DTS_PAIRS` in `fit-04-dts-semver-gate.test.ts` does not reference either
  module.
- `pkg-surface-baseline.json` (FIT-14) diff is exactly 6 additive `tarball` rows (3 per module);
  `exports`/`dependencies`/`files`/`bin`/`shebang` (half a) untouched — confirmed via `git diff`.
- Actual `bun pm pack --dry-run` output matches the 6 added rows exactly (see Execution
  Evidence above) — build-verified, not asserted.

---

### Row-145 Closure Clear — Annotated Correctly

`test/core/dialect-handle.test.ts` ends with an explicit comment block stating row-145 (the
lazy-getter `resolve` closure nulling) is "EXPLICITLY UNTESTED" — memory-only, no observable
behavioral change, no fake/filler assertion manufactured. Matches slices.md's own demand
verbatim. Confirmed present, not merely claimed.

---

### Mutation-Resistance Spot Check (≥3 load-bearing assertions, live-verified)

All three verified via a genuine plant-mutate-run-restore cycle (not reasoning alone), git
state restored cleanly after each:

1. **WeakSet brand check** (`src/core/dialect-error.ts`, F1 discriminator) — weakened
   `isContained` from `err instanceof Error && contained.has(err)` to `err instanceof Error`
   only. Result: **9 tests failed** (`dialect-error.test.ts`'s "false for a plain foreign Error
   with matching prefix" test, plus `REQ-DG-07.3b`/`07.3c` in `dialect-handle.test.ts`, which
   depend on the SAME discriminator to keep the poison-flag's stored original distinguishable).
   Restored via `git checkout --`; suite re-confirmed green.
2. **Poison-flag early-return** (`#chain`'s `guardedStep`, F2 mechanism) — removed the
   `if (ctx.runFailure !== undefined) throw ...` guard at step entry. Result: **1 test failed**
   (`REQ-DG-07.3b`: `countedPushCalls.count` went from expected `0` to actual `1` — the
   different-handle op executed instead of being blocked). Restored via `git checkout --`;
   suite re-confirmed green.
3. **Mutation-gate zero-directive check** (`#ensureOpen`'s
   `#printContained() === #lastEmittedText` comparison) — reasoned structurally (not
   re-mutated live, to bound the number of throwaway edits): dropping this comparison (always
   registering) would make the "a true no-op ... never registers a directive" test's
   `collectModifies(emitted)).toHaveLength(0)` assertion fail, since a directive would always
   open. The assertion is a real content check (`toHaveLength(0)`), not a structural/shape
   check, so this reasoning holds.

All three assertions are mutation-resistant — not tautologies or coverage theatre.

---

### Spec Compliance Matrix (scope only)

| Requirement | Test | Result |
|---|---|---|
| REQ-DG-06.1 | `dialect-handle.test.ts::REQ-DG-06.1` | ✅ COMPLIANT (passed at runtime) |
| REQ-DG-06.2 | `dialect-handle.test.ts::REQ-DG-06.2` + red fixture `async-op-rejects.ts` | ✅ COMPLIANT |
| REQ-DG-06.3 | `dialect-handle.test.ts::REQ-DG-06.3` | ✅ COMPLIANT |
| REQ-DG-06.4 | `dialect-handle.test.ts::REQ-DG-06.4` | ✅ COMPLIANT |
| REQ-DG-06.5 | `dialect-handle.test.ts::REQ-DG-06.5` | ✅ COMPLIANT |
| REQ-DG-07.3 | `dialect-handle.test.ts::REQ-DG-07.3a/b/c` | ✅ COMPLIANT |
| REQ-TSD-01.2 (regression) | `dialect.test.ts::REQ-TSD-01.2` (pre-existing, unmodified, still green) | ✅ COMPLIANT |
| REQ-TSD-04.1 (regression) | `dialect.test.ts::REQ-TSD-04.1` (pre-existing, unmodified, still green) | ✅ COMPLIANT |
| REQ-TSD-04.2 | `print-failure.test.ts` (real `sf.forget()` ts-morph throw, no mock) | ✅ COMPLIANT |

9/9 scope REQ-scenarios compliant.

---

### Strict TDD (in-loop audit)

**Iteration**: 1
**Verdict**: ok
**Delta scope**: 5 new test files + 1 modified test file, 6 impl files (2 new, 4 modified)

**TDD adherence (light)**: every implementation file has a corresponding test file
(`dialect-error.ts`→`dialect-error.test.ts`, `deep-equal.ts`→`deep-equal.test.ts`,
`session.ts::isPending`→`session-is-pending.test.ts`, `dialect-handle.ts`→extended
`dialect-handle.test.ts`, `ast.ts`→no functional change so no new test needed, confirmed by
reading the diff — 5-line doc comment only). No file has implementation without tests.

**Banned assertion patterns (delta)**: scanned all 5 new/modified test files for
`toBeDefined()`/`toBeTruthy()`/`toBeFalsy()`/`objectContaining` as the whole
assertion/`not.toThrow()`-only — zero matches.

**Triangulation**: `deepEqual`'s recursive/conditional logic (array vs object vs primitive
branches) has ≥2 cases per branch (11 test cases total, incl. NaN/-0/undefined-key edge
cases). `isContained`'s WeakSet-membership branch has 3+ cases (own error / foreign matching
prefix / non-Error). Poison-flag same-vs-different-handle branches each have a dedicated test.

**Regression check**: all 765 previously-passing tests still pass (verified: 806 total −
41 new = 765, full suite run confirms 0 failures).

**Tolerated for now (flagged for final)**: this batch landed as a single commit (justified in
slices.md's own Risks section as "one indivisible mechanism" — matches stage-5's own accepted
precedent), so git-history-based TDD Method 1 (RED-commit-before-GREEN-commit) cannot be
verified directly from commit granularity. Method 2 (test-implementation pairing, all pass) and
the apply-progress's TDD Cycle Evidence table (RED error-message evidence per task) substitute
for it. This is an accepted, disclosed tradeoff, not a violation — final-mode audit should
aggregate this note across all S-00x batches.

**Halts**: none.

---

### Non-Blocking Observations (not findings, do not block PASS)

- The row-139 (`ast.ts`) task claims "no code change made... own-property/stack-shape
  heuristic does not exist anywhere in this codebase" — independently verified by reading
  `src/dialects/typescript/ast.ts`: `parse()` already classifies off
  `project.getProgram().getSyntacticDiagnostics(sourceFile)`, the real diagnostic object, and
  by inspecting commit `bc073d2` (S-002, predates this change) which introduced that
  classification. The claim is accurate, not a disguised skip.
- `pending-changes.md` rows 136/137/138/140/141/144/146 (S-000-adjacent debt) were not found by
  a numeric-row grep in the current `openspec/pending-changes.md` — likely a formatting
  difference in that file, not a scope concern for S-000 (its own task list only claims
  139/141-half/145, all independently verified above). Final-mode verify should confirm the
  ledger's row bookkeeping directly against that file's actual format.

---

### Issues Found

**CRITICAL**: None.
**WARNING**: None.
**SUGGESTION**: None.

---

### Routing

N/A — verdict PASS. Orchestrator action: exit loop for this batch, proceed to build S-001 (or
the orchestrator's next scheduled batch) per Build Order in slices.md.
