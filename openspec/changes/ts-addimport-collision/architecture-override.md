# Architecture Audit Override — ts-addimport-collision

**Date**: 2026-07-21
**Gate**: `arch_audit_gate` (pre-archive)
**Decision**: HUMAN OVERRIDE — archive proceeds despite `architecture-audit = violations`.

## The violation being overridden

`openspec/architecture-audit.md` (2026-07-21, HEAD af74a30): `package.json:27` declares
`engines.node >=25.9.0` while `.github/workflows/publish.yml:42` runs CI on `node-version: "22"`.

## Owner's reason (persisted per the halt-routing contract)

The violation is **pre-existing and unrelated to this change**: it predates the change's first
commit and none of the change's commits touch `package.json` engines or any workflow file
(verified: the change's production footprint is confined to `src/dialects/typescript/ops.ts`).
Blocking this archive on it would couple an unrelated CI-config defect to a finished, fully
verified change. Resolution path chosen by the owner ("Override + followup", 2026-07-21):
register a pending-changes followup to align `engines.node` with the CI/publish matrix in its
own scoped mini-change — the alignment direction (bump CI vs relax engines) is that change's
decision to make, not this one's.

## Obligation created

`sdd-archive` MUST register the followup row ("align engines.node with publish workflow node
version") in `openspec/pending-changes.md` as part of its ledger reconciliation. If that row is
not registered, this override loses its justification.
