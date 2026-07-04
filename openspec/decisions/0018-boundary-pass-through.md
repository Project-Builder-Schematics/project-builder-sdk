# ADR-0018: Boundary pass-through — the SDK never validates; the engine judges at the single seam

- Status: Accepted
- Date: 2026-07-04
- Deciders: Daniel (Hyperxq)
- Builds on: `openspec/problem-statement.md` invariant #5 (single engine boundary); ADR-0001
  (SDK emits wire directives); ADR-0015 (EngineClient port); ADR-0017 (normative fake).
- Closes: DECISION D6 (`openspec/objectives-plan.md`, Stage 1.7) — in the **pass-through**
  direction, replacing the gap-review framing that had the SDK possibly validating.

## Context

An adversarial gap review found three edges where "correct IR" was undefined: author-path
validity, runtime serializability of `create` options, and intra-batch conflicting directives.
The original D6 framing asked whether the SDK should validate them. The owner ruled
(2026-07-04): **the engine owns all file control; the SDK only sends and receives through one
abstraction.** Validation inside the SDK would duplicate engine judgment and split authority
across the seam.

## Decision

The SDK is a **verbatim conduit**; judgment lives on the engine side of the `EngineClient`
port. Concretely:

1. **Paths: verbatim pass-through.** The SDK performs zero validation or normalization of
   author-supplied paths — absolute, `../`, empty, or `\`-separated strings travel to the wire
   untouched. (The `posix.join`/`dirname`/`basename` calls in `src/commons/index.ts` are
   handle-position bookkeeping for the fluent chain, NOT validation — that distinction is
   documented at those call sites.) The fake, as the normative counterpart (ADR-0017), owns
   path-acceptance semantics; a path the engine rejects surfaces to the author via the Stage 2
   attribution contract like any other engine rejection.
2. **Runtime serializability: no verb-level guard.** The type surface (`JsonValue`) is the
   author-facing contract; the SDK adds no runtime type-checking in the verbs. Instead the
   boundary models the wire: the fake's `emit` performs a JSON round-trip on the batch, so what
   the fake applies is exactly what a real engine would deserialize. Non-serializable options
   (functions, circular refs, `undefined`-collapsing) therefore fail AT THE SEAM as
   engine-judged errors — attributed like any rejection — not in SDK verb code.
3. **Intra-batch conflicts: emit in author order; the engine judges.** The SDK never de-dupes,
   reorders, or cross-validates buffered directives (create-then-remove of one path, two
   creates on one path, modify-after-remove all emit as authored). The eager-application model
   gives the engine everything it needs to judge each directive in sequence; the applied
   boundary on rejection is the author's observability.

## Consequences

- The `EngineClient` port is ratified as the **sole engine I/O seam** — every input from the
  engine (read results, rejections) and every output to it (batch, commit, discard) crosses it;
  a structural fitness guard (FIT-10, objectives-plan Stage 1.8) enforces that no module outside
  `src/core` reaches the port or wire encoding.
- The fake grows wire-modeling fidelity (JSON round-trip on emit; pinned path-acceptance
  semantics; pinned conflict-sequence behavior) — objectives-plan Stage 1.7.
- Stage 2 attribution inherits three new rejection families (path, serialization, conflict) with
  no new SDK vocabulary — they are engine rejections like any other.
- Golden-IR fixtures may legitimately pin "odd" paths verbatim; correctness of the SDK is
  faithful transport, not judgment.
