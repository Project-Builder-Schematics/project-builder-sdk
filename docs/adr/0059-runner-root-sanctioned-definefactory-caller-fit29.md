# ADR-0059: Runner Root Is a Sanctioned `defineFactory` Caller — FIT-29 Allow-List +1

**Status**: Accepted · **Date**: 2026-07-16 · **Change**: stdio-engine-client

## Context

RUN-05 requires the runner composition root (`src/transport/runner.ts`, per ADR-0053) to wrap
the resolved bare factory using the internal `defineFactory`. The pre-existing production
fitness function `fit-29` confines `defineFactory`-binding imports to
`ALLOWLISTED_ROOTS = [src/core, src/testing, src/conformance]` (scan surface `src/**` +
`bin/**`), so `runner.ts` importing `defineFactory` is flagged as unsanctioned. This is not a
re-open of the plan-verify iteration-2 "fit-29 untouched" ruling — that resolved a
fitness-numbering collision only; the pre-existing guard blocking RUN-05's specified path was
never separately adjudicated until this change. `context.ts`'s own `@internal` note already
names "the future production runner" as a legitimate wrapper of this seam — `runner.ts` IS
that runner.

## Decision

Extend `fit-29`'s `ALLOWLISTED_ROOTS` by EXACTLY one path — the FILE `src/transport/runner.ts`
(not the whole `src/transport/` directory) — mirroring ADR-0053's FIT-10 +1 treatment, with a
red-proof that a planted `defineFactory` import from an unrelated transport file
(`src/transport/framing.ts`) is STILL flagged. `runner.ts` imports `defineFactory` directly
from `../core/context.ts` — the same sanctioned-caller idiom `src/testing/index.ts` and
`src/conformance/index.ts` already use (fit-29's own positive controls), never through the
barrel.

## Consequences

**Positive:**
- Honors fit-29's intent: `defineFactory` stays confined to named sanctioned callers, and
  every other transport file is still scanned.
- Reuses an already-ratified, already-executed mechanism (the identical FIT-10 +1 pattern).
- Zero `src/core` churn — no collision with this change's own `context.ts` brand-marker edit
  (ADR-0056).

**Negative:**
- One more reviewed guard edit (deviates from baseline; already within this change's
  `modifying` architecture impact).

## Alternatives Considered

1. **A `src/core/`-resident wrapper the runner calls** — Rejected: pushes production-runner
   composition into `src/core/`, reversing ADR-0053's core-purity rationale and colliding with
   this change's own `context.ts` edits; an indirection existing only to dodge a fitness check.
2. **Relocate `runner.ts` into `src/core/`** — Rejected: directly reverses ADR-0053.

## Related ADRs

- ADR-0053: transport home `src/transport/` + FIT-10 allow-list +1 (the FIT-10 precedent this
  decision mirrors for FIT-29).
- ADR-0056: `defineFactory` brand-marker double-wrap detection (the `context.ts` edit this
  decision avoids colliding with).

## Origin

Promoted from design section 4.5 (ADR-07) of change `stdio-engine-client` (2026-07-16),
resolving the S-000.7 `architectural-conflict` halt raised during apply. Signed spec version
V4. Verified by `sdd-verify --mode=final` (pass-with-followups) and judgment-day (APPROVED,
round 2). REQ coverage: RUN-05 (sanction scenario).
