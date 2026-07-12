# Archive Report: stage-5-first-dialect

**Archived at**: 2026-07-12
**Verify verdict**: pass-with-followups
**Spec versions archived**: dialect-generics V3, typescript-dialect V4, modify-coalescing V3, dialect-conformance V4, factory-package-shape V5, dialect-authoring-standards V3, foundations-skeleton V4 (all signed)

## Summary

Stage 5 delivered the first real AST-capable dialect (TypeScript via ts-morph 28.0.0) with type-safe, chainable `modify` operations that coalesce to a single directive. The dialect generics contract (`defineDialect`/`defineOpPack`/`withOps`) is proven through a real implementation; a conformance kit establishes the recipe for future dialects. All 34 REQ-IDs across 7 domain specs are now in main specs. Verify final passed with 34/34 REQ coverage and 765 passing tests. Judgment-day approved (R1). Steward reckoning delivered. ADRs 0037-0038 promoted to project level.

## Specs Synced to Main

| Domain | Type | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|
| dialect-generics | New | 6 | 0 | 0 |
| typescript-dialect | New | 16 | 0 | 0 |
| modify-coalescing | New | 7 | 0 | 0 |
| dialect-conformance | New | 5 | 0 | 0 |
| dialect-authoring-standards | New | 2 | 0 | 0 |
| factory-package-shape | Delta | 0 | 1 | 0 |
| foundations-skeleton | Delta | 0 | 6 | 0 |

**Total**: 7 domains, 36 new REQs, 7 modified REQs (all scenario counts preserved or grown).

## Archive Location

`openspec/changes/archive/2026-07-12-stage-5-first-dialect/`

## Lessons Learned Persisted

1. **ts-morph@28 strips leading BOM through getFullText** (discovery) — WeakMap re-prepend logic in ast.ts handles this; design prose initially assumed otherwise. Internalized in `src/dialects/typescript/ast.ts` as undocumented invariant, but load-bearing for round-trip fidelity.

2. **ts-morph parser is fault-tolerant, real syntax-error detection needs getSyntacticDiagnostics** (discovery) — The parser succeeds on malformed input; detecting genuine syntax errors requires the `getSyntacticDiagnostics` path, which the dialect implements for TSD-04 (parse-fail containment).

3. **Async author callbacks under a `=> void` type escape sync try/catch containment** (pattern) — Thenable-return from an async-internal operation wrapped in a sync-typed callback requires awaiting the thenable inside the contained wrapper to preserve error handling. FIT-20 pins this pattern.

4. **openspec architecture mirror skipped three cycles when refreshes went engram-only** (process) — Architecture baseline refreshes in worktree context should mirror to filesystem when hybrid/openspec mode is active; skipping filesystem updates creates divergence for future readers.

5. **Cross-branch ADR/FIT "next free number" planning collides when sibling changes are unmerged** (process) — Reserve ADR/FIT number ranges at plan time when parallel branches exist; stage-4 (0024-0028) and stage-5 (0033-0034 → 0037-0038) both independently claimed the same slots. Applied established precedent (mechanical renumber); design/slices/apply-progress header document the collision.

## ADRs

### Promoted to Project-Level (Confirmed at Archive)

- **ADR-0037**: Coalescing seam is handle-owned; the run boundary joins outstanding handles (origin: S-001, stage-5-first-dialect, 2026-07-12). Status: Accepted. Builds on ADR-0006, ADR-0015, ADR-0010, ADR-0011. Renumbered from draft 0034 due to cross-branch collision with stage-4b; content unchanged.

- **ADR-0038**: ts-morph as the first runtime dependency — plain, exact-pinned (D5) (origin: S-002, stage-5-first-dialect, 2026-07-12). Status: Accepted. Builds on D5, ADR-0014, ADR-0037. Renumbered from draft 0033 due to cross-branch collision with stage-4b; content unchanged.

Both ADRs were marked Accepted at apply time and remain in `openspec/decisions/` with full authority headers documenting the renumber precedent.

## Followups Registered

**Verify final** verdict: `pass-with-followups`. Six followups registered to `project/pending-changes`:

| Description | Type | Size | Stage |
|---|---|---|---|
| [stage-5b-dialect-breadth] modify(content)-after-AST-op last-write-wins (reject or document — judgment-day confirmed both judges) | design | M | **5b** |
| [stage-5b-dialect-breadth] runOp async containment if Op<Ast> ever relaxes to async | refactor | S | **5b** |
| [stage-5b-dialect-breadth] DAS-01.1 negative-guard broadening beyond removeImport (doc scope) | docs | S | **5b** |
| [stage-5b-dialect-breadth] TSD-04.1 own-property/stack sweep vs REAL ts-morph error tracking | refactor | S | **5b** |
| [stage-5b-dialect-breadth] mid-chain print-failure containment + "could not print" fixture | test-coverage | S | **5b** |
| [stage-5b-dialect-breadth] MC-01.2/TSD-03.1 batch-grouping annotation-or-assert, Session.isPending() vs pendingSnapshot copy, FIT-01 extensionless-relative-import blind spot, AuthoringError{origin} promotion | refactor | M | **5b** |
| provenance go-live checklist (remove --dry-run at first real release + assert live provenance) | refactor | XS | **6.2** |
| README front-door dialect entry (Stage 6.3, steward flag) | docs | S | **6.3** |

All eight registered at `openspec/pending-changes.md` with existing rows preserved; engram `project/pending-changes` upser follows below.

## Verify & Review Summary

- **Verify Final Verdict**: `pass-with-followups`
- **Completeness**: 34/34 REQ-IDs covered; ~65/65 scenarios COMPLIANT (verified via self-run full suite: 758 tests pass, 0 fail; typecheck clean; build clean).
- **Adversarial Review (Step 11b)**: No gating findings. Two non-gating nits (untyped-cast boundaries at generic-erasure, doc-drift in ADR labels). Code audit pre-PR: clean.
- **Judgment-day**: APPROVED (R1: 0 critical, 0 real warnings after owner-fix `5ad8a73`; R2 parallel: both judges PASS). Ordered-write adversarial surface + code-execution hatch reviewed.
- **Steward Reckoning**: DELIVERED. Problem statement fully resolved on primary path (run verified). North Star affirmations (4 CQs) all carried forward without drift.

## Final State

- Spec status: signed (7 domain specs archived, 34 new + 7 modified REQs synced to main)
- Suite: 662 → 765 tests passing
- Ts-morph: 28.0.0 exact-pinned; lockfile committed; provenance workflow staged
- Slices: 6/6 complete (S-000..S-005), all tasks ✅
- Lessons: 5 persisted to project memory (ts-morph BOM strip, getSyntacticDiagnostics, async containment pattern, arch-mirror discipline, ADR collision handling)
- ADRs: 2 promoted (0037, 0038); 2 amendments to existing (0012, 0014)
- Followups: 8 registered (6 stage-5b, 1 stage-6.2, 1 stage-6.3)

## Next Step

Stage 5 archived and ready for PR. Followups visible to Stage 5b planning cycle. ADR promotions carry full authority headers; amendments to 0012/0014 in-place. Architecture baseline refresh recommended once main branch is updated (worktree-scoped capture; Stage-5 scope is complete).
