# ADR-0060: Option Value-Lowering at DirectiveFactory Is Wire Shaping, Not Rendering — Amends KIT-03 (ADR-0013)

**Status**: Accepted · **Date**: 2026-07-18 · **Change**: typed-options-feeder

## Context

ADR-0013 (KIT-03) pins `DirectiveFactory` as "pure args→Directive; never renders templates, never touches AST." When adding JSON-encoding for native array/object option values at the factory, the council asked whether this transform breaches that KIT-03 invariant.

## Decision

Amend ADR-0013 to distinguish **wire value-lowering** — adapting a `JsonValue` to the shape the engine's wire consumes — from **template rendering** and **AST manipulation**, both of which remain banned.

JSON-encoding a serializable option value is wire value-lowering: a shallow per-entry transform that sits one layer above the JSON-RPC wire boundary. The factory already performs wire shaping via the `forceEntry` helper (key-omission); adding a shallow per-entry `JSON.stringify` for composite values is categorically the same class of transform.

Encoding is shallow/top-level only: one `JSON.stringify` call per composite entry (per `typed-options-encoding` REQ-TOE-01); nested content rides inside that single call. The implementation lives in an exported `encodeOptions` helper in `src/core/directive-factory.ts`, making the decision→code mapping direct.

## Consequences

- Authors can pass native arrays/objects in `options` everywhere the API accepts them, closing a DX gap.
- `template` / `pathTemplate` bytes continue to cross the wire verbatim — no rendering occurs.
- The baseline's factory-purity characterization ("pure args→Directive") requires clarification on next architecture refresh to note the value-lowering exception.
- `create()` runtime output changes for composite option values — existing golden fixtures must re-record to the post-encode wire form.

## Alternatives Considered

1. **Encode in the verb layer (`commons`/`expander`)** — Rejected: two live call sites would duplicate the transform, and the budget estimate in `classify-transport` would remain broken (still measuring pre-encode option shape).
2. **Encode at `Session.flush()`** — Rejected: couples the op-blind flush to create-specific knowledge and still misses the pre-flush budget estimate layer.

## Related ADRs

- **ADR-0013** (KIT-03): Factory purity invariant (amended by this decision).
- **ADR-0061**: String passthrough as the backward-compat mechanism.
- **ADR-0062**: Interim plain-`Error` reject + independent `createOp` oracle.
