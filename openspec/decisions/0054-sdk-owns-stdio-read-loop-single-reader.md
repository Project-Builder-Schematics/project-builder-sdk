# ADR-0054: SDK Owns the Raw Stdio Read Loop Post-`ready` (Single Reader)

**Status**: Accepted · **Date**: 2026-07-16 · **Change**: stdio-engine-client

## Context

Exploration's Open Question 1 left the read-loop boundary open: does `StdioEngineClient` do
its own stdio I/O, or does it receive already-framed callbacks injected by the engine? An
earlier revision of the wire design rejected engine-initiated bidirectionality outright.

## Decision

Under the settled Shape C (sequential, host-initiated), the SDK owns everything
post-`ready`: `frame-reader.ts` owns the single async reader over fd 0, and `framing.ts` owns
the single writer over the captured fd 1. The engine bootstrap hands off in-process (via the
bridge) and does NOT remain an in-process framing intermediary.

The prior rejection of engine-initiated bidirectionality no longer applies as originally
worded — the adjudication inverted trust: the host is now the trusted initiator, and the
runner issues only 4 *allowlisted* reverse callbacks (WPS-05). This is a gated inversion, not
open bidirectionality, and does not reopen the earlier rejection.

## Consequences

**Positive:**
- Exactly one reader gives structural fault attribution (SEC-08).

**Negative:**
- The SDK must own frame reassembly itself (SEC-10 — split/coalesced/partial-frame
  handling).

## Alternatives Considered

1. **Engine-injected framed callbacks** — Rejected: re-couples the in-process boundary the
   bridge handoff just cleanly severed.

## Origin

Promoted from design section 4.5 (ADR-02) of change `stdio-engine-client` (2026-07-16),
resolving explore Open Question 1. Signed spec version V4. Verified by `sdd-verify
--mode=final` (pass-with-followups) and judgment-day (APPROVED, round 2). REQ coverage:
WPS-05, SEC-08, SEC-10.
