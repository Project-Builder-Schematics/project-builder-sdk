# ADR-0011: Ambient run-context via AsyncLocalStorage

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0002 (Session/EngineClient), ADR-0003 (path-only author verbs), ADR-0008 (no tree;
  reads round-trip).

## Context

Author ergonomics require path-only verbs — `find("x.ts")`, `create(...)` — with no context argument
threaded through every call (ADR-0003). But the verbs need a `Session` + `EngineClient`, and that
context is **per-run**, not global (concurrent runs, test isolation). How does a free-function verb
reach its run's context?

## Decision

An **ambient run-context**, scoped per run via `AsyncLocalStorage` (NOT a module global).

- The host builds `RunContext = { session, factory }` with the appropriate `EngineClient` — the real
  IPC client in production, the **contract fake** in tests — and activates it around the factory
  invocation (a `defineFactory` wrapper).
- `find` / `create` read the **active** context; `currentContext()` **throws outside a run**
  (fail-loud, never a silent write-to-nowhere).
- AsyncLocalStorage survives `await` boundaries — required because reads are async (ADR-0008) and a
  chain may suspend mid-run.

## Consequences

- The path-only author surface (ADR-0003) is preserved — "import and use", no context threading.
- The contract fake is injected at `RunContext` construction → the whole SDK is testable without a real
  engine (the verbs never know which `EngineClient` they got). This is what makes ADR-0007's "the fake
  replaces the spike" mechanically possible.
- `flush` stays internal to `Session` (never on the author surface).
- Per-run scoping (not a process global) keeps concurrent runs and test isolation correct.

## Amendment (2026-07-12, `schematic-local-files`) — `packageRoot`/`packageDir` fields

`RunContext` gains two run-boundary-seeded fields, `packageDir` (resolution anchor) and
`packageRoot` (the `collection.json` containment ceiling), seeded ONCE in `defineFactory`
at the pre-`als.run` chokepoint — the same "seed once at run boundary" pattern the
`dialects` registry (ADR-0037) already uses. See ADR-0046. The ambient-context invariant
(per-run, not global; `currentContext()` throws outside a run) is unchanged; these are
additional read-only per-run facts the scaffold leaf consumes via `currentContext()`.
