## Verify In-Loop Result

**Change**: stage-1-ir-bedrock
**Iteration**: 1/3
**Scope**: S-1.3
**Mode**: in-loop (Strict TDD)

---

### Verdict: NEEDS_FIX

Local checks are almost entirely green — full suite passes, typecheck clean, targeted
S-1.3 tests pass, spec compliance for the batch's REQ-IDs is structurally and behaviourally
sound, scope discipline holds. One Strict TDD triangulation gap on REQ-KIT-03.3 blocks a
clean PASS.

- Tasks in scope complete: 5/5 (all S-1.3 checkboxes `[x]`)
- Affected tests passed: 201/201 (full suite) — 40/40 in the 5 targeted files
- Spec compliance for scope: 10/10 REQ-IDs (REQ-KIT-03.1–.3, REQ-FAKE-04.m1–.m4,
  REQ-FAKE-07.1–.3) — 9 COMPLIANT, 1 PARTIAL (REQ-KIT-03.3, see finding below)
- Assertion audit: clean except the finding below

---

### Execution Evidence

| Command | Result |
|---|---|
| `bunx tsc --noEmit` | exit 0, no errors |
| `bun test` (full suite) | 201 pass / 0 fail / 302 expect() calls, 33 files, 1083ms |
| `bun test test/fake/move-fail-closed.test.ts test/fake/modify-existence.test.ts test/skeleton/directive-factory.test.ts test/skeleton/handle-chaining.test.ts test/fitness/fit-04-dts-semver-gate.test.ts` | 40 pass / 0 fail / 79 expect() calls |
| Lint | Not available — no lint script in `package.json` |

---

### Findings

| # | Severity | File | Detail | REQ/Criterion | Routing |
|---|---|---|---|---|---|
| 1 | CRITICAL | `src/commons/index.ts` (`buildWritableHandle.move`, `buildFoundHandle.move`) | REQ-KIT-03.3 requires "`handle.move(toDir)` on either handle form (no opts) → wire directive omits `force` entirely." The omission branch (`opts?.force !== undefined ? {...} : {}`) is duplicated independently in three places (free `move`, `WritableHandle.move`, `FoundHandle.move`) — same pattern the design/spec calls out for the *present* case in REQ-KIT-03.2 ("kills the free-function-only threading mutant"). Only the **free function's** omission path is directive-shape-asserted (`handle-chaining.test.ts::"move omits force key..."`, asserts `dir.move.force` is `undefined`). `WritableHandle.move(toDir)` is called with **zero opts anywhere in the suite** (grepped every `.move(` call in `test/skeleton/handle-chaining.test.ts` and `directive-factory.test.ts` — the only bare-args call on `WritableHandle.move` doesn't exist at all; it's only ever called with `{force:true}`, line 306). `FoundHandle.move(toDir)` IS called bare once (line 257, pre-existing, C4 chained-read test) but that test only asserts read-content at destination, never the directive's `force` key — so it exercises the runtime path without crashing but doesn't kill a mutant that spuriously includes `force` on omission. A mutant that flips the ternary/spread logic in either handle wrapper independently would pass the whole suite today. | REQ-KIT-03.3 | LOCAL |

**Tolerated for now** (flagged for final, not blocking): none beyond the above — no other sub-critical concerns surfaced in the delta.

---

### REQ Coverage Check

