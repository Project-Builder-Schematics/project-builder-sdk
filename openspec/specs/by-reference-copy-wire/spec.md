# By-Reference Copy Wire Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-28 — micro-unfreeze V3.2→V3.3, ruling 15, deltas pre-authorized; plan-verify closed by owner override per ruling 14, see proposal.md)
**Change**: `inline-collection-marker`

V3 → V4 (archive-sync, `inline-collection-marker`, 2026-07-29): REQ-BRC-02 rationale rewritten (the retired containment family's ceiling REQ it cited no longer exists; the substantive engine-independence promise is unchanged); REQ-BRC-06 re-anchors its legitimate-origin citation onto `package-source-io-hygiene` REQ-PSH-02 and drops the retired out-of-ceiling/no-existence-oracle clause; REQ-BRC-07 re-anchors its enforcing-mechanism citation onto `ir-path-well-formedness` REQ-IPF-01/03; REQ-BRC-08.2 drops its retired post-render-check citation and becomes self-referential (a citation fix only, plan-verify finding F1, no behavioural change); the Seam Obligations Status section's REQ-BRC-02 row flips from ENGINE-GATED to LIVE on a first-hand owner verification (2026-07-28) that the engine's apply process implements ceiling validation, and its opening sentence drops the retired family's REQ-ID mention — REQ-BRC-08 remains ENGINE-GATED on its own citation alone. REQ-IDs stable; no scenario content changes beyond citation/rationale text.

V2 → V3 (owner micro-unfreeze, 2026-07-12): REQ-BRC-06 reworded — the in-fake
implementation leak (`#requireExists` mirroring FAKE-06) removed; restated as an
end-to-end harness obligation (what, not how): SDK-side containment/stat validation is
the legitimate origin, the fake is not required to re-check package disk. REQ-IDs
stable.

V1 → V2 (blind council fixes applied): REQ-BRC-07 (source path package-relative,
never absolute, S7); REQ-BRC-08 (engine path-form rejection + single-pass literal-token
render, [SEAM], S8); scenario BRC-01.2 (binary fixture — directive carries no source
contents, S6). All V1 REQ-IDs preserved.

**Shipped wire shape**: `{ op: "copyIn"; copyIn: { from: string; to: string; force?: boolean } }`
(ADR-0043) — `sdd-design` resolved the wire-encoding decision this domain deliberately
left open: a NEW, additive op rather than a `copy` source discriminator.

## Purpose

Pins the SEMANTIC contract of the by-reference copy directive. Every requirement below
is phrased in terms of "the by-reference directive"; the shipped encoding is the
`copyIn` op (see above).

**Evidence boundary (binding, restated from proposal Success Criteria)**: SDK-side
verification of by-reference copy is DIRECTIVE EMISSION + fake/conformance simulation
+ `dryRun()` visibility ONLY. No scenario in this domain (or any domain) asserts bytes
land in `result.tree` or on disk — that is engine-gated (PC-PROTO-01).

## Requirements

### REQ-BRC-01: Emission Contract — Directive Shape Agnostic

The SDK MUST emit, for every by-reference copy, a directive carrying: a package-local
source path, a destination `pathTemplate` (tokens allowed, per `folder-scaffold`
REQ-FSC-05), and a `force` flag. The exact wire encoding (a dedicated op, or a
discriminated `copy` variant) is NOT pinned here — this REQ pins only that these
three semantic fields are present and machine-distinguishable from a by-value
`create` directive.

#### Scenario REQ-BRC-01.1: By-reference directive is distinguishable from by-value [SDK]

- GIVEN one by-value (`create`) and one by-reference emission in the same batch
- WHEN the emitted batch is inspected
- THEN the by-reference entry is structurally distinguishable from the `create`
  entry (whatever the design-ratified encoding), carrying source path, destination
  `pathTemplate`, and `force`

#### Scenario REQ-BRC-01.2: Directive carries a path REFERENCE, never the source's contents [SDK]

- GIVEN a `copyIn` over a BINARY fixture with known distinctive byte content
- WHEN the emitted directive's full serialized form is scanned
- THEN NO field of the directive contains the source file's contents (raw, escaped,
  or base64-encoded) — the directive references the source by path only

