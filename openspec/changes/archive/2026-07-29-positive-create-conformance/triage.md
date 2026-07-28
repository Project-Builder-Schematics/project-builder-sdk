# Triage: Positive Create Conformance

**Classification**: M
**Decided at**: 2026-07-28T00:00:00Z
**Change name**: `positive-create-conformance`

## Problem & Scope

> The engine change `sdk-wire-create` (engine repo, plan PR #185) makes the wire `create` op
> ingestible — rendered at ingest against promoted options, containment-gated, always fail-closed
> on collision; any `force` field on a wire create rejects the whole batch (engine ADR-0028
> amendment). The engine's conformance merge gate is BLOCKED on the SDK corpus proving the
> positive create path with real SDK-emitted directives (unblocks engine PC-CREATE-02).
> Handshake: once this lands on SDK main, the engine advances its third_party submodule pin to
> that exact commit SHA and un-skips its two gated conformance tests (cardinality + force-reject
> against real corpus).

```yaml
scope:
  in_scope:
    - Amend openspec/specs/conformance-fixtures/spec.md REQ-CFX-02/02.1/03 — admit positive
      create fixtures alongside the wire-create-reject-twin (ADR-0064 unchanged)
    - Add ≥1 positive create fixture (new fixture id OR new case in
      conformance/m2-create-composition/manifest.json) — encodeOptions-preferred composite
      options, export ≠ null/"createRejectProbe", exitCode 0, emitRejectionCode null,
      byte-exact expected/
    - Extend test/fitness/fit-40-conformance-corpus-integrity.test.ts's SANCTIONED_SITE scan to
      admit the new positive site (site-agnostic)
  out_of_scope:
    - Engine-side Go tests + submodule pin advance (engine repo)
    - force-removal followup (wire.ts force?:boolean, docs/create-templates.md) — register as
      pending-changes row, not folded in
    - BRC-08/PRC-06 hardening (engine-side)
    - Typed feeder for array/object create options (own registered pending change; already
      tracked at pending-changes.md:472)
```

## Description Received

Engine-team handoff (2026-07-28), persisted verbatim at engram `sdd/positive-create-conformance/handoff` (obs #1695). Verified in-repo: current REQ-CFX-02 mandates exactly one wire-`create` case corpus-wide (`m2-create-composition/wire-create-reject-twin`); `corpus.json` lists 7 fixtures, none author an accepted `create()`.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected | ~5-7: `spec.md`, `manifest.json`, `factory.ts`, `expected/` bytes, `fit-40` test (possibly `conformance-validators.ts`) | M |
| Lines affected | ~150-250 (spec REQ rewrite + new scenarios, fixture case, fit-40 scan) | M |
| Bounded contexts | 1 (conformance/ authoring + its spec + its fitness test — no `src/**` change) | S/M |
| New patterns | Variant of existing — case-level factory-override authoring (ADR-0065) is established 6x, but no prior POSITIVE-create precedent exists; the cardinality-invariant generalization in REQ-CFX-02 and `fit-40`'s `SANCTIONED_SITE` path-literal check requires genuine (bounded) design, not mechanical copy | M |
| Test types | Existing (`bun test`, `fit-40`) — no new test infrastructure | S |
| Precedent | Partial — mirrors `m2-copy`/`m2-copyin`'s case-authoring shape (verified: `test/fitness/fit-40-conformance-corpus-integrity.test.ts:207` `checkCreateQuarantine` already generalizes across case-referenced named exports per-module, site-agnostic); the cardinality-relaxation logic itself has no direct twin to copy | no reduction (judgment) |

### Overrides Triggered
None. `conformance/` is confirmed absent from `openspec/sensitive-areas.md`. No migration, no new external dependency, not cross-cutting, single bounded context — none of the M/L/XL forcing overrides fire.

**Final classification**: M — real cross-repo handshake risk (unlike the `copy-copyin-conformance-fixtures` precedent, which bundled 2 fixtures + README sync-site discipline + submodule-ratchet sequencing into L), but here scope is ONE fixture/case + a cardinality relaxation, no bundling, no atomicity-across-fixtures constraint, no README touch required. Sized and shaped for the M light pipeline (target 2-4 slices).

## Recommended Path

- Phase: light Planner
- Skills to invoke (in order): `sdd-explore` (light) → `sdd-propose` (MERGED mode: proposal + `## Requirements`, doubles as spec, one signature) → `sdd-design` → `sdd-slice` (target 2-4 slices) → ready for `/build`. `sdd-spec` only if the merged spec needs refinement.
- Slice target: 2-4

## Recommended Personas

Not applicable for M — no sensitivity override fired, so no security-engineer trigger.

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- **Pending-changes connection**: `openspec/pending-changes.md:500` already registers "Create total-count==1 + `session.buffer` raw `{op:"create"}` shape scan — widen the exactly-one-create invariant" tagged **next fit-40 touch**. This change is plausibly that trigger, but its scope (admit ONE additional site) may not fully close the `session.buffer` raw-object bypass surface named in that row — `sdd-design` should explicitly decide whether this change closes that row or leaves a narrower residual open.
- **Spec cross-reference density**: REQ-CFX-02 is referenced by REQ-CFX-03 (DO-NOT-COPY clause), REQ-CFX-04 (outcome triple), REQ-CFX-09 (existing reject-twin contract), REQ-CFX-12 (writtenPaths), REQ-CFX-13 (transcript table), REQ-CFX-17 (sync-site discipline for OTHER ops). Amending the "exactly one" cardinality touches a heavily cross-referenced invariant — `sdd-spec`/`sdd-design` must verify no downstream REQ silently breaks.
- **force-removal followup**: explicitly out-of-scope per the handoff; needs a pending-changes.md row registered (not automatic — flag for the orchestrator/archive step, triage does not write it).

## Halt?

No

## Notes for Next Phase

- `sdd-explore` should read `conformance/m2-create-composition/{manifest.json,factory.ts}` (current reject-twin contract) and `test/fitness/fit-40-conformance-corpus-integrity.test.ts:232-318` (`checkCreateQuarantine`, already site-agnostic per-module) as the primary structural precedents — confirm whether the simplest path (new named export in the SAME file/manifest) needs near-zero `fit-40` code change vs. a new fixture directory needing the `SANCTIONED_SITE` literal to admit a second path.
- Preserve the honesty-boundary framing (REQ-CFX-11) verbatim — the new fixture's `expected/` bytes are a declaration, not SDK-proven, same as every other fixture.
- `sdd-design` must resolve: new case in `m2-create-composition` vs. new fixture id (both handoff-sanctioned); which REQ-ID houses the new positive-create contract (extend REQ-CFX-09 vs. new REQ-CFX-18).
