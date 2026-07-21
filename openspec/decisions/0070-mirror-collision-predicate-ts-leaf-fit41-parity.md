# ADR-0070: Mirror the Collision/Idempotency Predicate in the TS Leaf + Predicate-Parity Fitness (FIT-41)

**Status**: Accepted · **Date**: 2026-07-21 · **Change**: `ts-addimport-collision` (originally ADR-01)

## Context

The value-namespace + import-binding predicate family now lives in both dialect leaves
(`src/dialects/react/ops.ts` and `src/dialects/typescript/ops.ts`, ADR-0039 cross-dialect
precedent). Arm b (hoist to a new `src/core/import-model.ts`, single source) is architecturally
clean but RE-OPENS the archived, signed React leaf (must refactor React to consume it, risking
REQ-RXD-05) — a scope expansion the PM ruling binds to explicit owner ratification, not a free
implementation choice.

## Decision

Arm a — keep the predicate in the TS leaf (React byte-sealed, zero diff this change). Reduce
intra-leaf duplication by extracting one `isValueNamespaceClaimed` boolean shared by
`assertNoCollision` and the new `addImport`; the remaining TS-copy/React-copy duplication is
guarded by a MANDATORY predicate-parity fitness (`test/fitness/fit-41-addimport-parity.test.ts`)
asserting both dialects' `addImport` return identical verdicts on a shared battery. Self-alias is
encoded as a POSITIVE expected-divergence assertion, never a row exclusion: every battery row
asserts verdict equality, and the self-alias row (REQ-TSD-01.15) asserts the KNOWN pair
explicitly — TS = no-op, React = reject — so a future drift on that row fails RED instead of
being silently masked by an exclusion.

## Consequences

- React stays sealed; honours the owner's standalone-TS scope; no React-reopen risk.
- Two live copies of the predicate persist — FIT-41 substitutes arm b's drift-DETECTION benefit,
  NOT its single-point-of-maintenance benefit: a genuine predicate change still costs a two-place
  edit; FIT-41 only guarantees the divergence surfaces. That residual cost is the accepted price
  of keeping React sealed.
- Enables arm b later without pressure.

## Alternatives Considered

1. **Arm b (single source)** — Rejected: re-opens signed React, owner-ratification-gated, and
   FIT-41 substitutes for its drift-detection benefit anyway.
2. **Mirror without a parity fitness** — Rejected: three defect-prone copies (React, TS,
   whichever leaf comes next) with no agreement check is halt-worthy.

## Related ADRs

- **ADR-0039**: The cross-dialect value-namespace collision predicate this decision mirrors.
- Tracks the same "one consumer" placement debt sharpened by ADR-0071 (below).
