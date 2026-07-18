# ADR-0067: `collection.json` Package-Anchor Marker — Single Shared Ancestor

**Status**: Accepted · **Date**: 2026-07-19 · **Change**: conformance-corpus

## Context

`src/transport/runner.ts:309-310` unconditionally passes `packageDir` to `defineFactory` for
every fixture; `resolvePackageRoot` (`src/core/context.ts:144-162`, ADR-0046) walks upward for a
`collection.json` ancestor and throws `AuthoringError{invalid-input}` (exit 1, before `fn`) when
none exists. The handoff never mentions this file — without it every runner-driven fixture
invocation fails before its factory runs, silently defeating the corpus.

## Decision

Ship a SINGLE `conformance/collection.json` at the corpus root (the shared ancestor of all
fixtures), presence-only (content ignored, never parsed). Consumption direction: corpus (data) →
runner (`resolvePackageRoot`) → core — the SDK reads it, never the engine's Go loader
(engine-loader-invisible, flagged for engine awareness). REQ-CSC-02 asserts its presence once per
self-check run; REQ-CCR-03 lists it as PR#1 scaffolding.

## Consequences

- Every fixture resolves `conformance/` as its `packageRoot`.
- One file, one File-Changes row, one self-check assertion.
- An SDK-side coupling absent from the outbound handoff — documented as a cross-repo awareness
  item (changes nothing engine-side).

## Alternatives Considered

1. **Per-fixture `collection.json`** (mirroring the `test/fixtures` per-fixture precedent) —
   Rejected: 5 identical marker files vs 1 shared ancestor, more bytes and more determinism
   surface for zero benefit since `resolvePackageRoot` stops at the FIRST ancestor and
   `conformance/` already is one.
2. **Omit it and let the engine add it** — Rejected: it is an SDK-runner precondition, the SDK
   owns it.

## Related ADRs

- **ADR-0046**: `resolvePackageRoot` package-anchor resolution — the mechanism this marker
  satisfies.
- **ADR-0063**: The `conformance/` layer this marker lives at the root of.
- **ADR-0064**: Depends on this marker's presence for its exit-2 resolution to hold.
