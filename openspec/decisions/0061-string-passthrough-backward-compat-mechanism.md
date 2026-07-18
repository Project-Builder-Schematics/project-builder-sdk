# ADR-0061: String Passthrough Is the Backward-Compat Mechanism — Type Discrimination, Not a Flag

**Status**: Accepted · **Date**: 2026-07-18 · **Change**: typed-options-feeder

## Context

The `docs/create-templates.md` guide (PR #36) already teaches authors to hand-`JSON.stringify` composite `create` options as a workaround for the engine's v1 wire requirement. Enabling native array/object support must preserve compatibility with existing call sites that manually stringify their options.

## Decision

Discriminate on each option value's runtime type. A value already a `string` — including a pre-`JSON.stringify`'d string or one beginning with `[` or `{` — passes through byte-identical without re-encoding (per `typed-options-encoding` REQ-TOE-02). Only native array and plain-object values undergo JSON encoding.

Type discrimination itself IS the backward-compat seam: no version flag, no opt-in feeder mode, no dual code paths. The transform in `src/core/directive-factory.ts::encodeOptions` checks `typeof value === "string"` and skips encoding for those values.

## Consequences

- Zero migration burden: both hand-stringified and native call sites work identically in both forward and revert directions.
- Encoding is idempotent: encoding an already-encoded string is a no-op.
- The engine's v1 promotion rule for strings beginning `[`/`{` remains an engine-owned limit (documented, not SDK-guarded).
- Future changes that add native type support should follow this pattern: discriminate on type, use existing strings as-is.

## Alternatives Considered

1. **Version flag / opt-in feeder mode** — Rejected: forces two behaviors to maintain and test, and requires authors to understand the wire mechanism the whole change exists to hide.
2. **Dual code paths** — Rejected: increases test surface and maintenance burden.

## Related ADRs

- **ADR-0060**: Wire value-lowering (this change implements it via type discrimination).
- **ADR-0062**: Independent oracle for test-side `createOp` builders.