| REQ-ID | Test exists | Meaningful assertion | Passes | Notes |
|---|---|---|---|---|
| REQ-KIT-03.1 | Yes — `directive-factory.test.ts` (unit) + `handle-chaining.test.ts` (free fn, integration) | Yes — exact directive `toEqual`, `force:true` observed on wire | Yes | Factory + free-function layers both proven |
| REQ-KIT-03.2 | Yes — `handle-chaining.test.ts` (`WritableHandle.move`, `FoundHandle.move`, both with `{force:true}`) | Yes — exact `toDir`/`force` assertions | Yes | Both handle forms proven for the present case |
| REQ-KIT-03.3 | Partial — only free-function omission is directive-shape-asserted; factory-level omission asserted (`"force" in directive.move === false`) | Partial | Passes as written, but does not cover the two handle-wrapper omission branches | ⚠️ PARTIAL — see Finding #1 |
| REQ-FAKE-04.m1 | Yes — `move-fail-closed.test.ts` | Yes — rejects with `/move collision/`, both src/dst content asserted untouched | Yes | |
| REQ-FAKE-04.m2 | Yes | Yes — dst holds source content, src reads `undefined` | Yes | |
| REQ-FAKE-04.m3 | Yes | Yes — dst holds source content | Yes | |
| REQ-FAKE-04.m4 | Yes | Yes — content preserved after self-move; identity-exclusion confirmed load-bearing via mid-implementation RED (documented in apply-progress) | Yes | |
| REQ-FAKE-07.1 | Yes — `modify-existence.test.ts` | Yes — rejects with `/modify target not found/`, path absent afterward | Yes | |
| REQ-FAKE-07.2 | Yes | Yes — content updated | Yes | |
| REQ-FAKE-07.3 | Yes | Yes — intra-batch `[create X, modify X]`, reads `content2` — kills the seed-only existence-check mutant | Yes | |

---

### TDD Evidence Audit (Strict TDD, in-loop, delta scope: 4 test files, 5 impl files)

