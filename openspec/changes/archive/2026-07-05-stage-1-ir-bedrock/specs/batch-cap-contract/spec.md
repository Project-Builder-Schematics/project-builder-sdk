# Batch-Cap Contract Specification

**Spec version**: V2
**Status**: draft
**Change**: `stage-1-ir-bedrock`

## Purpose

Defines the `Batch` size cap as a wire-envelope property the fake (standing in for the
engine) enforces at `emit()` — never at `Session.flush` — preserving ADR-0018's "the SDK
never validates" invariant. Ratified as **D8** (2026-07-04), formalized as **ADR-0019** at
design time: cap = 4 MiB measured as `Buffer.byteLength(JSON.stringify(batch), 'utf8')`;
`modify.content`/`create.template` are UTF-8 text only in v1 (no binary/base64 wire shape —
the binary-posture rationale prose lives in ADR-0019, not here).

## Requirements

### REQ-01: 4 MiB cap enforced at the fake's `emit`, measured in UTF-8 bytes of the SERIALIZED batch

> RED posture: **must-fail-first** — no cap check exists anywhere today; the rejection
> scenarios below fail red against the current fake before the fix lands.

A `Batch` whose `Buffer.byteLength(JSON.stringify(batch), 'utf8')` exceeds `4 * 1024 * 1024`
MUST cause `emit()` to reject. A `Batch` at exactly the cap MUST pass. `Session.flush` (SDK
side) MUST perform no size check of its own — it always calls `emit()` regardless of size;
only the fake (engine stand-in) judges size, matching ADR-0018.

**Fixture-construction constraint (mutant-killer)**: boundary fixtures MUST be sized against
the SERIALIZED batch, and MUST be built so a mutant that measures raw content bytes (summing
`modify.content`/`create.template` lengths instead of serializing the envelope) reaches the
WRONG verdict on at least one fixture. Concretely: the over-cap fixture's raw content byte
total stays BELOW the cap while JSON-escaping overhead (quotes, `\n`, `\\`, envelope keys)
pushes its serialized byte length OVER — a raw-content measurer passes it; the correct
measurer rejects it. Multi-byte (non-ASCII) content remains mandatory in both boundary
fixtures so a UTF-16 code-unit measurer is also distinguishable from the UTF-8 byte
measurer.

#### Scenario REQ-01.1: Exactly-at-cap passes

- GIVEN a `Batch` whose SERIALIZED UTF-8 byte length
  (`Buffer.byteLength(JSON.stringify(batch), 'utf8')`) equals `4 * 1024 * 1024` exactly,
  built from multi-byte (non-ASCII) content that also contains JSON-escaping characters
- WHEN `emit(batch)` is called
- THEN it resolves (does not reject)

#### Scenario REQ-01.2: One byte over rejects — and a raw-content measurer would wrongly pass it

- GIVEN a `Batch` whose serialized UTF-8 byte length is `4 * 1024 * 1024 + 1` or more, but
  whose raw content bytes (sum of `Buffer.byteLength` over the content/template fields
  alone) total BELOW the cap — escaping + envelope overhead supplies the excess
- WHEN `emit(batch)` is called
- THEN it rejects
- AND the test also asserts the fixture property itself (raw-content total < cap <
  serialized total), so the raw-content-measurement mutant demonstrably flips this verdict

#### Scenario REQ-01.3: SDK never pre-validates — the fake is the sole judge

- GIVEN an oversized batch per REQ-01.2
- WHEN a `defineFactory` run flushes it through `Session.flush`
- THEN `Session.flush` calls `emit()` unconditionally (no SDK-side size branch) and the
  rejection originates from the fake, not from `session.ts`

### REQ-02: Wire content fields are type-constrained to `string` (UTF-8 text posture, v1)

> RED posture: **characterization / RED-waived** — the wire types already declare `string`
> today; this pins the existing shape per the `typed-options-and-read` prove+freeze
> precedent (#2).

The `Directive` wire type MUST declare `modify.content` and `create.template` as exactly
`string` — no union with a binary/base64 wrapper shape exists in the v1 contract. The pin is
type-level and observable: an `expectTypeOf`-style type test AND the FIT-04 committed
`.d.ts` baseline both freeze it. The binary-posture rationale (why text-only; why a future
binary shape is an additive wire change) is ADR-0019 prose, not a scenario here.

(Previously in V1: the scenario asserted the ABSENCE of a binary/base64 code path — not
observable. Rephrased to a positive type-level pin.)

#### Scenario REQ-02.1: The `string` constraint is pinned at type level

- GIVEN the `Directive` type declarations in `wire.ts`
- WHEN checked by a type-level test (`expectTypeOf` asserting `modify.content` and
  `create.template` are exactly `string`) and diffed against the FIT-04 `.d.ts` baseline
- THEN both fields are exactly `string`; widening either to a union (e.g.
  `string | { base64: string }`) fails the type test and the baseline diff

### REQ-03: Empty-batch run-end still reaches `commit()`

> RED posture: **characterization / RED-waived** — `Session.flush` already no-ops on empty
> pending and `defineFactory` already calls `commit()` unconditionally; zero production
> change (`session.ts`/`context.ts` untouched by this requirement). Prove+freeze precedent
> from `typed-options-and-read` (#2).

A `defineFactory` body that buffers zero directives MUST still resolve cleanly:
`Session.flush` no-ops (no `emit` call, since pending is empty) and the runner still calls
`session.commit()` on success.

#### Scenario REQ-03.1: Zero-directive factory still commits — commit invocation observed

- GIVEN a `defineFactory` body that calls no verbs at all, run against a fake whose
  `commit()` is spied (invocation counter)
- WHEN the runner executes it to completion
- THEN `emit` is never called (spy count 0)
- AND the `commit()` spy was invoked exactly once — the assertion observes the INVOCATION,
  not merely that the run resolves
- AND the run resolves without error