### REQ-BRC-02: Engine Re-Derives Containment Ceiling — SDK Value Never Wire-Authoritative

The SDK MUST NOT place any resolved anchor value on the wire as an authoritative
containment root the engine trusts. The engine independently re-derives its own ceiling
from its own invocation context and re-checks containment at apply time — the ONLY real
security control.

#### Scenario REQ-BRC-02.1: No SDK-resolved root value appears on the wire as authoritative [SEAM] [preservation-pin]

- GIVEN a by-reference directive emitted by the SDK
- WHEN its wire shape is inspected
- THEN it carries no field presented as an authoritative containment root for the
  engine to trust as-is — this documents the seam contract; the engine's own
  re-derivation is exercised in the engine's suite, not here

### REQ-BRC-03: Additive Wire Widening — By-Value Half Unaffected

Introducing the by-reference directive MUST NOT alter the existing `create` directive
shape, its collision semantics, or any other existing wire op. The by-value half of
this change (scaffold's rendered path, `create({templateFile})`) rides the EXISTING
`create` IR with zero engine contract change — only the by-reference half is a new,
additive wire surface.

#### Scenario REQ-BRC-03.1: Existing `create` directive shape is byte-identical pre/post this change [SDK]

- GIVEN the `create` directive shape before and after this change lands
- WHEN diffed
- THEN it is unchanged — the addition is purely additive

### REQ-BRC-04: Evidence Boundary — SDK-Side Verification Scope

By-reference copy MUST be verifiable SDK-side ONLY as: (a) directive emission (shape,
paths, `force`, containment rejection) [SDK]; (b) fake/conformance simulation
(REQ-BRC-06, `author-test-harness` REQ-ATH-15/16) [SDK]; (c) `dryRun()` visibility
(`dry-run-plan-exposure` REQ-DRE-05) [SDK]. No test anywhere in this change MAY assert
that by-reference bytes land in `result.tree` or on disk — real end-to-end byte-copy
evidence is deferred until the engine's apply pass lands (PC-PROTO-01).

#### Scenario REQ-BRC-04.1: No test asserts on-disk/result.tree by-reference bytes [SDK]

- GIVEN the full by-reference test suite this change ships
- WHEN reviewed against this boundary
- THEN zero assertions check `result.tree` content or filesystem bytes for a
  by-reference target path — only emission/simulation/dryRun assertions exist

### REQ-BRC-05: Collision With/Without `force`

A by-reference directive targeting an existing destination without `force` MUST reject
fail-closed with a `path-collision`-family reason; with `force: true` it overwrites
(mirroring the existing `create`/`rename`/`move`/`copy` collision contract).

#### Scenario REQ-BRC-05.1: By-reference collision without force rejects; with force overwrites [SDK]

- GIVEN a fake seeded with a file at the by-reference directive's destination path
- WHEN emitted without `force`, then again with `force: true`
- THEN the first rejects with a `path-collision`-family reason; the second overwrites

### REQ-BRC-06: Missing Source Surfaces `source-not-found` — End-to-End Obligation

A by-reference directive whose package-local source does not exist MUST surface an
`AuthoringError` with reason `source-not-found` through the harness run
(`author-test-harness` REQ-ATH-15.2). The SDK-side guarded existence check
(`package-source-io-hygiene` REQ-PSH-02) is the legitimate origin of this rejection —
the fake is NOT required to re-check package disk; this REQ pins the author-visible
outcome, not the enforcement site.

#### Scenario REQ-BRC-06.1: Missing package-local source surfaces source-not-found through the harness [preservation-pin]

- GIVEN a factory emitting a by-reference copy for a source path that does not exist in
  the package
- WHEN run via the harness
- THEN the run rejects with an `AuthoringError` whose reason is `source-not-found`
  (`authoring-error-contract` REQ-AEC-10)

### REQ-BRC-07: Emitted Source Path Is Package-Relative, Never Absolute

The by-reference directive's source path MUST be emitted PACKAGE-RELATIVE — never an
absolute filesystem path. An absolute path on the wire would leak the author's
filesystem layout to the engine AND invite the engine to trust an SDK-resolved location
(violating REQ-BRC-02's re-derivation posture). The enforcing mechanism is
`ir-path-well-formedness` REQ-IPF-01/03's lexical screen: an absolute source is rejected
before any directive is built, so a package-relative path is the only form that can ever
reach emission.

#### Scenario REQ-BRC-07.1: No absolute filesystem path appears in the emitted directive [preservation-pin]

- GIVEN by-reference directives emitted via `copyIn` and via a by-reference `scaffold`
  entry
- WHEN each directive's full serialized form is scanned
- THEN no absolute filesystem path appears anywhere in it — the source field is
  package-relative

### REQ-BRC-08: Engine Path-Form and Render Hardening — Seam Contract

The engine MUST reject, fail-closed, source AND rendered-destination paths in
non-canonical filesystem forms: UNC (`\\host\share`), device namespace (`\\.\`, `\\?\`),
reserved DOS device names (`CON`, `NUL`, `COM1`, …), and drive-relative (`C:foo`) forms.
The engine's `pathTemplate` render MUST be SINGLE-PASS: substituted token values are
treated as LITERAL path segments — never re-scanned for tokens, traversal sequences, or
path-form reinterpretation after substitution. These are contract obligations on the
engine seam, not SDK-runnable tests.

#### Scenario REQ-BRC-08.1: Non-canonical path forms rejected at apply time [SEAM] [ENGINE-GATED] [preservation-pin]

- GIVEN a by-reference directive whose source or rendered destination is a UNC,
  device-namespace, reserved-DOS-name, or drive-relative path
- WHEN the engine applies it
- THEN the engine MUST reject it fail-closed — documented seam contract, exercised
  in the engine's own suite

#### Scenario REQ-BRC-08.2: Substituted token values are literal — no second render pass [SEAM] [ENGINE-GATED] [preservation-pin]

- GIVEN a `pathTemplate` whose token value substitutes to a string containing `../`
  or `{= =}`-shaped text
- WHEN the engine renders it
- THEN the substituted value is treated as a literal segment (subject to the engine's
  own post-render containment check, REQ-BRC-08 itself) and is NEVER re-scanned as
  template or traversal syntax — single-pass render, documented seam contract

## Seam Obligations Status (as of archive-sync, 2026-07-29)

REQ-BRC-02 [LIVE, first-hand owner verification 2026-07-28: the engine's apply process
implements ceiling validation — it validates the resolved path and rejects with an error
on escape] and REQ-BRC-08 are ENGINE-GATED — the latter registered in
`openspec/pending-changes.md` § "From schematic-local-files", owner = engine repo,
cross-repo, tied to PC-PROTO-01, **committed-next scheduled** (owner affirmation,
2026-07-13, not yet superseded for REQ-BRC-08). Until the engine lands REQ-BRC-08, engine
path-form/render hardening is contract-only for that obligation; REQ-BRC-02's ceiling
re-derivation is confirmed shipped (see above) — by-reference bytes still never land on
real disk for any verb in THIS SDK's own test suite (REQ-BRC-04).

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (containment, new disk-read surface) | REQ-BRC-02 (rationale rewrite), REQ-BRC-06, REQ-BRC-07, REQ-BRC-08 (citation fix) | Yes |
| public-api (wire contract) | REQ-BRC-01, REQ-BRC-03 (unchanged) | Yes |
