# Archive Report: l1-author-surface-skeleton

**Archived at**: 2026-06-22
**Verify verdict**: pass (one non-blocking followup)
**Spec version archived**: V1 (signed)

## Summary

Sub-change #1 of the `l1-author-surface` program — the walking skeleton — is complete and
archived. It threads four program seams thinly end-to-end: a typed `create<S>` (SEAM-01), a
directive-buffer snapshot feeding a minimal dry-run plan (SEAM-02), an all-or-nothing
commit/discard boundary through the contract fake (SEAM-03), and one attributed `AuthoringError`
on a forced rejection (SEAM-04). Verify-final passed (24/24 REQ scenarios compliant, code-audit
pre-pr GATING clean, adversarial review not-required for an M non-sensitive change). Integration
gate #1 passed (4/4 produced/consumed seams real cross-boundary; SEAM-05/06 deferred to #4). 170
tests green, typecheck exit 0, permissive-proof exit 2 (negative proof real). Four spec
capabilities promoted to `openspec/specs/`; #2/#3/#4 grow them.

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|
| `typed-create-skeleton` | New | all (REQ-01..02) | 0 | 0 |
| `dry-run-plan-skeleton` | New | all (REQ-03..05) | 0 | 0 |
| `commit-discard-contract` | New | all (REQ-06..09) | 0 | 0 |
| `error-attribution-skeleton` | New | all (REQ-10..13) | 0 | 0 |

Pure ADDED — no MODIFIED/REMOVED; Step 4 destructive-sync check skipped.

## Archive Location

`openspec/changes/archive/2026-06-22-l1-author-surface-skeleton/`

## Lessons Learned Persisted

3 entries appended to `openspec/lessons-learned.md`:
- plan-verify "zero Judge-B questions" bar is asymptotic for complex changes (process)
- a migration plan's "which tests break" prediction must be apply-verified, not trusted (discovery)
- read-your-own-writes precludes rollback-by-withholding — roll back transactionally downstream (pattern)

## ADRs

### Promoted to Project-Level
- **0015** — All-or-Nothing Commit and the EngineClient Transaction Port (originally ADR-01).
  Load-bearing: the grown port (`commit`/`discard`) and the reversed commit contract are already
  encoded in `architecture.md` and depended on by every downstream sub-change.

### Recommended but Not Yet Promoted
- ADR-02 (thin error-attribution wrap at the emit call site) — recommend promoting alongside
  sub-change #3 (`error-and-commit-contract`), which freezes the full error contract. Promoting
  now would lock a deliberately-thin, first-instruction-only attribution that #3 will broaden.

## Followups Registered

| Description | Type | Size | Origin |
|---|---|---|---|
| `typecheck:permissive-proof` wrapper masks tsc exit-2; CI must invert via raw `tsc` | other | XS | verify-report §deviations |

## Pre-PR Audit

Covered by sdd-verify --mode=final (Step 11b code-audit pre-pr GATING, clean: 0 Bug/MAJOR/
Architecture) over the full skeleton diff. The four reported apply deviations were independently
adjudged acceptable inline improvements. No unaddressed blocking findings.

## Final State

- Spec status: signed (archived) + 4 capabilities promoted to `openspec/specs/`
- Lessons in project memory: 3 added
- ADRs: 1 promoted (0015); 1 recommended for #3 (ADR-02)
- Pending changes: 1 followup registered
- Program: `l1-author-surface` #1 done; #2 `typed-options-and-read` (L) is next
