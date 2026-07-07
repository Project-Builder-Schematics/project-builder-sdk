# ADR-0030: Scoping ADR-0018 — author-input-contract conformance is SDK-owned upstream of the wire

- Status: DRAFT (Proposed; promoted at stage-4-typed-options archive)
- Date: 2026-07-06
- Change: `stage-4-typed-options`
- Amends/Scopes: ADR-0018 (boundary pass-through — "the SDK never validates")

## Context

ADR-0018 ruled that the SDK is a verbatim conduit: WIRE-level judgments — author-path validity, runtime
serializability, intra-batch conflicts — are engine-owned at the `EngineClient` port. Read literally
("the SDK never validates"), it appears to forbid this change's run-boundary schema validation. The
pre-archive architecture audit gate would halt `architecture-audit-violations` without a formal scoping
of ADR-0018 (council finding arch-F1). The two validations operate on different objects at different
sites and answer different questions.

## Decision

ADR-0018's non-validation ruling is scoped to WIRE-level judgments at the `EngineClient` port and remains
fully in force there. This change adds a DISTINCT, upstream responsibility: schema-conformance of the
author's OWN declared input contract (`schema.json` ↔ resolved input `o`), enforced at the pre-`als.run`
run boundary BEFORE any directive is staged or reaches the wire. This is not wire judgment — it validates
the author's input against the author's own declared schema, a plane the engine has no visibility into.

Boundary, explicitly:

1. **Author input contract (SDK-owned, new)**: type/shape/required/excess/reserved/prototype-key
   conformance of `o` against `schema.json`, at the run boundary. Rejections are `authoring-rejected`.
2. **Wire judgments (engine-owned, unchanged — ADR-0018)**: path validity, serializability, intra-batch
   conflicts, batch size — judged at the seam by the engine/normative fake.
3. **Path-shaped input VALUES** are validated here ONLY against the declared schema type/shape; their
   eventual use as a wire-level path stays ADR-0018 engine territory, passed through untouched (SEC-m1).

## Consequences

- The architecture audit passes: run-boundary validation is a documented, scoped-in responsibility, not a
  breach of ADR-0018 — the "single seam judges" invariant #5 holds at the wire.
- Cost: the SDK now owns two validation planes; the code and docs must keep the site distinction visible
  (a test asserts the SITE, not merely that some rejection occurred — REQ-RBV-01.1).
- Enables Stage 4's fail-closed input contract without duplicating or splitting engine authority.

## Alternatives Considered

- **Route input validation through the engine/emit seam**: mis-attributes an author-input error to the
  wire (`unrepresentable-content`), collapses the site distinction the spec requires, and defers a
  cheap author-side check to a far-away failure.
- **Leave ADR-0018 unscoped and rely on prose**: the audit gate halts on the literal "never validates";
  the distinction must be recorded as a decision, not assumed.
