# North Star — stage-2-error-attribution (foresight)

**Checkpoint**: foresight (post-design, forward-looking) · **Verdict**: `aligned`
**Held against**: the ORIGINAL problem statement (triage.md), NOT the spec.

## The pain, as stated (our north star)

> An author whose schematic is rejected today cannot tell WHICH verb failed or WHY:
> `session.ts` attributes every rejection to `instructions[0]`, `toAuthoringError`
> discards the engine's raw text by design, mid-chain failures don't report what
> already applied. Why now: Stage 1 landed three rejection families marked
> RAW-UNTIL-STAGE-2.1 — this stage FREEZES the error contract everything after builds on.

The hurting person: the **schematic author** staring at a useless rejection. Three
concrete wounds, all verified live in the source:

1. `session.ts:62` — `throw toAuthoringError(raw, batch.instructions[0]!)` — blames the
   FIRST directive, never the actual offender on a mid-chain failure.
2. `authoring-error.ts` — `AuthoringError` carries only `{verb, path}`, message
   `${verb} failed at ${path}`; `_raw` engine text is discarded → no WHY.
3. No applied-boundary — the author can't tell what the eager fake already applied.
4. (Latent, but fatal to usability) `AuthoringError` is **unexported** — confirmed absent
   from `src/commons/index.ts` and the kit barrel. The author cannot even `instanceof`
   the type they catch. The structured fields would be unreachable without fixing this.

## This is what we're going to do (outcome terms)

A rejected author will be able to catch a real, importable `AuthoringError` and read,
in author vocabulary with zero engine/fake text: **which verb failed** (the ACTUAL
offender, via `failedIndex`), **why** (a closed, switchable `reason`), **from where**
(`origin`), and **what already applied** (`appliedCount`) — then `switch(reason)` to
drive recovery. The message stops lying about `instructions[0]`.

## Here's how it fits (architecture)

No new layer, no port-signature change. Structured metadata threads through the ONE
existing seam (SEAM-04, `Session.flush` → `authoring-error.ts`):
- A port-internal `EmitRejection {code, failedIndex?, appliedCount}` carries the WHY
  through the `emit` rejection channel (the fake sets `code` at each throw site).
- `toAuthoringError` reads the metadata, indexes the real offender, maps `code→reason`,
  derives `origin` via an exhaustive `originFor(reason)` switch, builds one of three
  frozen messages.
- `AuthoringError` + its three type aliases are promoted to `./commons` via the same
  two-step re-export `FoundHandle`/`WritableHandle` already use — author DATA types
  cross the ADR-0009 boundary; kit MACHINERY does not.
Architecture impact: **modifying** (SEAM-04 behavior + `AuthoringError` shape + a new
port convention) — additive on the public surface, no boundary removed.

## Here's the outcome we're chasing (author journey, simulated end-to-end)

Factory does `create(A)`, `modify(B)`, `move(C)` onto an existing path without `force`.
The move is rejected; the run is discarded.

- **Today**: author catches an unexported `AuthoringError`; `.message` = "create failed
  at A" (WRONG offender); no reason, no origin, no applied-boundary. Dead end.
- **After the design, executed perfectly**: author imports `AuthoringError` from
  `@pbuilder/sdk/commons`, `instanceof`-checks it, reads `verb:"move"`, `path:C`,
  `reason:"path-collision"`, `origin:"write-rejected"`, `appliedCount:2`, message
  `"move failed at C: path-collision"`, and `switch(reason)` reaches the `path-collision`
  arm (REQ-17.1 e2e). **The pain is resolved** — which verb, why, and what applied are
  all answerable.

The journey holds. Every stated wound has a design move that closes it.

## Is there a shorter path to the SAME outcome?

Examined and rejected. The heaviest pieces are load-bearing, not gold-plating:
- **Closed `reason` enum + FIT-11 whole-object leak scan** — the mechanism that makes
  the WHY *safe*. A free-text cause (the shorter path) would leak engine vocabulary —
  exactly the invariant THIS stage exists to freeze. Removing it defeats the stage.
