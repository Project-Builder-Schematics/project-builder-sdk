# Archive Report: schematic-local-files

**Archived at**: 2026-07-13T00:00:00Z (session date)
**Verify verdict**: pass-with-followups
**Adversarial review**: APPROVED (judgment-day, iteration 3 of 3, owner-authorized over nominal budget)
**Steward reckoning**: DELIVERED
**Spec version archived**: V3 signed baseline; `package-root-containment` domain V5 (V3→V4→V5 amendments owner-signed at this archive)

## Summary

`schematic-local-files` (L) ships the SDK-side half of package-local folder scaffolding and
by-reference file copy (`scaffold`, `copyIn`, `create({templateFile})`): a new `src/scaffold/`
leaf, the additive `copyIn` wire op, a 12-member `AuthoringReason` union, and the fused
`RunContext.packageAnchors?` dual-anchor containment ceiling. Verify-final: pass-with-followups
(1055/0 suite, tsc clean, fitness 276/0). Judgment-day caught and fixed 3 real defects (classifier
budget under-measurement, a BOM-stripping regression, a raw-Node-error leak) across 3 iterations
before approving. Steward reckoning: DELIVERED — the SDK half genuinely solves the stated problem;
the engine copy-apply pass is honestly carried as a scheduled, not-yet-built dependency. Ten domain
specs synced to main, the change folder moved to archive, 4 lessons + 4 ADRs promoted, 5 followups
registered.

## Owner Sign-Off Package (2026-07-13)

| Item | Disposition |
|---|---|
| Spec amendment REQ-PRC-10 (V3→V4, walk-root containment pre-check) | **SIGNED** |
| Spec amendments REQ-PRC-10.3 (amended) + REQ-PRC-10.3b (new) (V4→V5, walk-root read failure → `AuthoringError`) | **SIGNED** |
| Engine copy-apply pass (PC-PROTO-01) | **committed-next SCHEDULED** (re-affirmed, not merely registered — see pending-changes note below) |
| `permissive-proof` pre-existing `TS2578` (main @ `04c141e`) | Registered as standalone project pending item, NOT attributed to this change |

## Architecture Audit

**Result: CLEAN.** Baseline `openspec/architecture.md` was stale (dated stage-5b, no mention of
`src/scaffold/`) — refreshed to rev dated 2026-07-13, adding: the `src/scaffold/` leaf (walk,
filename-pipeline, classify-transport incl. the sniff primitive, containment, expander, index),
the 7-member wire/verb growth (`Directive`/`AuthoringVerb`/`DryRunVerb` + `copyIn`, 1-op↔1-verb
totality), the fused `packageAnchors?` dual-anchor, the containment ceiling seam, and fitness
gates FIT-21/FIT-22. Post-refresh audit: `bun test test/fitness` (276/0, 23 files), `bun x tsc
--noEmit` (clean), and a manual reverse-dependency scan confirmed zero imports of `src/scaffold/`
from `src/core/**`/`src/dry-run/**` (only comments reference it) — FIT-22 now guards this
structurally. No violations. Engram pointer `sdd/project-builder-sdk/architecture` (#2001) updated
to match.

## Spec-Sync Manifest

| Domain | Type | REQs Added | REQs Modified | Main spec version |
|---|---|---|---|---|
| `folder-scaffold` | New | 9 | — | V3 (as-shipped, no history rewrite) |
| `file-escape-hatches` | New | 5 | — | V3 |
| `content-classification` | New | 6 | — | V3 |
| `package-root-containment` | New | 10 | — | V5 (V3→V4→V5 owner-signed) |
| `by-reference-copy-wire` | New | 8 | — | V3 |
| `author-test-harness` | Delta | 3 (ATH-14/15/16) | — | V3→V4 |
| `authoring-error-contract` | Delta | 3 (AEC-10/11/12) | 1 (AEC-01 enum 8→12, AEC-05.1 family list) | V3→V4 |
| `batch-cap-contract` | Delta | 2 (REQ-04/05) | — | V2→V3 |
| `dry-run-plan-exposure` | Delta | 2 (DRE-05/06) | — | V2→V3 |
| `run-boundary-input-validation` | Delta | 1 (RBV-06) | — | V2→V3 |

All 10 domains verified REQ-ID-count-stable (pre-existing + delta = post-sync main count) before
commit. `authoring-error-contract` REQ-AEC-01's enum literal was extended 8→12 in main to stay
internally consistent with REQ-AEC-10's own extension text (judgment call, documented inline —
the delta used ADDED-only formatting but REQ-AEC-10 itself mandates the union grows to 12).

