# ADR-0062: Interim Plain-`Error` Reject + `createOp` Stays Independent Oracle

**Status**: Accepted · **Date**: 2026-07-18 · **Change**: typed-options-feeder

## Context

Non-plain-JSON option values (functions, symbols, BigInt, circular references, etc.) must reject at scheduling time before crossing the wire. Two design questions: (1) what error class to throw, and (2) whether test-side builders like `createOp` should mirror the real `encodeOptions` logic.

The proposal originally framed rejection as a Stage-2 `AuthoringError` with `originFor` attribution. The Stage-4 interim precedent (used for other errors) accepts a plain `Error` now, deferring full attribution to a registered followup.

## Decision

1. Throw a **plain `Error`** with a spec-pinned message (`typed-options-encoding` REQ-TOE-04) naming the offending option key. Full `AuthoringError` attribution with `originFor` is a registered followup.
2. `createOp` (the test-side parallel builder in `test/fake/directive-builders.ts`) stays **raw** — it writes `options` verbatim without calling `encodeOptions`. Parity is proven by an equivalence test (`test/fake/encode-recorded-batch.test.ts::REQ-TOE-07.2`) comparing live factory output against a `createOp` expectation whose options carry the **hand-written encoded string** (the absolute anchor).

## Consequences

- `directive-factory.ts` keeps a light dependency footprint (no authoring-error import).
- `createOp` remains an independent oracle: a bug in `encodeOptions` cannot corrupt both surfaces identically. This guards the "shared encode-mutation makes both surfaces wrong identically" trap mentioned in `typed-options-encoding` REQ-TOE-06.1.
- Rejection at scheduling time is loud and names the key, but lacks the structured verb/path/reason depth of `AuthoringError` until the followup lands.
- One hand-maintained encoded anchor string in the test oracle.
- **Attribution regression (explicit and documented)**: the scheduling-time plain-`Error` shadows Stage-2's `unrepresentable-content` `AuthoringError` for function/BigInt/symbol values in create-options. Those inputs previously reached the flush-time batch-level guard; now they reject earlier. Non-finite numbers (NaN, Infinity) still reach the Stage-2 guard, keeping REQ-14.3 live. The registered `AuthoringError`-parity followup restores full attribution.

## Alternatives Considered

1. **`createOp` calls `encodeOptions`** — Rejected: makes the oracle a mirror of the code under test, blind to encode bugs.
2. **Build `AuthoringError` now with invented verb/path** — Rejected: the encode site does not own the verb, path, or reason context needed for faithful attribution. Owner ruling: plain `Error` interim is acceptable; full attribution is a followup.

## Related ADRs

- **ADR-0060**: Wire value-lowering rationale and factory amendment.
- **ADR-0061**: Type discrimination (this ADR does not re-litigate that choice).
