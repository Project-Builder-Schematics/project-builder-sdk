# Outcome Verdict — stage-3-dry-run-exposure (RECKONING)

**Checkpoint**: steward reckoning (pre-archive, backward-looking) · **Verdict**: `delivered`
**Date**: 2026-07-07 · **Commits**: 36d3a65 (S-000), c371afc (S-001), 1ecf645 (S-002)

## Our objective was THIS

O2 coverage line 5 (ratified problem statement): *"The author can see the plan of what they are
about to emit (dry-run) before it happens."* Local pain (triage): the pure renderer
`src/dry-run/plan.ts` was complete but DEAD CODE — nothing exported it, nothing fed it from the
`Session`. North Star promised three moves, no new layer, `Session`/`context.ts` untouched.

## Did we deliver it? WHERE

| Problem-statement pain | Shipped artifact that relieves it | Status |
|---|---|---|
| Renderer unreachable (dead code) | `dryRun(): DryRunEntry[]` zero-arg ambient accessor, `src/commons/index.ts` — wires `currentContext().session.pendingSnapshot()` → `dryRunPlan` | RELIEVED |
| Author would see wire tags, not their own vocabulary | `plan.ts` frozen `WIRE_TO_AUTHOR_VERB` map renders `delete`→`remove`, identity elsewhere; proven by e2e `find().remove()` → `{ verb: "remove" }` | RELIEVED |
| Accessor must resolve from the package | Additive named export; present in public baseline `commons.index.d.ts:135` AND root `index.d.ts` (via `export *`) — reachable from `@pbuilder/sdk` and `@pbuilder/sdk/commons`; `package.json#exports` unchanged (`[".","./commons","./conformance"]`) | RELIEVED |
| Author needs compile-time exhaustiveness | `DryRunEntry.verb` narrowed to local `DryRunVerb` six-member union | RELIEVED |
| Silent omission would be dishonest | Outside-run `@throws` JSDoc names the ADR-0026 followup; no silent ship | RELIEVED |

No orphan outputs. Every deliverable traces to the stated pain.

## User-journey simulation (executed, not asserted)

- **Write-only factory** (`create` + `modify`, then `dryRun()`): e2e green — returns
  `[{verb:"create",path:"src/a.ts"},{verb:"modify",path:"src/b.ts"}]` in author vocabulary.
- **Remove journey** (`find().remove()` then `dryRun()`): e2e green — `[{verb:"remove",path:"src/gone.ts"}]`,
  never `delete`. The wire tag does not leak to authors.
- **Discoverability**: defining-site JSDoc carries in-run `@example`, the temporal contract
  (still-pending only; empties after `read()`/flush), and the shape-level guarantee.
- **Reachability**: 25/25 dry-run tests pass; `.d.ts` baselines byte-consistent; the symbol is in
  the frozen public contract.

The dead renderer is now a reachable, discoverable, useful author surface. Outcome met.

## Promise ↔ delivery drift vs the North Star (foresight memo)

No drift. All three foresight moves landed verbatim:
1. `dryRun()` ambient accessor in `./commons` — DELIVERED.
2. Vocabulary conformance via frozen local map (`remove`, never wire `delete`) — DELIVERED.
3. Additive export + `.d.ts` regen + `DryRunVerb` narrowing — DELIVERED.
Plus the ADR-0026 outside-run `@throws` compensation — DELIVERED.

Scope held: `src/core/context.ts` and `src/core/session.ts` are absent from the diff range; commons
edit appended at file END; no drift into Session/attribution (stage-2's lane).

## The affirmed foresight conscience questions — were the rulings HONORED?

The three human-only significance questions were escalated at foresight and **owner-affirmed**;
reckoning's job is to confirm the delivery honored those rulings, not re-litigate them.

- **CQ-1 (temporal significance)** — affirmed: "pending tail at call time" IS the ratified O2
  line-5 fulfillment under the frozen eager-flush architecture. **Honored**: the accessor renders
  `pendingSnapshot()`; JSDoc states the honest "what will this run still emit" contract verbatim.
- **CQ-2 (demo-moment survivability)** — affirmed: the interleaving-demo restructure is a
  registered followup for Stage 5/6. **Honored**: no attempt to solve the read-interleaving case
  here; `@example` deliberately uses non-reading verbs, consistent with the deferral.
- **CQ-3 (shape-level significance)** — affirmed: `{ verb, path }` shape-level plan IS the
  contract. **Honored**: `DryRunEntry` unchanged; JSDoc states "no content or byte preview."

All three affirmed rulings are honored in what shipped. The usable?/significant? axis for this
change was settled by the owner at foresight and remains satisfied — no NEW human-only question
survives that the affirmed CQs do not already cover.

## Conscience questions (escalated, gating)

None. The three foresight conscience questions were owner-affirmed and are honored by the delivery;
re-raising them would be ceremony, not conscience.

## Verdict

`delivered` — the change makes the previously-dead dry-run renderer a reachable, discoverable,
author-vocabulary surface that fulfills O2 line 5 to the honest maximum the frozen architecture
allows, exactly as the owner ratified at foresight. Archive may proceed.