## Archive Location

`openspec/changes/archive/2026-07-13-schematic-local-files/` — move verified: source folder gone,
destination present, 32/32 files (triage, explore, proposal, design, slices, apply-progress, 10×
verify-in-loop, 2× verify-plan, verify-report, judgment-day-report, outcome-verdict, north-star,
state.yaml, `specs/` 10 domain subfolders, this archive-report).

## Lessons Learned Persisted (4)

1. BOM regression from a "neutral" decode refactor — pattern — engram #2022
2. Classifier budget heuristic measured the wrong quantity — pattern — engram #2023
3. Blind adversarial re-review is load-bearing even after council + verify-final — discovery — engram #2024
4. Worktree engram-namespace gap during planning — discovery — engram #2025

Also appended to `openspec/lessons-learned.md` § "From `schematic-local-files` (2026-07-13)".

## ADRs Promoted to Project-Level (4 of 4)

| ADR | Title | Status |
|---|---|---|
| ADR-0043 | By-reference copy wire shape — `copyIn` op | Accepted, promoted 2026-07-13 |
| ADR-0044 | `src/scaffold/` expansion leaf module (supersedes ADR-0005) | Accepted, promoted 2026-07-13 |
| ADR-0045 | Package-read source validation & SDK/fake division of labor | Accepted, promoted 2026-07-13 |
| ADR-0046 | `RunContext.packageRoot` eager ceiling seeding | Accepted, promoted 2026-07-13 — **as-built amendment appended**: shipped as fused `packageAnchors?: { packageDir; packageRoot }` object (both-or-neither structural), not the two independent optionals originally sketched |

Individual ADR files updated in `openspec/decisions/`; mirrored to engram #2026-#2029.

## Followups Registered (5)

| Description | Type | Size | Origin |
|---|---|---|---|
| BRC-02 engine ceiling re-derivation + TOCTOU closure | security | M | design §Seam Contract; owner: engine repo, committed-next scheduled |
| BRC-08 non-canonical path-form rejection + single-pass render | security | M | design §Seam Contract; owner: engine repo, committed-next scheduled |
| PRC-06 post-render destination containment | security | M | design §Seam Contract; owner: engine repo, committed-next scheduled |
| `permissive-proof` TS2578 (pre-existing on main, not this change) | bugfix | XS | verify-report finding 1 |
| Executor-Context §5 note imprecision (rename `../` smuggling) — note lives in this sealed archive folder, not corrected in place | docs | XS | judgment-day Judge F, iteration 3 |

All registered at `openspec/pending-changes.md` (BRC-02/08/PRC-06 pre-existed from S-005; the
other two added at this archive) and mirrored to engram #2030-#2032.

## Final State

- Spec status: signed (archived), `package-root-containment` V5 owner-signed at this archive
- Main specs updated: 10 domains (5 new, 5 delta)
- Suite: **1055 pass / 0 fail** (123 files) · Fitness: **276 pass / 0 fail** (23 files) · `tsc --noEmit`: clean
- `permissive-proof`: 1 pre-existing failure, confirmed unrelated to this change
- Lessons in project memory: 4 added (engram + `openspec/lessons-learned.md`)
- ADRs in project memory: 4 promoted (engram + `openspec/decisions/00{43,44,45,46}-*.md`)
- Pending changes in project memory: 5 registered/updated (engram + `openspec/pending-changes.md`)
- Architecture baseline: refreshed and clean (`openspec/architecture.md`, engram #2001)