- **TDD adherence (light)**: every implementation file touched (`wire.ts`, `directive-factory.ts`, `base-handle.ts`, `commons/index.ts`, `contract-fake.ts`) has a corresponding delta test file/block. No new file with implementation and zero tests.
- **RED evidence where [must-fail-first]**: confirmed for FAKE-04.m1 (`ContractFake` silently overwrote before the fix — real RED observed, "Expected promise that rejects, Received promise that resolved" per apply-progress), FAKE-07.1 (same failure signature), KIT-03.1 factory + free-fn + both handle-form present-force cases (`"Expected - 1 (force:true) / Received + 0"` / `"Expected: true, Received: undefined"`). The apply-progress explicitly documents which of the bundled rows (FAKE-04.m2/m3, FAKE-07.2/.3, KIT-03.3 rows) are green-path characterizations rather than independently red, and why (today's fake unconditionally overwrote on move pre-fix, so the "success" rows were already true) — this is transparent, not theatre, and consistent with the spec's own RED-posture annotations for these REQs.
- **Banned assertion patterns (delta)**: none found. `expect(dir).toBeDefined()` appears in the four new `handle-chaining.test.ts` tests as a type-narrowing guard before real assertions (`dirs.find((d) => d.op === "move")` already guarantees `op === "move"` when defined, so the guard cannot mask a false pass) — not used as the assertion; specific value assertions follow in every case. Not flagged.
- **Triangulation**: `contract-fake.ts`'s move collision conditional (`!isSelfMove && exists(dst) && !effective`) has 4 distinct driving cases (m1/m2/m3/m4) — adequate. `modify`'s existence conditional has 3 cases (07.1/07.2/07.3) — adequate. `DirectiveFactory.move`'s conditional spread has 2 cases (present/omit) — adequate at the factory layer. **Gap**: the same conditional-spread logic, independently duplicated in `WritableHandle.move` and `FoundHandle.move`, has only the "present" case verified on both, and the "omit" case verified on neither at the directive-shape level (see Finding #1) — this is the one place triangulation is incomplete for delta-introduced code.
- **Regression check**: full suite 201/201 pass — no previously-passing test now fails.

**Verdict (Strict TDD in-loop module)**: `concerns` (not `halt`) — the single triangulation gap is fixable within the loop (LOCAL), not a banned-pattern violation or a regression.

---

### Scope Audit (delta files vs. slice tasks)

| File | Slice task | In scope? |
|---|---|---|
| `src/core/wire.ts` | S-1.3 GREEN (`move.force?`) + design row 1.3 phantom-ADR-0028→0013/0001 fix | Yes |
| `src/core/directive-factory.ts` | S-1.3 GREEN (`MoveArgs.force?`) + design row 1.3 ADR-0028 comment fix | Yes |
| `src/core/base-handle.ts` | S-1.3 GREEN (`WriteOps.move` opts) | Yes |
| `src/commons/index.ts` | S-1.3 GREEN (free `move` + both `.move`) | Yes |
| `test/support/contract-fake.ts` | S-1.3 GREEN (move fail-closed + self-move identity + modify existence) | Yes |
| `test/fake/move-fail-closed.test.ts` (new) | S-1.3 RED (FAKE-04.m1–.m4) | Yes |
| `test/fake/modify-existence.test.ts` (new) | S-1.3 RED (FAKE-07.1–.3) | Yes |
| `test/skeleton/directive-factory.test.ts` | S-1.3 RED (KIT-03.1/.3, factory layer) | Yes |
| `test/skeleton/handle-chaining.test.ts` | S-1.3 RED (KIT-03.1/.2/.3, integration layer) | Yes |
| `test/fitness/dts-baseline/commons.index.d.ts`, `core.base-handle.d.ts`, `core.handle-state.d.ts` | S-1.3 baseline-regen task | Yes |
| `openspec/changes/stage-1-ir-bedrock/slices.md` | Checkbox completion for S-1.3 tasks | Yes (expected apply bookkeeping) |
| `openspec/changes/stage-1-ir-bedrock/apply-progress.md` (new) | Required apply artefact | Yes (expected) |
| `.sdd/state/stage-1-ir-bedrock.json` | Orchestrator phase/batch tracking | Yes (expected bookkeeping, not code) |

**No out-of-scope files.** Confirmed NOT touched: `test/fitness/fit-04-dts-semver-gate.test.ts` (W7 edit correctly deferred to S-1.5/1.6 per design), any `batch-cap`/`BATCH_CAP_BYTES` file (S-1.4 scope), `test/golden-ir/*` (S-1.1 scope, REQ-GIR-01 not in this batch's acceptance criteria).

---

### Binding Contract Checks (from launch notes)

- **Self-move identity**: verified real, not dead code. Traced `contract-fake.ts` move handler: `isSelfMove` exclusion is load-bearing — without it, `!isSelfMove && exists(dst) && !effective` would be `exists(dst) && !effective`, and since `dst === src` always exists when the source exists, a self-move with no force would incorrectly throw. `move-fail-closed.test.ts::m4` proves this exact behaviour, and apply-progress documents a genuine mid-implementation RED when a naive (non-exclusion) version was tried.
- **Staging existence model**: REQ-FAKE-07.3 (`[create X, modify X]` in one batch) passes and specifically exercises staging-aware `#exists` (tree-or-seed, not seed-only) — confirmed the seed-only mutant would be killed (empty seed, X only exists via staged create).
- **Force-threading parity**: free function ✓, `WritableHandle.move` ✓ (present case), `FoundHandle.move` ✓ (present case). Omission parity across both handle forms is the one unverified leg (Finding #1).
- **Non-breaking surface (FIT-04)**: green against regenerated baselines — ran `fit-04-dts-semver-gate.test.ts` directly, part of the 40/40 targeted pass.
- **Stage-boundary raw-seam rejections**: both new `ContractFake` throw sites (`modify target not found`, extended `move collision`) use the plain `ContractFake: <reason>: "<detail>"` convention, no `AuthoringError`/attribution vocabulary; confirmed no test asserts `instructions[0]`-style attribution as correct.
- **Scope discipline**: confirmed — see Scope Audit table above; no S-1.4/S-1.5/S-1.6 work smuggled in.

---

Orchestrator action: re-invoke `/build` with SDD-light targeting Finding #1 — add two directive-shape assertions: `WritableHandle.move(toDir)` (no opts) and `FoundHandle.move(toDir)` (no opts, can extend the existing C4 chained-read test or add a sibling) each asserting the emitted wire directive omits `force` (e.g. `"force" in dir.move` is `false`, mirroring the existing free-function omission test). Iteration 1 of 3 used.
