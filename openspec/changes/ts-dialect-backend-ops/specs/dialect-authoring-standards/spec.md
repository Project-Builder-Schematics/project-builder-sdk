# Delta for dialect-authoring-standards

**Spec version**: V2
**Status**: draft
**Change**: `ts-dialect-backend-ops`
**REQs / Scenarios**: 1 / 5 (V1: 1/4)

## Changelog — V1 → V2 (council-spec-v1.md finding resolution)

| ID | Finding | Resolution |
|---|---|---|
| m8 | REQ-DAS-01.4's THEN overstates what a substring guard can mechanically verify | APPLIED — reworded to the actual mechanical assertion (substring/keyword presence, not full-semantic "documented" claim) |
| — | `addVariable.kind` runtime validation (ruling f, REQ-TSD-21) introduces an 8th author-touchpoint outside the "seven new ops" scope REQ-DAS-01.4 already names | APPLIED — new scenario REQ-DAS-01.5 extends doc-coverage to this existing-op behaviour change, consistent with the honesty discipline BA praised in V1 (asymmetry surfaced at author touchpoints) |

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
all TWELVE shipped ops: the five carried forward (`addImport`, `removeImport`, `addFunction`,
`addVariable`, `addClass`) plus the seven Group-1 import/export ops (`addDefaultImport`,
`addNamespaceImport`, `addTypeImport`, `addSideEffectImport`, `addReExport`, `addExportAll`,
`removeExport`) — including, for the seven new ops, their idempotency identity, collision/merge
semantics (Spec Decisions 1-10, `typescript-dialect` spec), and the identifier-validation
rejection boundary (`typescript-identifier-validation` REQ-TIV-01). It MUST NOT document
unshipped surface (a second dialect, the collision diagnostic, `export * as ns`, or the deferred
importable `modify(handle, fn)` form) as if it existed. The `.modify(fn)` coverage MUST ALSO
document the TWO-REALMS hazard: the author's OWN ts-morph realm (if they already depend on it
directly) vs. the SDK's internal realm inside `.modify(ast => …)` — Node objects/instances
crossing between the two are NOT interchangeable even when both realms load the same ts-morph
version (`typescript-dialect` REQ-TSD-06's accepted-and-documented residual risk).

(Previously: the op-pack coverage mandate listed five ops — `addImport`, `removeImport`,
`addFunction`, `addVariable`, `addClass`. This change widens the mandate to twelve, adding the
per-op idempotency/collision/validation documentation obligation the seven new ops introduce.
No other clause of this REQ changes.)

#### Scenario REQ-DAS-01.1: doc names exactly the shipped API, nothing more

- GIVEN `docs/authoring-a-dialect.md` after this change
- WHEN its content is scanned against the shipped public surface
  (`defineDialect`/`defineOpPack`/`withOps`/`.replaceContent`/`.modify`/ the 12 dialect ops)
- THEN every documented API name resolves to a REAL export; the verb-guard loop
  (`test/docs/security-authoring-guard.test.ts`, REQ-DAS-01.1) is hand-extended from 5 to 12
  dialect op names (pending-changes row (16): the array stays hand-edited — no
  derive-from-op-pack-type refactor in this change); no documented name refers to unshipped
  surface; neither `.raw`, a bare `.modify(content)` string-replace form, `export * as ns`, nor
  the deferred importable `modify(handle, fn)` form appears anywhere in the doc

#### Scenario REQ-DAS-01.4: op-pack coverage documents idempotency, collision, and validation for the 7 new ops (REWORDED, V2 — m8)

- GIVEN `docs/authoring-a-dialect.md`'s op-pack section after this change
- WHEN a guard test scans it for the seven new op NAMES followed within N lines by the
  substrings `"idempot"`, a collision/merge keyword (`"merge"`/`"reject"`/`"collision"`), AND
  `"dialectError"`
- THEN each of the seven new op names has ALL THREE substrings present in its vicinity — this is
  the mechanical claim a substring guard can actually verify (presence of the required
  vocabulary near each op name), NOT a semantic claim that the documented explanation is
  correct or complete; a guard test fails RED if any of the seven new op names is present in the
  surface scan (REQ-DAS-01.1) but missing one of the three required substrings nearby

#### Scenario REQ-DAS-01.5: op-pack coverage documents the `addVariable.kind` validation touchpoint (NEW, V2)

- GIVEN `docs/authoring-a-dialect.md`'s op-pack section after this change
- WHEN a guard test scans the `addVariable` entry
- THEN it carries the substrings `"kind"` and `"dialectError"` in vicinity — the runtime
  validation this change adds to an EXISTING op (`typescript-dialect` REQ-TSD-21, ruling f) is
  an author-facing behaviour change and MUST be documented at its point of use, the same
  honesty-at-touchpoints discipline already applied to the seven new ops

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
| security (code execution / third-party trust) — doc accuracy on the widened op-pack | REQ-DAS-01 | Yes |
