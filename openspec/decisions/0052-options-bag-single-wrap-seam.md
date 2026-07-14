# ADR-0052: Options-Bag Signature + Single-Wrap-Seam Delegation

**Status**: Accepted · **Date**: 2026-07-15 · **Change**: bare-factory-migration

## Context

The harness signature for `runFactoryForTest` must accept two runtime options: `seed` (seeding overrides for reproducibility) and `packageDir` (schema validation anchor). Today, `seed` is a positional 3rd argument. `packageDir` must join it in a way that extends without arity churn and maintains structural parity with the seam the future runner will call.

## Decision

`runFactoryForTest` adopts a named-options-bag signature:

```ts
runFactoryForTest<O>(
  fn: (input: O) => void | Promise<void>,
  input: O,
  options?: { seed?: Record<string, string>; packageDir?: string | URL }
): Promise<RunResult>
```

`packageDir` is OPTIONAL: absent = untyped tier, byte-identical to today (REQ-TFO-02 opt-out relocated to the caller); present = schema-validated.

**Critically**, `runFactoryForTest` DELEGATES to `defineFactory` — it never reimplements the wrap logic. The single-wrap-seam invariant is structural: `runFactoryForTest` internally calls `defineFactory(fn, packageDir !== undefined ? {packageDir} : undefined)` against a harness-managed client. The parity reference (REQ-ATH-19) invokes `defineFactory` DIRECTLY (never re-wraps), proving the seam is shared.

## Consequences

**Positive:**
- Named options extend without arity churn (future: `priority`, `config`, etc., trivially added).
- Parity is structural, not asserted — the harness IS the seam.
- Single wrap point simplifies reasoning about wrap behavior.

**Negative:**
- Options-bag migration touches every `./testing` caller: `test/fake/harness-*.test.ts`, `test/docs/*`, `test/e2e/*`, plus `test/support/ir-transcript.ts::captureRun()`.
- Corpus regeneration must thread `packageDir` through `scenarios.ts`.

## Implementation Notes

- `RunResult` shape (`{tree, emitted, error}`) is unchanged.
- `seed` is still read back via a named field; REQ-ATH-01.4 proves the options-bag migration preserves seeding behavior.
- Byte-identical corpus regen (REQ-ATH-20.2) verifies the migration is transparent to end-state.

## Alternatives Considered

1. **4th positional arg** — Rejected: ordering ambiguity (is it `fn, input, seed, packageDir` or `fn, input, packageDir, seed`?); poor extensibility for future options.
2. **Parallel wrap reimplementation in the harness** — Rejected: drifts from the runner seam; the parity test would pass on a lie.
3. **Keep `seed` positional, only `packageDir` named** — Rejected: inconsistent; either all named or all positional.

## Related ADRs

- ADR-0050: `defineFactory` core-internal removal
- ADR-0051: Caller-supplied `packageDir` anchor

## Origin

Promoted from design section 4.5 of change `bare-factory-migration` (2026-07-15). Signed spec version V2. Verified by `sdd-verify --mode=final` with verdict `pass-with-followups`. REQ coverage: REQ-ATH-01, REQ-ATH-19 (wrap-parity), REQ-ATH-06, REQ-ATH-11, REQ-ATH-14, REQ-ATH-17, REQ-ATH-18.
