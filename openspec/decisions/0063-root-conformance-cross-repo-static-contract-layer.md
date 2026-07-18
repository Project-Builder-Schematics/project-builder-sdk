# ADR-0063: Root `conformance/` as a New Cross-Repo Static-Contract Layer

**Status**: Accepted · **Date**: 2026-07-19 · **Change**: conformance-corpus

## Context

The corpus is a submodule-consumed contract with no baseline analog; the closest shape
(`test/e2e/author-emulation/corpus/`) is SDK-internal under `test/`. Placing it at repo root is
fixed by the engine's loader (accept-as-contract).

## Decision

Introduce `conformance/` at repo root as a net-new architectural layer, kept OUT of
`package.json#files`/`#exports` and out of `dist`; disambiguated from the published
`./conformance` kit via README (REQ-CCR-06).

## Consequences

- Satisfies the engine's fixed submodule path.
- Zero packaging collision.
- A second corpus root in the repo (naming adjacency risk, mitigated by README).
- Triggers the mandatory post-build architecture baseline refresh.

## Alternatives Considered

1. **`src/conformance/`** — Rejected: collides with the ADR-0012 published dialect-conformance
   kit and would enter `dist`.
2. **Under `test/`** — Rejected: the engine's loader path is repo-root-fixed.

## Related ADRs

- **ADR-0012**: Published dialect-conformance kit (`src/conformance/**`) — disambiguated from,
  not superseded by, this decision.
- **ADR-0067**: `collection.json` package-anchor marker — lives inside this new layer.
