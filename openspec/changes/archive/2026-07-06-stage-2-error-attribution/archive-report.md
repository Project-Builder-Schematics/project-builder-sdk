# Archive Report: stage-2-error-attribution

**Archived at**: 2026-07-06T23:55:00Z
**Verify verdict**: pass-with-followups
**Spec version archived**: V2 (signed, owner, 2026-07-05)

## Summary

Stage 2 froze the author-facing error contract: closed six-value `reason` enum (★D2),
two-value derived `origin` discriminant, `appliedCount` boundary field, three-template
message contract, and public promotion of `AuthoringError` (+3 type aliases) and
`classifyContent`/`ContentState` via `./commons`. `EmitRejection` structured rejection
metadata killed the `instructions[0]` hardcode at SEAM-04. Four delta specs synced (3 NEW,
1 MODIFIED); 5 slices, 18 REQs / 49 scenarios, suite 243→334→341 green; judgment-day
APPROVED; steward reckoning DELIVERED; architecture audit clean (amended). Four ADRs
(0020-0023) materialized into the decisions ledger.

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed | Action |
|---|---|---|---|---|---|
| `authoring-error-contract` | New | 6 (REQ-AEC-01..06) | 0 | 0 | Created; Status: signed (2026-07-06) |
| `emit-rejection-metadata` | New | 3 (REQ-ERM-01..03) | 0 | 0 | Created; Status: signed (2026-07-06) |
| `read-trichotomy-helper` | New | 3 (REQ-RT-01..03) | 0 | 0 | Created; Status: signed (S-004 SHIPPED, not dropped) |
| `error-attribution-skeleton` | Delta | 4 (REQ-14..17) | 2 (REQ-10, REQ-12) | 0 | Blocks replaced (Previously-notes dropped in main), REQ-11/13 untouched |

## Archive Location

`openspec/changes/archive/2026-07-06-stage-2-error-attribution/`
- 22 files moved via `git mv` (verified: source gone, dest present, file count matches)
- Per-change artefacts accessible via topic keys: `sdd/stage-2-error-attribution/*`

## Lessons Learned Persisted

| Lesson | Type | Topic Key |
|---|---|---|
| Mutation-probe verification is evaluator discipline, not a nice-to-have | pattern | `project/lessons-learned` |
| Data-variant slices over a generalized mechanism are characterization, not must-fail-first | pattern | `project/lessons-learned` |
| Parallel slice-apply agents clobber a shared apply-progress topic key | discovery | `project/lessons-learned` |
| Blind-council review catches unimplemented spec clauses that mode-final verification marks compliant | pattern | `project/lessons-learned` |

Total: 4 lessons added (4/5 budget used). Also appended to `openspec/lessons-learned.md`.

## ADRs

### Promoted to Project-Level (orchestrator-confirmed in launch directive)
- **ADR-0020**: Closed `reason` enum (★D2) — `openspec/decisions/0020-closed-reason-enum.md`
- **ADR-0021**: Error-origin taxonomy, `origin` derived via exhaustive `originFor` — `openspec/decisions/0021-error-origin-taxonomy.md`
- **ADR-0022**: `EmitRejection` port contract (incl. kit-barrel deviation, Stage-6 revisit) — `openspec/decisions/0022-emit-rejection-port-contract.md`
- **ADR-0023**: `AuthoringError` public promotion via `./commons` — `openspec/decisions/0023-authoring-error-public-promotion.md`

All four shipped as designed and audit-verified; Status: Accepted (2026-07-06). Mirrored to
engram `project/architectural-decisions`.

## Followups Registered

Verify-final followup #1 (FIT-04 `DTS_PAIRS` pairs for `core.authoring-error.d.ts` +
`commons.classify-content.d.ts`) — **CLOSED IN-CHANGE** by commit `6c136aa`, confirmed by
verify-in-loop-4 and the amended architecture audit. Recorded as completed, NOT pending.

| # | Description | Type | Size | Origin | Stage |
|---|---|---|---|---|---|
| 1 | EmitRejection port conformance for real engine client (malformed message on out-of-range/absent `failedIndex`; spurious index on batch codes) — enforce precondition or degrade to `unknown` | edge-case | M | judgment-day (both judges, confirmed theoretical) | **6 (gating)** |
| 2 | Positive type pins for `verb`/`path` `\| undefined` arms + frozen pre-change FIT-04 baseline snapshot pattern | refactor | S | Judge A + Judge B convergent | test-only backlog |
| 3 | `primaryPath` source-side on rename/move/copy collisions — DX wart; revisit before dialect-family message ossification | other | S | design §4.3 ratified | 5 (note) |
| 4 | `defineFactory` silently drops factory return values — zero signal today | edge-case | S | steward | DX backlog |
| 5 | Promote REQ-16 tags into the 4 untagged non-site source comments | refactor | S | S-003 note | cleanup backlog |

Retirements applied to the prior ledger: stage-1 "2.1 attribution granularity (M)" RETIRED
(delivered); "read not-found is a VALUE (ADR-0016)" RETIRED (honored); "CQ-1 read-trichotomy
(2.3)" RETIRED (S-004 shipped). "non-Error E1 E2-swallow (S)" RE-REGISTERED still-open;
"rejection-message locators (S)" RE-DEFERRED.

## Test Coverage

| Metric | Value |
|---|---|
| Full suite | 334 pass / 0 fail at final verify (341 at steward re-run); typecheck + build clean |
| Fitness | 73+ pass incl. FIT-04 (with new baseline pairs), FIT-06, FIT-08 pin, FIT-10 extended, FIT-11 new |
| Mutation probes | 5 final-verify probes + 4 in-loop probes, all killed for the right reason |
| REQ coverage | 49/49 scenarios compliant (18 REQs) |

## Final Checklist

- [x] Specs synced to main (4 domains: 3 NEW, 1 MODIFIED; Previously-notes dropped in main)
- [x] Change folder moved to archive (`git mv` verified, 22/22 files)
- [x] ADRs 0020-0023 materialized in `openspec/decisions/` (Accepted)
- [x] Lessons learned extracted (4 curated entries)
- [x] Followups registered in `openspec/pending-changes.md` (5 new + 2 carried; 3 retirements; 1 closed-in-change)
- [x] Engram mirrors upserted (lessons, ADRs, pending, archive-report)
- [x] Archive report written

**Status**: COMPLETE. Change sealed; ready for PR.
