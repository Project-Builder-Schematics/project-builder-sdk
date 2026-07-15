# ADR-0055: Sequential Single-In-Flight, Single Pending Slot, No Pending-Map

**Status**: Accepted · **Date**: 2026-07-16 · **Change**: stdio-engine-client

## Context

The Go host keeps an ID-keyed pending map for *host* concurrency (its own `sidecar.go`), but
the SDK-side runner runs exactly one factory per process (WPS-09), and the corresponding
engine sidecar skeleton already blocks per callback. Introducing a pending-ID map on the SDK
side would add complexity that no SDK-side concurrency need justifies.

## Decision

One pending slot per reverse callback. A second run-entry invocation rejects immediately with
`OverlappingRunError` (SEC-02); the first run is unaffected. Commit/discard remain advisory
intents the engine owns (an amendment to ADR-0015, with no choreography code change).

## Consequences

**Positive:**
- No pending map to maintain; overlap fails loud instead of silently queueing or
  corrupting state.

**Negative:**
- No host-side pipelining (explicitly out of scope for this change).

## Alternatives Considered

1. **ID-keyed pending map** — Rejected: unneeded complexity for a single-run process;
   contradicts the sequential wire clause the design settled on.

## Related ADRs

- ADR-0015: commit/discard advisory-over-wire semantics (amended, no code change to the
  choreography itself).

## Origin

Promoted from design section 4.5 (ADR-03) of change `stdio-engine-client` (2026-07-16),
ratifying settled decision #2. Signed spec version V4. Verified by `sdd-verify --mode=final`
(pass-with-followups) and judgment-day (APPROVED, round 2). REQ coverage: SEC-02, WPS-09.
