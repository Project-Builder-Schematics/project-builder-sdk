# Delta for dialect-authoring-standards

**Spec version**: V3
**Status**: signed (owner, 2026-07-14 — V4 scope-reduction per foresight obs #2128)
**Change**: `author-write-surface`

(V2: no content changes in this domain — the council critique's cross-reference finding for
`docs/authoring-a-dialect.md` landed in `foundations-skeleton` REQ-KIT-03 instead, since the
finding's home is the `docs/authoring-verbs.md` entry pointing INTO this doc, not this doc's own
content. Version bumped for artefact-wide consistency across the 7-domain V2 round.)

(V3: owner-directed scope reduction at the post-design foresight gate (obs #2128) — the
importable `modify(handle, fn)` calling convention is DEFERRED out of this change, along with
its run-identity guard subsystem. REQ-DAS-01's mandate to document that form is REMOVED; the
mandate to document the CHAINED `.modify(fn)` form, the two-realms hazard, and async usage
(REQ-MC-06, unrelated to the importable form) all STAY unchanged. The cross-run-handle-reuse
documentation clause and its scenario (former REQ-DAS-01.4) are REMOVED — that clause existed
purely to cover the importable form's handle-lifetime concern (it cited `typescript-dialect`
REQ-TSD-12.4, now retired); it did not independently apply to the chained form. See
`typescript-dialect` spec's REQ-TSD-12 tombstone for the full deferral rationale.)

## MODIFIED Requirements

### REQ-DAS-01: Mandated sections, accuracy-gated over the shipped surface only

`docs/authoring-a-dialect.md` MUST document, and ONLY document, the surface this change
actually ships: `defineDialect`/`defineOpPack`/`withOps` (`dialect-generics`), the
`.replaceContent(content)` wholesale-replace verb and the `.modify(fn)` escape hatch (the
CHAINED form, `handle.modify(fn)`) and their explicit-trust posture (cross-referencing
SECURITY.md's `foundations-skeleton` REQ-STD-01 sentence), the coalescing contract's
observable shape (N edits → one modify; a read splits it — `modify-coalescing`), ASYNC USAGE
(the awaited-chain form, e.g. `await find(p).addImport(x).modify(f)`, AND forgotten-await
behaviour under the run-end join — `modify-coalescing` REQ-MC-06), and the
`@pbuilder/sdk/typescript` op-pack as the worked example. The op-pack coverage MUST document
all five shipped ops: `removeImport`, `addFunction`, `addVariable`, `addClass`, plus the
original `addImport`. It MUST NOT document unshipped surface (a second dialect, the collision
diagnostic, or the deferred importable `modify(handle, fn)` form) as if it existed. The
`.modify(fn)` coverage MUST ALSO document the TWO-REALMS hazard: the author's OWN ts-morph
realm (if they already depend on it directly) vs. the SDK's internal realm inside
`.modify(ast => …)` — Node objects/instances crossing between the two are NOT interchangeable
even when both realms load the same ts-morph version (`typescript-dialect` REQ-TSD-06's
accepted-and-documented residual risk).

(Previously: this REQ documented `.raw(ast => …)` as the ONLY AST escape hatch, and the
wholesale-replace verb was `.modify(content)` — undocumented as a distinct name since the doc
covered the escape hatch, not the string-replace verb, by that earlier name collision. This
change: the escape hatch renames to `.modify(fn)` (chained form; the importable form was
mandated content in V2, then DEFERRED at the V3/V4 foresight gate — see the domain-level V3
amendment note); the wholesale-replace verb renames to `.replaceContent(content)` and is now
explicitly named in the mandated sections. V3 REMOVES: the importable-form documentation
mandate and the cross-run handle reuse documented-unsupported clause the importable form
motivated — both deferred with REQ-TSD-12.)

#### Scenario REQ-DAS-01.1: doc names exactly the shipped API, nothing more

- GIVEN `docs/authoring-a-dialect.md` after this change
- WHEN its content is scanned against the shipped public surface
  (`defineDialect`/`defineOpPack`/`withOps`/`.replaceContent`/`.modify`/
  `addImport`/`removeImport`/`addFunction`/`addVariable`/`addClass`)
- THEN every documented API name resolves to a REAL export; no documented name refers to
  unshipped surface; neither `.raw`, a bare `.modify(content)` string-replace form, nor the
  deferred importable `modify(handle, fn)` form appears anywhere in the doc

#### Scenario REQ-DAS-01.2: the two-realms hazard section is present and guard-asserted

- GIVEN `docs/authoring-a-dialect.md`'s `.modify(fn)` coverage
- WHEN a guard test scans it (mirrors the REQ-STD-01 SECURITY.md substring guard)
- THEN a two-realms hazard section is present, naming BOTH the author's own ts-morph realm and
  the SDK's internal realm inside `.modify(ast => …)` — the guard fails RED if the section is
  removed or reverts to naming `.raw(ast => …)`

#### Scenario REQ-DAS-01.3: the Async usage section is present and guard-asserted

- GIVEN `docs/authoring-a-dialect.md`
- WHEN a guard test scans it (mirrors REQ-DAS-01.2's two-realms guard)
- THEN an "Async usage" section is present, naming BOTH the awaited-chain form and the
  forgotten-await run-end join behaviour — the guard fails RED if the section is removed

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution / third-party trust) — doc accuracy on `.modify(fn)`, two-realms hazard, cross-run handle lifetime | REQ-DAS-01 | Yes |
