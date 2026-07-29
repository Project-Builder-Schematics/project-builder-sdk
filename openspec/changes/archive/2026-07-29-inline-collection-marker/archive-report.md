# Archive Report: inline-collection-marker

**Archived at**: 2026-07-29T00:00:00Z
**Verify verdict**: pass-with-followups
**Spec version archived**: V3.3 (signed, owner ruling 15)

## Summary

`inline-collection-marker` deletes SDK-side containment wholesale: the reported bug
(inline-collection CLI projects have no ancestor `collection.json`, so every scaffold
verb failed loud before running) is fixed by removing the ancestor-marker walk and its
dual-anchor ceiling model entirely — `packageDir` is now the sole run anchor, and the
real security boundary moves fully to the engine's apply-time re-derivation
(`by-reference-copy-wire` REQ-BRC-02, independently owner-verified LIVE). Judgment-day
ran 3 rounds against this exact surface and found 13 confirmed real defects the 7
prior in-loop verifies had missed (most seriously: a trailing-slash symlink bypass of
the walk-root rejection, and the walk-root rejection itself). Suite: 2448 pass / 0
fail; `tsc --noEmit` clean. Steward reckoning verdict: `delivered-pending-activation`
— the fix is real and proven by construction, but first-hand proof against a real
published build is deferred to next consumer install (outcome-check followup
registered). 14 delta spec families synced into main; `package-root-containment`
retires wholesale (tombstoned, no REQ-ID recycled).

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|
| `package-dir-run-anchor` | New (whole family) | 2 (+ scenarios) | 0 | 0 |
| `package-source-io-hygiene` | New (whole family) | 5 | 0 | 0 |
| `ir-path-well-formedness` | New (whole family) | 3 | 0 | 0 |
| `authoring-error-contract` | Delta | 0 | 3 (REQ-AEC-10/11/12) | 0 |
| `by-reference-copy-wire` | Delta | 0 | 4 (REQ-BRC-02/06/07/08) | 0 |
| `folder-scaffold` | Delta | 2 (REQ-FSC-10/11) | 1 (REQ-FSC-09) | 0 |
| `run-boundary-input-validation` | Delta | 0 | 2 (REQ-RBV-04/06) | 0 |
| `scenario-matrix` | Delta | 0 | 2 (REQ-SCM-01/02) | 0 |
| `golden-corpus-contract` | Delta | 0 | 1 (REQ-GCC-08) | 0 |
| `conformance-corpus` | Delta | 0 | 0 | 1 (REQ-CCR-08) |
| `conformance-self-check` | Delta | 0 | 1 (REQ-CSC-02) | 0 |
| `conformance-fixtures` | Delta | 0 | 1 (cross-reference only) | 0 |
| `fitness-guards` | Delta | 3 (REQ-FTG-06/07/08) | 0 | 0 |
| `package-root-containment` | RETIRED wholesale | 0 | 0 | 10 (REQ-PRC-01..10) |

Same-commit obligations (verify-final W-4) landed in the sync commit: `fit-26`'s
matrix row-count assertion (21→20) plus new REQ-SCM-02.1/REQ-GCC-08.1 executable
checks; `fit-43` clause (e)'s real-tree `openspec/specs/` sweep now runs permanently
(added REQ-FTG-06.5). Retired-vocabulary sweep: 98→0 unsafe hits (20 remaining hits are
all inside version-history markers, verified line-by-line against the exact
`findOrphanedRetiredCitations` logic).

## Archive Location

`openspec/changes/archive/2026-07-29-inline-collection-marker/`

## Lessons Learned Persisted

- Dry-run ratified sweeps at plan time — pattern — `project/lessons-learned`
- POSIX lstat follows a trailing-slash final symlink — bugfix — `project/lessons-learned`
- posix.join normalizes `..` before validation — bugfix — `project/lessons-learned`
- Object.hasOwn for author-supplied table lookups — bugfix — `project/lessons-learned`
- Adversarial review pays for itself (2 bypass regressions, 7 clean verifies) — pattern — `project/lessons-learned`

## ADRs

### Promoted to Project-Level
- ADR-0077: Relocate the containment boundary out of the SDK (supersedes 0046/0067, amends 0045 — all three dated headers confirmed present)

### Recommended but Not Yet Promoted
None — ADR-0077 is this change's only new ADR.

## Followups Registered

12 rows registered at `project/pending-changes` (file: `openspec/pending-changes.md`
§"From `inline-collection-marker` archive"): 1 outcome-check (deferred-pending-activation,
cross-repo), F-1/F-2/F-3/F-6/F-7 (F-4/F-5 discharged at this archive), and 6
judgment-day theoretical/suggestion-pool rows grouped by theme.

## Final State

- Spec status: signed (archived)
- Main specs updated for: 14 domains (3 new, 10 modified, 1 retired wholesale)
- Sensitive-areas.md: 1 new row (package-local read / containment relocation)
- Lessons in project memory: 5 added (obs #648, repaired from a mid-archive clobber — see obs #648's own content note)
- ADRs in project memory: 1 promoted (obs #647)
- Pending changes in project memory: 12 registered (obs #649)
- Suite: 2448 pass / 0 fail; `tsc --noEmit` clean
