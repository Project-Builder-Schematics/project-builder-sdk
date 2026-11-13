# ADR-0051: Caller-Supplied `packageDir` Anchor

**Status**: Accepted · **Date**: 2026-07-15 · **Change**: bare-factory-migration

## Context

`packageDir` is the runtime anchor for schema validation, reserved-name scanning, and containment ceiling in the author-emulation fixture pipeline. Today, `packageDir` is threaded at the author's `defineFactory(fn, {packageDir})` call site. The bare-factory migration inverts this: the author exports a bare function, and the harness (or future runner) supplies `packageDir` when calling the factory.

## Decision

`packageDir` moves to the CALLER that runs the factory. In the harness, this is the `runFactoryForTest` options bag signature:

```ts
runFactoryForTest<O>(
  fn: (input: O) => void | Promise<void>,
  input: O,
  options?: { seed?: Record<string, string>; packageDir?: string | URL }
): Promise<RunResult>
```

The bare author function carries no `packageDir`. Scaffold error strings (templateFile, copyIn, scaffold) reword runtime-neutrally:

> `"<verb> has no package directory to resolve … against — pass \`packageDir\` to the call that runs this factory"`

The message keeps the `"invalid input:"` prefix and names the bare-shape remedy without enumerating the harness or future runner.

## Consequences

**Positive:**
- Author function is pure input→effect; no packaging ceremony leaks into the export contract.
- Error message is true in both harness and runner without enumerating either, future-proofing for runner introduction.

**Negative:**
- Per-scenario `packageDir` must now be threaded through `test/e2e/author-emulation/scenarios.ts` and `scripts/regen-corpus.ts` (was implicit in the `defineFactory` wrap call).
- Corpus regeneration becomes a visible part of the build, not a hidden side effect.

## Alternatives Considered

1. **Thread `packageDir` through the author fn signature** — Rejected: reintroduces the per-schematic ceremony being removed; defeats the bare-contract goal.
2. **Name `runFactoryForTest` in the error string** — Rejected: lies under the future runner; locks the message to the harness.
3. **Explain both runtimes in the message** — Rejected: confuses both; the abstraction-agnostic "the call that runs this factory" is clearer.

## Related ADRs

- ADR-0050: `defineFactory` core-internal removal
- ADR-0052: Options-bag signature + single-wrap-seam delegation

## Origin

Promoted from design section 4.5 of change `bare-factory-migration` (2026-07-15). Signed spec version V2. Verified by `sdd-verify --mode=final` with verdict `pass-with-followups`. REQ coverage: REQ-ATH-01, REQ-ATH-06, REQ-ATH-11, REQ-ATH-14, REQ-ATH-17, REQ-TES-09.
