# ADR-0021: Error-origin taxonomy — `origin` derived from `reason` (2.4)

- Status: Accepted
- Date: 2026-07-06
- Deciders: Daniel (Hyperxq) — 2.4 proof-substitution ratified at spec sign 2026-07-05
- Builds on: ADR-0020 (closed reason enum); ADR-0012 (dialect family, Stage 5 — the future
  `authoring-rejected` producer).
- Origin: change `stage-2-error-attribution` (2026-07-06).

## Context

Authors must distinguish an engine-refused write from an SDK-side misuse, but the SDK-origin
dialect family (Stage 5, ADR-0012) does not exist yet — the taxonomy must be frozen now
without over-implementing.

## Decision

`AuthoringError.origin` is a closed 2-value union — `"write-rejected" | "authoring-rejected"`
— DERIVED from `reason` via `originFor(reason)`: an **exhaustive switch with a `never` default
arm**, mirrored by a `test/types/authoring-reason.test.ts` exhaustiveness pin. Adding a reason
breaks the build at the switch AND the type pin, forcing a deliberate origin assignment —
"Stage 5 adds producers, not a rename" holds by construction, not hope. Derivation also makes
REQ-AEC-02's invariants unfalsifiable by any producer.

Mapping: `outside-run → "authoring-rejected"`; all others including `unknown →
"write-rejected"`. `unknown → write-rejected` is **deliberate, not incidental**: an
unclassifiable rejection necessarily arrived through the emit/write seam — the only place
`toAuthoringError` runs — so the write side is the honest attribution.

Birth sites: SEAM-04 `catch` → always `write-rejected`; `currentContext()` misuse throw →
`authoring-rejected` (the ONE concrete v1 proof case). The dialect/AST family is a RESERVED
slot under `authoring-rejected`: unimplemented and untested in v1.

## Consequences

- (+) Provable now against one concrete case; the field is frozen — Stage 5 adds producers,
  never renames.
- (−) v1 exercises only one `authoring-rejected` producer.
- (−) A new reason later touches `originFor()` — a MAJOR change per ADR-0020, by design.

## Alternatives Considered

- **Subclass hierarchy** (`EngineError` / `MisuseError`) — rejected: heavier than a
  discriminant, no author benefit.
- **Engine-origin only** (skip the taxonomy) — rejected: leaves 2.4 unprovable and the
  misuse throw a plain `Error`.

## Related

ADR-0020 (reason enum), ADR-0012 (Stage-5 dialect family — reserved producer slot).
