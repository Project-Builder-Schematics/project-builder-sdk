# Archive Report: bare-factory-migration

**Archived at**: 2026-07-15T00:00:00Z
**Verify verdict**: pass-with-followups
**Spec version archived**: V2 (signed, owner, 2026-07-14)
**Triage**: L

## Summary

The bare-factory migration successfully relocated `packageDir` from author-supplied to caller-supplied, graduating `defineFactory` to internal vocabulary. All 20 active REQs across 5 domains (56 scenarios) are COMPLIANT. Two REMOVED REQs (REQ-TES-02, REQ-ATH-13) had their guarantees relocated to REQ-TES-08 and REQ-ATH-17. Three architectural decisions (ADRs) promoted to project-level; four non-blocking followups registered for future planning.

## Specs Synced to Main

| Domain | Type | REQs Added | REQs Modified | REQs Removed | Status |
|---|---|---|---|---|---|
| testing-entry-surface | Delta | 2 (TES-08, TES-09, TES-10) | 2 (TES-03, TES-05, TES-06) | 1 (TES-02) | ✅ synced |
| author-test-harness | Delta | 3 (ATH-17, ATH-18, ATH-19, ATH-20) | 4 (ATH-01, ATH-06, ATH-11, ATH-14) | 1 (ATH-13) | ✅ synced |
| factory-package-shape | Delta | 0 | 0 | 0 | ✅ synced |
| testing-story-docs | Delta | 0 | 0 | 0 | ✅ synced |
| author-onboarding-docs | Delta | 0 | 0 | 0 | ✅ synced |

## Archive Location

**Filesystem**: `openspec/changes/archive/2026-07-15-bare-factory-migration/`
**Branch state**: All 23 files moved via `git mv`; folder verified present, source removed.

## Lessons Learned Persisted

Two high-value lessons extracted and appended to `openspec/lessons-learned.md`:

1. **Design inventory claims derived from narrow searches undercount reality** — Type: discovery. The design-phase inventory scan (`fd . test/fake | rg harness`) found 4 files; build execution revealed 5 unclaimed consumers. Section 14's docs table missed `src/dialects/typescript/index.ts`'s `@example`. Multi-pattern sweeps + executor-side re-derivation (verify + build/typecheck) caught both. Actionable: inventory claims must be cross-checked twice (search + automated cross-cutting scan) before spec signature.

2. **The vacuous-oracle trap: substring-match safety depends on context** — Type: pattern. REQ-ATH-20.1 scans for bare `defineFactory` token; the guarantee holds today because the token doesn't appear (vacuous), not because code actively forbids it. FIT-16's comment warned of this trap pre-migration. Actionable: when a spec REQ depends on token absence, state explicitly whether it's enforced by code (active guard), type system, or merely observed as side effect; if the latter, register as drift risk or future guard.

## ADRs Promoted to Project-Level

Three architectural decisions promoted from design section 4.5:

- **ADR-0050**: `defineFactory` Graduates to Core-Internal, Removed from `./testing` — Status: Accepted. Structural enforcement via FIT-08 (export narrowing) + FIT-29 (new import-reachability guard). FIT-16 3rd-signal retired as consequence.

- **ADR-0051**: Caller-Supplied `packageDir` Anchor — Status: Accepted. `packageDir` moves from `defineFactory(fn, {packageDir})` to `runFactoryForTest`'s options bag. Error wording rewritten runtime-neutrally.

- **ADR-0052**: Options-Bag Signature + Single-Wrap-Seam Delegation — Status: Accepted. `runFactoryForTest(fn, input, {seed?, packageDir?})` delegates to `defineFactory`; never reimplements wrap logic.

## Followups Registered

Four non-blocking followups registered in `openspec/pending-changes.md` under bare-factory-migration:

1. **R-11 scratch-replica drift risk** (S, refactor) — The scratch-anchor replica skips `validateAtRunBoundary` and lacks `checkReservedNames` wrapper. Behavior preservation proven by git-clean corpus regen; register lockstep pin test or shared helper to prevent silent divergence.

2. **Cosmetic comment-level tokens** (XS, docs) — 4 prose/comment mentions of `defineFactory` remain in test files (harness-opted-in.test.ts, classify-transport.test.ts), describing the migration. No spec scenario scans comments; optional cleanup.

3. **FIT-29 namespace-import bypass** (S, security) — Both judgment-day judges noted: `import * as` would bypass FIT-29's named-import-only scan if an untrusted file re-exported a piped `defineFactory` binding. Theoretical today (no production code namespace-imports); register as forward-looking hardening.

4. **Spec REQ-ATH-01/17 `packageDir` type reconciliation** (S, refactor) — Spec declares `packageDir?: string | URL`, runtime accepts only `string`. Align type or document limitation.

(Note: TSD-01.4 seeded-read oracle tightening and comments on REQ-FPS-05.2 `@example` not registered — former is refinement candidate for next story-docs evolution; latter is correct-by-design. Double-fault frozen branch pre-existing, outside scope.)

## Upstream Sync

**spec_source**: internal (no upstream Jira/GitHub sync required).

## Final State

- **Specs synced to main**: 5 domains (5 files modified).
- **Change folder moved**: openspec/changes/archive/2026-07-15-bare-factory-migration/ ✓
- **Lessons persisted**: 2 entries appended to openspec/lessons-learned.md.
- **ADRs promoted**: 3 (ADR-0050, ADR-0051, ADR-0052) in openspec/decisions/.
- **Pending changes registered**: 4 new rows in openspec/pending-changes.md.
- **Verify verdict**: pass-with-followups (1285/0 test suite, 0 gating findings from pre-PR audit).
- **Judgment-day**: APPROVED.
- **Steward reckoning**: DELIVERED.
- **Architecture audit**: clean (no violations).

## Coherence

| Area | Status | Notes |
|---|---|---|
| Spec compliance | ✅ | 56/56 scenarios compliant; 2 REMOVED REQs' guarantees relocated and verified |
| ADR adherence | ✅ | ADR-A/B/C implemented and verified; ADR-A consequence (FIT-16 retirement) honored |
| Frozen-set manifest | ✅ | Regression sentinels untouched; context.ts impl body frozen; corpus byte-identical |
| Test coverage | ✅ | 1285 passing, 0 failing, 0 skipped; REQ-ID coverage 20/20 active, 2/2 removed guaranteed relocated |

## Archive Status

**Ready for closure**: Yes. All steps completed:
1. ✅ Delta specs synced to main (5 domains)
2. ✅ Change folder moved to archive/2026-07-15-bare-factory-migration/
3. ✅ Lessons learned extracted and persisted
4. ✅ ADRs promoted to openspec/decisions/
5. ✅ Followups registered in openspec/pending-changes.md
6. ✅ Verify report confirms pass-with-followups
7. ✅ Judgment-day APPROVED
8. ✅ Steward reckoning DELIVERED
9. ✅ Architecture audit clean

**Next**: Archive is sealed. Orchestrator can begin a new change cycle or groom pending-changes for future planning.
