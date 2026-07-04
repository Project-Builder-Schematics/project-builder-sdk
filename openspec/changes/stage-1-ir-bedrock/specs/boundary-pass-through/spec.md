# Boundary Pass-Through Specification

**Spec version**: V2
**Status**: draft
**Change**: `stage-1-ir-bedrock`

## Purpose

Models ADR-0018's "SDK never validates; the engine judges at the single seam" as fake
behavior: the fake round-trips every batch through JSON at `emit()`, comparing pre/post so
silent data loss (not merely `JSON.stringify` throwing) surfaces as a rejection. Paths and
intra-batch conflict ordering pass through verbatim — the fake carries no normalization or
de-duplication logic.

## Requirements

### REQ-01: JSON round-trip fidelity comparison at `emit`

> RED posture: **must-fail-first** — no round-trip exists in today's fake; the rejection
> behavior (exercised via REQ-02's scenarios) fails red before the fix lands. REQ-01.1's
> green path guards against false rejections once the mechanism exists.

`emit()` MUST perform a JSON round-trip (`JSON.parse(JSON.stringify(batch))`) on the
incoming batch AND structurally COMPARE the round-tripped result against the original
BEFORE applying — a mismatch (not just a thrown serialization error) MUST cause `emit()` to
reject. Comparing, not merely round-tripping-and-trusting, is required because
`JSON.stringify` silently DROPS some values rather than throwing.

#### Scenario REQ-01.1: Structurally identical batch round-trips clean

- GIVEN a batch whose `options`/content are plain JSON-compatible values
- WHEN `emit(batch)` is called
- THEN the round-trip comparison finds no mismatch and the batch applies normally

### REQ-02: Non-serializable values are REJECTED — both the silent-drop and the stringify-throw families

> RED posture: **must-fail-first** — today's fake applies these batches without complaint
> (or crashes uncaught); every scenario below fails red before the fix lands.

Two distinct failure families MUST both surface as `emit()` rejections:

1. **Silent-drop family** — values `JSON.stringify` silently OMITS or nulls rather than
   throwing: function values, `undefined` values, `Symbol` values (smuggled past `JsonValue`
   via `any`). Only the pre/post COMPARISON catches these.
2. **Stringify-throw family** — values where `JSON.stringify` itself throws: `BigInt`,
   circular references. The fake surfaces the throw as an `emit` rejection, not an uncaught
   crash.

#### Scenario REQ-02.1: Function-valued option rejects (the killer case)

- GIVEN a `create` directive whose `options` object has a key holding a function value
  (typed past `JsonValue` via `any`)
- WHEN `emit(batch)` is called
- THEN it rejects (the function-valued key is detected as a round-trip mismatch, never
  silently dropped)

#### Scenario REQ-02.2: `undefined`-valued and `Symbol`-valued options reject (silent-drop family)

- GIVEN one `create` directive whose `options` has a key holding `undefined`, and separately
  one whose `options` has a key holding a `Symbol` (both smuggled via `any`)
- WHEN `emit(batch)` is called for each
- THEN both reject via the pre/post comparison — `JSON.stringify` drops both keys silently,
  so only the comparison (not a thrown serialization error) can catch them

#### Scenario REQ-02.3: BigInt and circular references reject (stringify-throw family)

- GIVEN a directive whose `options` contains a `BigInt` value, and separately one containing
  a circular object reference
- WHEN `emit(batch)` is called for each
- THEN both reject (`JSON.stringify` throws; the fake surfaces this as an `emit` rejection,
  not an uncaught crash)

### REQ-03: Paths travel verbatim on the EMITTED WIRE DIRECTIVE — no normalization

> Scope: this requirement constrains the EMITTED WIRE DIRECTIVE (the factory/SDK output as
> captured at `emit`) — NOT the fake's internal tree resolution. The fake's own
> `posix.join`/`dirname`/`basename` destination bookkeeping for `move`/`rename` is
> legitimate and unchanged (documented in ADR-0018 as handle-position bookkeeping, not
> validation).

Author-supplied paths MUST cross the seam byte-for-byte as authored — no resolution of
`../`, no leading/trailing slash normalization, no case-folding — anywhere in the SDK path
from verb call to the directive `emit` receives.

#### Scenario REQ-03.1: An odd path (`../`, leading slash) crosses the seam unmodified

- GIVEN a factory that calls `create` with path `"../escaped.ts"`
- WHEN the emitted batch is captured (spy on `emit`)
- THEN the captured directive's `pathTemplate` is the exact literal string
  `"../escaped.ts"` (byte-equal, unresolved)
- AND for ops without destination-joining (create/modify/delete) the fake's stored key is
  that same literal — a read of the literal key returns the content

### REQ-04: Intra-batch conflicting directives apply in author order

> RED posture: **characterization / RED-waived** — today's eager array-order apply already
> produces these outcomes; the scenarios pin the behavior so it cannot regress when the
> round-trip/cap logic is added to `emit` (prove+freeze precedent).

The fake MUST NOT de-dupe, reorder, or cross-validate directives targeting the same path
within one batch — each applies in array order, so the LAST directive on a path determines
the outcome.

#### Scenario REQ-04.1: `[create X, delete X]` leaves X absent

- GIVEN a batch with instructions `[create("X", ...), delete("X")]`
- WHEN `emit(batch)` is called
- THEN a subsequent read of `X` returns `undefined`

#### Scenario REQ-04.2: `[delete X, create X]` leaves X present

- GIVEN a batch with instructions `[delete("X"), create("X", content)]`
- WHEN `emit(batch)` is called
- THEN a subsequent read of `X` returns `content`
