# Conformance Fixtures Specification — delta

**Change**: `conformance-writtenpaths-reconcile`
**Base**: `openspec/specs/conformance-fixtures/spec.md` (V3, SIGNED)
**Operation**: MODIFIED (REQ-CFX-12, REQ-CFX-09)

Reconciles `writtenPaths` semantics with the engine's `mutation-event-streaming` contract:
`Result.WrittenPaths` = the committed-mutation set across all six op classes, deduped + sorted.
All other REQs (including REQ-CFX-05's already-correct `["out.txt"]` pin and every negative twin's
`[]`) are unchanged.

## MODIFIED Requirements

### REQ-CFX-12: `writtenPaths` Rule — Committed-Mutation Set (all six op classes)

`outcome.writtenPaths` for a case MUST list **every workspace-relative path touched by a committed
mutation during the run** — derived from the committed set across all six op classes
(`create` / `modify` / `rename` / `delete` / `copyIn` / `copy`), **including engine-side
schematic-lowered `create` staging** — deduplicated and **sorted** (the self-check and the engine
harness compare positionally, so order is part of the contract). This mirrors the engine's
`Result.WrittenPaths` contract (`project-builder-engine`, `mutation-event-streaming`): *"every
`Success==true` committed entry's `Op.Path`, deduplicated and sorted, covering all six
`PlannedOp.Class` values — unlike the old pre-run `OpCreate`-only batch."*

Per-op-class semantics (engine-confirmed, code-grounded):

- A committed `modify` or `delete` lists its target path. A `delete` lists the **removed** path —
  the contract is the committed *set*, not "bytes written".
- A committed `rename`/`move` lists **only the destination** path. The source becomes a moved-away
  tombstone (`StatusMovedAway`) that `PlanOf` skips (`plan.go:115`) and never enters the committed
  journal, so `WrittenPaths` never sees it.
- A `create` followed by a `modify` of the **same** path deduplicates to a single entry.
- A rejected or discarded run commits nothing, so its `writtenPaths` is `[]`.

Pinned values, every positive case: `m1-vehicle` = `["out.txt"]` (schematic-lowered `create` of
`out.txt` + factory `modify` of the same `out.txt` → deduped to one entry); `m2-modify` =
`["target.txt"]`; `m2-delete` = `["target.txt"]`; `m2-rename-move` = `["dst.txt"]`;
`m2-create-composition` = `["existing.txt", "generated.txt"]` (schematic-lowered `create` of
`generated.txt` + factory `modify` of `existing.txt`, sorted). Every negative twin = `[]`.

#### Scenario REQ-CFX-12.1: Same-path create+modify deduplicates to one entry

- GIVEN `m1-vehicle`'s positive case (schematic-lowered `create` of `out.txt`, then a factory
  `modify` of `out.txt`)
- WHEN `outcome.writtenPaths` is inspected
- THEN it equals `["out.txt"]` exactly — the two committed mutations on the same path deduplicate

#### Scenario REQ-CFX-12.2: Wire-mutation positive cases pin their committed target path

- GIVEN `m2-modify` (modify `target.txt`), `m2-delete` (delete `target.txt`), or `m2-rename-move`
  (rename `src.txt` → `dst.txt`) positive case
- WHEN `outcome.writtenPaths` is inspected
- THEN `m2-modify` = `["target.txt"]`, `m2-delete` = `["target.txt"]`, `m2-rename-move` =
  `["dst.txt"]` — the rename lists the destination only; its source is absent (moved-away tombstone)

### REQ-CFX-09: `m2-create-composition` Behavioral Contract

`class: composition`, `lowering: schematic`. Seed: `existing.txt = "orig"`. Schematic:
`schema.json {"schema_version":"1","name":"compose","variables":[]}`,
`files/generated.txt = "generated"` (the CREATE half comes from engine lowering — the factory
MUST NOT author it). Factory: `modify` of `existing.txt` → `"composed"`. `writtenPaths` pin:
REQ-CFX-12.

| Case | exitCode | emitRejectionCode | failedIndex | expected |
|---|---|---|---|---|
| positive | 0 | null | null | `{generated.txt: "generated", existing.txt: "composed"}`, `writtenPaths: ["existing.txt", "generated.txt"]` exactly |
| wire-create-reject-twin | 2 | `unrepresentable` | null | `"zero-effect"` |

(The `wire-create-reject-twin` outcome triple is resolved by ADR-0064 — `2`/`unrepresentable`/`null`,
emit-time — and is unchanged by this delta. All the twin's surrounding machinery notes from the base
spec carry forward verbatim.)

#### Scenario REQ-CFX-09.1: Positive case declares one commit, two composed halves

- GIVEN `m2-create-composition`'s manifest + schematic-staged `generated.txt` + seed
  `existing.txt` + `expected/`
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares a single `ir.commit` flush, `outcome.exitCode: 0`, both files at
  their final content in `expected/`, `outcome.writtenPaths = ["existing.txt", "generated.txt"]`
