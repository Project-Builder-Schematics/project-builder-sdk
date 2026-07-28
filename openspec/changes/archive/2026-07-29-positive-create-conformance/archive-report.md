# Archive Report: Positive Create Conformance

**Archived at**: 2026-07-29  
**Verify verdict**: pass-with-followups  
**Spec version archived**: V1 (merged, signed)  
**Archive commit**: `0bd88e4` (PR #55 merged to main 2026-07-29)

## Summary

Added a second positive wire `create` case (`createComposite`, named export in `m2-create-composition/factory.ts`) quarantined inside the existing sanctioned file, exercising composite options via the `encodeOptions` JSON-stringify branch. Relaxed REQ-CFX-02's cardinality wording from "exactly one case corpus-wide" to "any number of cases inside one sanctioned file's quarantine," per engine's `sdk-wire-create` handoff. Added ADR-0078 to document the force-disposition resolution for `wire-create-reject-twin` under new engine semantics. All 9 REQ scenarios compliant with mutation-verified evidence; full suite 2401/0, targeted fit-40 61/61 green.

## Specs Synced

| Domain | REQs Modified | Scenarios Added |
|---|---|---|
| `conformance-fixtures` | REQ-CFX-02, REQ-CFX-03, REQ-CFX-09, REQ-CFX-12, REQ-CFX-13 | REQ-CFX-02.2, REQ-CFX-09.4, REQ-CFX-09.5, REQ-CFX-12.3, REQ-CFX-13.6 |

**Main spec updated**: `openspec/specs/conformance-fixtures/spec.md` — quarantine invariant language live in REQ-CFX-02/03 (cardinality control); new positive-create-composite case documented in REQ-CFX-09/12/13 table rows.

## Archive Location

`openspec/changes/archive/2026-07-29-positive-create-conformance/`

## ADRs

### Accepted (Promoted to Project-Level)

**ADR-0078**: `wire-create-reject-twin` Gains Explicit `force: true` To Stay Valid Under `sdk-wire-create`  
Origin: this change (design §4.5), resolves engine handoff staleness question (obs #1695 — new engine rejects only force-bearing creates, not all creates). Outcome triple `(2, "unrepresentable", null)` stays byte-identical; rejection CAUSE reclassified from "unconditional reject" (old engine) to "force-field-triggered reject" (new engine, ADR-0064 amended).

## Lessons Learned Persisted

1. **Red-base zero-new-failures technique** (type: pattern)  
   Verify final can use a paused-build base commit (not the spec's canonical baseline) to establish zero regression — byte-identical failing-set proof against that base, then confirm the spec changes explain each failure's resolution. Surfaces failures hidden by fresh runs. Source: verify-report Item C (mutation-spot-check findings).

2. **ADR-number cross-branch collision protocol** (type: pattern)  
   When multiple in-flight branches claim the same ADR numbers, check other uncommitted branches' work before numbering. This change initially claimed 0077→0078 after inline-collection-marker had already drafted 0077; protocol resolved the collision without re-opening design. Source: design phase git-history discovery.

## Followups Registered

| Description | Type | Size | Origin |
|---|---|---|---|
| Remove `force?: boolean` from `src/core/wire.ts` create directive type + reword `docs/create-templates.md` "Overwrite behavior" | feature-cleanup | S | design §4.8 / engine handoff-2 handoff |
| Engine PC-CREATE-02 pin-advance landing confirmation (gated-tests green) — close as delivered | outcome-check | S | outcome-verdict deferred-activation |

## Final State

- Spec status: signed, archived, live main-spec synced
- Main specs updated for: `conformance-fixtures`
- Lessons in project memory: 2 added
- ADRs in project memory: 1 promoted (ADR-0078)
- Pending changes in project memory: 2 registered (force-removal, outcome-check)

## PIN-ADVANCE: Engine Handoff Package

**Archive commit SHA**: `0bd88e4` (PR #55 merged to main 2026-07-29)  
**Post-archive cleanup**: `e76bd8f` (simplify-gate + ADR-0064 amendment expansion)  
**The engine pins the archive commit on main after THIS change lands, NOT merge `0bd88e4`.**

### Blast-Radius Statement (Verify-Report Item D)

**Runner invocation surface** (bin/exports): byte-identical. `bin/pbuilder` entry unchanged; `src/transport/stdio-engine-client.ts` unchanged; single-instance-probe mechanism unchanged.

**Exit-code taxonomy**: unchanged. All six exit codes and their trigger conditions pre-exist this change; REQ-CFX-02.2/09.5 clarify wording/mechanism only.

**Transparency note**: One pre-existing failure mode (missing-collection.json ancestor → exit 1 for `resolvePackageRoot` callers) is retired by an unrelated change (`inline-collection-marker`, paused). External callers of the runner surface may observe this behavior change; the corpus's own fixtures are unaffected (empirically confirmed). Flag for engine team confirmation at pin-advance time: is their setup's cross-repo test (`internal/conformance/sdk_emitted_create_test.go`) aware of this retirement?

### Composite-Options Coverage

**Requirement**: REQ-TOE-01 specifies JSON-stringify branch of `encodeOptions`.  
**Evidence**: `conformance/m2-create-composition/factory.ts` export `createComposite` (lines 33-34) calls `create()` with composite option array; fixture's case manifests exit 0 with byte-exact output. `test/core/encode-options.test.ts` + `test/golden-ir/golden-ir.test.ts` exercise end-to-end round-trip.

### Outcome Status

**Verdict**: `delivered-pending-activation`

**Justification**:
- ✅ Positive create corpus fixture present (`m2-create-composition/factory.ts::createComposite`)
- ✅ Spec amendment live in main (`REQ-CFX-02` quarantine invariant, `REQ-CFX-09/12/13` new case documented)
- ✅ ADRs clear (ADR-0078 Accepted; ADR-0064 amended)
- ✅ Composite-options coverage confirmed (REQ-TOE-01 pinned, tested)
- ✅ Engine team has all data to advance pin

**Externally falsifiable proof** (per outcome-verdict): Engine lands PC-CREATE-02 pin-advance PR with:
1. third_party submodule pin advanced to commit `0bd88e4`
2. Two gated tests un-skipped: `TestConformance_M2CreateForceRejected`, `TestConformance_M2WireAuthoredCreateCardinality`
3. Both tests passing green

**Until engine's PR lands and passes**, outcome remains UNPROVEN. The SDK has delivered its half of the handshake; the engine's half determines whether PC-CREATE-02 is unblocked.

**Deferred activation**: Register one outcome-check row in `project/pending-changes.md` to confirm when engine lands their PR (already registered at archive time in pending-changes.md).

## Pre-PR Audit Notes

**Code audit (pre-pr mode)**: Clean — zero Bug/Architecture/MAJOR findings. Group 1 (spec alignment): all 9 REQ rows traced to tests, no drift. Group 2 (architecture): zero `src/**` diff, ADR-0064's frozen triple unchanged (Amendment section only), no layer/SSOT violation, `conformance/` confirmed absent from sensitive-areas. Group 3 (quality): no untyped casts, no magic numbers, no TODO/FIXME, near-duplicate caught and fixed by simplify gate (`e76bd8f`). Group 4 (scope): diff files match design §4.2 exactly; `pending-changes.md` row 500 untouched.

**No findings block this archive.**

## Commitment

Outcome is externally falsifiable — verified only when engine's PC-CREATE-02 lands. Archive can proceed with confidence that the SDK has met its contractual deliverables.
