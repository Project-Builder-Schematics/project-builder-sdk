# ADR-0073: `assets/` — Package-Local In-Fixture Source Directory for `copyIn`

- Status: Accepted
- Date: 2026-07-22
- Deciders: Daniel (Hyperxq)
- Related: REQ-CFX-16 (copyIn behavioral contract), REQ-CCR-09 (landing sequence), engine ADR-D (fixtures are SDK-owned)

## Context

The `copyIn` verb copies bytes that live inside the fixture package itself. The corpus loader previously documented only `seed/`, `expected/`, and `schematic/` subdirectories, and the strict JSON decoder in the engine forbids adding a new manifest schema key. The source bytes need a home resolved against the fixture's `packageDir`.

## Decision

Place `copyIn` source bytes in a package-local `assets/` directory (no manifest key required) and reference them as a relative path in the factory's `copyIn(from,…)` call. The Go loader treats unknown files and directories inside a fixture package as inert (engine-confirmed behavior), similar to the posture taken with `collection.json` (ADR-0067). A [SEAM] note is recorded for engine-team awareness.

## Consequences

- (+) Zero schema changes; strict decoder honored; umbrella boundary (REQ-CFX-01) intact.
- (+) No new registry overhead; the convention is purely a file-system layout decision.
- (-) A new fixture-subdir convention that future fixtures must learn and follow.
- (-) Loader-inertness is engine-authoritative — the actual proof comes from the engine harness run at submodule pin-advance, gated by REQ-CCR-09 item 4 and surfaced to the engine team via `CONFORMANCE-CORPUS-HANDOFF.md`.

## Alternatives Considered

- **New manifest `source` key**: Rejected — breaks `DisallowUnknownFields` in the engine's strict decoder.
- **Reuse `seed/` directory**: Rejected — `seed/` is the destination tree's pre-state and has a different resolution root; using it for source bytes would conflate concerns.
- **Corpus-root file**: Rejected — pollutes the `collection.json` package-anchor surface and breaks the per-fixture isolation contract.

## Origin

Promoted from change `copy-copyin-conformance-fixtures` (2026-07-22). See design.md §4.5 (ADR-01).
