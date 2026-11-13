# 0015 — All-or-Nothing Commit and the EngineClient Transaction Port

**Status**: Accepted
**Origin**: change `l1-author-surface-skeleton` (2026-06-22), ADR-01
**Supersedes**: the partial-write contract documented in `context.ts` (pre-skeleton)

## Context

A factory run buffers author directives and emits them to the engine. The L1 release
contract (program `l1-author-surface`, SEAM-03) requires **all-or-nothing**: a factory that
resolves commits its full batch; a factory that throws commits nothing.

"Don't emit on throw" is impossible. `read()` flushes `#pending` to the engine *before*
delegating to `EngineClient.read()` (read-your-own-writes), so by the time a later line of a
factory throws, directives are already staged at the engine. There is nothing left to
withhold. The all-or-nothing boundary therefore cannot live in an SDK-side "decide whether to
emit" — it must be a transactional **staging → commit / discard** boundary owned by the
engine. The SDK declares that boundary on its transport port and invokes it.

## Decision

1. **The `EngineClient` port carries the transaction boundary.** Beyond `emit(batch)` and
   `read(path)`, the port exposes `commit(): Promise<void>` and `discard(): Promise<void>`.
   These are ADDITIVE — `emit`/`read` signatures are untouched. The engine stages emitted ops
   and commits/discards them transactionally; the real Go client fulfils this at engine §6,
   the contract fake models it now (`#committed` tree promoted only on `commit()`).

2. **`defineFactory` drives the boundary through `Session`, not the client directly.** On
   success: `session.flush()` then `session.commit()`. On throw (or a flush rejection):
   `session.discard()`, then re-throw. `Session.commit()`/`Session.discard()` are thin
   wrappers delegating to `#client`. `Session` is the sole owner of `#client`; calling
   `client.commit()` directly from `defineFactory` would add a `defineFactory → EngineClient`
   coupling that does not exist today. The wrapper keeps transport ownership in one place.

## Consequences

- The release's all-or-nothing guarantee is exercised by a real forced rejection from day one
  (lesson from foundations: lifecycle guarantees are tested, not JSDoc-only).
- `#2`/`#3`/`#4` build against a stable port that expresses the engine's real transactional
  shape, not a leaky `emit`-only port that hides the commit boundary.
- The fake carries a two-phase model the real engine MUST match; it is the conformance anchor
  until engine §6 lands. Divergence is a tracked risk, not a silent one.
- Rollback-by-withholding is permanently off the table for any read-your-own-writes surface in
  this SDK — see lessons-learned.

## Alternatives Rejected

- **Implement a real transaction in `src/`** — invents an engine §6 deliverable the SDK does
  not own.
- **Buffer-and-replay rollback in `Session`** — duplicates transactional semantics the engine
  owns; impossible cleanly once mid-run `read()` has already staged.
- **`commit()` called directly on `client` in `defineFactory`** — adds a direct coupling the
  Session wrapper exists to prevent.
