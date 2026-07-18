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

## Amendment (2026-07-18)

The `dist/bin` build wiring half of followup F-5 landed early: engine integration needs a
spawnable `dist/bin/pbuilder-runner.js` (the engine invokes it by absolute path). The entry
moved from `bin/pbuilder-runner.ts` to `src/bin/pbuilder-runner.ts` so `tsc` emits it as a
THIN module resolving against the sibling `dist/transport/*.js` files — never a
self-contained bundle, which would ship a second copy of the `runner.ts` composition root.
FIT-14's tarball baseline gained the one new entry; the decision's core holds: still NO
`package.json#bin` entry — that half of F-5 remains deferred to the public-package plan.

## Origin

Promoted from design section 4.5 (ADR-06) of change `stdio-engine-client` (2026-07-16),
ratifying settled decision #4. Signed spec version V4. Verified by `sdd-verify --mode=final`
(pass-with-followups, followup F-5 tracks the deferred dist/bin build wiring) and
judgment-day (APPROVED, round 2). REQ coverage: RUN-01..08 (runner entry surface, generally).
