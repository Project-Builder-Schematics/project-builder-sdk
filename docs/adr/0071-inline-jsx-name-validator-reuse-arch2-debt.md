# ADR-0071: Fold In `name` Validation by Consuming `jsx-name-validator.ts` As-Is, Inline; Register the ARCH-2 Rename Debt

**Status**: Accepted · **Date**: 2026-07-21 · **Change**: `ts-addimport-collision` (originally ADR-02)

## Context

Closing the CONFIRMED `name`-splice injection on `addImport` needs the grammar + reserved-word +
denylist chain that already ships as `assertValidImportBinding`. Reusing it makes the TS dialect
the module's SECOND, first non-JSX consumer — sharpening the project's ARCH-2 baseline finding
(the "one consumer" placement premise for `src/core/jsx-name-validator.ts`) ahead of a third
dialect. TS ops are plain functions calling asserts inline; React wraps every op in
`validatedOp`.

## Decision

Import `assertValidImportBinding` verbatim (no TS narrowing) and call it INLINE as `addImport`'s
first statement, matching the leaf's own `assertNoCollision` house style — NOT the `validatedOp`
wrapper (a React-ism foreign to this leaf; mixing styles in one file is worse than either). Do
NOT relocate the module; register it as ARCH-2's now-realised second trigger in the architecture
baseline.

## Consequences

- One validator family, no second skeleton; closes the injection now on an already-sensitive op;
  validate-before-mutate preserved by the inline first-line placement.
- ARCH-2 debt compounds (two consumers pre-third-dialect) — a placement/cohesion note, not a
  dependency-direction breach (the edge is dialect → core, the sanctioned direction).
- `src/core/jsx-name-validator.ts` now genuinely serves two dialects; its name is a misnomer
  going forward — tracked as rename/placement debt, not resolved by this change.

## Alternatives Considered

1. **`validatedOp` wrapper** — Rejected: inconsistent with the TS leaf's established inline-assert
   house style; no benefit over inline here.
2. **Relocate the module now** (pull the eventual split forward) — Rejected: that is arm b's
   React-reopen cost (see ADR-0070) without arm b's benefit.

## Related ADRs

- **ADR-0070**: The predicate-mirroring decision this validation reuse sits alongside.
- **ADR-0039**: `assertNoCollision`'s existing collision predicate, unchanged by this decision.
