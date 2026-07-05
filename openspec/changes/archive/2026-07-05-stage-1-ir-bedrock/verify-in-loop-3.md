## Verify In-Loop Result

**Change**: stage-1-ir-bedrock
**Iteration**: 1/3 (this is the first verify pass over **batch 2**; the change-wide file is
named `verify-in-loop-3` per orchestrator sequencing — batch 1 used `verify-in-loop-1`/`-2`)
**Scope**: S-1.4, S-1.5/1.6, S-1.8, S-1.9 (batch 2 — built by four parallel apply agents)
**Mode**: in-loop (Strict TDD)
**Baseline**: `5ecc04f` (closed batch 1 / S-1.3, already verified — out of scope except as
regression surface). Under review: the uncommitted working tree on `feat/stage-1-ir-bedrock`.

---

### Verdict: PASS

All four slices' scope checks are green, individually and integrated. Loop can exit for
this batch.

- Tasks in scope complete: 18/18 (S-1.4: 5, S-1.5/1.6: 6 incl. 4 housekeeping items + 1
  test file + 1 prod edit — see slices.md task list, S-1.8: 2, S-1.9: 4)
- Affected tests passed: 48/48 (batch-2 targeted files) + 223/223 (full suite)
- Spec compliance for scope: 19/19 batch-2 REQ scenarios compliant (batch-cap REQ-01.1–.3/
  REQ-02.1/REQ-03.1 = 5, commit-discard REQ-10.1–.3 = 3, REQ-FIT-09 = 4 scenarios, pyramid
  REQ-01–04 = 4 — plus contrast/red-proof rows not separately REQ-numbered)
- Assertion audit: clean — no banned patterns in any batch-2 delta test file
- Cross-slice integration: coherent (see below)
- Scope discipline: clean — every delta file traces to one of the four slices; nothing from
  S-1.7 or S-1.1 present

Orchestrator action: mark S-1.4, S-1.5/1.6, S-1.8, S-1.9 done, commit batch 2, proceed to
next batch (S-1.7) per Build Order.

---

### Execution Evidence

| Command | Result |
|---|---|
| `bunx tsc --noEmit` (full project) | exit 0, no output — clean |
| `bun test` (full suite) | **223 pass / 0 fail**, 354 `expect()` calls, 39 files, 1.62s |
| `bun test test/fake/batch-cap.test.ts test/types/wire-content-string.test.ts test/skeleton/write-only-factory.test.ts` (S-1.4) | 10 pass / 0 fail |
| `bun test test/skeleton/double-fault.test.ts test/fitness/fit-04-dts-semver-gate.test.ts test/skeleton/directive-factory.test.ts test/types/permissive-proof.guard.test.ts test/conformance/meta.test.ts` (S-1.5/1.6) | 26 pass / 0 fail |
| `bun test test/fitness/fit-10-engine-client-port-guard.test.ts` (S-1.8) | 6 pass / 0 fail |
| `bun test test/e2e test/pyramid` (S-1.9) | 6 pass / 0 fail |
| `bun test test/fitness` (regression, whole fitness layer) | 59 pass / 0 fail (10 files) — includes FIT-04 rebuild + FIT-10 |

No step exceeded the in-loop time budget; no step was skipped.

---

### Cross-Slice Integration Check

1. **`contract-fake.ts` ordering — S-1.3 fail-closed vs S-1.4 cap.** `emit(batch)` now
   computes `Buffer.byteLength(JSON.stringify(batch), 'utf8')` and rejects on cap-exceeded
   **before** the `for (const directive of batch.instructions) this.#apply(...)` loop that
   houses the S-1.3 fail-closed `move`/`modify`-existence checks. This ordering is
   **spec-silent** (no REQ specifies precedence when a batch is simultaneously over-cap and
   contains a colliding `move`) but is **coherent, not accidental**: it is the natural
   consequence of the cap being a whole-envelope structural property (checked once, before
   any per-directive interpretation begins) versus the fail-closed rules being per-directive
   semantic properties (checked during apply). No test in either S-1.3 or S-1.4 constructs a
   batch that would trigger both simultaneously, so the ordering is untested but also
   unclaimed by any REQ — flagging as a note for `final` verify / design, not a blocker.
