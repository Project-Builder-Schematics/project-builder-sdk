# Outcome Verdict — stage-2-error-attribution (reckoning)

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Verdict**: `delivered`
**Held against**: the ORIGINAL problem statement (triage.md) + the North Star memo (north-star.md), NOT the spec.
**Evidence basis**: shipped diff `c7c46dd..HEAD` (10 commits) · verify-report.md (pass-with-followups) · a
steward-authored throwaway journey script run against the public surface (scratchpad, outputs below) ·
`bun test` 341 pass / 0 fail, clean tree.

## Our objective was THIS

> An author whose schematic is rejected today cannot tell WHICH verb failed or WHY: `session.ts`
> attributes every rejection to `instructions[0]`, `toAuthoringError` discards the engine's raw
> text by design, mid-chain failures don't report what already applied. This stage FREEZES the
> error contract everything after builds on.

North-star promise: a rejected author catches a real, importable `AuthoringError` and reads — in
author vocabulary with zero engine/fake text — which verb (the ACTUAL offender), why (closed
switchable `reason`), from where (`origin`), what already applied (`appliedCount`), then
`switch(reason)` to drive recovery.

## Did we deliver it? WHERE (result→problem map)

Every stated wound has a shipped closure I can point to and that I exercised live:

| Wound (problem statement) | Shipped closure | Pointed evidence |
|---|---|---|
| Every rejection blamed on `instructions[0]` | `EmitRejection.failedIndex` → `toAuthoringError` indexes the real offender (`src/core/authoring-error.ts:216`) | Journey J1: `create,modify,move` — move at index 2 rejected → `verb:"move"`, `path:"c/util.ts"` (source-side), not create/a.ts |
| Raw engine text discarded → no WHY | Closed `reason` enum (ADR-0020) via `code→reason` map, never message text; fresh message, no `.cause` chain | J1 `reason:"path-collision"`; J3 batch-level `changes-too-large`; whole-object leak scan (own props + cause walk + JSON form) found ZERO fake vocabulary in J1/J2/J3 |
| Mid-chain failures don't report what applied | `appliedCount` threaded from the fake's throw sites | J1 `appliedCount:2`; REQ-15 multi-flush tests pin the per-flush boundary |
| (Latent, north-star wound 4) `AuthoringError` unexported — author can't even `instanceof` | Promoted to `./commons` + umbrella (ADR-0023), with `AuthoringVerb/Reason/Origin` types | J1/J2 `instanceof AuthoringError` through the commons import — works |
| Contract public and FROZEN | Four independent locks: JSDoc MAJOR-on-growth, `toEqualTypeOf` pins (growth AND shrinkage), `originFor` exhaustive never-arm, FIT-04 `.d.ts` pairs — the verify-report's followup 1 (missing `core.authoring-error.d.ts` pair) was actually CLOSED in-change (commit 6c136aa) | `test/types/authoring-reason.test.ts`, `test/fitness/fit-04-dts-semver-gate.test.ts:107-114`, `test/fitness/fit-11-*` |

This is an OUTCOME, not just outputs: the author's recovery loop demonstrably works end-to-end.

## The journey, simulated for real (steward-authored script, not the shipped e2e)

Ran `steward-journey.ts` (scratchpad) against `src/commons/index.ts` + `defineFactory` + `ContractFake`
— the north-star's EXACT scenario plus cases the shipped e2e does not cover. All 26 checks passed:

- **J1** create(A), modify(B), move(C→occupied dest, no force): caught `AuthoringError`; `verb:"move"`,
  `path:"c/util.ts"` (source side per design §4.3), `reason:"path-collision"`, `origin:"write-rejected"`,
  `appliedCount:2`; message `"move failed at c/util.ts: path-collision"`; nothing committed; then
  `switch(reason)` drove a REAL recovery — force-retry re-run succeeded (`lib/util.ts` = source content).
- **J2** verb at module scope: catchable `AuthoringError`, `reason:"outside-run"`,
  `origin:"authoring-rejected"` — distinguishable from J1's `write-rejected` with no internals read;
  message teaches the fix.
- **J3** >4MiB batch: `reason:"changes-too-large"`, `verb`/`path` honestly `undefined`, message never
  prints "undefined".
- **J4** a total `switch` recovery table over all six reasons compiles with NO default arm —
  the closed enum IS the contract, enforced by TS exhaustiveness.
