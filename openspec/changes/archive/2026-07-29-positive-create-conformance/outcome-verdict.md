# Outcome Verdict: Positive Create Conformance

**Checkpoint**: reckoning (pre-archive)  
**Change**: positive-create-conformance  
**Triage**: M  
**Steward**: haiku blind launch  
**Date**: 2026-07-29

---

## Original Problem (The Yardstick)

> The engine change `sdk-wire-create` (engine repo, plan PR #185) makes the wire `create` op ingestible. The engine's conformance merge gate is **BLOCKED** on the SDK corpus proving the positive create path with real SDK-emitted directives (unblocks engine PC-CREATE-02). **Handshake**: once the SDK work lands on main, the engine advances its third_party submodule pin to that exact commit SHA and un-skips its two gated conformance tests (cardinality + force-reject against real corpus).

**Who is hurting**: Engine team, blocked on conformance merge gate PC-CREATE-02  
**Pain**: Cannot advance engine's pin or run gated conformance tests without corpus proof  
**Why now**: Engine change `sdk-wire-create` ships on signed fallback; SDK corpus must prove acceptance path before engine can land theirs  

---

## Did We Deliver It? Show Me WHERE

### The Promise → The Delivery Map

| Promised Outcome | Deliverable Evidence | Status |
|---|---|---|
| **Amend REQ-CFX-02** to relax cardinality from "exactly one corpus-wide" to "quarantined to one sanctioned file" | Delta spec: `openspec/changes/positive-create-conformance/specs/conformance-fixtures/spec.md` REQ-CFX-02/02.1/03 reworded (awaiting archive-time sync to main spec) | ✅ DELIVERED |
| **Add ≥1 positive create fixture** proving composite options path + exit 0 + byte-exact output | `conformance/m2-create-composition/factory.ts` export `createComposite` (line 33-34) + manifest case `create-composite` + `expected-composite/create-composite.txt` byte-exact | ✅ DELIVERED |
| **Extend fit-40's SANCTIONED_SITE scan** (site-agnostic) to admit new positive case | Zero code change needed (already file-level scan); new test blocks REQ-CFX-09.4/09.5/02.2 added; scan still passes at one literal path | ✅ DELIVERED |
| **ADR-0064 amended** to document force-is-trigger + engine v1 no-force-mechanism | `openspec/decisions/0064-wire-create-reject-twin-outcome-triple-frozen.md` Amendment section (lines 45-67): states explicitly force-is-trigger, not template; engine v1 never has force mechanism; wire create + force = batch-level reject at decode step 2 | ✅ DELIVERED |
| **encodeOptions composite-options round-trip** pinned by REQ + tested end-to-end | REQ-TOE-01 specifies JSON-stringify branch; `test/core/encode-options.test.ts` + `test/golden-ir/golden-ir.test.ts` exercise it; `createComposite` calls `create(...)` with array options → `session.buffer(factory.create(..., options: { tags: ["x","y"] }))` → `encodeOptions` → JSON string | ✅ DELIVERED |
| **Pin-advance blast-radius statement** at archive time: invocation surface / probe / exit-codes / cross-repo concerns | Verify-report Item D: runner surface (bin/exports) byte-identical; single-instance-probe untouched (zero commits); exit-code taxonomy unchanged; one transparent pre-existing failure mode (resolvePackageRoot deletion, outside THIS change) flagged for engine confirmation | ✅ DELIVERED |

### The Delivered Result

**Scope**: 3 slices complete (S-000 skeleton, S-001 force rule, S-002 sync), 15/15 tasks done  
**Commit**: Archive at `0bd88e4` (PR #55 merged to main 2026-07-29); post-archive cleanup `e76bd8f`  
**Test verdict**: fit-40 61/61 pass, full suite 2401/0 pass, typecheck clean, 9/9 REQ scenarios compliant with mutation-verified evidence  
**Spec compliance**: 100% — REQ-CFX-02.1/02.2, REQ-CFX-03 clause (a), REQ-CFX-09.1/09.2/09.3/09.4/09.5, REQ-CFX-12.3, REQ-CFX-13.6 all live and tested

### The Consumer Journey (Engine Engineer at Pin-Advance)

**What the engine engineer needs**:
1. Archive commit SHA where the corpus fixture landed ← **`0bd88e4` exists on main**
2. Evidence that fit-40 green at that commit ← **61/61, verified independent of verify-in-loop**
3. Spec amendment clearly documented ← **Delta spec present, ADRs clear**
4. ADR-0064 amended with force-trigger specifics ← **Amendment section present, quotes engine handoff obs #1739**
5. Composite options coverage confirmed ← **REQ-TOE-01 pinned, end-to-end tested**
6. Blast-radius statement for any surface changes ← **Item D in verify-report**

All six items present and verified. **The engineer can proceed to advance the pin.**

---

## Is It Usable? (Escalated Question)

**Not directly applicable** — this is not a user-facing feature but a cross-repo handshake (SDK corpus ↔ engine conformance). The usability criterion for the engine team is: "Can we advance our pin and run the gated tests?" Answer: **Yes, all blocking items are resolved.**

---

## Did We Drift?

### Promise vs. Delivery Drift Check

**Promise (proposal + spec + design)**:
- Engine prerequisite: Add positive create fixture + amend REQ + ADRs
- Approach: New case in same sanctioned file, no new fixture id, zero fit-40 code change
- Outcome: "Unblocks engine PC-CREATE-02"

**Delivery (archive commit 0bd88e4 + e76bd8f)**:
- ✅ New case `createComposite` in existing `m2-create-composition/factory.ts`
- ✅ REQ-CFX-02 amended (delta spec)
- ✅ ADRs 0078 (new, force-disposition) + 0064 (amended, force-trigger + v1-no-mechanism)
- ✅ All sync sites (README, DO-NOT-COPY, fit-40 regex) updated in same commit
- ✅ No fit-40 code change needed (scan already site-agnostic)

**Drift assessment**: NONE — delivered exactly as promised.

### Cross-Change Coherence

- **ADR-0064 frozen outcome triple** (`(2, "unrepresentable", null)`): Byte-identical, only Amendment section grew
- **ADR-0078 (force-disposition, new)**: Consistent with engine ADR-0028 amendment
- **Architecture**: `conformance/` marked `(additive)` — no layer violations, no SSOT conflict, sensitive-areas confirmed no trigger
- **Scope boundaries**: REQ-CFX-02/03/09/12/13 carefully traced; `pending-changes.md` row 500 (session.buffer raw-object bypass) stays open, correctly; force-removal followup confirmed registered as separate row for archive step

---

## The Structural Fact: Externally Falsifiable Outcome

**Per engine handoff obs #1739, item 6**:

> "Steward reckoning: outcome is externally falsifiable — engine flips `skipPendingPositiveCorpus` off, un-skips `TestConformance_M2CreateForceRejected` + `TestConformance_M2WireAuthoredCreateCardinality`; until that lands green record **delivered-pending-activation**, not delivered."

**What this means**:

The problem statement says the outcome is "unblocks engine PC-CREATE-02." But PC-CREATE-02 is **the engine's task** (a skip-gated test re-enablement on their side). This SDK change delivers:

- ✅ The positive create corpus fixture (what the engine needed to unblock their gate)
- ✅ The spec amendment and ADRs documenting the new behavior
- ✅ Test evidence that the fixture works as declared

But the proof that it actually *unblocks* PC-CREATE-02 is:
1. Engine advances their `third_party` pin to commit `0bd88e4` (external party)
2. Engine un-skips the two gated tests `TestConformance_M2CreateForceRejected` + `TestConformance_M2WireAuthoredCreateCardinality` (external party)
3. Engine runs those tests green against the new corpus fixture (external party, external outcome)

**Until step 3 lands and passes in the engine repo, the outcome remains UNPROVEN.** The SDK has delivered its half of the handshake perfectly; the engine's half determines whether the outcome (PC-CREATE-02 unblocked) is true.

---

## Deferred Activation Criteria

| Criterion | When Activated | How to Verify |
|---|---|---|
| Main spec sync (REQ-CFX-02 quarantine wording live in `openspec/specs/conformance-fixtures/spec.md`) | Archive step runs (automatic) | `git log` shows delta spec → main spec merge at archive time |
| Archive commit SHA registered and persisted | Archive step completes | `openspec/changes/positive-create-conformance/archive-report.md` records commit SHA |
| Engine advances `third_party` pin to archive SHA | Engine PR lands (external) | Engine repo `go.mod` or submodule pointer updated to commit SHA |
| Gated tests un-skipped and run | Engine PR lands (external) | Engine CI logs show `TestConformance_M2CreateForceRejected` + `TestConformance_M2WireAuthoredCreateCardinality` no longer in skip list |
| Gated tests pass green | Engine PR lands (external) | Engine CI/merge gate shows 0 failures for both tests |

**Archive registration duty**: Once engine lands their pin-advance PR green (out-of-band notification expected from engine team), register a ONE-LINE outcome-check followup in `project/pending-changes.md` to confirm PC-CREATE-02 landed. This ensures the outcome question re-opens post-activation rather than being forgotten at archive time.

---

## Conscience Questions (Escalated to Human)

**None.**

This is a cross-repo handshake with mechanically verifiable preconditions and an externally falsifiable outcome. The engine team's own gated tests are the oracle of whether PC-CREATE-02 is truly unblocked. The SDK has met its contractual deliverables; the outcome proof belongs to the engine team's own test run.

---

## Verdict

**`delivered-pending-activation`**

**Justification**:
- Every pre-archive-evaluable criterion is SATISFIED ✅
- All 9 REQ scenarios compliant with mutation-verified evidence ✅
- Engine team has all the data they need to advance their pin ✅
- The outcome (PC-CREATE-02 unblocked) is **externally falsifiable** — its proof depends on the engine's pin-advance PR landing green with gated tests enabled and passing
- No usability or significance concerns — this is a mechanical handshake between two repos

**Deferred until**: Engine lands PC-CREATE-02 pin-advance PR with gated tests passing (out-of-band timeline)  
**Archive can proceed**: Yes; register one outcome-check followup in `project/pending-changes` for the engine's PR landing  
**Outcome activation event**: Engine team notifies SDK team that PC-CREATE-02 tests are green; SDK closes the outcome-check as delivered

---

## Result

Archive proceeds with confidence. The engine team has received exactly what they asked for — a conformance corpus with a positive create fixture, a clear spec amendment, ADRs documenting the force-semantics, and full test evidence at the pinned commit SHA. Their gated tests will be the final proof that the outcome (PC-CREATE-02 unblocked) is true.

---

## Persistence

**Engram**: `sdd/positive-create-conformance/outcome-verdict` (this file content)  
**OpenSpec**: `openspec/changes/positive-create-conformance/outcome-verdict.md` (this file)  
**Pending-changes registration**: Archive step MUST add one outcome-check row (engine PC-CREATE-02 landing confirmation)