2. **FIT-04 W7 unconditional rebuild vs S-1.4's `wire.ts` change.** `wire.ts` gained one new
   export (`BATCH_CAP_BYTES`) and no signature changes. `wire.ts` is **not** one of the five
   `DTS_PAIRS` baselines tracked by `fit-04-dts-semver-gate.test.ts` (`commons/index`,
   `index`, `conformance/index`, `core/handle-state`, `core/base-handle` — confirmed by
   reading the test file), so the new export cannot trip the gate regardless. Confirmed
   green via targeted run above (26 pass, includes this file) and via the full-suite run.
3. **FIT-09/FIT-10 guard scans current `src` cleanly.** Confirmed via targeted run (6/6
   pass) and via the full-suite run — the two characterization rows (Directive/JsonValue
   exemption, `commons`/`conformance` clean scan) both pass against the CURRENT tree state
   post-S-1.4 (which added no new `src/**` files outside `src/core`), so S-1.8's guard and
   S-1.4's `wire.ts` edit do not interact adversely.
4. **`test/skeleton/directive-factory.test.ts`** is touched only by S-1.5/1.6 (phantom
   ADR-0028 → ADR-0013 header-comment fix) — confirmed by diff, a one-line comment change,
   no assertion touched. Does not collide with S-1.3's earlier edits to the same file (out
   of this batch's diff).

No mocked seam stood in for a real one anywhere in this batch — REQ-10's `DiscardRejectingClient`
delegates `emit`/`read`/`commit` to a real `ContractFake` and only overrides `discard()`, matching
the spec's explicit "MUST NOT be hollowed to a mocked unit test" instruction.

---

### REQ Coverage Check (all 4 slices)

| REQ-ID | Test file | State |
|---|---|---|
| batch-cap REQ-01.1 (exactly-at-cap passes) | `test/fake/batch-cap.test.ts` | ✅ green |
| batch-cap REQ-01.2 (over-cap rejects, raw-measurer mutant killed) | `test/fake/batch-cap.test.ts` | ✅ green |
| batch-cap REQ-01.3 (SDK never pre-validates) | `test/fake/batch-cap.test.ts` | ✅ green |
| batch-cap REQ-02.1 (`string` type pin) | `test/types/wire-content-string.test.ts` | ✅ green |
| batch-cap REQ-03.1 (empty-batch reaches commit) | `test/skeleton/write-only-factory.test.ts` | ✅ green |
| REQ-10.1 (E2 attached as E1.cause) | `test/skeleton/double-fault.test.ts` | ✅ green |
| REQ-10.2 (RED-PHASE GATE, historical) | same file, documented in apply-progress | ✅ evidence captured |
| REQ-10.3 (contrast — normal discard, no cause) | `test/skeleton/double-fault.test.ts` | ✅ green |
| REQ-FIT-09 scenario 1 (planted-bypass flagged) | `test/fitness/fit-10-engine-client-port-guard.test.ts` | ✅ green |
| REQ-FIT-09 scenario 2 (contract-fake allow-listed clean) | same file | ✅ green |
| REQ-FIT-09 scenario 3 (Directive/JsonValue exempt) | same file | ✅ green |
| REQ-FIT-09 scenario 4 (commons/conformance clean) | same file | ✅ green |
| pyramid REQ-01 (four-layer table) | `test/pyramid/pyramid-codification.test.ts` | ✅ green |
| pyramid REQ-02 (decision table) | same file | ✅ green |
| pyramid REQ-03 (CI coverage) | same file | ✅ green |
| pyramid REQ-04.1 (e2e happy path + move-force) | `test/e2e/author-to-tree.e2e.test.ts` | ✅ green |

