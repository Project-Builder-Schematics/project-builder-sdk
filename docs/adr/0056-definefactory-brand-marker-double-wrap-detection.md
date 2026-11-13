# ADR-0056: Double-Wrap Detection via Brand Marker on `defineFactory`'s Return

**Status**: Accepted · **Date**: 2026-07-16 · **Change**: stdio-engine-client

## Context

RUN-06 requires rejecting an already-`defineFactory`-wrapped export at load time. An earlier
spec revision (V2) dropped V1's arity-sniffing approach because an arity-2 bare factory would
be misclassified (RUN-06.2).

## Decision

`defineFactory` stamps a non-enumerable, non-configurable brand symbol on its returned
wrapper. The runner rejects at load if the resolved export already carries that brand.

## Consequences

**Positive:**
- Arity-independent and robust — detection does not depend on guessing the author's
  function signature.

**Negative:**
- A tiny surface addition to `context.ts` (invisible to callers; the marker is
  non-enumerable).

## Alternatives Considered

1. **Arity-sniffing** — Rejected by the spec (misclassifies an arity-2 bare factory,
   RUN-06.2).
2. **`instanceof` check** — Rejected: the wrapper is a plain closure, not a class instance.
3. **`.toString()` scan** — Rejected: brittle, breaks under minification.

## Origin

Promoted from design section 4.5 (ADR-04) of change `stdio-engine-client` (2026-07-16).
Signed spec version V4. Verified by `sdd-verify --mode=final` (pass-with-followups) and
judgment-day (APPROVED, round 2). REQ coverage: RUN-06.
