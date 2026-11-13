# ADR-0065: Per-Case `factory` Override for the Multi-Behaviour Composition Fixture

**Status**: Accepted · **Date**: 2026-07-19 · **Change**: conformance-corpus

## Context

`m2-create-composition` must carry TWO behaviours in ONE fixture — a positive `modify` and a
`wire-create-reject-twin` that emits a raw wire `create` (REQ-CFX-02's sole exception) — but the
handoff's manifest schema pins ONE fixture-level `factory` and offers no per-case discriminator.
The handoff is underspecified for this shape. Verified non-viable alternatives: (1) two fixtures
— the handoff forbids it (twins are cases on the same fixture); (2) input-branching one default
export — needs a schema extension AND puts a create path inside the positive factory, muddying
the CFX-02/03 representable-ops quarantine. The umbrella boundary (ADR-0009) also blocks the
handoff's `currentContext().session.buffer` alternative: it resolves into `src/core/**`,
unavailable through `../../src/index.ts` without breaching REQ-CFX-01.

## Decision

Extend the manifest schema with a per-case `factory` override. The positive case uses the
default export (`modify`); `wire-create-reject-twin` selects a separate named export
`createRejectProbe` (public `create()`, the compliant path, sufficient — representable-at-SDK,
rejected-at-engine per ADR-0064) carrying the DO-NOT-COPY header (REQ-CFX-03). The mechanism
generalized beyond this one fixture: 5 of the corpus's 12 cases now use a per-case `factory`
override (`notFoundProbe`×2, `dirTargetProbe`, `collisionProbe`, `dirSourceProbe`,
`createRejectProbe`), not only the composition fixture the original context named — see W3 in
the change's verify-report for the doc-scope gap this leaves in the ADR's own prose.

## Consequences

- Create stays quarantined in a marked, separate export.
- The umbrella-only invariant (REQ-CFX-01) holds.
- Introduces a schema field beyond the handoff — the engine loader must honor it, gated on
  sign-off before the submodule pin advances.
- Blocked PR#2's composition manifest until the engine confirmed the schema delta.

## Alternatives Considered

1. **Input-branching a single default export** — Rejected: needs its own schema extension and
   mixes a create path into the positive factory.
2. **Two fixtures** — Rejected: the handoff requires twins to be cases on the same fixture.
3. **Naming it `wireCreateRejectProbe`** — Rejected (tech-writer finding): "wire" falsely
   implies a raw bypass the ADR rejects; it authors a legitimate public `create()`, hence
   `createRejectProbe`.

## Related ADRs

- **ADR-0009**: Umbrella author-surface boundary — blocks the `session.buffer` alternative this
  decision rejected.
- **ADR-0064**: Freezes the outcome triple this probe's factory export produces.
