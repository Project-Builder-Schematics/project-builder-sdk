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

## Amendment (2026-07-12, `stage-5b-dialect-breadth`, S-004): `withOps` runtime collision + reserved-name check

**Status**: Accepted (amends Accepted ADR-0010)

**Context**: ADR-0010 promised "a readable diagnostic + a disjoint-names convention" but left
collisions as an incompatible-intersection compile artifact. The kit's `any`-erasure means a
THIRD-PARTY (or fixture) pack collision evaporates at the type level — a runtime test cannot
red-prove a compile error, so the load-bearing proof MUST be runtime.

**Decision**: `withOps` performs an EAGER, synchronous, fail-closed check at composition: (a)
an op name declared by two or more of the passed packs (or colliding with `base.ops`) throws
`op-pack composition failed: duplicate op "{name}"…`; (b) an op name in `RESERVED_HANDLE_NAMES`
(the full base vocabulary — `then`, `read`, `raw`, `modify`, `rename`, `move`, `copy`, `remove`
— superset of the spec's illustrative `then`/`read`/`modify`/`raw`, to prevent silent shadowing
of ANY base verb) throws `op-pack composition failed: op "{name}" collides with a reserved
handle verb`. These compose-time throws are NOT WeakSet-branded (they are minted outside
`dialectError()`), so `#invokeContained`'s `isContained` discriminator never mistakes one for a
deliberate contained reject — and they fire at composition, before any run exists. The DISTINCT
`"op-pack composition failed: "` prefix additionally keeps the two families legible to a reader.
Type-level intersection (REQ-DG-02.1) is unchanged; no type-level collision diagnostic is added
(theatre for the runtime-proven case).

**Consequences**: (+) the deferred diagnostic ships, RED+GREEN, against real `SourceFile` packs.
(+) `then`-shadow (breaks PromiseLike join) is caught. (−) a legitimately-named third-party op
matching a base verb is blocked — acceptable (base verbs are reserved).

**Alternatives considered**: **Compile-time only** — rejected: unprovable against `any`-erased
third-party packs. **WeakSet-brand the compose-time throws too** — rejected: they are not
run-op contained rejects and must never be recognised by `isContained` as passthrough; keeping
them unbranded (and out of `dialectError()`) is what preserves the discriminator's meaning.
