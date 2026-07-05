# Archive Report: stage-1-ir-bedrock

**Archived at**: 2026-07-05T22:15:00Z
**Verify verdict**: pass-with-followups
**Spec version archived**: V2 (signed, 2026-07-04)

## Summary

Stage 1 IR bedrock hardened the IR seam with fail-closed move collision detection, batch-cap enforcement, JSON round-trip fidelity at the fake's `emit`, and double-fault error preservation. Five delta specs synced to main (3 NEW, 2 MODIFIED with appended requirements); design ADR-status alignment completed; seven slices delivered 19 REQs, all 237/237 tests pass, architecture conformant, Strict TDD verified. Three cosmetic followups deferred (domain-spec status normalization, EngineClient spy helper extraction, ADR status label sync). Per-slice progress and orchestrator DAG checkpointing prevented collision losses during parallel apply.

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed | Action |
|---|---|---|---|---|---|
| `batch-cap-contract` | New | 3 (REQ-01/02/03) | 0 | 0 | Created; Status normalized: draft→signed |
| `boundary-pass-through` | New | 4 (REQ-01/02/03/04) | 0 | 0 | Created; Status normalized: draft→signed |
| `test-pyramid-codification` | New | 4 (REQ-01/02/03/04) | 0 | 0 | Created; Status normalized: draft→signed |
| `commit-discard-contract` | Delta | 1 (REQ-10) | 0 | 0 | Appended REQ-10 (double-fault preservation) |
| `foundations-skeleton` | Delta | 4 (REQ-GIR-02, REQ-GIR-03, REQ-FAKE-07, REQ-FIT-09) | 0 | 0 | Appended new requirements to appropriate domains |

## Archive Location

`openspec/changes/archive/2026-07-05-stage-1-ir-bedrock/`
- 31 files moved (verified: source gone, dest present, file count match)
- Per-change artefacts accessible via topic keys: `sdd/stage-1-ir-bedrock/*`

## Design Artefact Alignment

**ADR Status Corrections**:
- ADR-0019: `Status: Proposed` → `Status: Accepted` (aligned with committed `openspec/decisions/0019-batch-cap-and-text-wire.md`)
- ADR-0017 Amendment: `Status: Proposed` → `Status: Accepted` (amends ADR-0017, design now accurate)

**Spec Domain-Status Normalization**:
- All five delta specs carried `Status: draft` in the change folder (appropriate for stage-local review)
- NEW specs synced with `Status: signed` (2026-07-04, stage-1-ir-bedrock)
- MODIFIED specs inherit parent spec version/status on append (commit-discard-contract V1 signed, foundations-skeleton V4 signed)
- Cosmetic; no content divergence. Deferred as pending-changes 1.1.

## Lessons Learned Persisted

| Lesson | Type | Topic Key |
|---|---|---|
| Identity exclusion proved load-bearing via triangulation regression | pattern | `project/lessons-learned` |
| Stage-boundary markers guide cross-stage collaboration | pattern | `project/lessons-learned` |
| Seam contracts need fixture adversarialism to kill encoding mutants | discovery | `project/lessons-learned` |

Total: 3 lessons added (3/5 budget used).

## ADRs

### Promoted to Project-Level

The following ADRs are **recommended** for promotion to `project/architectural-decisions`:
- **ADR-0019**: Batch size cap, UTF-8 measurement, text-only wire content
  - Rationale: Cross-cutting wire-envelope property affecting all future payloads; the cap lives as a single constant (`BATCH_CAP_BYTES`) in `wire.ts` and all fixtures parametrize on it. Changing the value touches exactly one production line + regenerated fixtures. Stage 6 freeze depends on real engine confirmation of this value.
  - Status: Accepted (2026-07-04)
- **ADR-0017 Amendment** (self-move identity exclusion): Amends ADR-0017 fail-closed semantics
  - Rationale: Clarifies that `dst === src` is not a collision (file-preserving success, matches fs `rename` semantics). Foundational for move operation design going forward.
  - Status: Accepted (2026-07-04b)

**Note**: Promotion requires orchestrator confirmation via `confirmed_adr_promotions` parameter. This report surfaces the recommendation; the orchestrator surfaces to human for confirmation, then re-invokes archive if needed.

## Followups Registered

