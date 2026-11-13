# ADR-0050: `defineFactory` Graduates to Core-Internal, Removed from `./testing`

**Status**: Accepted · **Date**: 2026-07-15 · **Change**: bare-factory-migration

## Context

`defineFactory` is author-facing ceremony encoding no decision. The 0.x SDK has zero external schematic authors. Owner direction (obs #2070, 2026-07-14) makes the bare function the author contract, eliminating ambiguity.

## Decision

`defineFactory` stays declared in `src/core/context.ts` and barrelled from `src/core/index.ts` (the `@pbuilder/sdk-kit` extraction boundary). It is REMOVED from `./testing`'s public re-export. JSDoc gains `@internal` naming the harness + future runner as sanctioned callers. Enforcement is structural:

- **FIT-08** (no-kit-bleed): `./testing`'s export allowlist narrows to `runFactoryForTest` (value), `Batch`/`Directive` (type-only). `defineFactory` is NO LONGER included.
- **FIT-29** (new): import-reachability guard scans production code (`src/**`, `bin/**`) and confines `defineFactory` importers to sanctioned paths: `src/core/**`, `src/testing/**`, `src/conformance/**`. `test/**` is categorically OUTSIDE this scope.

## Consequences

**Positive:**
- One author shape, no missing/double-wrap failure mode (hard contract).
- Engine↔SDK wire designed against the final shape now, eliminating future shape ambiguity.

**Negative:**
- Breaking `./testing` removal (scheduled removal of a public re-export).
- Absorbed by `./testing`'s 0.x semver-exemption + zero external consumers.

**Derived decision:**
- **FIT-16's 3rd-signal retires** (`hasUntetheredDefineFactory`). It goes vacuously green once author fixtures are bare (no `defineFactory` token to scan). Its threat model (untethered run without `packageDir`) re-homes to the future runner plan, registered as a followup outside this change.

## Alternatives Considered

1. **Dual-shape shim** — accept wrapped AND bare factories. Rejected: keeps exactly the ambiguity the migration deletes, with no external consumer to protect.
2. **Leave in `./testing` as internal-by-convention** — Rejected: unenforceable; FIT-29 makes the structural constraint explicit.

## Related ADRs

- ADR-0051: Caller-supplied `packageDir` anchor
- ADR-0052: Options-bag signature + single-wrap-seam delegation

## Origin

Promoted from design section 4.5 of change `bare-factory-migration` (2026-07-15). Signed spec version V2. Verified by `sdd-verify --mode=final` with verdict `pass-with-followups`. REQ coverage: REQ-TES-03, REQ-TES-05, REQ-TES-06, REQ-TES-08, REQ-TES-10, REQ-ATH-01, REQ-ATH-03, REQ-FPS-05.
