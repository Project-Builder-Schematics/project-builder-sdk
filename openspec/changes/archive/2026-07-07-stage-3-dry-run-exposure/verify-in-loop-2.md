## Verify In-Loop Result

**Change**: stage-3-dry-run-exposure
**Iteration**: 2/3
**Scope**: S-001, S-002 (batched — both extend `test/skeleton/dry-run-accessor.test.ts`; S-000 out of scope, already PASS at verify-in-loop-1)
**Mode**: in-loop (Strict TDD)

---

### Verdict: PASS

All scope checks green. Loop can exit.

- Tasks in scope complete: 2/2 (S-001 1/1, S-002 1/1 — `slices.md` both `[x]`)
- Affected tests passed: 3/3 in `dry-run-accessor.test.ts`; full suite 261/261
- Spec compliance for scope (REQ-DRE-01.2, 01.3, 01.4): 3/3
- Assertion audit: clean — exact `toEqual`/`toThrow(substring)` assertions throughout, no banned patterns
- TDD taxonomy deviation ([must-fail-first] → honest [characterization] via teeth evidence): legitimate, verified below

Orchestrator action: exit loop, proceed to `/evaluate` (mode=final) — all 3 slices of the change (S-000, S-001, S-002) are now complete.

---

### Completeness

| Metric | Value |
|---|---|
| Slices in scope | S-001, S-002 |
| Slices complete | 2/2 |
| Tasks total (scope) | 2 |
| Tasks complete | 2 |

`git diff 36d3a65..1ecf645 -- openspec/changes/stage-3-dry-run-exposure/slices.md` confirms both S-001 and S-002 task rows flip `[ ]`→`[x]`; S-000 untouched (correctly already complete).

### Correctness Check (Static Spec Match)

- **REQ-DRE-01.4** (S-001): `src/commons/index.ts:244-245` — `export function dryRun(): DryRunEntry[] { return dryRunPlan(currentContext().session.pendingSnapshot()); }`. No try/catch, no accessor-specific branch anywhere in the file (`rg -n "dryRun" src/commons/index.ts` shows one import + one JSDoc mention + the two-line function — nothing else). `currentContext()` (`src/core/context.ts:16-25`) throws `Error("... can only be used while a schematic is running ...")` when `als.getStore()` is `undefined`. Matches spec's "no accessor-specific fallback" requirement exactly.
- **REQ-DRE-01.2** (S-002): `Session.flush()` (`src/core/session.ts:52-53`) — `if (this.#pending.length === 0) return;` — confirmed early-return path, no seed needed since no `client.emit` call happens at run end.
- **REQ-DRE-01.3** (S-002): `Session.buffer()` pushes to `#pending`; `flush()` (`session.ts:57`) does `this.#pending.splice(0)` — mutates in place, empties the buffer, and returns the removed elements as the batch. `pendingSnapshot()` (`session.ts:29-31`) returns `this.#pending.slice()` — a fresh copy taken AFTER whatever flush has already spliced out. The pinned in-fn sequence (`create(a)` → `await find(a).read()` [triggers flush, splices `create(a)` out] → `modify(b)` → `dryRun()`) is structurally guaranteed to produce `[{verb:"modify",path:"src/b.ts"}]` only if splice-then-fresh-buffer semantics hold — which they do.

### Cross-Change / Scope Guard

