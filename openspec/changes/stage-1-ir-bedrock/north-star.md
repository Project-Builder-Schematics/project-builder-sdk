# North Star — stage-1-ir-bedrock (foresight)

**Checkpoint**: foresight (post-design, pre-slice) · **Verdict**: `aligned`
**Change**: `stage-1-ir-bedrock` · **Triage**: L · **Recorded**: 2026-07-04

> The reckoning checkpoint will quote this memo verbatim. It is the promise Stage 1 is
> held against, not the spec.

## 1. This is what we're going to do (in outcome terms)

Freeze the IR bedrock *correct* while it is still cheap to change — before any later stage
semver-locks it. Concretely, when this stage lands:

- The `move` verb carries `force?` on the wire, the factory, and the author surface — so the
  contract is frozen *with* the capability, not frozen absent it (the one expensive-to-reverse
  mistake, per triage).
- Two live correctness bugs stop existing: `move` no longer silently overwrites its
  destination, and `modify` of a missing path no longer silently materializes it. The fake
  fails closed, matching ADR-0017.
- The batch has a *defined* size contract (4 MiB, UTF-8 bytes of the serialized envelope,
  judged at the engine stand-in's `emit` — never in the SDK), a *proven* determinism guarantee
  (same inputs → byte-identical batch), and a fake that *models the wire* (JSON round-trip at
  the seam, so silent value-drops surface as rejections).
- The single `EngineClient` port is guarded *structurally* — bypassing it becomes impossible,
  not merely discouraged — and the four-layer test pyramid is named over the tree with one true
  end-to-end author journey (factory → fake → committed golden tree).

## 2. Here's how it fits

The baseline is a single-layer library behind one IR-seam port (`EngineClient`). This stage
**hardens that seam without adding a layer**: three production edits thread `force?` through the
existing `wire → directive-factory → author-surface` chain; one `context.ts` edit preserves the
original error on a double-fault; everything else lives in the normative counterpart
(`contract-fake.ts`) and the test pyramid. All architecture touchpoints are `aligns` — nothing
deviates from the ADR-0017/0018 seam pattern. Impact is `modifying` (existing fake behavior
changes; the `move` wire shape changes), never `breaking` (surface additions are optional).

## 3. Here's the outcome we're chasing

The hurting person is the schematic author — but not yet, and not directly. Stage 1's outcome is
a **frozen-correct contract** that two parties inherit:

- **Every later stage (2–6)** builds on semantics that are pinned, ratified, and proven against
  a legitimate fake — so error attribution, dry-run, typed options, and dialects each start from
  bedrock they never have to renegotiate.
- **The downstream author** (met at Stage 6) receives a `move` that already has `force?`, an IR
  that is deterministic, and a boundary that fails closed instead of corrupting silently — none
  of which can be retrofitted cheaply once the package is published and semver-locked.

The product of this stage, per the problem statement, is not a shipped feature — it is the
IR-correctness triad itself (golden-IR + unmocked fake + fitness). The pinned contract IS the
outcome. That is why a test-heavy design is faithful here, not evasive.

## 4. The filed question — does it resolve the pain, or just produce correct outputs?

It resolves the pain **for this stage's remit**. Every one of the seven stated pains maps to a
design piece; every Stage-1 objectives-plan bar (O1 rows 1–7, 11) is delivered; later-stage bars
(8/9/10) are cleanly deferred, not annexed. The design even corrected the plan *toward* the
canonical contract (cap enforced at the fake's `emit`, not `Session.flush` — honoring "the SDK
never validates") rather than drifting from it. There is no shorter faithful path: the freeze-now
logic (cheaper now than semver-locked later) was already stress-tested against an XL split.

## What the reckoning must hold the result against

1. **The `force?` freeze is real and additive-only** — FIT-04 confirms the `.d.ts` baseline
   grows by exactly the optional `{force?}` surface, no breakage.
2. **The two live bugs are provably fixed** — a move-collision red-proof and a modify-nonexistent
   red-proof each fail on today's code before the fix; the double-fault RED-PHASE GATE (REQ-10.2)
   fails on today's `context.ts`.
3. **The cap is judged at the fake's `emit`, never in `src/`** — `session.ts` carries zero cap
   code; FIT-09 would catch a leak.
4. **The non-REQ housekeeping actually landed** — the objectives-plan reconciliation (item 1.4 /
   O1-row-6 "at flush" → "at emit", the D8/ADR-0019 row) and the phantom-ADR-0028 → 0013/0017
   citation fixes carry no scenario and nothing in the suite guards their omission. The reckoning
   must confirm by inspection that these edits are present — an untested promise is the easiest
   one to silently drop.
5. **The one true e2e exists and runs** — `test/e2e/author-to-tree.e2e.test.ts` drives a real
   author journey to a golden committed tree; without it, this stage would be contract-pinning
   with no end-to-end proof the pieces compose.

## Conscience questions (escalated — human judgment, not faked)

- **CQ-1 (the freeze-against-fake bet — significant?):** the entire stage confidently freezes
  values against a fake because the real engine does not exist yet. The sharpest concrete case is
  the **4 MiB cap**: ADR-0019 reasons carefully about *unit and encoding* (UTF-8 serialized
  bytes, exactly-at-cap passes) but cites no source for the **value 4 MiB** itself. Is 4 MiB an
  engine-sourced constraint, or an SDK-chosen placeholder? If it is invented, we are building
  elaborate boundary-fixture machinery and semver-freezing a number the real engine may contradict
  — the one way this stage produces "correct outputs" (green fake tests) that later diverge from
  "the outcome that matters" (a contract the engine honors). Low cost to change *now*, which is
  exactly why to confirm it now. This is the owner's deliberate bet ("integration becomes the
  engine's conformance problem") — but the bet should be affirmed consciously, not inherited by
  default.
- **CQ-2 (usable — is the fake a faithful enough stand-in?):** the problem statement asserts the
  fake is "a legitimate counterpart, not a stopgap." That is a claim about lived reality no test
  in this stage can prove: does pinning semantics against `contract-fake.ts` genuinely de-risk the
  eventual real-engine integration, or does it risk pinning the *fake's* behavior as if it were
  the engine's? The steward's suspicion: this is sound *given* the owner's strategy, but it rests
  on the fake being maintained as a truthful mirror of the real wire — a standing commitment, not
  a one-time proof. Human affirmation requested.
