# Delta for Run-Boundary Input Validation

**Spec version**: V3
**Status**: signed (owner, 2026-07-12 — micro-unfreeze V2→V3, deltas pre-authorized)
**Change**: `schematic-local-files`

V2 → V3: no V3 deltas targeted this domain — content unchanged; version/status bump
only.

V1 → V2 (blind council fixes applied): REQ-RBV-06.1 strengthened with a killable
observable — the missing-ancestor rejection PRE-EMPTS a factory-body sentinel throw,
proving the pre-`als.run` ordering rather than asserting it by prose. REQ-ID
preserved.

## ADDED Requirements

### REQ-RBV-06: Package-Root Discovery Is a Legitimate Pre-`als.run` Read

Resolving the containment ceiling (`package-root-containment` REQ-PRC-02 — walking
ancestors for the nearest `collection.json`) MUST happen at the SAME pre-`als.run`
chokepoint `defineFactory` already uses for schema/reserved-name validation
(`context.ts`'s `validateAtRunBoundary`/`checkReservedNames`), not a separate,
uncoordinated read site. A missing `collection.json` ancestor fails closed at this
same site (`package-root-containment` REQ-PRC-03, reason `invalid-input` per
REQ-AEC-12) — it does not silently degrade to "no containment" the way REQ-RBV-03's
no-schema opt-out legitimately degrades for schema validation; there is no analogous
opt-out for containment.

#### Scenario REQ-RBV-06.1: Missing-ancestor rejection pre-empts the factory body — killable ordering observable [SDK]

- GIVEN a factory defined via `defineFactory(fn, { packageDir })` in a package with
  NO `collection.json` ancestor, whose body's FIRST statement throws a sentinel
  `Error("body-ran")`
- WHEN the factory runs
- THEN the thrown value is the missing-ancestor fail-loud rejection — NOT the
  sentinel — proving the ceiling walk resolved (and rejected) BEFORE
  `als.run`/`fn(o)` executed; a mutant that defers the walk into the run would
  surface `"body-ran"` instead