- **J5** `classifyContent`: absent/empty/present trichotomy incl. the `"0"` falsy killer.
- **Leak scan** (author-side, whole object: message, own props, depth-20 cause walk, JSON form)
  against the fake's entire vocabulary dictionary: zero hits in all three rejection shapes.

One script bug on my side (not the SDK's): I first wrote the factory returning a value —
`defineFactory`'s runner resolves `Promise<void>` by Stage-1 contract. Worth noting as author-DX
telemetry, not a defect of this change.

## Promise ↔ delivery drift (north-star CQ-1..CQ-4 commitments)

| Foresight commitment (owner-affirmed) | Held? | Evidence |
|---|---|---|
| CQ-1: partition frozen, 7th reason = MAJOR | **Held, and strengthened** | JSDoc records MAJOR-on-growth verbatim; type pins freeze exact membership; `originFor`/`messageFor` never-arms break the build; FIT-04 now diffs the emitted class shape (6c136aa closed the gap the verify report had deferred) |
| CQ-2: `switch(reason)` IS the contract | Held | REQ-17.1 e2e switch-branch test; every JSDoc @example is switch-based; my J1 switch drove a real recovery; J4 no-default totality |
| CQ-3: 2.4 proof via outside-run substitution (dialect proof travels with Stage 5) | Held, as ratified | REQ-AEC-02.3 contrast test + J1-vs-J2 live contrast; spec V2 status line records the ratification; not quietly reshaped |
| CQ-4: 2.3 bundled as droppable S-004 | Held | Built (not dropped), severable per `commons/index.ts` comment; J5 proves the journey |

No promise was quietly dropped or reshaped. The one narrowing (CQ-3) was ratified twice (spec V2
sign-off + foresight re-affirmation) and delivered exactly as ratified.

## Outputs-without-outcome scan

- No shipped component is correct-but-inert against the stated pain. The heaviest machinery
  (code discriminant, leak scan, exhaustiveness pins) is exactly what makes the WHY safe — the
  invariant this stage exists to freeze.
- **One honest asterisk** (staging, not a gap in this change): the catch-side consumer today is
  whoever calls the runner — and `defineFactory` is kit-internal (ADR-0009; the umbrella exports
  commons only). An external author cannot yet experience this journey outside the repo's harness
  because no public runner/engine exists until Stage 6 — explicitly out_of_scope in triage
  ("any real engine client", "Stage 6 live publish"). The contract correctly front-runs it.
- `appliedCount` is per-FLUSH, not per-run; its JSDoc states diagnostic-not-persistence. Honest
  and documented; noted so nobody later reads it as a persistence promise.

## Conscience questions (escalated — human-only; confirmations, not suspicions)

1. **Freeze consummation (CQ-1, now real).** At foresight you affirmed freezing 6 reasons + 2
   origins before Stages 3/5/6 exercise them. That bet is now CONSUMMATED and quadruple-locked —
   after archive, the 7th reason or any rename is a MAJOR break by your own recorded policy.
   Confirm once more, eyes open, that this partition ships as v1's frozen vocabulary. (Evidence
   is unambiguous that the mechanism works; only you can own the timing bet.)
2. **"Usable" with the runner still kit-internal.** The rejected-author journey is mechanically
   proven end-to-end, but until Stage 6 no external author can reach it through a published
   entry point. Do you accept "usable" as "usable at the contract level, journey proven in-repo,
   public runner staged later per the objectives plan"? (My read: yes — that IS the plan's
   sequencing — but usable-for-whom is your call, not mine.)

No other human-only questions genuinely remain: significance is not ambiguous — this change is the
load-bearing freeze the whole post-Stage-2 plan builds on, not ceremony.

## Notes for archive (non-blocking)

- verify-report.md followup 1 (FIT-04 `DTS_PAIRS` baseline pairs) was completed in-change by
  commit 6c136aa — the archive ledger should record it as DONE, not register it as pending.
- Followup 2 (lessons-learned: characterization vs must-fail-first tagging for data-variant
  slices) remains valid for the ledger.

## Verdict: `delivered`

The shipped code delivers the OUTCOME the problem statement named — attribution without
string-parsing, zero engine-text leakage proven at the whole-object level, a public frozen
contract with real recovery ergonomics — not merely outputs that pass tests. Archive may proceed
once the two confirmation questions above are answered; both are confirmations of already-affirmed
bets, not newly discovered gaps.
