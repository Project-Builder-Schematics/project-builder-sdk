# ADR-0008: The SDK persists no tree — the engine is the sole source of truth

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Reinforces: ADR-0001 (reads async), ADR-0002 (no shadow; Session buffers), ADR-0006 (one live AST).
  Engine design.md §4 ("flush-before-read REPLACES the SDK shadow").

## Context

A schematic mutates files mid-run and reads them back. The tempting shortcut is a local mirror of the
workspace tree. That mirror would drift from the engine's authoritative staging tree and re-introduce
the two-source-of-truth bug the engine's flush-before-read model exists to kill.

## Decision

The SDK persists **no tree**. The engine (in tests, the contract fake) is the **sole source of
truth** for workspace state. The SDK's complete in-memory state is exactly:

1. `pending: Directive[]` — the write buffer, not yet flushed (bounded by the 4 MiB frame cap, which
   forces a flush);
2. transiently, **one file's AST** held by the coalescer during a single fluent chain (ADR-0006),
   set to `null` and **discarded at flush**;
3. a reference to the `EngineClient`.

There is **no path→content map, no shadow, no tree mirror**. Therefore **every read and every modify
is an engine round-trip**: flush the pending buffer first (flush-before-read), then `EngineClient.read`
(Tree-first, served by the engine). The SDK never answers a read from memory — there is nothing to
answer from.

## Consequences

- Cost: each modify that needs current content is a round-trip. Mitigated by **lazy reads** (a read
  fires only when content is actually needed — ADR-0004) and **write coalescing** (a chain → one
  `modify`, batched — ADR-0006).
- Fitness function: no field in `core/**` or any dialect handle is a collection keyed by path (no
  `Map<path, …>`, no tree type); a `modify`-then-`read` test asserts the read produced a `flush` +
  `EngineClient.read` round-trip (spied), proving the answer came from the engine, not memory.
- Closes the door on a future dialect quietly caching a tree across chains.
