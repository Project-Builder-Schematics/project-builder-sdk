# Triage: Typed Feeder for Array/Object `create` Options

**Classification**: M
**Decided at**: 2026-07-18T00:00:00Z
**Change name**: `typed-options-feeder`

## Problem & Scope

> Schematic authors must manually `JSON.stringify` array- and object-valued `create` options at every call site for the engine's v1 wire to render them (the engine promotes string values beginning with `[` or `{` into real arrays/objects before rendering). This is SDK-owned DX friction — the author should not need to know how options travel the wire. Owner-ruled 2026-07-18 (`openspec/pending-changes.md:473`): resolves SDK-side. Why now: the create-template guide just shipped (`docs/create-templates.md`, PR #36) documenting the call-site workaround; closing the gap while the surface is fresh keeps the doc's appendix short-lived.

```yaml
scope:
  in_scope:
    - "an intermediate conversion/validation step at the SDK's wire boundary that JSON-encodes array- and object-valued option values"
    - "ALL surfaces that emit options — create() inline template, create({templateFile}), and scaffold expansion — one choke point, no surface left inconsistent"
    - "docs update on landing: docs/create-templates.md § Appendix + §1 example move to native arrays"
    - "tests per Strict TDD"
    # Amendment (orchestrator, 2026-07-18, plan-verify iter 1 Judge A observation):
    # three correctness CONSEQUENCES of the choke-point move, recorded as in-scope
    # consequences rather than new scope — they exceed the four bullets above but
    # follow necessarily from them:
    - "consequence: scaffold budget estimator (classify-transport) measures post-encode bytes (REQ-CCL-02 delta)"
    - "consequence: recorded batches / createOp oracle parity reflects encoded wire form (REQ-TOE-07)"
    - "consequence: dryRun() stays options-blind — regression guard (REQ-TOE-08)"
  out_of_scope:
    - "engine-side changes (PC-PROTO-01 native-JSON ratification)"
    - "pbuilder-codegen typed-options schema changes"
    - "any new template-language feature"
```

## Description Received

DX gap discovered while adapting the engine's create-template authoring guide (pending-changes.md row, `create-template-authoring-guide` followup, 2026-07-18): `DirectiveFactory.create()` forwards `options: JsonValue` verbatim; the engine's v1 renderer needs composite (array/object) values pre-encoded as JSON strings. Build a single conversion choke point so authors pass native arrays/objects everywhere `options` is accepted.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | ~5-6: `src/core/directive-factory.ts` (the choke point — `DirectiveFactory.create()` already receives `options` from both `commons/index.ts`'s `create()` and `scaffold/expander.ts`'s direct `factory.create()` call, confirmed by read), its test file, `docs/create-templates.md`, plus per-surface test coverage (commons `create()` incl. `templateFile` form, scaffold expansion) required by scope item 2 ("no surface left inconsistent") | M |
| Lines affected (estimated) | ~150-250 incl. tests + doc rewrite; the core transform itself is a small pure function (~15-30 lines), consistent with the existing `forceEntry` helper pattern already in the same file | S/M |
| Bounded contexts | 1 (SDK core authoring/wire-construction layer — `directive-factory.ts`, `commons/index.ts`, `scaffold/expander.ts` are all the same authoring-API context, not separate contexts) | S/M |
| New patterns introduced | none — variant of the existing pure-transform-inlined-into-a-factory-method pattern (`forceEntry` precedent in the same file) | XS/S |
| Test types needed | existing (Bun unit tests); no new test infrastructure | XS/S/M |

### Overrides Triggered

None.

- **Sensitivity checked explicitly**: `openspec/sensitive-areas.md` registers `security (IPC)` (JSON-RPC wire to the Go engine sidecar, confidence low) and `public-api (contract)` (medium). Read `src/core/session.ts` (the actual JSON-RPC transport/client) — it does not reference `options` at all; the transport/framing layer is untouched. This change only reshapes a JSON-serializable value (`JsonValue` already types arrays/objects) before it crosses the wire — it does not loosen "only serializable messages cross," does not touch `session.ts`, and is backward-compatible (pre-`JSON.stringify`'d strings pass through unchanged, since the transform only acts on non-string composite values). Judged **not** to trip the IPC override — the registered sensitive area is the transport/client code, not payload value-shaping one layer above it.
  - **`public-api (contract)`**: `create()`/`scaffold()` are published, documented functions and this changes their runtime behavior (not their type signature — `JsonValue` already permitted arrays/objects). The change is additive/non-breaking (previously-working call sites, including manually-`JSON.stringify`'d ones, keep working). Flagged as a **risk to design/spec**, not a size override on its own.
  - No migration, no new external dependency, no cross-cutting concern spanning many modules, no 3+ bounded contexts.

**Final classification**: **M** — bounded to one authoring-layer choke point, small core diff, but the "no surface left inconsistent" scope requirement pushes file/test count into M territory; no sensitivity or other override fires.

## Recommended Path

- Phase: light Planner
- Skills to invoke (in order): `sdd-explore` (light) → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 2-4 slices) → ready for `/build`
- Slice target: 2-4

## Recommended Personas (L only)

Personas not applicable for M — invoke Architect + Business Analyst only (light Council, no full deliberation).

## Spec Reference (if spec_source ≠ internal)

spec_source: internal — no reference captured

## Risks Flagged at Triage

- **Public-API behavior change**: `create()`/`scaffold()` runtime behavior changes for composite option values; non-breaking by construction (string passthrough preserves existing manual-`JSON.stringify` call sites) but design/spec should make the backward-compat property an explicit, tested invariant.
- **Fake-mirror decision deferred**: `src/testing/contract-fake.ts` destructures `{ pathTemplate, template, force }` from `directive.create` and never reads `options` — read confirms it does not need to learn the promotion rule to keep working, but design should confirm this explicitly rather than assume it (the fake never renders templates).
- **Choke-point placement**: the natural single choke point is `DirectiveFactory.create()` itself (both `commons/index.ts`'s `create()` and `scaffold/expander.ts` already funnel through it) — design should confirm this placement rather than duplicating the transform per call site.
- **Shallow-vs-deep encoding ambiguity**: the engine promotes only top-level `options` map values; design must pin down (and spec must test) that the transform is a shallow walk over `Object.entries(options)`, not recursive — get this wrong and nested structures double-encode or fail to promote.

## Halt?

No

## Notes for Next Phase

`sdd-explore` should confirm: (1) `DirectiveFactory.create()` as the sole choke point (read `src/commons/index.ts:187-204` and `src/scaffold/expander.ts:171` — both call `factory.create()`), (2) exact JSON-encoding predicate (array or plain-object, excluding `null`/primitives — `null` is a valid `JsonValue` and must NOT be stringified), (3) whether `docs/create-templates.md` §1's example is the one to convert alongside the Appendix. Cross-repo tether: PC-PROTO-01 (engine-side native-JSON ratification) is out of scope but noted in pending-changes as a future no-op reducer for this feeder if it lands.
