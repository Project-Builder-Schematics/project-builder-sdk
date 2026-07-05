# Outcome Verdict — stage-1-ir-bedrock (reckoning)

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Verdict**: `delivered`
**Change**: `stage-1-ir-bedrock` · **Triage**: L · **Recorded**: 2026-07-05
**Branch**: feat/stage-1-ir-bedrock · **Baseline**: main (4a902ec) · **Head**: 5f6b0f9
**Evidence run by steward**: `bun test` → 243 pass / 0 fail (42 files) at head.

> This memo holds the delivered result against the ORIGINAL problem statement and the
> foresight North Star — not the spec. Verification already established quality (19/19 REQs,
> suite green, audit clean, judgment-day APPROVED). The question here is different: did it
> deliver the OUTCOME, is it usable, is it significant.

## 1. Our objective was THIS

From the problem statement (canonical contract): the product of Stage 1 is *not* a shipped
feature — it is the **IR-correctness triad** (golden-IR + unmocked contract fake + fitness),
frozen *correct* while it is still cheap to change, before any later stage semver-locks it.
The North Star restated the outcome as a **frozen-correct contract** two parties inherit:
later stages (2–6) build on pinned, ratified, fake-proven semantics; the eventual downstream
author receives a `move` that already carries `force?`, a deterministic IR, and a boundary
that fails closed instead of corrupting silently.

## 2. Did we deliver it? Result → problem map

Each Stage-1 pain (triage problem_statement) → the delivered mechanism that resolves it,
confirmed by inspection of the `main...HEAD` production diff + the fake + the suite:

| Stated pain (Stage 1) | Delivered mechanism | Where | Status |
|---|---|---|---|
| `move` lacks `force?` on the wire (semver risk) | `force?` threaded wire→factory→base-handle→author surface, additive-only | `wire.ts`, `directive-factory.ts`, `base-handle.ts`, `commons/index.ts`; FIT-04 `.d.ts` baselines grow by exactly `{force?}` | ✅ |
| 4 MiB cap has no unit/encoding anywhere in `src/` | `BATCH_CAP_BYTES` constant + UTF-8-serialized-byte measurement, ADR-0019 records unit/encoding/provenance | `wire.ts` (constant only), `contract-fake.ts` `emit`; ADR-0019 | ✅ |
| Emission determinism unproven | byte-identical double-run + committed golden string | `test/golden-ir/determinism.test.ts` | ✅ |
| Fake does not model the wire (ADR-0018 round-trip unimplemented) | `emit` JSON round-trip + structural `deepEqual` fidelity compare (silent-drop + stringify-throw families) | `contract-fake.ts` | ✅ |
| ADR-0017 fail-closed unimplemented (2 live bugs) | move-collision fails closed without `force`; modify-of-nonexistent rejects; self-move identity no-op | `contract-fake.ts` `#apply`; red-proofs in `test/fake/` | ✅ |
| `EngineClient` port guarded by convention only | structural port-bleed scan (REQ-FIT-09) with planted-bypass red-proof | `test/fitness/fit-10-engine-client-port-guard.test.ts` | ✅ |
| Four-layer pyramid implicit | pyramid table structurally enforced + explicit e2e suite | `CONTRIBUTING.md`, `test/pyramid/`, `test/e2e/author-to-tree.e2e.test.ts` | ✅ |
| (adjacent) failed run half-commits / double-fault clobbers E1 | try/catch around `discard()`, E2 as `E1.cause`, E1 re-thrown unchanged (frozen-E1 guarded) | `context.ts` | ✅ |

**Every stated pain maps to a delivered, tested mechanism. No pain left untouched within
Stage 1's remit.** The `session.ts` file is absent from the production diff — proof the cap
lives at the fake's `emit`, never in the SDK (ADR-0018 honored, North Star check #3 satisfied).

## 3. Is it usable / significant? (escalated — see conscience questions)

The person who was hurting — the schematic author — is met at Stage 6, not here. Stage 1's
usability question is therefore about the two INHERITORS of the contract:

- **Later stages / contributors**: the delivered surface WORKS engine-free. The one true e2e
  (`author-to-tree.e2e.test.ts`) drives a real author journey — `create`→`modify`, and
  `move(..., { force: true })` overwriting a seeded destination — through `defineFactory` to a
  committed golden tree, with `ContractFake` at the exact seam a real `EngineClient` occupies.
  A contributor adding a verb has an obvious home per the CONTRIBUTING pyramid table (unit +
  integration), and the fail-closed / cap / round-trip rejections all surface with clear
  messages. Lived experience: it composes.
- **The eventual author**: inherits a `move` that already has `force?`, a deterministic
  byte-pinned IR, and a fail-closed boundary — none retrofittable cheaply post-publish.

The two questions the AI cannot answer — whether freezing against the fake is *significant*
de-risking and whether the fake is a *faithful enough* stand-in — are escalated below.

## 4. Did we drift? Promise (North Star) ↔ delivery

