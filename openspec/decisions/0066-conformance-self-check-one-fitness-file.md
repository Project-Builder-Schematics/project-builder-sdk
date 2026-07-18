# ADR-0066: Structural Self-Check as One Fitness File; Typecheck Sweep; Corpus.json-Derived Inventory

**Status**: Accepted · **Date**: 2026-07-19 · **Change**: conformance-corpus

## Context

Self-check depth (owner-endorsed structural-only), placement, tsconfig treatment, wireSpecVersion
pin, and the inventory-count cadence (green at PR#1's 1 fixture AND PR#2's 5/12) were all open
for design to wire.

## Decision

1. ONE new file `test/fitness/fit-40-conformance-corpus-integrity.test.ts` (fit-24/28 idiom), no
   runner spawn — the named fail-closed verifier for REQ-CSC-01..06 + REQ-CDT-03..07 +
   REQ-CFX-01/02/03/04 structural invariants; behavioral runner-replay is a registered followup.
2. NO tsconfig `exclude` for `conformance/**` — factories sweep into `bun run typecheck`, a
   required-green gate proving each factory typechecks against the public umbrella.
3. `wireSpecVersion` pinned by importing the leaf constant `WIRE_PROTOCOL_VERSION`
   (`src/transport/wire-protocol.ts` — a zero-import pure-constants module) and asserting
   `corpus.json` + every manifest equal it (REQ-CCR-07).
4. The inventory check is DERIVED FROM `corpus.json#fixtures` — every listed id has a complete
   landed artefact set AND 0 orphan directories — so it is green at both checkpoints: PR#1
   (`["m1-vehicle"]`, 1 fixture / 2 cases) and PR#2 (5 fixtures / 12 cases). The absolute
   5-fixture/12-case count is asserted only when `corpus.json` lists 5 (post-PR#2 gate); it must
   not be evaluated against the PR#1 state (REQ-CCR-05).

## Consequences

- One discoverable verifier.
- Typecheck catches factory API misuse pre-merge.
- fit-40 stays green at PR#1 without a false 5/12 failure.
- A strict-mode typecheck error in any factory now fails the whole suite.

## Alternatives Considered

1. **Dedicated `test/conformance-corpus/` cluster** — Rejected: breaks the fit-NN idiom.
2. **`exclude` conformance from typecheck** — Rejected: forfeits the free factory-correctness
   gate.
3. **Absolute 5/12 count unconditionally** — Rejected: red at PR#1's legitimate 1-fixture state.

## Related ADRs

- **ADR-0063**: The `conformance/` layer this fitness file validates.
