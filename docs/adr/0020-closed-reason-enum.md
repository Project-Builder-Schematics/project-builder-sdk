# ADR-0020: Closed `reason` enum on `AuthoringError` (★D2)

- Status: Accepted
- Date: 2026-07-06
- Deciders: Daniel (Hyperxq) — option (b) owner-ratified 2026-07-05
- Builds on: ADR-0016 (message-parsing rejected for read classification — same stance here);
  the no-engine-text guarantee (`error-attribution-skeleton` REQ-11, FIT-11).
- Closes: DECISION D2 (`openspec/objectives-plan.md`, Stage 2.2).
- Origin: change `stage-2-error-attribution` (2026-07-06).

## Context

A rejected author needs a structured, debuggable cause, but the no-engine-text guarantee
(FIT-11 whole-object scan) covers the WHOLE error object — a free-text cause would leak
engine vocabulary through the very field meant to help.

## Decision

`AuthoringError.reason` is a closed SDK-owned union of exactly six author-vocabulary values:

`"path-collision" | "path-not-found" | "unrepresentable-content" | "changes-too-large" | "outside-run" | "unknown"`

Classification is `EmitRejectionCode → reason` mapping ONLY (ADR-0022) — never message-text
parsing. `unrepresentable-content` deliberately fuses the stringify-throw and round-trip-drop
families: both mean "this content can't cross the wire," and an author fixes both the same way.

**Semver stance (verbatim from the signed spec)**: adding a 7th value later is a MAJOR change,
not additive. Authors are expected to write exhaustive `switch(reason)` blocks; TypeScript's
exhaustiveness check breaks such a switch when a new member is added, even though nothing
breaks at runtime. FIT-04's `.d.ts` gate MUST treat a `reason` union growth as breaking.
Enforcement: FIT-04 line-diff on the dedicated `core.authoring-error.d.ts` baseline pair +
compile-time `toEqualTypeOf` membership pins + the `originFor` never-arm (ADR-0021).

## Consequences

- (+) Debuggable and leak-proof; `switch(reason)` branch-and-recover is the intended
  consumption pattern (proven usable by REQ-17.1 e2e).
- (−) Coarser than raw engine text — FIT-11 keeps the leaking alternative off the table.
- (−) Enum growth is MAJOR (see semver stance above).

## Alternatives Considered

- **(a) Free-text `_raw` cause** — rejected: leaks engine text, defeats the guarantee this
  stage exists to protect.
- **(c) Error subclass per family** — rejected: subclass explosion, no exhaustiveness gain
  over a discriminant.
- **(d) Numeric codes** — rejected: opaque, un-greppable, needs a lookup table authors
  won't have.

## Related

ADR-0021 (origin derived from reason), ADR-0022 (the `EmitRejectionCode` source of the
mapping), ADR-0023 (public promotion of the frozen shape).
