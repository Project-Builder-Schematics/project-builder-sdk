# North-Star Memo — stage-3-dry-run-exposure (FORESIGHT)

**Checkpoint**: steward foresight (post-design, pre-slice) · **Verdict**: `aligned` (AI-judgeable
dimensions) — **gate does NOT pass until the owner answers the conscience questions below.**
**Date**: 2026-07-06

## The problem we are chasing (north reference)

Schematic authors cannot see what their run will emit before it happens. The pure renderer
(`src/dry-run/plan.ts`) is complete but DEAD CODE — nothing exports it, nothing feeds it from the
`Session`. Objective O2 coverage line 5 promises: *"The author can see the plan of what they are
about to emit (dry-run) before it happens."*

## What we will do (and how it fits)

Three moves, no new layer, `Session`/`context.ts` untouched:

1. **`dryRun(): DryRunEntry[]`** — zero-arg ambient accessor added to `./commons`, wiring the
   existing `currentContext().session.pendingSnapshot()` → the existing `dryRunPlan` renderer.
   Matches the idiom every author verb already uses.
2. **Vocabulary conformance** — `plan.ts` renders the AUTHOR verb for every op (`remove`, never
   wire `delete`) via a frozen local 6-row map. This CORRECTS a pre-existing spec violation, not
   a new feature.
3. **Exposure plumbing** — additive named export from `./commons` (no new subpath, ADR-0014),
   `.d.ts` baselines regen, FIT-09/FIT-04/no-import stay green; `DryRunEntry.verb` narrowed to a
   local `DryRunVerb` union for author exhaustiveness.

## Result → problem map (every deliverable traces)

| Deliverable | Traces to |
|---|---|
| `dryRun()` accessor | makes the dead renderer reachable — the core of the pain |
| delete→remove vocabulary fix | "in their own vocabulary" (end-state) — no wire tags leak |
| additive export + `.d.ts` regen | the accessor actually resolves from the package |
| `DryRunVerb` narrowing | O2 DX — compile-time exhaustiveness for the author's `switch` |
| ADR-0026 outside-run JSDoc compensation | honesty about a known message-omission, not a silent ship |

No orphan outputs. Scope is tight (exactly plan items 3.1/3.2/3.3); no drift into Session/attribution
(stage-2's lane). No problem-drift.

## The outcome we are chasing — and the crux tension

The design delivers **"see the STILL-PENDING directives at call time."** O2 line 5 promises
**"see what you are about to emit before it happens."** These coincide for **write-only factories**
(the plan's primary case: nothing flushes until run end, so `dryRun()` at the body's end shows the
FULL plan — outcome met). They DIVERGE for any factory that `read()`s (or later opens a dialect
handle) before calling `dryRun()`: `read()` flushes `#pending` (ratified, session.ts:33-36), so
pre-read directives are already EMITTED and absent from the snapshot — the author sees only the
pending TAIL, not the full run plan.

This is NOT a design defect introduced here: given the eager-flush architecture (ADR-0008,
read-after-write consistency), there is no point mid-run where the full plan is simultaneously
buffered. Including already-flushed directives would answer "what has this run emitted in total" —
which the spec correctly rejects as dishonest for a "what will I still emit" question. The accessor
is therefore the **honest maximum** given frozen architecture. Whether that maximum is a
*significant/usable* fulfillment of O2 line 5 is a human-only judgment — escalated below, gating.

## Conscience questions for the owner (gate blocks until answered)

- **CQ-1 (crux — temporal significance)**: Is "pending tail at call time" a usable, significant
  fulfillment of O2 line 5, or does the owner consider a *full-run-plan* view essential? If
  essential, the accessor shape being **semver-frozen now** will not deliver it — adjust the O2
  line-5 claim / end-state narrative before the freeze rather than after.
- **CQ-2 (demo-moment survivability)**: The end-state's canonical demo interleaves *"adds an import
  to an existing module via the dialect"* (requires reading the module → flush) BEFORE *"shows its
  dry-run plan."* With this accessor the earlier `create` is already flushed at that point, so the
  demo's dry-run would show a PARTIAL plan. Confirm the demo is expected to survive this shape, or
  restructure it to call `dryRun()` before any read/dialect-open. (Note: every REQ example and the
  JSDoc `@example` deliberately use `find().remove()` — which does not read — sidestepping the
  flush; the interleaving case is real but untested by design.)
- **CQ-3 (shape-level significance)**: The plan is `{ verb, path }` only — no content/byte preview.
  Is a shape-level plan enough for the author's real "what will my run emit" need? (Spec scopes
  content out as an invariant breach; confirm shape-level is significant enough for O2 line 5.)

## Journey simulation notes

- **Write-only factory** (buffer, then `dryRun()` at end): delight — full plan, author vocabulary.
- **Read-interleaving factory**: surprise — plan shows only the post-last-flush tail (honest per
  JSDoc temporal contract, but contrary to the naive "see everything I'll emit" mental model).
- **Outside a run**: honest — propagates `currentContext()`'s throw; message doesn't name `dryRun`
  (compensated by JSDoc `@throws` + ADR-0026 followup).
- **Author wanting content preview**: shape-level only; JSDoc states the guarantee.