| # | Description | Type | Size | Origin | Stage |
|---|---|---|---|---|---|
| 1.1 | Normalize domain-spec `Status: draft` → signed on sync (verify-report SUGGESTION #1) | docs | XS | verify-report | 1.6 (backlog) |
| 1.2 | Extract shared `EngineClient` spy helper (verify-report SUGGESTION #2) | refactor | XS | verify-report | 1.7 (backlog) |
| 1.3 | Align design §4.5 ADR status labels with committed ADRs (verify-report SUGGESTION #3) | docs | XS | verify-report | **COMPLETED at archive** |
| 2.1a | Attribution granularity: `session.ts` attributes to `instructions[0]`, stage 2.1 carries offending directive/index | refactor | M | verify-report | 2.1 |
| 2.1b | Non-Error E1 + rejecting `discard()` drops E2; context.ts guard limitation | edge-case | S | verify-report | 2.1 (document) |
| 2.1c | Round-trip/cap rejection messages could name the offending directive/field | docs | S | verify-report | 2.1 (nice-to-have) |
| 6 | Confirm `BATCH_CAP_BYTES` against real engine frame limit before Stage 6 freeze | edge-case | S | verify-report | 6 |
| 1.9 | Doc note: FIT-04 gate blind to intentional-surface slices; additivity out-of-band | docs | XS | verify-report | 1.6 (design note) |

**Routing**: Followups 2.1a/b/c and 6 carry stage-routing; 1.1/1.2/1.9 surface in grooming. Followup 1.3 (ADR status alignment) was completed during this archive phase.

## Pre-PR Audit Summary

**Mode**: pre-pr (full change diff audit)
**Findings**: Clean

- **G1 (Spec/Req alignment)**: 19/19 REQs trace to signed spec V2 clauses; all scenarios have implementing code + passing tests.
- **G2 (Architecture)**: No layer violations (edits confined to `src/core` + `src/commons`); ADR-0017/0018/0019 all implemented as designed; SSOT (`BATCH_CAP_BYTES` single constant); no sensitive area touched.
- **G3 (Code quality)**: Zero `as any`/`@ts-ignore`/`eslint-disable`/`TODO`/`FIXME` in production `src/`. Five `RAW-UNTIL-STAGE-2.1` markers are spec-sanctioned stage-boundary pointers, not deferred work.
- **G4 (Scope)**: Production diff = exactly the 5 files in design's File-Changes table (`wire.ts`, `directive-factory.ts`, `base-handle.ts`, `context.ts`, `commons/index.ts`). No scope creep.

**Upstream sync**: spec_source=internal; no upstream sync required.

## Test Coverage

| Metric | Value |
|---|---|
| Full suite | 237/237 pass (up from 188 baseline; +49 new tests) |
| Typecheck | Clean (bunx tsc --noEmit exit 0) |
| FIT-04 gate | Green (no breaking `.d.ts` removals; `move {force?}` additive) |
| Mutation coverage | Design-level mutant-killer assertions; no stryker config (skipped per sdd-init) |
| REQ-ID coverage | 19/19 (all REQs have ≥1 referencing test; 0 uncovered) |

## Completeness State

- **Slices**: 7 of 7 complete (S-1.3, S-1.4, S-1.7, S-1.1, S-1.5/1.6, S-1.8, S-1.9)
- **Tasks**: 27 of 27 ticked in slices.md
- **In-loop iterations**: 5 (iter-1 had triangulation gap; iter-2–5 all PASS)
- **Verify verdict**: pass-with-followups
- **Adversarial review**: required (triage L); orchestrator runs judgment-day blind before archive seal

## Artifacts Persisted

| Artefact | Topic Key / Location | Format |
|---|---|---|
| Archive report | `sdd/stage-1-ir-bedrock/archive-report` (openspec: this file) | Markdown |
| Lessons learned | `project/lessons-learned` (3 entries) | engram observations |
| Pending changes | `project/pending-changes` (8 entries from this change) | openspec file append |
| ADR promotion recommendation | Listed above (ADR-0019 + ADR-0017 amendment) | Human confirmation pending |

## Final Checklist

- [x] Specs synced to main (5 domains: 3 NEW, 2 MODIFIED)
- [x] Delta spec Status normalized (draft → signed for NEWs; inherited for MODIFIEDs)
- [x] Design ADR-status alignment (ADR-0019, ADR-0017 amendment: Proposed → Accepted)
- [x] Change folder moved to archive (`git mv` verified: SRC gone, DEST present, file count matches)
- [x] Lessons learned extracted (3 curated entries, ≤5 budget)
- [x] Followups registered in pending-changes
- [x] ADR promotion recommendation prepared (awaiting orchestrator confirmation)
- [x] Archive report written

**Status**: COMPLETE. Ready for orchestrator ADR-promotion confirmation and user push-to-PR.
