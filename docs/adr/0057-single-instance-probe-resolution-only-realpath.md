# ADR-0057: Single-Instance Probe = Resolution-Only Realpath, Before Import

**Status**: Accepted · **Date**: 2026-07-16 · **Change**: stdio-engine-client

## Context

SEC-07 needs to compare the runner's own `@pbuilder/sdk` realpath against the factory's
resolved copy WITHOUT executing the factory's top-level code — otherwise the module-level
ALS singleton (`context.ts`'s `als`) could split before the check ever runs, and any author
top-level side effect would run outside the run boundary.

## Decision

`import.meta.resolve` (anchored at the factory's URL) resolving `"@pbuilder/sdk"`, followed
by `fs.realpathSync`, compared against the runner's own resolved realpath — performed BEFORE
importing the factory module. Fallback: `module.createRequire(factoryUrl).resolve(...)` if
Bun's `import.meta.resolve` semantics prove unavailable at runtime. This design assumes Bun
exposes a resolve-without-execute path; that assumption was unverifiable from this repo alone,
so the fallback was designed in rather than guessed away.

## Consequences

**Positive:**
- No author code runs before the single-instance check — prevents an outside-run escape on
  the very first verb call.

**Negative:**
- One extra syscall (realpath) at handshake time.

## Alternatives Considered

1. **Import-then-compare** — Rejected: runs author code before the check, defeating the
   control it exists to provide.
2. **Trusting a version string** — Rejected: a matching version number is not a same-instance
   guarantee (two installed copies can share a version).

## Origin

Promoted from design section 4.5 (ADR-05) of change `stdio-engine-client` (2026-07-16).
Signed spec version V4. Verified by `sdd-verify --mode=final` (pass-with-followups,
followup F-2 registered against the fallback branch's real-resolver happy-path coverage
altitude) and judgment-day (APPROVED, round 2). REQ coverage: SEC-07.
