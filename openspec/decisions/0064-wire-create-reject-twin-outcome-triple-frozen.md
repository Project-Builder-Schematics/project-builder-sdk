# ADR-0064: `wire-create-reject-twin` Outcome Triple = Exit 2 / `unrepresentable` / null (Frozen)

**Status**: Accepted · **Date**: 2026-07-19 · **Change**: conformance-corpus

## Context

REQ-CFX-09's design-blocking precondition: does a factory-authored wire `create` get rejected
CLIENT-SIDE before it ever reaches emit (`AuthoringError` → `authoring-rejected` → exit 1), or AT
emit time (engine `unrepresentable` → exit 2)? Resolving it also freezes REQ-CFX-13.4's
dual-branch transcript.

## Decision

**Exit 2.** Traced from the run boundary: `pbuilder-runner` (`src/transport/runner.ts:309-310`)
unconditionally builds `packageDir = dirname(<factory URL>)` and calls `defineFactory(fn,
{packageDir})`; `resolvePackageRoot` (`src/core/context.ts:144-162`) walks upward for a
`collection.json` ancestor — absent one it throws `AuthoringError{invalid-input}` → exit 1
*before* `fn` runs (the REQ-CCR-08 failure, not the twin's rejection). With
`conformance/collection.json` present, resolution succeeds and only then does `fn` run: the
public `create()` verb (`src/commons/index.ts:193-203`) with inline `template` buffers a
representable-at-SDK `{op:"create"}` directive with no pre-emit check; `Session.flush` emits the
batch; `StdioEngineClient` reconstructs the host's batch-level `EmitRejection{code:
"unrepresentable"}`; `unrepresentable` → reason `unrepresentable-content` → origin
`write-rejected` (`src/core/authoring-error.ts:111-114`); `classifyExitCode`
(`src/transport/exit-codes.ts:22-25`) returns 2.

Triple = `(2, "unrepresentable", null)`; transcript frozen to `[ir.emit, ir.discard]` (the
emit-branch of REQ-CFX-13.4).

## Consequences

- The twin's manifest freezes to concrete values, clearing the fail-closed placeholder.
- Lifts REQ-CFX-03 clause (d)'s "ahead of the ADR" hedge — the DO-NOT-COPY header may now name
  exit 2 explicitly.
- Exit-2 is a DECLARATION; first runner-driven proof is engine-side (REQ-CFX-11, honesty
  boundary).
- The whole triple is contingent on `collection.json` (ADR-0067) landing in PR#1.

## Alternatives Considered

1. **Exit 1 (authoring-time)** — Rejected: no SDK layer rejects a representable inline `create`
   pre-emit; the exit-1 path belongs to a MISSING `collection.json` marker (REQ-CCR-08), a
   different failure mode entirely.

## Related ADRs

- **ADR-0065**: Per-case `factory` override — the mechanism that isolates this probe's raw
  `create` authoring from the fixture's positive default export.
- **ADR-0067**: `collection.json` package-anchor marker — its presence is the precondition this
  decision's exit-2 resolution depends on.