19/19 batch-2 scenario-groups mapped (5 + 3 + 4 + 4 counted at the REQ-ID granularity used in
slices.md's own coverage check = 19 total change-wide REQ-IDs, all now covered across batch 1 +
batch 2; batch 2 alone closes the 4 batch-cap + 3 commit-discard + 1 FIT-09 (4 scenarios) + 4
pyramid = the remaining REQ-IDs after S-1.3's 3).

**Binding-contract spot checks**:
- Cap predicate is EXACTLY `Buffer.byteLength(JSON.stringify(batch), 'utf8')` in both
  `contract-fake.ts` and the fixtures module — confirmed by direct read.
- Boundary semantics confirmed: `batchOfSerializedBytes(BATCH_CAP_BYTES)` asserted `===
  BATCH_CAP_BYTES` and resolves; `batchOverSerializedBytes(BATCH_CAP_BYTES)` asserted `>
  BATCH_CAP_BYTES` and rejects — exact `==`/`>` boundary as specified.
- Fixtures use multi-byte content (`"€\"\\\n"` — 3-byte euro + escaped quote/backslash/
  newline) in both boundary fixtures — ASCII-only violation NOT present.
- `BATCH_CAP_BYTES` is the single named constant in `wire.ts`; no duplicate definition found
  anywhere else (`rg` confirms only the fixtures/tests import it, none redefine it).
- SDK never validates the cap: `context.ts`/`session.ts` diff shows no size-related code;
  cap check lives exclusively in `test/support/contract-fake.ts#emit`.
- ADR-0019 carries the provenance clause (SDK-chosen placeholder, cheap-to-change until
  Stage 6) — confirmed present verbatim. ADR-0017's file carries the appended
  "Amendment (2026-07-04b): self-move identity exclusion" section — confirmed present.
- REQ-10: `context.ts`'s catch block wraps `discard()` in its own try/catch, attaches `E2`
  to `E1.cause` (guarded `err instanceof Error`), re-throws `E1` — E2 never swallowed nor
  replacing E1. Contrast row (REQ-10.3) confirmed: `E1.cause` stays `undefined` when
  `discard()` resolves normally, since `err.cause` is only assigned inside the `catch
  (discardErr)` block.
- REQ-FIT-09 stable ID used everywhere (no invented "REQ-FIT-10" found by `rg`); file is
  `fit-10-engine-client-port-guard.test.ts`; allow-list is exactly the single path
  `test/support/contract-fake.ts` (string-equality check in `scanPortBleed`, not a
  substring/prefix match); red-proofs are string fixtures fed directly to `scanPortBleed`,
  never committed as real poisoned modules; a dedicated test confirms `Directive`/
  `JsonValue`-only type imports are NOT flagged.
- Pyramid: `CONTRIBUTING.md`'s new "Test pyramid" section has the exact 4-column header
  `Layer | Directory | Runs without engine? | Example test` with exactly 4 rows
  (unit/fitness/integration/e2e), plus the "Where does my change belong?" decision table
  (`Contribution type | Layer(s) | Home`) with exactly 4 rows. `pyramid-codification.test.ts`
  parses both tables programmatically (regex header match + row extraction), not by
  substring search. `.github/workflows/ci.yml` diff vs baseline is **empty** (confirmed via
  `git diff 5ecc04f -- .github/workflows/ci.yml`) — read-only constraint honored. The e2e
  test runs entirely against `ContractFake`, no engine import anywhere in `test/e2e/`.
  The CONTRIBUTING.md directory-per-layer mapping (unit→`test/golden-ir`, fitness→
  `test/fitness`, integration→`test/fake`, e2e→`test/e2e`) matches the design §4.6 Test
  Derivation table's own per-REQ level labels (e.g. REQ-GIR-01 labeled "unit", REQ-FAKE-07/
  boundary REQs/batch-cap REQs labeled "integration") — reads as design intends; the
  apply-progress's own note that `test/skeleton` is a secondary acceptable integration home
  (not one of the four canonical directories) does not contradict REQ-02's "points to *a*
  layer from REQ-01" wording.
