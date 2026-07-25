# ADR-0076: Constraint 4 Is an Outright Ban on `createRequire` in the Closure, Exempted by Anchor

**Status**: Accepted (amended in implementation — see Amendment) · **Date**: 2026-07-25 · **Change**: `runner-integrity-manifest` (originally ADR-04)

## Context

The integrity lemma is sound about import *edges* and was being used as a claim about executed
*code*. `createRequire(anchor)("./x")` executes unhashed CommonJS with **no import edge anywhere**,
and `createRequire` is **already imported by the closure**
(`src/transport/single-instance-probe.ts`), where only the discipline of calling `.resolve()` keeps
it resolution-only — argued at length in that file's header, i.e. exactly the folklore this exercise
exists to retire.

## Decision

Any `createRequire` **reference** in a closure file is a violation, with a single site exempted by
the same anchor idiom CST-03 uses for the sanctioned dynamic import. The same scan covers `eval`,
`new Function`, `node:vm`, `Bun.plugin` and `process.binding`. `single-instance-probe.ts`'s **logic
is not touched**; it gains one header sentence pointing at the enforced Constraint.

## Rejected

- **Discriminate the call form from `.resolve()` *as the whole mechanism*.** Defeated by one variable
  (`const req = createRequire(u); req("./x")`) and by the namespace form
  (`import * as m from "node:module"; m.createRequire(u)(…)`). A check that passes the direct
  red-proof while letting the real thing through is worse than none.
- **Refactor the probe to remove `createRequire`.** ADR-0057 records that it is the **sole** workable
  mechanism in this Bun version, and any such refactor would break the zero-`src`-diff posture that
  keeps this change `additive`.

## Amendment — how the exemption is decided (implementation, two judgment-day rounds)

The decision above pins the *ban*; it under-specified how the **one exemption** is recognised, and
that gap produced two CRITICAL findings before it closed.

1. **As designed**: the exemption was granted to the first non-import `createRequire` occurrence at
   the anchor file, whatever it did with it. Blind review found this permits *execution*, not just
   resolution — `createRequire(u)("./evil.cjs")` kept the build green.
2. **First fix**: require the exempted occurrence to be the callee of a call whose result is
   immediately `.resolve(...)`d. This is call-form discrimination, which the Rejected list above
   dismissed — legitimately so *as a whole mechanism*, but sound as an extra condition **on top of**
   the identifier ban. Round 2 then found it still evadable: the alias check returned the *first*
   binding, so an unaliased decoy import alongside `import { createRequire as cr }` made the file
   read as unaliased, the decoy consumed the single exemption, and every `cr(...)` execution passed
   as an unrecognised name. Reproduced end-to-end against the real built tree by both judges.
3. **Shipped**: the exemption is no longer *searched for* among whatever the anchor imports — it is a
   shape the anchor must **prove**. Exactly one `createRequire` binding, unaliased, or the exemption
   is forfeit outright and every bound name found becomes denied text. Red-proof:
   `fit-42-runner-closure-integrity.negative.test.ts`, REQ-CST-04.3.

**The lesson is recorded because it outlives this change**: steps 1 and 2 each closed the spelling a
reviewer had imagined, and each left the next one open. Step 3 inverted the burden of proof and is
the first with no obvious successor. Constraint 4 is still enforced by an **AST-shape scanner**, and
shapes have a long tail — `pending-changes.md` registers the mechanism question itself as the parent
of four open rows (R2-5, R1-7, R1-16, R1-17), to be decided before any of them is patched individually.

## Consequences

The exemption is an anchored *site*, so a second `createRequire` inside the probe file still fails.
The ban is broader than the engine's original wording, and the docs page marks Constraint 4
**SDK-added** so cross-repo numbering cannot silently diverge.
