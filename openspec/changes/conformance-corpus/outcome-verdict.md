# Outcome Verdict — conformance-corpus (Steward Reckoning)

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Verdict**: `delivered` · **Triage**: L
**Held against**: the ORIGINAL `problem_statement` (triage) + the North Star memo — NOT the spec.
**Delivered state**: branch `feat/conformance-corpus`, range `6db2f5e..caff939` (10 commits).

## Our objective was THIS

> The engine repo (`sdk-live-conformance` / PC-PROTO-02) is BLOCKED on M1 until this SDK repo
> lands a conformance fixture corpus under `conformance/` at repo root on `main`, consumed as a
> pinned git submodule and driven through the REAL runner via its Go harness — replacing the
> in-repo fake as the thing SDK↔engine validation runs against. Hurting: the engine team (blocked
> milestone) and both repos (fake/engine fidelity gaps go undetected). Why now: handoff landed, M1
> is current.

## Did we deliver it? Show me WHERE

Yes — the corpus exists, runs, and is truer to the runner than the handoff text it came from.

| Objective element | Where it landed | Evidence |
|---|---|---|
| `conformance/` at repo root, all 5 fixtures | `conformance/{m1-vehicle,m2-modify,m2-delete,m2-rename-move,m2-create-composition}` each with `manifest.json`/`factory.ts` + seed/expected/schematic | tree listed; 35/35 REQs COMPLIANT (verify-report) |
| PR#1 = m1-vehicle isolated to unblock M1 alone | `corpus.json` `fixtures === ["m1-vehicle"]` at PR#1 head `e28c7b6` | byte-verified (REQ-CCR-03.1 PASS) |
| Corpus actually RUNS through the runner (not just lands) | `collection.json` package-anchor (ADR-0067) — the insight the handoff never mentions; without it every fixture exits 1 before its factory runs | design trace + fit-40 |
| Fail-closed incremental delivery | `corpus.json` lists only landed fixtures per slice; commit-atomicity gate | REQ-CCR-04.1 PASS (no orphan-listing commit) |
| Fidelity self-proof (internal consistency, not engine behavior) | `fit-40` + `.negative.test.ts` proving every fail-closed branch actually fires | 2033 pass / 0 fail; byte-oracle reproducible across 2 passes |

The place that resolves the pain is concrete and pointable: the engine engineer advances the
submodule pin, the Go loader reads `corpus.json`, the runner resolves `conformance/` as
`packageRoot` via `collection.json`, and drives `m1-vehicle`'s factory through the REAL runner —
the first real-SDK-through-real-runner exercise, replacing the fake. That is the M1 unblock, and it
is not hypothetical.

## Is it usable / significant? — ESCALATED questions, already RULED

These are the human-only calls the AI does not fake. All three already carry owner rulings /
empirical evidence; none is re-opened here:

- **Usable? (foresight Q1 / CQ-1)** — "is a declaration-only corpus usable to unblock M1?" —
  **RULED** (CQ-3, 2026-07-19): ship now; engine-side M1 confirmation is an external, NON-GATING
  followup. The honesty boundary (REQ-CFX-11: every exit code/transcript is a DECLARATION,
  engine-proven-later, never SDK-proven-now) is honored in the README and enforced by the ruling —
  "self-check green" is NOT being allowed to masquerade as "the engine will produce these bytes."
- **Significant? (CQ-2)** — the definitive, empirical answer: the corpus's FIRST live contact with
  the engine **already caught a real shipped-dist SDK bug** (dual-ALS / context-singleton),
  remediated as change `context-singleton-fix` (PR #40). The fake↔engine fidelity gap named as the
  original pain is precisely what this surfaced — on first contact, before the full corpus even
  landed. This is outcome, not output. Not ceremony.
- **Cross-repo coordination (foresight Q2 greeting-twin + Q3 ADR-0065 loader ownership)** —
  both engine gates resolved / signed off (handoff commit `c80fd7d`: "ADR-0065 case-level factory
  ACCEPTED by engine, strict-decoding clause added"); residual engine-owned cleanup assumptions
  fold into the same engine-proven-later, non-gating posture.

## Did we drift? (promise vs delivery)

No drift. The delivery matches the North Star promise element-for-element:

- **Two-PR shape** — promised PR#1 (m1-vehicle + scaffolding, unblocks M1) then PR#2 (four m2-*).
  Delivered exactly: `corpus.json` grows fail-closed, byte-verified at PR#1 head. Owner-ratified
  delivery shape — PR#1 (#39) open now, PR#2 (m2 set) opens post-archive. The reckoning judges the
  branch's delivered whole (all 5 fixtures on `feat/conformance-corpus`), which is complete.
- **Truer-than-the-ask** — the memo promised the corpus would be truer to the runner than the
  handoff (collection.json marker, corrected twin transcripts, escalated ADR-0065 schema delta).
  Delivered: ADRs 0063-0067 followed; twins frozen to the ADR-0064 emit-branch; the schema delta
  was escalated and engine-accepted, not silently drifted.
- **Honesty boundary carried** — the memo's explicit warning ("the reckoning must not let
  'self-check green' masquerade as 'the engine will produce these bytes'") is respected by the
  CQ-3 ruling keeping engine confirmation external and non-gating. The boundary was honored, not
  quietly crossed.

## Outputs-without-outcome check

Negative — decisively. The single strongest signal a purpose steward can receive is that the
artefact moved the needle on the stated pain before anyone declared it done. The corpus did:
it caught a real, shipped SDK defect on first engine contact. A green suite over a useless fixture
would be a polished irrelevance; this is the opposite — a fixture that earned its existence
immediately.

## Verdict

**`delivered`** — the result solves the stated problem, its usability is owner-ruled ship-now with
engine confirmation as an explicit non-gating followup, and its significance is proven empirically
(dual-ALS bug caught on first contact). Archive may proceed on the delivered whole. No new
conscience questions.

## Archive preconditions (from the North Star) — status

1. **Spec V3 re-signed** — SATISFIED (verify-report: "V3 SIGNED"; design.md carries the
   `> **RESOLVED**: V3 RE-SIGNED` gate annotation).
2. **PR#2 engine sign-off for ADR-0065** — RESOLVED (`c80fd7d` engine-accepted). PR#1/M1 unblock
   was never contingent on it.
3. **Greeting-twin empty-vs-pre-staged assumption** — folded into the engine-proven-later /
   non-gating posture per the CQ-3 ruling; engine-owned, not an SDK archive blocker.
