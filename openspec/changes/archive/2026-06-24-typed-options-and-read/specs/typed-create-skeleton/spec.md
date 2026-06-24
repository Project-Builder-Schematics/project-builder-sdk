# Typed Create — Full Options Derivation (delta)

**Spec version**: V2 (delta over typed-create-skeleton V1)
**Status**: signed (orchestrator 2026-06-22)
**Change**: `typed-options-and-read` (#2 of l1-author-surface)
**Seam**: SEAM-01 (produced by #2; archived #1 consumes the stable `create<S>(path, opts): WritableHandle` shape)

## MODIFIED Requirements

### REQ-01: Full Options Structural Typing — Proven & Frozen

The `create` function MUST accept a generic type parameter `S` (the author's options interface) and,
when provided, MUST narrow `CreateOptions.options` to the **homomorphic** mapped type
`{ [K in keyof S]: S[K] }`. Because this mapped type is homomorphic (its constraint is `keyof S`),
TypeScript PRESERVES `S`'s optionality, required-ness, and per-key value types — so it already:
(a) requires every required (non-`?`) key of `S`, (b) allows every optional (`?`) key to be omitted,
(c) matches each key's value type to `S[K]`, and (d) rejects excess properties not in `S`. The narrowing
is **type-level only** (no runtime schema read — FIT-01 must stay green). The runtime implementation is
unchanged (see REQ-02, unchanged from V1).

This sub-change introduces **no new derivation type** — the skeleton's mapped type already delivers the
structural typing. #2's deliverable is to PROVE and FREEZE that contract before the L1 semver lock: the
full positive matrix (REQ-01.1/.3/.4/.5), the full negative matrix (REQ-01.2/.6/.7), and the CI regression
guard (REQ-03). The matrix is what distinguishes a proven, semver-frozen typed surface from one that holds
only by happy accident.

(Previously V1: narrowed `{ [K in keyof S]: S[K] }` for a single key as a type-level stub. Verified at
apply, 2026-06-22: the homomorphic map already enforces the full required/optional/type/excess contract
for all of REQ-01.1–01.7 — a separate `OptionsOf<S>` derivation was found to be a structural no-op and is
NOT introduced.)

#### Scenario REQ-01.1: Typed create compiles for a matching single-field schema
- GIVEN `S = { name: string }` and `create<S>("dst.ts", { template: "…", options: { name: "x" } })`
- WHEN the TypeScript compiler checks the call
- THEN the call is accepted without a type error

#### Scenario REQ-01.2: Excess field is rejected
- GIVEN `S = { name: string }` and `create<S>("dst.ts", { template: "…", options: { name: "x", extra: 1 } })`
- WHEN the compiler checks the call
- THEN the call is rejected (excess-property / assignability failure)

#### Scenario REQ-01.3: Untyped create still compiles for bare JsonValue options
- GIVEN `create("dst.ts", { template: "…", options: { anything: true } })` with no type parameter
- WHEN the compiler checks the call
- THEN the call is accepted (backward-compatible overload preserved)

#### Scenario REQ-01.4: Multi-field schema requires all required keys (triangulation)
- GIVEN `S = { name: string; count: number }` and `create<S>("dst.ts", { template: "…", options: { name: "x", count: 2 } })`
- WHEN the compiler checks the call
- THEN the call is accepted — proving the derivation maps over `keyof S`, not a hardcoded single key

#### Scenario REQ-01.5: Optional key may be omitted
- GIVEN `S = { name: string; tag?: string }` and `create<S>("dst.ts", { template: "…", options: { name: "x" } })` (tag omitted)
- WHEN the compiler checks the call
- THEN the call is accepted — proving the derivation propagates optionality from `S`

#### Scenario REQ-01.6: Missing required key is rejected
- GIVEN `S = { name: string; count: number }` and `create<S>("dst.ts", { template: "…", options: { name: "x" } })` (count omitted)
- WHEN the compiler checks the call
- THEN the call is rejected — proving the derivation does NOT make every key optional (kills the over-permissive mutant)

#### Scenario REQ-01.7: Wrong value type is rejected
- GIVEN `S = { count: number }` and `create<S>("dst.ts", { template: "…", options: { count: "five" } })`
- WHEN the compiler checks the call
- THEN the call is rejected — proving per-key value-type enforcement, not mere key-presence

## ADDED Requirements

### REQ-03: Negative Options Proof Is CI-Verifiable

The negative type proofs (REQ-01.2 / REQ-01.6 / REQ-01.7) MUST be machine-verifiable in CI such that a
REGRESSION making the `OptionsOf<S>` derivation over-permissive (a negative case starts compiling clean)
flips CI RED. The CI check MUST be pinned to the expected TypeScript error semantics (the intended
`@ts-expect-error` directives doing their job), NOT a bare "any non-zero exit = pass" rule — an unrelated
compile failure MUST NOT be read as the negative proof passing.

#### Scenario REQ-03.1: A deliberate over-permissive regression flips CI red
- GIVEN the `permissive-proof` fixture asserting the negative options cases
- WHEN `OptionsOf<S>` is deliberately widened so a negative case (e.g. excess field) compiles clean
- THEN the CI permissive-proof step reports FAILURE (the now-unused `@ts-expect-error` is detected)

#### Scenario REQ-03.2: An unrelated compile error is not counted as the proof passing
- GIVEN the `permissive-proof` fixture
- WHEN the fixture fails to compile for a reason unrelated to the options narrowing (e.g. a bad import)
- THEN the CI step does NOT report the negative proof as passing (it is distinguishable from the intended error)

## Notes
- REQ-02 (Runtime Behaviour Unchanged) is carried verbatim from V1 — not modified by this change.
- Seam stability: the `create<S>(path, opts): WritableHandle` SIGNATURE SHAPE is unchanged; only the
  `OptionsOf<S>` derivation behind it grows (additive-safe for archived #1).
