# ADR-0053: Transport Home `src/transport/` + FIT-10 Allow-List +1

**Status**: Accepted · **Date**: 2026-07-16 · **Change**: stdio-engine-client

## Context

`StdioEngineClient` is the first real `EngineClient` implementation. FIT-10 guards the
`EngineClient` port with a one-entry path allow-list (until now, "the one legitimate
implementer" was purely theoretical) — framed as guarding a spoofable structural shortcut,
not one more reviewed path. Landing the transport cluster in `src/core/` would be zero-churn
but reverses ADR-0035 (which relocated `ContractFake` out of core-adjacent code to keep
`src/core` pure choreography).

## Decision

Land the transport cluster (client, framing, reader, runner, bridge, probes) in a new
`src/transport/` leaf. Extend FIT-10's allow-list by EXACTLY one path
(`src/transport/stdio-engine-client.ts`), with a red-proof update proving the widened list
still catches an unrelated bleed.

## Consequences

**Positive:**
- `src/core` stays pure choreography; the transport cluster is independently testable.
- Enables the engine-integration seam to grow without polluting choreography.

**Negative:**
- A new top-level directory plus a reviewed guard edit (deviates from the architecture
  baseline; triggers a post-build baseline refresh).

## Alternatives Considered

1. **`src/core/`** — Rejected: reverses ADR-0035, hides transport beside pure choreography.
2. **Structural `implements` exemption** (skip the allow-list entirely) — Rejected upstream
   as spoofable; a structural check alone cannot distinguish an intentional implementer from
   an accidental one.

## Related ADRs

- ADR-0035: `ContractFake` relocation (the boundary this decision deliberately does not
  reverse for the core side, only extends on the transport side).

## Origin

Promoted from design section 4.5 (ADR-01) of change `stdio-engine-client` (2026-07-16).
Signed spec version V4. Verified by `sdd-verify --mode=final` (pass-with-followups) and
judgment-day (APPROVED, round 2). REQ coverage: SEC-01 (port conformance).
