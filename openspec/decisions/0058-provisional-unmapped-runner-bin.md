# ADR-0058: Provisional Unmapped Runner Bin (`dist/bin`, No `package.json#bin`)

**Status**: Accepted · **Date**: 2026-07-16 · **Change**: stdio-engine-client

## Context

The runner ships inside `dist/` but is engine-spawned or bridge-imported — it is not a user
CLI. Adding a public `#bin` entry is a public-package-surface concern, and this change ships
ahead of the public-package plan.

## Decision

Build to `dist/bin/pbuilder-runner.js`. Add NO `package.json#bin` entry. Leave FIT-14
(package-surface baseline) untouched. Register the `#bin` entry as a public-package-plan
concern, not this change's.

## Consequences

**Positive:**
- No premature public surface; FIT-14's baseline stays stable.

**Negative:**
- The bin is reachable only by path until the public-package plan adds the entry
  (dist/bin build wiring itself is deferred — tracked as followup F-5).

## Alternatives Considered

1. **Add `#bin` now** — Rejected: churns FIT-14 and exposes an unstable CLI pre-1.0.

## Origin

Promoted from design section 4.5 (ADR-06) of change `stdio-engine-client` (2026-07-16),
ratifying settled decision #4. Signed spec version V4. Verified by `sdd-verify --mode=final`
(pass-with-followups, followup F-5 tracks the deferred dist/bin build wiring) and
judgment-day (APPROVED, round 2). REQ coverage: RUN-01..08 (runner entry surface, generally).
