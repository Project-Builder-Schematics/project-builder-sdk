# ADR-0075: Manifest-Derived Fitness Counts (amends ADR-0066)

- Status: Accepted
- Date: 2026-07-22
- Deciders: Daniel (Hyperxq)
- Related: ADR-0066 (corpus self-check), REQ-CCR-05 (corpus-wide numerics), pending-changes row 502

## Context

The `fit-40` corpus self-check previously hardcoded absolute checkpoint gates: `if (corpus.fixtures.length !== 1)` at PR#1 and `if (corpus.fixtures.length !== 5)` at PR#2. Every new fixture added after these checkpoints leaves the hardcoded gates silently vacuous — they can never go RED again, becoming dead code that wastes CI time and silently masks failures to maintain the corpus correctly (pending-changes row 502).

This pattern is unsustainable as the corpus grows beyond the current 5 fixtures. Future fixtures (like `m2-copy`/`m2-copyin` in this change) require a generative mechanism, not manual literal updates.

## Decision

Replace the hardcoded gates with a count DERIVED at test time from `corpus.json#fixtures` itself. The derived check compares:
1. The set of fixture directories on disk (`conformance/*/`)
2. The list declared in `corpus.json#fixtures`
3. The total case count: sum of `manifest.json#cases.length` for every listed fixture

The check passes when these three align. Additionally, DELETE all dead hardcoded early-return gates (REQ-CCR-05.5) — do not leave them in place as vacuous dead code.

## Consequences

- (+) Green at every checkpoint — 1/2 (PR#1), 5/12 (PR#2), 6/18 (m2-copy), 7/23 (m2-copyin un-held) — with zero spec/test literal edits as fixtures land.
- (+) Discharges pending-changes row 502.
- (+) Future fixtures require no derived-count infrastructure changes; the mechanism scales.
- (-) The derived sum is self-referential — it checks that the corpus declares what it declares, not that the cases are behaviorally correct. The load-bearing guard against case-outcome drift is the per-fixture behavioral-contract blocks (REQ-CFX-15, REQ-CFX-16, etc., not REQ-CCR-05).
- (-) Requires deletion of existing hardcoded gates, a destructive change that must be verified carefully.

## Alternatives Considered

- **Add a new literal 3rd checkpoint**: Rejected — re-introduces the vacuous-on-next-fixture problem and does not solve the pattern's unsustainability.
- **Keep hardcoded gates and add derived alongside**: Rejected — REQ-CCR-05.5 forbids leaving dead code; having both is worse than having neither.
- **Parametric literals via environment**: Rejected — moves the maintenance burden to CI configuration instead of the codebase and obscures the check's intent.

## Origin

Promoted from change `copy-copyin-conformance-fixtures` (2026-07-22). See design.md §4.5 (ADR-03), slices.md S-000 (walking skeleton implementation).
