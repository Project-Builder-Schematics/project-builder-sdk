# Archive Report: stage-3-dry-run-exposure

**Archived at**: 2026-07-07T18:00:00Z
**Verify verdict**: pass-with-followups
**Spec version archived**: V2 (signed, owner, 2026-07-06)
**Triage**: M (owner-ratified conditional)

## Summary

Stage 3 closed the dry-run exposure objective (O2 coverage line 5): the pure `dryRunPlan` renderer, complete since Stage 1, is now reachable by authors via a zero-argument `dryRun()` accessor in `./commons`, wired read-only off `Session.pendingSnapshot()`. The renderer vocabulary was corrected from wire tags (`delete`) to author vocabulary (`remove`), aligned with Stage 2's ratified `AuthoringError` surface. All changes are additive to the public contract; no new `package.json#exports` subpath was added. Three ADRs were ratified (0024–0026) documenting the exposure shape, the public `DryRunVerb` union, and the deferral of outside-run message enumeration correction to a post-merge pending-change.

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|
| `dry-run-plan-exposure` | New | 4 (REQ-DRE-01 to REQ-DRE-04) | 0 | 0 |
| `dry-run-plan-skeleton` | Delta | 0 | 1 (REQ-04, with new scenario REQ-04.4) | 0 |

**Main spec updates**:
- `openspec/specs/dry-run-plan-exposure/spec.md` — created (new full spec, 4 REQs, 5 scenarios)
- `openspec/specs/dry-run-plan-skeleton/spec.md` — modified (REQ-04 now includes frozen verb map + REQ-04.4 decoy scenario; "design §4.4" wire-tag rationale RETIRED)

## Archive Location

`openspec/changes/archive/2026-07-07-stage-3-dry-run-exposure/` (moved via `git mv` 2026-07-07; 17 files, folder move verified)

Folder move committed as `d041377`; ADR promotions, followup rows, and lessons committed in the archive-completion commit.

## Lessons Learned Persisted

Three generalizable lessons identified, all meeting the "future engineer would benefit" bar:

1. **[must-fail-first] Tag Misapplication on Characterization Slices** — When a skeleton slice ships working capability and later slices add tests-only, genuine pre-impl RED is impossible. Tag such slices [characterization] at plan time, not [must-fail-first]. Use TEETH-DEVIATION (deliberately-wrong assertion) at verification time to prove test teeth. (Type: pattern)

2. **Blind Evaluators Must Not Cleanup Uncommitted Artifacts** — Pipeline artifacts must be committed before blind evaluation; cleanup instructions without scope invite over-zealous garbage collection. This lesson emerged from judges deleting verify-report.md, believing it was their own work residue. (Type: discovery)

3. **Worktree-Scoped Architecture Refresh Silent Failure on Unmerged Sibling Branches** — Running architecture baseline refresh inside a worktree in a parallel-change scenario can silently omit architectural impact from sibling branches visible in main but not the worktree. Document scope ("baseline captured in stage-3-worktree context only") and re-refresh post-merge. (Type: pattern)

