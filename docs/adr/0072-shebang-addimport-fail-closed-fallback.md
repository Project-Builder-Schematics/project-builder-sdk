# ADR-0072: REQ-TSD-01.33 Ships the Pre-Authorized Fallback — Pin Shebang Containment, Defer Insertion

**Status**: Accepted · **Date**: 2026-07-21 · **Change**: `ts-addimport-collision` (originally ADR-03)

## Context

`.33`'s primary path wanted shebang files upgraded from today's fail-closed reject to successful
insertion via `.21`'s directive-prologue mechanism (statement-index insertion).

## Decision

Ship the fallback. Empirically probed against pinned `ts-morph@28.0.0`:
`insertImportDeclaration(afterDirectiveIndex)` cleanly fixes the directive-prologue case, but
EVERY top-of-file insertion on a shebang file throws `ManipulationError: A syntax error was
inserted` — the shebang is `SourceFile` leading trivia, not a statement, so a correct insertion
needs a DIFFERENT text-surgery mechanism (strip the shebang line → insert the import → re-prepend
the shebang line — the same class of surgery `ast.ts`'s BOM handling already does), not `.21`'s
statement-index insertion. Per the spec's pre-authorized fallback: PIN the existing branded
fail-closed reject (`dialect operation failed: addImport() on "{path}" threw`, `.cause`
undefined, zero directives, byte-unchanged) as a regression guard; register shebang-aware
insertion as a `project/pending-changes` followup.

**Containment level (honest statement)**: today's shebang reject is contained at the HANDLE
level, not the op level — `addImport` does not catch anything; ts-morph's `ManipulationError`
propagates out of the op and is caught by `dialect-handle.ts`'s `#invokeContained`, which brands
it as a `dialectError` with the generic foreign-wrap tail (the same mechanism REQ-TSD-04.1
already tests for a real ts-morph parse failure).

## Consequences

- No shebang behaviour change — nothing was silently broken, so a contained reject is safe to
  ship as-is.
- Keeps this change's scope on the port + validation core; no new security surface on a sensitive
  op.
- Shebang files still cannot receive `addImport` insertions — deferred, tracked in
  `project/pending-changes` ("Shebang-aware `addImport` insertion").

## Alternatives Considered

1. **Build the text-surgery mechanism now** — Rejected: it needs its own containment,
   `newLineKind`, and security reasoning; a scope expansion the spec explicitly pre-authorized
   deferring.

## Related ADRs

- **ADR-0070**: The four-branch algorithm this scenario is a bucket of.
