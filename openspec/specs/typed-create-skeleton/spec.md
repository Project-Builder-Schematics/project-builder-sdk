# Typed Create Skeleton Specification

**Spec version**: V1
**Status**: signed (orchestrator 2026-06-21); amended 2026-06-21 (plan-verify iter-2 resolution: REQ-02.2 mechanism note corrected — flush fires at run-end on success, no `finally`)
**Change**: `l1-author-surface-skeleton`
**Seam**: SEAM-01

## Purpose

Provides a single-option generic overload of `create<S>` that narrows `options`
from bare `JsonValue` to a single schema-derived field at the type level. This is a
type-level stub only — no runtime behaviour changes; it seeds the SEAM-01 shape so
that `typed-options-and-read` (#2) can grow the full derivation into an already-working
slot.

## Requirements

### REQ-01: Single-Option Type-Level Narrowing

The `create` function MUST accept a generic type parameter `S` and, when provided,
MUST narrow `CreateOptions.options` to `{ [K in keyof S]: S[K] }` for a single
schema-derived key instead of the bare `JsonValue` type.

The narrowing is type-level only — the runtime implementation is unchanged.

#### Scenario REQ-01.1: Typed create compiles for a matching single-field schema

- GIVEN a schema type `S = { name: string }` and an invocation `create<S>("dst.ts", { template: "…", options: { name: "x" } })`
- WHEN the TypeScript compiler checks the call
- THEN the call is accepted without a type error (compile proof passes)

#### Scenario REQ-01.2: Typed create produces a compile error for an extra field

- GIVEN a schema type `S = { name: string }` and an invocation `create<S>("dst.ts", { template: "…", options: { name: "x", extra: 1 } })`
- WHEN the TypeScript compiler checks the call
- THEN the call is rejected with a type error (excess-property or assignability failure)

#### Scenario REQ-01.3: Untyped create still compiles for bare JsonValue options

- GIVEN an invocation without a type parameter `create("dst.ts", { template: "…", options: { anything: true } })`
- WHEN the TypeScript compiler checks the call
- THEN the call is accepted (backward-compatible overload)

### REQ-02: Runtime Behaviour Unchanged

The generic overload MUST NOT alter the runtime shape of the directive buffered into
`Session.#pending`. The `create` directive's `options` field MUST still carry the
author-supplied value as-is.

#### Scenario REQ-02.1: Write-only typed factory buffers the create directive

- GIVEN a `defineFactory`-wrapped function that calls `create<S>("dst.ts", { template: "t", options: { name: "x" } })` and returns without calling `.read()`
- WHEN the runner executes the factory
- THEN a single `create` directive is present in the batch flushed to the engine client
- AND the directive's `options` field equals `{ name: "x" }`
- AND no type error was reported at compile time

#### Scenario REQ-02.2: Write-only path holds — no trailing read required

- GIVEN a factory that calls `create<S>` without any trailing `.read()` call
- WHEN the runner executes the factory
- THEN the directive batch is emitted (flush fires at run-end on factory success)
- AND the committed tree contains the created path (SEAM-03 integration via ContractFake)