**Lessons persisted to**: `openspec/lessons-learned.md` (stage-3 section prepended, newest-first); engram topic `project/lessons-learned` — ONE cumulative observation (#648) carrying all three stage-3 lessons plus stage-2's four (restored: the topic-key upsert had replaced them — itself an instance of stage-2's own shared-topic-clobber lesson)

## ADRs

### Promoted to Project-Level

| ADR ID | Title | Rationale | Status |
|---|---|---|---|
| ADR-0024 | Dry-run exposure shape + author-verb vocabulary | Establishes the exposure surface and frozen verb-map mechanism; affects how future rendering changes will be designed in this project; cross-cutting ADR-0025/0026 dependencies | Promoted — file in `openspec/decisions/` |
| ADR-0025 | Public `DryRunVerb` union narrowing | Establishes `DryRunVerb` as a semver-locked type whose growth is MAJOR; future changes to wire ops or author vocabulary must consult this ADR | Promoted — file in `openspec/decisions/` |
| ADR-0026 | Outside-run message-omission deferral | Establishes the precedent for coordinating cross-stage behavioral divergence at the spec level when one stage cannot own the fix; generalization deferred to post-merge pending-change | Promoted — file in `openspec/decisions/` |

All three ADRs were extracted from the change's `design.md` (§4.5) and promoted as project-level architecture records: `openspec/decisions/0024-dry-run-exposure-shape-author-verb-vocabulary.md`, `0025-dryrunverb-public-local-union.md`, `0026-outside-run-message-omission-coordination.md` (Status: Accepted, origin-change reference recorded in each). NOTE: stage-4's in-flight plan drafts ADRs also numbered 0024-0028 in its own worktree — stage-3 signed first and keeps these numbers.

### Recommended but Not Yet Promoted

None — all three candidate ADRs met promotion criteria.

## Followups Registered

Verify verdict was `pass-with-followups`. The `openspec/pending-changes.md` stage-3 section carries five rows: three registered at plan phase (confirmed, not duplicated — the single-source-extraction row was AMENDED with the commons import-hoisting architect note) plus two NEW rows registered at archive:

| Description | Type | Size | Origin | Next |
|---|---|---|---|---|
| Single-source wire→author map extraction (once stage-2+3 merge) — eliminates duplicate `WIRE_TO_AUTHOR_VERB` and `DryRunVerb`/`AuthoringVerb`; includes hoisting stage-3's mid-file imports in `src/commons/index.ts` | refactor | S | design ADR-0024/0025 (plan-phase row, amended at archive) | post-merge |
| Outside-run message generalization — generalise away from the verb enumeration; preserve "…can only be used while a schematic is running…" substring; closing it retires `dryRun`'s compensating `@throws` caveat; see ADR-0026 | refactor | XS | design ADR-0026 (plan-phase row, confirmed) | post-merge (standalone, not owned by stage-2) |
| Demo-moment narrative restructure (call `dryRun()` before any read/dialect-open) | docs | XS | steward CQ-2 (plan-phase row, confirmed) | Stage 6.3 |
| REQ-DRE-02 test hardening — `.d.ts` scans in `test/skeleton/dry-run-public-contract.test.ts` should target fresh `dist/` output instead of the committed baseline | test | XS | judgment-day Judge A (NEW at archive) | anytime |
| /simplify candidates — renderer switch indexes `WIRE_TO_AUTHOR_VERB[d.op]` instead of per-arm hardcoded keys (both judges); `Object.freeze` the map; `@example` runnability polish | refactor | XS | judgment-day round 1 (NEW at archive) | immediate post-archive /simplify pass |

## Final State

- **Spec status**: signed (archived)
- **Main specs updated for**: 2 domains (1 new, 1 modified)
- **Lessons in project memory**: 3 added (file + engram obs 648)
- **ADRs promoted**: 3 (`openspec/decisions/0024..0026`)
- **Pending changes registered**: 2 new at archive + 3 plan-phase rows confirmed (1 amended)

## Pre-PR Audit (Step 6d)

Code audit (pre-pr, GATING) per `skills/_shared/code-audit.md` mode=pre-pr: CLEAN.
- 0 Bug/MAJOR findings
- No scope creep (all changes in design §4.2 File Changes table)
- Cross-change guard honored (src/core/context.ts, src/core/session.ts absent from diff)
- Commons edit appended at file END (constraint 4 of §4.8)
- Mutation-resistance spot-checked: map consistency, flush splice, error propagation, doc drift, wire-type leak

**Upstream sync**: spec_source=internal, no upstream sync attempted.

## Quality Summary

- **Verify final verdict**: pass-with-followups (quality floor met, 3 pre-registered followups deferred)
- **Adversarial review**: APPROVED round 1, 0 critical, 0 real warnings (3 SUGGESTION items routed to /simplify, 1 real WARNING doc-noted)
- **Steward reckoning**: DELIVERED (outcome audit §Conscience questions = none; three foresight CQs affirmed by owner and honored in delivery)
- **Architecture audit**: CLEAN (baseline refreshed post-verify in worktree scope; re-refresh after stage-2+3 merge registered as pending-change)
- **Test coverage**: 261 pass / 0 fail (47 files, 413 expects); mutation-resistant; .d.ts baselines byte-consistent; FIT-04/06/09/no-import all green

## Next Steps for User

1. Commit the archive move + ADR promotions + lessons persisted + this archive-report
2. Push to remote (feat/stage-3-dry-run-exposure branch)
3. Open PR: the change is ready; orchestrator will surface the 3 pending-changes for post-merge grooming
4. After merge to main: initiate the post-merge pendingchange workflow (map extraction, message generalization, test hardening) — all three are cross-stage coordination tasks

## Archive Integrity

- Archive folder move verified: SRC removed, DEST exists, 17-file count preserved
- Delta specs validated: MODIFIED block (REQ-04) has full scenario content, no destructive sync loss
- Lessons curated: 3 entries, all generalizable, future-engineer-benefit bar passed
- ADRs verified: 3 promotion candidates, all cross-cutting, signed against design.md source

Archive is sealed and ready for commit.
