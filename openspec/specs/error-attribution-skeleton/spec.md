# Error Attribution Skeleton Specification

**Spec version**: V1
**Status**: signed (orchestrator 2026-06-21)
**Change**: `l1-author-surface-skeleton`
**Seam**: SEAM-04

## Purpose

Introduces a thin error-attribution wrap over `EngineClient.emit` / `.read` so that
a single forced rejection surfaces an `AuthoringError` in author vocabulary (verb +
path) instead of the raw `ContractFake:` / `OpMove` strings the engine currently
leaks. Seeds SEAM-04 so that `error-and-commit-contract` (#3) can grow the full
attribution across every verb and mid-chain rejection into an already-working slot.
The skeleton exercises one real forced rejection from the `ContractFake` — never a
mock.

**Sensitive areas**: None (pre-release; no published consumer).

## Requirements

### REQ-10: AuthoringError Type

The SDK MUST define an `AuthoringError` type carrying at minimum `verb` (the author
vocabulary word for the failing operation: `"create"`, `"modify"`, `"delete"`,
`"rename"`, `"move"`, `"copy"`) and `path` (the primary path of the failing directive).

#### Scenario REQ-10.1: AuthoringError carries verb and path

- GIVEN an `AuthoringError` value produced from a failed `create` directive on path `"src/foo.ts"`
- WHEN its fields are inspected
- THEN `verb` is `"create"` and `path` is `"src/foo.ts"`

### REQ-11: Engine Vocabulary Hidden from Author

When an `EngineClient.emit` call throws, the error surfaced to the factory author
MUST be an `AuthoringError`. The raw engine error text (`ContractFake:`, `OpMove`,
or any engine-internal vocabulary) MUST NOT appear in the surfaced error message or
type.

#### Scenario REQ-11.1: Forced-rejection collision surfaces AuthoringError, not engine text

- GIVEN a `ContractFake` seeded with `"src/existing.ts": "old"` and a factory that calls `create("src/existing.ts", …)` without `force: true`
- WHEN the runner executes the factory
- THEN the error thrown from the runner is an `AuthoringError`
- AND `verb` is `"create"` and `path` is `"src/existing.ts"`
- AND the error message does NOT contain `"ContractFake:"` or `"OpMove"`

#### Scenario REQ-11.2: AuthoringError propagates through defineFactory

- GIVEN a factory that triggers a forced rejection (as above)
- WHEN the runner's returned promise is awaited
- THEN the promise rejects with an `AuthoringError` (not a generic `Error`)

### REQ-12: Attribution Wrap Covers emit Call Site

The attribution wrap MUST intercept errors thrown by `EngineClient.emit` at the
`Session.flush` call site and translate them to `AuthoringError` before the error
reaches `defineFactory`'s `finally` block. The wrap MUST NOT swallow the error; it
MUST re-throw the `AuthoringError` so that `defineFactory` still propagates it and
triggers the discard path (REQ-07).

The skeleton covers the single forced-rejection case. Attribution of mid-chain
applied-boundary and every op kind is deferred to #3 `error-and-commit-contract`.

#### Scenario REQ-12.1: Wrap intercepts emit error and re-throws as AuthoringError

- GIVEN a `Session` whose `EngineClient.emit` throws a raw engine error
- WHEN `Session.flush` is called
- THEN `flush` re-throws an `AuthoringError` (not the raw error)
- AND the `AuthoringError` carries the verb and path of the first failing directive

#### Scenario REQ-12.2: Discard fires after AuthoringError (integration with REQ-07)

- GIVEN a factory that triggers a forced rejection (raw engine error → AuthoringError)
- WHEN the runner executes the factory
- THEN the committed tree is empty (discard fired — REQ-07 integration)
- AND the error received by the test is an `AuthoringError`
- AND the fake's staging tree is discarded

### REQ-13: Single Real Forced Rejection in Cross-Boundary Test

At least one cross-boundary test MUST exercise SEAM-04 with the `ContractFake`
unmocked on BOTH sides: the fake throws a real collision error; the session attribution
wrap converts it; the factory runner propagates the `AuthoringError`; the test asserts
the committed tree is empty (SEAM-03 + SEAM-04 combined). No mock of the attribution
or commit/discard path is permitted in this test.

#### Scenario REQ-13.1: End-to-end forced-rejection cross-boundary test

- GIVEN a `ContractFake` seeded with a path that will collide, a real `Session`, and the attribution wrap active
- WHEN a `defineFactory`-wrapped function calls `create` on the colliding path
- THEN the runner rejects with `AuthoringError { verb: "create", path: <colliding path> }`
- AND the `ContractFake`'s committed tree is empty
- AND no mock intercepted the `emit`, attribution, or commit/discard path
