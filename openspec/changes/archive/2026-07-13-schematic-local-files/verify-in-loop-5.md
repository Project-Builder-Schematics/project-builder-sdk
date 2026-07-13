# S-002+S-004 batch, iteration 2

## Verify In-Loop Result

**Change**: schematic-local-files
**Iteration**: 2/3
**Scope**: S-002 (package-root containment, hardened), S-004 (batch-cap chunked flush)
**Delta since iteration 1**: `99b1c48` (fix: broken-symlink real-space normalization), `a1db745` (chore: TDD evidence tables + findings addressed)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All three iteration-1 findings are resolved and independently re-verified; no regressions. The fix held its routing scope exactly (containment only; the ADVISORY `readTemplateFile` gap was left for S-005 per orchestrator decision — confirmed `src/scaffold/index.ts` unchanged). Loop can exit.

Real execution evidence (all run by the verifier):

- `bun test`: **966 pass / 0 fail**, 117 files (up from 963 — exactly the 3 new tests: 2 broken-symlink positive controls + 1 case-fold arm).
- `tsc --noEmit`: **clean**.
- Fix commit touched only `src/scaffold/containment.ts` + `test/scaffold/containment.test.ts`; fitness baselines (`.d.ts`, `pkg-surface`) unchanged — no API surface drift, consistent with a pure logic fix.

---

## Finding-by-finding verification

### 1. CRITICAL (containment space-mixing) — RESOLVED ✅

The fix replaces `resolveBrokenSymlinkTargetLexically` with `resolveBrokenSymlinkTargetRealAncestor` (`src/scaffold/containment.ts:104-110`), which normalizes **both** absolute and relative broken-symlink targets to a lexical absolute form and then routes through `nearestExistingAncestorRealpath`, so the value compared against `realCeiling` (line 177) is always in real space.

**Verified with my own iteration-1 fixture** (in-ceiling broken symlink, absolute target): now correctly classifies `source-not-found` (was `source-outside-package` at iteration 1). **No regression**: an absolute-target broken symlink pointing outside the ceiling still rejects `source-outside-package`.

**Executor's additional claimed defect (relative-target branch) — independently verified with skepticism on BOTH the defect and the fix:**

I constructed the oracle-shape fixture the executor described (a broken symlink whose *relative* target traverses an EXISTING intermediate directory that is itself a symlink resolving out-of-ceiling: `pkg/escape → external-real/`, `pkg/broken-rel.txt → escape/never-created.txt`) and:

- **Reconstructed the OLD (pre-fix) resolver inline** and ran it against the fixture. The old `resolve(join(realpathSync(parent), target))` produced `/private/var/.../pkg/escape/never-created.txt` — which *lexically* appears in-ceiling, so the old `isWithinCeiling(..., realCeiling)` returned **true**, meaning the old code would have concluded `source-not-found` for a location whose real resolution (`escape` → `external-real`) is **outside** the ceiling. This is a genuine PRC-07 existence-oracle leak. **The executor's reported defect was real, not invented** — it simply wasn't reachable by my iteration-1 fixtures (which used non-symlinked intermediates).
- **Ran the current (fixed) code** against the same fixture: correctly rejects `source-outside-package`. The shared `nearestExistingAncestorRealpath` step realpaths the existing `escape` symlink to its external target before the ceiling check.
- **Positive control**: a relative-target broken symlink genuinely in-ceiling (real, non-symlinked intermediate) correctly classifies `source-not-found` — the fix did not over-correct into rejecting legitimate in-ceiling misses.

The executor's own two added regression tests (`containment.test.ts`, REQ-PRC-07.2 positive controls for absolute + relative in-ceiling targets) cover the same ground and pass.

### 2. WARNING W2 (case-fold coverage) — RESOLVED ✅

New test `containment.test.ts` "Q24 case-folding" asserts the fold arm **both directions per the current platform** (`isWithinCeiling("/PKG/x", "/pkg")` === `foldsHere`, where `foldsHere` = darwin/win32) plus a case-identical control. This genuinely exercises the `toLowerCase()` fold arm (`containment.ts:46-48`) — on darwin it kills a fold-removal mutant, on linux it kills an unconditional-fold mutant. Corroborated by my own independent case-fold test, which additionally confirmed sibling-prefix rejection survives folding (`/PKG-EVIL/x` still out).

### 3. WARNING W1 (TDD evidence tables) — RESOLVED ✅

`apply-progress.md` now has "TDD Cycle Evidence — S-002" and "TDD Cycle Evidence — S-004" tables. Checked against `git log` for contradictions:

- Both tables **honestly disclose** that the S-002/S-004 feature commits (`6fa8c5f`/`e388c71`) land test+prod files together, so `git log` cannot establish RED-first ordering — the same caveat S-000/S-001 already carried. No claim asserts a commit-order RED-first that the log would refute.
- The S-004 table explicitly states it was **not** literal test-first and grounds its RED validity in the tests' self-checking structure (`result.emitted.length > 1` is structurally impossible against the pre-S-004 single-batch expander; boundary fixtures self-assert their exact byte size). This is a legitimate RED-substitute for a well-specified integration change and is stated without overclaiming.
- The fix-iteration section claims true test-first for the CRITICAL fix (evaluator's fixture written and observed RED before the production edit). Fix commit `99b1c48` carries test + prod together, so the log neither confirms nor contradicts this; the claim is plausible, consistently caveated with the working-tree-order note, and not disprovable. Acceptable for in-loop under Strict TDD (method-statement RED evidence is permitted when commits are fix-grained).

No contradiction between any evidence claim and `git log`.

---

## Independent adversarial verification performed (all fixtures constructed fresh)

| Scenario | Result |
|---|---|
| Iteration-1 CRITICAL repro: in-ceiling broken symlink, ABSOLUTE target | ✅ now `source-not-found` (fixed) |
| No regression: out-of-ceiling absolute-target broken symlink | ✅ `source-outside-package` |
| Executor's claimed relative-target defect — OLD resolver reconstructed inline | ✅ confirmed the OLD code WOULD have leaked (`in-ceiling? true` for an out-of-ceiling real location) |
| Same fixture against current code | ✅ correctly `source-outside-package` |
| Relative-target broken symlink genuinely in-ceiling (positive control) | ✅ `source-not-found` (no over-correction) |
| Case-fold arm both directions + sibling-prefix survives fold | ✅ correct on darwin |
| Full regression sweep (`bun test`) | ✅ 966/0 |
| Typecheck | ✅ clean |
| Fix scope containment (readTemplateFile untouched, fitness baselines untouched) | ✅ confirmed |

---

### Orchestrator action

Exit the Executor↔Evaluator loop for the S-002+S-004 batch — verdict PASS at iteration 2/3. Proceed to `/build --scope=slice:S-003` (Build Order step 4). Carry forward the one persisted open item: the `readTemplateFile` / `create({templateFile})` containment gap remains routed to S-005 (ADVISORY, includes the `.d.ts` JSDoc doc-drift note from verify-in-loop-4) — the pre-archive steward reckoning + final verify must confirm it is actually closed there.
