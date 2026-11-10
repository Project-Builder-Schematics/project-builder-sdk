# ADR-0082: `create` Options Cross the Wire as Native JSON — Supersedes ADR-0060

**Status**: Accepted · **Date**: 2026-11-10 · **Change**: `native-json-create-options` (sdk#150)

## Context

ADR-0060 let `DirectiveFactory` JSON-encode each top-level array or plain-object `create`
option into a string, because the engine's v1 wire only promoted a string beginning `[` or `{`
into a real structure before rendering.

The engine no longer wants that promotion. engine#286 decision D3: "Remove the `PromoteValue`
JSON coercion. The engine passes inputs through exactly as received … A factory that wants JSON
sends JSON in the IR." Engine ADR-0028 already defines `options` as "an arbitrary JSON data
context (objects, strings, numbers, booleans, arrays)", and the engine's wire type is
`map[string]any`; promotion runs only on string values, so a native array renders the same as
the stringified one today. The engine cannot drop promotion while the SDK still sends strings,
so the SDK moves first.

## Decision

The factory validates `create` options and forwards them as native JSON. `encodeOptions`
(`src/core/directive-factory.ts`) keeps its `assertEncodable` walk (REQ-TOE-04) and its
prototype-safe assembly (REQ-TOE-05); the walk now returns a structural copy of each array or
plain object instead of the factory calling `JSON.stringify` on it. `structuredClone` is not an
option: the runner-integrity manifest default-denies that global (Constraint 4). Strings,
numbers, booleans and `null` pass through unchanged; a string that starts with `[` or `{` stays
a string.

The copy is load-bearing:

- it snapshots the author's value when `create` is called, as the string encoding did, so a
  later mutation cannot change the queued batch;
- it keeps a nested `NaN`/`Infinity` as a number, so the contract fake's flush-time round-trip
  guard rejects it as `unrepresentable-content`, the same outcome a top-level `NaN` already had,
  instead of it silently becoming `null` inside a string;
- it turns a null-prototype container into a plain object.

`classify-transport` keeps measuring the prospective directive through the same `encodeOptions`
(fit-39), so the budget estimate sees the native form the emitter sends.

## Consequences

- Recorded batches in `@pbuilder/sdk/testing` show the native values the author passed. Author
  tests that assert on a composite option as a JSON string break; this ships as a breaking change
  in 0.13.0.
- The factory performs no value-lowering on options any more. ADR-0013's wire value-lowering
  exception reduces to validation plus a structural copy.
- ADR-0061's string passthrough still holds in the SDK, but its "both directions work
  identically" consequence ends when the engine removes promotion: a hand-stringified option
  then renders as the string it is. Authors should pass native arrays and objects.
- The engine may remove `PromoteValue`, `promoteParams` and `promoteOptions` only after it pins
  an SDK release that contains this change. An old SDK against an engine without promotion would
  break `range` over composites.

## Alternatives Considered

1. **Keep stringifying until the engine removes promotion, then switch** — Rejected: a lockstep
   release. Native JSON already renders correctly against the promoting engine, so the SDK can
   ship first.
2. **Forward the author's value by reference, no copy** — Rejected: a mutation after `create`
   would leak into the queued batch, and the mutation window spans the whole factory run.

## Related ADRs

- **ADR-0060**: Superseded by this decision.
- **ADR-0013** (KIT-03): factory purity; its ADR-0060 amendment now points here.
- **ADR-0061**: string passthrough, unchanged in the SDK.
- **Engine ADR-0028**: `options` is arbitrary JSON. **Engine ADR-0065**: render data is the inputs as given.
