# Archive Report: conformance-writtenpaths-reconcile

**Archived**: 2026-07-24 · **Triage**: M · **Branch**: `feat/conformance-writtenpaths-reconcile`
**Verify final**: pass · **Adversarial review**: not-required (M, non-sensitive)

## Outcome

Reconciled the conformance corpus's `writtenPaths` semantics with the engine's shipped
`mutation-event-streaming` contract (`Result.WrittenPaths` = committed-mutation set across all six
op classes, deduped + sorted). Source: issue `Project-Builder-Schematics/project-builder-sdk#47`,
engine `#153` (PC-CONF-08).

## What changed

- **Spec** (`openspec/specs/conformance-fixtures/spec.md`, V3→V4): REQ-CFX-12 rewritten
  ("Committed-Mutation Set (all six op classes)") with per-op-class semantics + 5 pins; scenarios
  REQ-CFX-12.1/.2 rewritten; REQ-CFX-09 pin updated. REQ-CFX-06/07/08 needed no edit — they
  delegate their pin to REQ-CFX-12.
- **Fixtures** (committed cases): `m2-modify` → `["target.txt"]`, `m2-delete` → `["target.txt"]`,
  `m2-rename-move` → `["dst.txt"]`, `m2-create-composition` → `["existing.txt", "generated.txt"]`.
  `m1-vehicle` unchanged (`["out.txt"]`); all negative twins unchanged (`[]`).
- **Fitness**: `fit-40` positive-case assertions updated (TDD: assertions red first, manifests green).
- **Docs**: 2 stale contract pins in `CONFORMANCE-CORPUS-HANDOFF.md`.

### Merge-driven scope extension (`m2-copy` + `m2-copyin`)

Merging `origin/main` before the PR landed pulled in two fixtures added after this change branched —
`m2-copy` (REQ-CFX-15) and `m2-copyin` (REQ-CFX-16) — both authored under the OLD rule with
`writtenPaths: []`. Left unreconciled, the new REQ-CFX-12 would contradict them (the exact
self-contradiction this change removes), so they were folded in (owner-approved):

- `m2-copy`: positive → `["dst.txt"]`, collision-with-force → `["occupied.txt"]`, copy-then-modify → `["dst2.txt"]`.
- `m2-copyin`: positive → `["dst.txt"]`, verbatim-content → `["dst2.txt"]`, collision-with-force → `["occupied.txt"]`.
- `copy`/`copyIn` list the **destination** only — the by-reference `assets/` source is read, never written.
- REQ-CFX-12's pinned enumeration extended to cover both; their `fit-40` REQ-CFX-15/16 assertions updated.

These 6 pins are grounded in the engine's confirmed framework (committed set, `Op.Path` per entry,
destination-only) but not yet individually engine-confirmed — an engine courtesy check was sent,
non-blocking (same posture as the original delete/rename pins).

Full suite: 2146 pass / 0 fail (post-merge).

## Pins are engine-authoritative

All 5 values were confirmed by the engine team (2026-07-24) with code-grounded justification
(rename destination-only via `StatusMovedAway` tombstone + `PlanOf` skip at `plan.go:115`; delete
lists the removed path). Not inferred.

## Steward reckoning

Delivered. The stated problem — engine conformance red + spec self-contradictory from writtenPaths
drift — is resolved: corpus, fitness gate, and spec now agree with the engine's committed-set
contract, and on the engine advancing its SDK submodule pin the red case turns green.

## ADRs

None. This is a contract reconciliation to an external authority, not a new architectural decision.

## Followups (registered in `openspec/pending-changes.md`)

- **PC-CONF-09 (cross-repo, non-gating)**: engine closes the `#153` coverage gap — add
  `WrittenPaths` assertions to the engine-side modify/delete/rename conformance tests (today only
  `mutation_create_test.go` asserts the field) — then advances the SDK submodule pin. That
  pin-advance is the byte-exact empirical proof of this reconciliation.
