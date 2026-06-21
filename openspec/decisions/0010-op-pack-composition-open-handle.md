# ADR-0010: Op-pack composition — the handle is open, composed via `defineOpPack`

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Amends: ADR-0004 (the sealed per-dialect subclass is replaced by an OPEN handle; the State
  discriminant is retained), ADR-0003 (a dialect's `find` returns an open `Handle<State, Ast, Ops>`).
- Builds on: ADR-0009 (the contributor kit); engine design.md §2.1 (module-as-registry).

## Context

ADR-0004 modelled the handle as a `BaseFileHandle` **subclass** per dialect. A subclass is **sealed** —
a third party cannot add ops to a handle they don't own. Extensibility requires **composable op-packs**
("AST armados"): the community shares named-op collections on a base AST. Sealed and composable cannot
both be true.

## Decision

The handle is **open**. Ops compose at the **value level** and the types intersect:

- An op is `(ast: Ast, ...args) => void`. An **op-pack** (`defineOpPack`) is a record of named ops over
  one AST type.
- A dialect composes packs with `withOps(base, ...packs)`; the handle type is `Handle<State, Ast, Ops>`
  where `Ops` is the **intersection** of all attached op maps. Each op returns the same enriched
  handle, so chaining holds; an op from an unattached pack, or a typo, is a **compile error**.
- The **State discriminant from ADR-0004 is retained** (`FoundHandle` has `remove`; `WritableHandle`
  does not; the chaining state machine survives). What changes is the *dialect* axis: from a sealed
  subclass to a composed `Ops`.
- **Rejected alternatives:** subclassing (sealed); runtime mixins (fragile N-pack typing, poor
  chain-return inference); declaration merging (global/ambient — two packs adding `addImport` collide
  program-wide; that IS the cross-surface bleed ADR-0009 forbids).

## Consequences

- A community op-pack = the `ops` slot extracted and shipped; it composes onto a base dialect via
  `withOps`. **Module-as-registry**: exporting a pack publishes it (mirrors ADR-0003's "importing is
  selecting").
- Naming: `OpPack` / `defineOpPack` (rejected: `ConfiguredAst` / `Preset` / `Recipe` — they freeze
  internals or the wrong mental model).
- Op-name collisions across packs resolve to an incompatible intersection; a readable diagnostic + a
  documented "packs own disjoint op names" convention is required.
- The contributor never writes a handle subclass — `defineDialect` generates the handle from the three
  slots (`extensions`, `ast: { parse, print }`, `ops`).