- `git diff --stat 36d3a65..1ecf645` (S-000 end → S-002 end): only `.sdd/state/*.json`, `apply-progress.md`, `slices.md`, and `test/skeleton/dry-run-accessor.test.ts` changed. Zero production code touched by S-001/S-002.
- `git diff 36d3a65..1ecf645 -- src/core/` — empty. `src/core/context.ts` and `src/core/session.ts` confirmed untouched (cross-change guard vs. stage-2's `AuthoringError`/flush lane, ADR-0026, intact).

### Build & Tests Execution

**Typecheck**: `bun run typecheck` (`tsc --noEmit`) — clean, no errors.
**Tests (full suite, run independently)**: `bun test` — 261 pass / 0 fail / 413 expect() calls across 47 files. Matches apply-progress claim exactly (259 after S-001, 261 after S-002, +2).
**Scope file alone**: `bun test test/skeleton/dry-run-accessor.test.ts` — 3 pass / 0 fail (1 from S-001 + 2 from S-002).

### Harness Idiom Conformance (design §4.6b, pinned)

| Idiom | Pinned form | Actual test | Match |
|---|---|---|---|
| Outside-run (01.4) | `expect(() => dryRun()).toThrow(…substring…)`, no run, no harness | Exact | ✅ |
| Empty buffer (01.2) | `makeSpyClient()` no seed; in-fn `expect(dryRun()).toEqual([])` | Exact | ✅ |
| Post-flush (01.3) | `makeSpyClient({ "src/b.ts": "old" })`; in-fn `create(a)` → `await find(a).read()` → `modify(b)` → `expect(dryRun()).toEqual([{verb:"modify",path:"src/b.ts"}])` | Exact | ✅ |
| Flush-safety seed rule | never seed create targets; seed modify targets not created in-run | `src/a.ts` (create target) unseeded; `src/b.ts` (modify target) seeded | ✅ |
| Import surface | `dryRun`/`create`/`find`/`modify` from `../../src/commons/index.ts`; `defineFactory` from `../../src/core/context.ts`; `makeSpyClient` from `../support/spy-client.ts` | Exact | ✅ |

### Spec Compliance Matrix (scope — 3 rows)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-DRE-01.2 | Empty buffer → `[]` | `dry-run-accessor.test.ts::returns an empty array when the run has buffered no directive (REQ-DRE-01.2)` | ✅ COMPLIANT |
| REQ-DRE-01.3 | Post-flush temporal snapshot | `dry-run-accessor.test.ts::reflects only directives buffered since the last flush (REQ-DRE-01.3)` | ✅ COMPLIANT |
| REQ-DRE-01.4 | Outside-run propagation, no fallback | `dry-run-accessor.test.ts::throws the standard outside-run error when called with no active run` | ✅ COMPLIANT |

### Strict TDD (in-loop audit)

**Iteration**: 2
**Verdict**: ok
**Delta scope**: 1 test file (`dry-run-accessor.test.ts`, created in S-001, extended in S-002), 0 impl files

#### TDD taxonomy deviation legitimacy assessment

Both slices carry `[must-fail-first]` tags in `slices.md` but the executors recorded — up front, not defensively — a reclassification to `[characterization]` (`TEETH-DEVIATION` tag) with the honest reason: the behaviour under test (`dryRun()`'s pass-through of `currentContext()`'s throw; `Session.flush()`'s splice-to-empty semantics; `pendingSnapshot()`'s post-flush read) shipped complete in S-000. There is no production code left to write for either task — this is independently verifiable: `git diff --stat 36d3a65..1ecf645` shows zero `src/` changes across both commits.

This is the correct call, not a taxonomy dodge:
- The taxonomy's own definition of `[characterization]` is "pins a contract not yet observable any other way" — before S-001/S-002 existed, REQ-DRE-01.2/.3/.4 were unobserved (no test exercised them), even though the underlying code paths were already exercised indirectly by S-000's other tests (e.g., `Session.flush()`'s splice is exercised by every e2e test that calls `read()`). So "already shipped" is accurate to the *implementation*, and "not yet observable" is accurate to the *spec-level contract* — both halves of the deviation claim hold.
- Reclassifying to `[must-fail-first]`-in-spirit via manufactured teeth (a deliberately-wrong assertion, run, observed to fail for the right reason, then corrected) is the harness's own prescribed alternative for exactly this situation, and it was followed to the letter rather than silently relabeled or skipped.

#### Teeth evidence verification (independently re-derived, not taken on faith)

- **S-001 (01.4)**: claimed RED — wrong substring `"this substring does not appear in the real error"` against the real thrown message. Re-derivation: `currentContext()`'s actual thrown string (`src/core/context.ts:19-23`) is `"@pbuilder/sdk: file verbs (create, find, modify, remove, rename, move, copy) can only be used while a schematic is running — call them inside your factory function, not at module load time."` — the claimed wrong substring is indeed absent from it, so the described failure is real and would have occurred exactly as claimed. This also doubles as the mutation check: a swallowed or generic outside-run error would fail `.toThrow("can only be used while a schematic is running")` for the same reason.
- **S-002 (01.2)**: claimed RED — `[{verb:"create",path:"src/deliberately-wrong.ts"}]` vs real `[]`. Trivially correct: any non-empty expected array fails `toEqual([])`.
- **S-002 (01.3)**: claimed RED — the "naive both-entries" expectation `[{verb:"create",path:"src/a.ts"},{verb:"modify",path:"src/b.ts"}]`, said to fail because `create` is absent from the real (already-flushed) result. This is exactly the mutation this reviewer independently constructed to spot-check flush correctness (see below) — the executors' teeth evidence and the reviewer's adversarial mutation are the same scenario, which is a strong signal the teeth evidence is genuine rather than post-hoc narrative.

#### Mutation-resistance spot check (reviewer-derived, not from apply-progress)

- **Broken flush-splice (both entries returned)**: if `flush()` used a non-destructive read of `#pending` instead of `splice(0)` (leaving `create(a)` in the buffer), the post-flush `modify(b)` push would make `pendingSnapshot()` return `[create(a), modify(b)]` — 2 elements vs. the asserted 1-element array. `toEqual` fails on length alone. **Caught.**
- **Wrong-path entry**: `toEqual({verb:"modify",path:"src/b.ts"})` is an exact-value match; any path substitution (e.g. a stale `path` closure bug) fails the comparison. **Caught.**
- **Swallowed outside-run error**: an accessor-specific `try { ... } catch { return [] }` around `currentContext()` would make `dryRun()` outside a run return `[]` instead of throwing — `expect(() => dryRun()).toThrow(...)` fails because no throw occurs at all. A fallback that throws a *different* generic message also fails the substring match. **Caught.**

No tolerated/sub-critical findings to flag for final.

### Risks

None identified for this scope. Residual project-level risk (unchanged from verify-in-loop-1, not blocking): `ADR-0026` defers the outside-run error message's verb enumeration ("create, find, modify, remove, rename, move, copy") as a standalone post-merge followup — `dryRun()` is not enumerated in that string even though it can now trigger it; this is a pre-existing, explicitly-deferred gap, not something introduced by S-001/S-002.
