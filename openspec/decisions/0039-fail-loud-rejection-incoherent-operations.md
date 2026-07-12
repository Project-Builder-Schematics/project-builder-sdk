# ADR-0039: Fail-loud rejection of author-incoherent dialect operations

- Status: Accepted
- Date: 2026-07-12
- Change: `stage-5b-dialect-breadth` (S-001, S-002)
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0037 (runOp containment), ADR-0010 (withOps composition), REQ-MC-08 (row-136 characterisation)

## Context

Two author actions today either silently lose data or produce invalid TS:
`.modify(content)` after an open AST op wins array-order and drops the AST edit (row-136,
verified live); and a second top-level declaration under an existing value name yields invalid
TS. `addImport`, by contrast, MERGES (imports coexist safely). Owner rulings #3/#4 pinned both
new cases as `dialectError` REJECTS (not the public `AuthoringError` — growing its closed
`reason` union is a deferred MAJOR).

## Decision

Reject both, fail-loud, with a contained `dialectError`. (a) **Row-136**: inside
`runModify`'s enqueued step, throw when the handle's own open directive is still pending —
predicate `this.#openDirective !== undefined && session.isPending(this.#openDirective)`, the
IDENTICAL condition `#ensureOpen` already tests. Asymmetric and directional: `.modify()` with
no pending AST op is unchanged; `.read()` drains (documented escape); AST-op-after-modify is
unchanged. A GREEN characterisation test pinning today's silent LWW lands FIRST, then is
REPLACED by the reject scenarios in the SAME slice. (b) **Add-op collision**: each add-op calls
`assertNoCollision(ast, name)` — rejects when a VALUE-namespace declaration
(`function`/`const`/`let`/`var`/`class`/`enum`/`namespace`) OR an import binding exists under `name`, cross-kind;
`type`/`interface` are exempt (legal TS coexistence). The collision reject is constructed via
`dialectError()` **imported** from `../../core/dialect-error.ts` — LOAD-BEARING: only then does
the thrown error carry the WeakSet brand, so `#invokeContained`'s `isContained` passthrough
(REQ-DG-06.5) recognises it instead of double-wrapping. This does NOT breach FIT-08: FIT-08 bans
RE-EXPORTING kit symbols from author subpaths (it scans `export { … }` brace-lists on a fixed
path set); `ops.ts` is not in that scanned set at all, `dialectError`/`isContained` are not in
`KIT_SYMBOL_NAMES`, and IMPORTING (not re-exporting) from core is already how
`dialects/typescript/index.ts` obtains `defineDialect`/`defineOpPack`/`withOps`. The earlier
"reproduce the prefix as a leaf literal, do not core-import — FIT-08" reading was wrong and is
dropped; there is no duplicated contract literal.

## Consequences

(+) no silent data loss; fail-loud coherence for security-motivated edits.
(+) declarative desired-state mental model for authors. (−) an asymmetry with `addImport`
(merge) authors must learn — documented. (−) the leaf takes a compile-time import edge on the
kit-internal `dialect-error.ts` factory (legal, already the norm for `define-dialect.ts`) —
accepted as the cost of the unforgeable WeakSet brand.

## Alternatives considered

**Document row-136 as UB** — rejected: ships the silent-data-loss footgun ADR-0037 explicitly
refused for the await problem. **Grow `AuthoringError.reason`** — rejected: closed-union MAJOR,
deferred out by the row-141 split.
