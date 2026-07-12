# Dialect Authoring Standards Specification

**Spec version**: V3
**Status**: signed (owner, 2026-07-11 — V3; join deltas ratified)
**Change**: `stage-5-first-dialect`

## Purpose

The minimal, ACCURATE dialect-authoring doc — upgrading `docs/authoring-a-dialect.md` from
its `foundations-skeleton` titled-outline stub to real content, scoped to exactly what THIS
change ships (B4: accuracy-gated over the shipped surface only). The SECURITY.md guard test
and its `.raw()`-specific trust sentence live in `foundations-skeleton` REQ-STD-01 (MODIFIED
by this change) — this domain owns the authoring doc's own content requirements.

## Requirements

### REQ-DAS-01: Mandated sections, accuracy-gated over the shipped surface only

`docs/authoring-a-dialect.md` MUST document, and ONLY document, the surface this change
actually ships: `defineDialect`/`defineOpPack`/`withOps` (`dialect-generics`), the `.raw()`
escape hatch and its explicit-trust posture (cross-referencing SECURITY.md's REQ-STD-01
sentence), the coalescing contract's observable shape (N edits → one modify; a read splits
it — `modify-coalescing`), ASYNC USAGE (the awaited-chain form, e.g.
`await find(p).addImport(x).raw(f)`, AND forgotten-await behaviour under the run-end join —
`modify-coalescing` REQ-MC-06), and the `@pbuilder/sdk/typescript` op-pack as the worked
example. The op-pack coverage MUST document all five shipped ops: `removeImport`, `addFunction`,
`addVariable`, `addClass`, plus the original `addImport`. It MUST NOT document unshipped surface
(a second dialect, the collision diagnostic) as if it existed. The `.raw()` coverage MUST ALSO
document the TWO-REALMS hazard: the author's OWN ts-morph realm (if they already depend on it
directly) vs. the SDK's internal realm inside `.raw(ast => …)` — Node objects/instances
crossing between the two are NOT interchangeable even when both realms load the same ts-morph
version (`typescript-dialect` REQ-TSD-06's accepted-and-documented residual risk).

#### Scenario REQ-DAS-01.1: doc names exactly the shipped API, nothing more

- GIVEN `docs/authoring-a-dialect.md` after this change
- WHEN its content is scanned against the shipped public surface
  (`defineDialect`/`defineOpPack`/`withOps`/`.raw`/`addImport`/`removeImport`/`addFunction`/
  `addVariable`/`addClass`)
- THEN every documented API name resolves to a REAL export; no documented name refers to
  unshipped surface

#### Scenario REQ-DAS-01.2: the two-realms hazard section is present and guard-asserted

- GIVEN `docs/authoring-a-dialect.md`'s `.raw()` coverage
- WHEN a guard test scans it (mirrors the REQ-STD-01 SECURITY.md substring guard)
- THEN a two-realms hazard section is present, naming BOTH the author's own ts-morph realm and
  the SDK's internal realm inside `.raw()` — the guard fails RED if the section is removed

#### Scenario REQ-DAS-01.3: the Async usage section is present and guard-asserted

- GIVEN `docs/authoring-a-dialect.md`
- WHEN a guard test scans it (mirrors REQ-DAS-01.2's two-realms guard)
- THEN an "Async usage" section is present, naming BOTH the awaited-chain form and the
  forgotten-await run-end join behaviour — the guard fails RED if the section is removed

### REQ-DAS-02: Two-audience split is visible in the doc

The doc MUST visibly distinguish the AUTHOR surface (schematic authors consuming
`@pbuilder/sdk/typescript`, e.g. `find(path).addImport(x)`) from the CONTRIBUTOR surface
(dialect authors calling `defineDialect`/`defineOpPack`/`withOps`) — per ADR-0009's
two-audience boundary. The contributor-facing section MUST NOT include an author-style
runnable demo line; its worked proof anchors are the conformance kit
(`@pbuilder/sdk/conformance`) and the type-level composition proofs (REQ-DG-02.1), referenced
by name.

#### Scenario REQ-DAS-02.1: contributor section has no demo line, only kit + type-proof anchors

- GIVEN the doc's contributor-facing section
- WHEN scanned
- THEN it contains no author-style runnable code demo; it names `testDialect`/`testOpPack`
  and the `expectTypeOf` composition pin as its verification anchors

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution / third-party trust) — doc accuracy on `.raw()` | REQ-DAS-01 | Yes |