The North Star filed five checks the reckoning must confirm. All five hold:

1. **`force?` freeze real and additive-only** — ✅ production diff shows optional `{force?}`
   everywhere; FIT-04 `.d.ts` baselines grow, no breaking removal (judgment-day + verify agree).
2. **Two live bugs provably fixed** — ✅ `move-fail-closed.test.ts` + `modify-existence.test.ts`
   red-proofs; double-fault RED-PHASE-GATE (REQ-10.2) failed on pre-fix `context.ts`.
3. **Cap judged at the fake's `emit`, never in `src/`** — ✅ `session.ts` not in the diff;
   `wire.ts` carries only the documentation constant; enforcement is in `contract-fake.emit`.
4. **Non-REQ housekeeping landed** — ✅ objectives-plan reconciled ("enforced at flush" →
   "at emit", O1 row 6, D8 decision-table row all present in the diff); phantom `ADR-0028`
   replaced. *Minor note:* the North Star anticipated the phantom mapping to "0013/0017"; the
   actual citations are ADR-0013 (`directive-factory.ts`) and ADR-0001/0013 (`wire.ts`) — the
   phantom is gone and real ADRs are cited; the exact target set differs trivially and carries
   no scenario. Not a gap; a citation-nuance already covered by verify's cosmetic followups.
5. **The one true e2e exists and runs** — ✅ present and green.

**No promised capability failed to land. Nothing landed that wasn't promised** — the
production diff is exactly the five files in the design File-Changes table (verify G4: zero
scope creep). The one delivery-beyond-promise (frozen-E1 cause-assignment guard + non-finite
number rejection, head commit 5f6b0f9) strengthens delivered REQs (double-fault + round-trip
fidelity); it is defensive robustness inside scope, not creep.

## 5. Outputs-without-outcome scan

None found. Stage 1's outcome is a frozen-correct contract; every delivered piece feeds it —
golden fixtures + determinism → the pinned contract; fail-closed + self-move → the ratified
semantics; cap + round-trip → the defined wire; FIT-09 → the structural single-seam guarantee;
pyramid + e2e → the enabling test economy. The test-heavy shape is **faithful, not evasive**:
per the problem statement the IR-correctness triad IS the O1 product. A green suite here is the
deliverable, not a polished irrelevance over one.

## Verdict: `delivered`

On everything the AI can assert — result maps to every stated pain, zero promise↔delivery
drift, no outputs-without-outcome, the surface works end-to-end engine-free — Stage 1 delivered
its outcome: the IR bedrock is frozen correct, cheaply, before semver-lock. **The pinned
contract IS the outcome, and it is present, proven, and green.**

This verdict is `delivered` on delivery grounds. It does NOT pre-empt the two escalated
conscience questions below — per the steward contract, the gate does not pass until the human
engages them. They are questions of *significance*, not gaps in delivery; I do not fake a
verdict on meaning.

## Conscience questions (escalated — human judgment, gate does not pass until answered)

- **CQ-1 (the 4 MiB value — deliberately-owned bet?)**: The delivery *answered* the North
  Star's "invented vs engine-sourced" worry honestly — ADR-0019's Provenance section labels
  4 MiB **SDK-chosen, not engine-confirmed**, held as a single constant, explicitly cheap to
  change until the Stage 6 freeze. So the sharp risk ("semver-freezing a number the engine may
  contradict") is *defused*: nothing is frozen yet and the placeholder status is conscious, not
  silent. The residual, lower-stakes human question: **is deferring real-engine-frame-limit
  confirmation to Stage 6 an acceptable, deliberately-owned bet — and is there a cheap way to
  confirm the value against the engine team NOW rather than carrying it as a placeholder for
  five more stages?** Steward's read: sound as the owner's affirmed strategy; affirm it
  consciously rather than inherit it by default.

- **CQ-2 (fake as a faithful enough stand-in — the load-bearing bet)**: The whole stage
  freezes semantics against `contract-fake.ts` because the real engine does not exist yet. No
  test in this stage can prove the claim (problem statement) that the fake is "a legitimate
  counterpart, not a stopgap." **Does pinning semantics against the fake genuinely de-risk the
  eventual real-engine integration, or does it risk pinning the *fake's* behavior as if it were
  the engine's?** Steward's suspicion: sound *given* the owner's "integration becomes the
  engine's conformance problem" strategy — but it rests on the fake being maintained as a
  truthful mirror of the real wire, a standing commitment, not a one-time proof. This is the
  significance question the entire stage's value rests on; it needs conscious human affirmation
  at the finish, not silent inheritance.

## What archive inherits

Verdict `delivered`; two conscience questions open for the owner. If the owner affirms both
(or overrides with reason persisted to `sdd/stage-1-ir-bedrock/outcome-override`), archive
proceeds. Verify's three cosmetic followups (draft→signed spec-status normalization, spy-helper
dedup, design §4.5 ADR-status label alignment) remain non-blocking and route to sdd-archive /
pending-changes as already recorded.
