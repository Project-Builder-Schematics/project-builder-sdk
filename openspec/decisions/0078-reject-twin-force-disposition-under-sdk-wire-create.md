# ADR-0078: `wire-create-reject-twin` Gains Explicit `force: true` To Stay Valid Under `sdk-wire-create`

**Status**: Accepted · **Date**: 2026-07-28 · **Change**: positive-create-conformance · **Archived**: 2026-07-29

## Context

`m2-create-composition`'s `wire-create-reject-twin` (`createRejectProbe`,
`conformance/m2-create-composition/factory.ts:21-23`) calls the public `create()` verb with
`template: "unrepresentable"`, `options: {}`, and no `force` field. ADR-0064 froze its outcome
triple to `(2, "unrepresentable", null)` under the OLD (pre-`sdk-wire-create`) engine, which
rejects EVERY wire `create` unconditionally — the specific template text was never inspected;
any `create` batch entry was refused simply because the engine did not yet support the op.

The engine's `sdk-wire-create` handoff (obs #1695, engine plan PR #185) states the NEW engine:
renders `create` at ingest against promoted options, is containment-gated, is fail-closed on
collision, and rejects the WHOLE BATCH explicitly whenever a `force` field is present on a wire
create (engine ADR-0028 amendment) — independent of collision. Reading
`docs/create-templates.md` confirms `template` is literal Go `text/template` content forwarded
byte-for-byte to the engine, never a keyword the engine specially recognizes — a plain,
action-free string like `"unrepresentable"` is an entirely ordinary, renderable template. Once
the new engine can render `create` at all, this exact probe call (no force, no collision, no
containment violation) has no engine-confirmed reason left to be rejected — it would exit 0,
silently invalidating ADR-0064's frozen triple. The handoff's own deliverable #1 ("amend
REQ-CFX-02; ADR-0064 needs NO change") is scoped narrowly to the cardinality-relaxation edit, not
a guarantee that the twin's exit behavior is unaffected by the engine's new create semantics —
nothing in the handoff, spec, or ADR-0064 states the probe remains valid without a `force`
change. Additionally, the engine's OWN two gated conformance tests are named "cardinality +
**force-reject** against real corpus" — the corpus must supply a genuine force-triggered
rejection vector for that second gated test to have anything to un-skip against.

## Decision

Add `force: true` to `createRejectProbe`'s `create()` call:

```ts
create("wire-create-reject-probe.txt", { template: "unrepresentable", options: {}, force: true });
```

This amends ADR-0064 (see that file's Amendment section) rather than superseding it: the outcome
triple stays byte-identical — `(2, "unrepresentable", null)` — because `"unrepresentable"` remains
the only batch-level rejection code this corpus's validators (`BATCH_LEVEL_CODES` in
`test/support/conformance-validators.ts`) recognize, and the handoff introduces no new distinct
code string for force-triggered rejections. Only the CAUSE reclassifies: from "the engine rejects
every create unconditionally" (old, pre-landing) to "the engine rejects any force-bearing create
explicitly" (new, engine ADR-0028 amendment). The DO-NOT-COPY comment's clause (d) is reworded to
name the force-triggered cause.

## Consequences

- The twin remains a genuine, engine-confirmed rejection vector after the engine's submodule pin
  advances past `sdk-wire-create` — it no longer depends on the unconfirmed assumption that an
  unrecognized/nonsensical template string is itself rejected.
- Directly satisfies the engine's own "force-reject against real corpus" gated test — the corpus
  now supplies the exact vector that test needs.
- ADR-0064's manifest-level pins (`outcome`, `transcript`, `factory` pointer) require ZERO edit —
  only the factory.ts call body and the DO-NOT-COPY comment change.
- Cost: a future reader of `createRejectProbe`'s source must read the (reworded) DO-NOT-COPY
  comment to understand the call is rejected BECAUSE of `force`, not because `create` itself is
  disallowed — mitigated by the reworded clause (d) and the still-present clause (b)/(c) warning
  against imitating the probe's shape.

## Alternatives Considered

- **Leave the call unchanged, rely on `"unrepresentable"` being an unrecognized/unrenderable
  template under the new engine**: Rejected — unconfirmed by the handoff or any engine artefact;
  `docs/create-templates.md` shows plain action-free strings render as ordinary literal content,
  so this assumption is more likely FALSE than true; violates REQ-CFX-11's honesty boundary by
  declaring an outcome with no supporting evidence.
- **Retire or rename the twin entirely**: Rejected — the corpus would then have zero reject probe
  for wire `create`, and REQ-CFX-02/03's quarantine-with-a-reject-example role still needs one;
  also loses the engine's needed force-reject vector entirely.
- **Pin both eras (add a second twin case for the old behavior, keep this one force-free)**:
  Rejected — YAGNI; no requirement asks for two reject twins, and the "old engine" behavior has no
  future audience once the pin advances — this would add a case with no lasting purpose.

## Related ADRs

- **ADR-0064**: The decision this amends — outcome triple stays byte-identical, cause
  reclassified.
- **ADR-0065**: Per-case `factory` override — the mechanism `createRejectProbe` and the new
  `createComposite` case both use.