- Stage-boundary discipline: all five new/changed rejection sites in `contract-fake.ts` and
  `context.ts` use raw `ContractFake:`-prefixed messages or bare `Error` objects — no
  `AuthoringError` vocabulary, no `instructions[0]`-attribution pinned as correct anywhere
  in the batch-2 diff.
- `objectives-plan.md` reconciliation direction confirmed correct: item 1.4 now reads
  "Frame-cap enforcement at **emit**" (✅ RATIFIED 2026-07-04, D8/ADR-0019), Coverage O1 row 6
  updated to "enforced at emit (fake/engine boundary, never `Session.flush`)", new D8
  decision-table row added with the ✅ RATIFIED — ADR-0019 marker — matches the ratified
  D8/ADR-0019 direction, not the reverse.

---

### TDD Evidence Audit (per apply-progress-* file)

| File | Verdict | Notes |
|---|---|---|
| `apply-progress-s14.md` | clean | All 5 tasks' TDD Cycle Evidence table shows genuine RED→GREEN for REQ-01.1/.2/.3 (real assertion-failure messages captured) and honestly documents a "test fails for the wrong reason" fixture-seeding fixup (per strict-tdd.md's own guidance — the structural problem was fixed, not the cap logic, before re-running); REQ-02.1/REQ-03.1 correctly labeled characterization (spec's own RED-waived posture), not miscategorized as must-fail-first. Boundary triangulation: exactly-at-cap + over-cap = 2 cases satisfying the boundary, matches spec's `Scenario REQ-01.1`/`REQ-01.2` pairing. |
| `apply-progress-s1516.md` | clean | REQ-10.1 RED evidence is a genuine assertion-failure message (`rejects.toBe(e1)` — expected E1, received E2) against pre-fix `context.ts`; REQ-10.3 correctly labeled characterization/RED-waived (passed pre-fix, pins pre-existing correct behavior). Housekeeping items (i–v) correctly carry no REQ-ID and are verified by done-bar + suite-green per slices.md's own instruction, not fabricated TDD cycles. |
| `apply-progress-s18.md` | clean, with one judgment call flagged and accepted | 3 of 5 test rows show genuine RED→GREEN (real "Expected X, Received Y" failures); 2 rows (Directive/JsonValue exemption, production-scan-clean) passed on first run. Per strict-tdd.md, a first-run pass is normally a halt trigger, but the agent explicitly classified both as legitimate characterizations matching the spec's own posture-(b) taxonomy (behavior pre-exists as an emergent property of the already-triangulated mechanism) rather than silently passing them off as must-fail-first — this is exactly the "halt over heuristic, but document the judgment" behavior strict-tdd.md expects when a test is honestly characterization-shaped. Verified independently: these two scenarios are structurally incapable of being must-fail-first once the reachability-gated scanner exists (they assert the ABSENCE of a match), so treating them as characterization is correct, not a rationalization. |
| `apply-progress-s19.md` | clean | Pyramid REQ-01/02/03 show genuine RED→GREEN ("Expected 4, Received 0" against the pre-CONTRIBUTING.md-edit state); e2e rows correctly labeled characterization per the spec's own explicit RED-waived posture for REQ-04. Directory-mapping judgment call documented and flagged for verify — addressed above (reads as design intends). |

No banned assertion patterns found in any batch-2 delta test file (`toBeDefined()`,
`toBeTruthy()`/`toBeFalsy()` without context, `objectContaining` as sole assertion,
`not.toThrow()` as sole assertion — all absent per direct `rg` scan). Triangulation present
wherever conditional/iterative logic was introduced (cap boundary: 2 cases; double-fault:
2 cases via the try/catch's two branches; FIT-09 scanner: 5 cases across allow-list,
reachability gate, type exemption, and production scan; pyramid CI-exclusion detector:
2 cases including its own red-proof).

---

### Scope Audit

Delta vs baseline `5ecc04f` (via `git status` + `git diff --stat`):

**Modified** (13 files): `.sdd/state/*.json` (orchestrator bookkeeping) · `CONTRIBUTING.md`
(S-1.9) · `openspec/changes/stage-1-ir-bedrock/slices.md` (checkbox reconciliation only —
confirmed by diff, no wording changes) · `openspec/decisions/0017-*.md` (S-1.4, ADR-0017
amendment) · `openspec/objectives-plan.md` (S-1.5/1.6 housekeeping) · `src/core/context.ts`
(S-1.5/1.6) · `src/core/wire.ts` (S-1.4) · `test/conformance/meta.test.ts` (S-1.5/1.6) ·
`test/fitness/fit-04-dts-semver-gate.test.ts` (S-1.5/1.6) · `test/skeleton/directive-factory.test.ts`
(S-1.5/1.6, one-line comment) · `test/skeleton/write-only-factory.test.ts` (S-1.4) ·
`test/support/contract-fake.ts` (S-1.4 — diff confirms ONLY the cap-check addition, no
round-trip logic, no S-1.7 scope) · `test/types/permissive-proof.guard.test.ts` (S-1.5/1.6)

**Created** (12 paths): 4 `apply-progress-*.md` (expected bookkeeping) ·
`openspec/decisions/0019-batch-cap-and-text-wire.md` (S-1.4) · `test/e2e/` (S-1.9) ·
`test/fake/batch-cap-fixtures.ts` + `test/fake/batch-cap.test.ts` (S-1.4) ·
`test/fitness/fit-10-engine-client-port-guard.test.ts` (S-1.8) · `test/pyramid/` (S-1.9) ·
`test/skeleton/double-fault.test.ts` (S-1.5/1.6) · `test/types/wire-content-string.test.ts`
(S-1.4)

Every file maps to exactly one of the four in-scope slices' task lists or expected
bookkeeping. **Confirmed absent**: no `test/fake/boundary-pass-through.test.ts` (S-1.7,
unchecked in slices.md) and no `test/golden-ir/*` changes (S-1.1, unchecked in slices.md) —
both remain `[ ]` in the reconciled `slices.md`, correctly deferred to their own batches per
the Build Order (S-1.7 → S-1.1, sequential after this batch).

---

### Non-Blocking Notes (for final verify / next batches)

1. **Cap-vs-fail-closed ordering** (cross-slice item 1 above) is untested and spec-silent —
   worth a fixture in `final` verify or a design footnote if Stage 2.1 ever needs to
   distinguish "which rejection the author sees first" for a batch that is simultaneously
   over-cap and semantically invalid. Not a defect in this batch.
2. `err instanceof Error` guard in `context.ts`'s double-fault fix (flagged by the S-1.5/1.6
   apply-progress itself) is untested for a factory that throws a non-Error primitive — a
   pre-existing TS-strictness necessity, not a REQ-10 gap, carried forward as a note only.
3. `permissive-proof.guard.test.ts` hardening is explicitly "theoretical" robustness (no live
   bug demonstrated) — correctly scoped as housekeeping, not inflated into a false REQ.

None of the above block this batch's PASS verdict.

---

### Skill Resolution

`fallback-registry` — no `## Project Standards (auto-resolved)` compact-rule block was
injected into this verify launch beyond the brief inline TypeScript/Bun/Strict-TDD note;
proceeded using the codebase's own established conventions (test file placement, assertion
style, `ContractFake:`-prefixed error convention) as the pattern source, read directly from
the artefacts and source per instructions. Orchestrator should re-resolve the skill registry
if this recurs across further batches.