- **`code` discriminant on `EmitRejection`** — the V2 QA blocker proved `{failedIndex,
  appliedCount}` alone can't derive 4 of 6 reasons; message-parsing is banned (ADR-0016,
  rejected twice). The code channel is the minimum to classify WHY without parsing text.
- **`originFor` exhaustive switch + type pins** — cheap belt-and-braces that enforce
  "Stage 5 adds producers, not a rename" by construction. Justified because this stage
  FREEZES a contract everything downstream depends on.
The one genuinely separable piece — `classifyContent` (2.3) — the design already isolates
as a droppable final slice. Correct call.

## Outputs-without-outcome scan

No component is correct-but-inert against the stated pain. Two items serve ADJACENT
outcomes and are worth the human's eye (see conscience questions), but both are within
the objectives-plan's scope for this stage and neither dilutes the freeze:
- **2.3 `classifyContent`** serves read-value ergonomics (O2), NOT the rejected-author
  pain — but is explicitly droppable and isolated.
- **2.4 origin taxonomy** freezes a 2-value union that v1 exercises with only ONE
  `authoring-rejected` producer (the `currentContext()` outside-run misuse); the dialect
  producer is Stage 5. The distinguishability MECHANISM is frozen and proven against the
  one producer that exists today.

## Promise ↔ delivery (design vs objectives-plan exists-when)

| Objectives-plan promise | Design delivery | Fit |
|---|---|---|
| 2.1 every verb → verb+path+applied-boundary; whole-object zero-leak scan | REQ-14.2 + `appliedCount` + FIT-11 | match |
| 2.2 (D2) owner ratifies structured cause | ADR-0020 closed `reason` enum | match |
| 2.3 named `=== undefined`/`=== ""` helper, `./commons`-exported | `classifyContent`+`ContentState` (droppable) | match |
| 2.4 taxonomy ADR + test proves origin distinguishable w/o internals | ADR-0021 + REQ-AEC-02.3 contrast | match, **narrowed**: proven vs *misuse*, not *dialect* (dialect is Stage 5; spec V2 ratified the substitution) |

One nuance to re-affirm at foresight (not just at spec-sign): 2.4's plan language says
"distinguish an engine rejection from an SDK-side DIALECT failure"; the delivery proves
distinguishability against the outside-run MISUSE case. The mechanism is frozen and
provable; the dialect-side proof travels with Stage 5.

## Verdict: `aligned`

The design, executed perfectly, resolves the stated pain — result→problem map is clean,
the author journey holds end-to-end, and the weight is earned by the freeze + no-leak
invariant. Proceed to slice. The conscience questions below are human judgment layered on
an aligned design; they inform, they do not halt.

## Conscience questions (escalated — human-only)

1. **Freeze confidence (significance/timing).** This stage freezes the error contract and
   locks "a 7th `reason` is a MAJOR semver break" — before Stage 3 (dry-run), Stage 5
   (dialect/conformance), and Stage 6 (real engine) have exercised it. Are the 6 reasons +
   2 origins the RIGHT partition to freeze NOW? A wrong freeze is expensive downstream.
2. **Usability of `switch(reason)`.** The design bets the author's recovery workflow is
   structured branching on `reason` (the e2e literally switches). Is that the real author
   reflex when a run is rejected, or will they reach for `.message` and never touch
   `reason`? (Lived author experience — your call, not mine.)
3. **2.4 promise-narrowing.** Is proving origin-distinguishability against the one
   available producer (outside-run misuse) enough to call 2.4 "delivered" for this stage —
   or do you want the dialect-side proof to travel with 2.4 (pulling Stage 5 forward)?
   Spec V2 ratified the substitution; re-affirm it at foresight or reopen it.
4. **2.3 scope.** `classifyContent` addresses read ergonomics, not the rejected-author
   pain that defines this change. Bundled by the objectives-plan and droppable. Worth
   carrying in THIS change (adds a public surface + slice), or split so the freeze stays
   pure? Low stakes, your call.
