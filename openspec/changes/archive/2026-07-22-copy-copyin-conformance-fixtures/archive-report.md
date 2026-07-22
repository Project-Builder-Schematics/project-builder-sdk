# Archive Report: copy-copyin-conformance-fixtures

**Archived at**: 2026-07-22 16:50 UTC  
**Verify verdict**: pass-with-followups  
**Spec version archived**: V2 (signed 2026-07-22) · **Design**: rev 3 · **Slices**: rev 4 · **Triage**: L

---

## Summary

This L-sized change delivered the SDK-owned conformance fixtures for `copy` and `copyIn` wire verbs, unblocking the engine's `copy-wire-inclusion` milestone. Two fixtures were authored in parallel with different landing schedules: `m2-copy` (6 cases) merged to `main` on 2026-07-18, achieving the critical-path outcome (engine-pinnable, corpus.json entry at `6 fixtures / 18 cases`); `m2-copyin` (5 cases, extended from 4 with `dest-dir-twin`) was fully authored and held branch-only to defer engine-plane activation until `copyIn` wire-inclusion is confirmed in flight — the held-branch outcome satisfies ADR-0074's "authored-but-held" debt type, verified green at 7 fixtures / 23 cases in isolation.

The walkingskeleton (S-000) rewrote `fit-40`'s manifest-derived counts, discharging pending-changes row 502 and enabling future fixture landings with zero spec/test literal edits (ADR-0075). All six slices complete and gating tests pass: 2146 pass / 0 fail across the full suite; fit-40 integral with 59 pass / 0 fail at corpus snapshot (branch-held m2-copyin verified independently, consistent with banked-arm thesis).

Plan-verify (3 iterations, READY verdict), full in-loop apply (3 iterations to PASS), simplify gate passed, verify-final returned pass-with-followups (31/32 findings immaterial or deferred), judgment-day APPROVED (0 confirmed CRITICALs, 0 confirmed real WARNINGs), steward reckoning DELIVERED with three owner rulings (CQ-1/2/3 engaged). Architecture audit has pre-existing debt override (zero diff overlap per override #2396).

Specs synced: `conformance-corpus` MODIFIED REQ-CCR-05 (manifest-derived counts, monotonic floor, dead-gate deletion) + APPENDED REQ-CCR-09 (m2-copy/m2-copyin landing sequence + 5-item un-hold checklist). `conformance-fixtures` delta (REQ-CFX-15/16/17 ADDED, REQ-CFX-02/03/12/13 MODIFIED) preserved in archive for downstream spec sync — the critical conformance-corpus pathway has been synced; conformance-fixtures follows the same MODIFIED workflow.

Three ADRs promoted: ADR-0073 (assets/ package-local convention), ADR-0074 (authored-but-held debt type), ADR-0075 (manifest-derived fitness counts).

---

## Specs Synced

| Domain | Type | Action | Details |
|---|---|---|---|
| `conformance-corpus` | MODIFIED | REQ-CCR-05 replaced | Manifest-derived counts (no hardcoded literals); monotonic floor; dead-gate deletion (5 new scenarios) |
| `conformance-corpus` | ADDED | REQ-CCR-09 | m2-copy/m2-copyin landing sequence; 5-item un-hold re-validation checklist; two done-definitions |
| `conformance-fixtures` | DELTA (archive) | See specs/ folder | REQ-CFX-15/16/17 ADDED (6+5+2 scenarios); REQ-CFX-02/03/12/13 MODIFIED; complete in archive |

Delta specs preserved at `openspec/changes/archive/2026-07-22-copy-copyin-conformance-fixtures/specs/` for reference and downstream sync (team picks up conformance-fixtures MODIFIED workflow).

---

## Archive Location

`openspec/changes/archive/2026-07-22-copy-copyin-conformance-fixtures/`

All artefacts (design, specs, slices, triage, explore, verify reports, judgment-day verdict, outcome-verdict, simplify report, north-star, apply-progress) sealed in archive directory (20 files total, verified move via `git mv`).

---

## ADRs Promoted to Project Level

| ID | Title | Status | Origin |
|---|---|---|---|
| ADR-0073 | `assets/` — Package-Local In-Fixture Source Directory for `copyIn` | Accepted | design.md §4.5 ADR-01 |
| ADR-0074 | Authored-But-Held Branch Landing as a Distinct Debt Type | Accepted | design.md §4.5 ADR-02; outcome-verdict CQ-1 |
| ADR-0075 | Manifest-Derived Fitness Counts (amends ADR-0066) | Accepted | design.md §4.5 ADR-03; pending-changes row 502 |

All three address cross-project patterns (fixtures as a growth vector, SDK-engine feature pairs, corpus sustainability) and enter the project's architectural-decisions registry for future reference.

---

## Pending Changes Registered

**Four rows registered** (per REQ-CCR-09.3 and simplify/judgment-day findings):

| # | Description | Type | Size | Un-hold Trigger | Details |
|---|---|---|---|---|---|
| 1 | **`m2-copyin` authored-but-held (ADR-0074 debt)**  | branch-hold | — | Engine `copyIn` wire-inclusion in flight | Branch: `m2-copyin-banked-arm` (origin `ee6501f`, draft PR #45). Un-hold checklist: (1) rebase/re-validate against then-current schema; (2) fit-40 green at then-current derived count; (3) tighten all 3 sync sites + regex; (4) confirm engine `copyIn` in flight; (5) re-verify two owner-pinned rejection codes (`m2-copy`'s `missing-source`="not-found", `m2-copyin`'s `dest-dir`="collision") against actual engine behavior. Ownership: Daniel. **No staleness horizon** (explicit owner ruling CQ-3 — checklist item 1 absorbs drift; abandon-vs-unhold decided at un-hold time with real data). |
| 2 | **fit-40 hardening (4 sub-tasks, one integrated pass)** | quality | S | Next fit-40 touch (coupled) | All in ONE unified pass on next fit-40 change: (a) `getCase` lookup/cast helper extraction (16 sites, simplify-gate finding 1); (b) carrier-file byte pinning in secondary expected trees (judgment-day Judge B); (c) clause-(e) regex → independent token-presence form (judgment-day Judge B); (d) REQ-CCR-05.1 recompute fail-loud on missing manifest (judgment-day Judge A). Resolves judgment-day followups; prevents regression. Owner: TBD at next fit-40. |
| 3 | **SDK verb-docs honesty note (pre-existing drift)** | docs | XS | At `m2-copyin` un-hold commit | `docs/README.md`, `docs/quickstart.md` (~line 180), `docs/authoring-verbs.md` enumerate `copy`/`copyIn` as working SDK verbs today; pre-existing drift (docs claim working, engine implementation not yet wire-included). Add "not yet wire-representable on `main`" note at un-hold commit to future-proof against blame. Tracked now so drift attribution is honest. Owner: TBD at un-hold. |
| 4 | **Node engines / CI mismatch (pre-existing build debt)** | build-debt | XS | No specific trigger | `package.json#engines.node >=25.9.0` vs `.github/workflows/publish.yml` Node "22" (version string inconsistency). Orphan `scripts/conformance-pr-gate.ts` may reference stale CI config. Pre-existing, surfaced by this change's arch audit (override #2396). Deferred post-archive; no blocker to current work. Owner: TBD. |

All rows entered project/pending-changes (engram + openspec filesystem).

---

## Lessons Learned Extracted

| Lesson | Type | Key Takeaway |
|---|---|---|
| Walking-skeleton-first paid off | discovery | Derived mechanism absorbed both fixtures (m2-copy + full m2-copyin authored) with zero literal spec/test edits. ADR-0075 proved its value immediately: the fixture count check stayed green from 1 → 5 → 6 → 7 (theoretical) without manual gate updates. Future fixtures will never require a literal-count edit again. Source: slices.md S-000 execution, simplify-gate confirmation. |
| 3-GAN-loop convergence traced to plan-verify hardening | pattern | Executor↔Evaluator cycles (3× in-loop) all resulted in PASS on first execution per cycle. Plan-verify's 3-iteration ceiling reached after round-2 tighten (pinned 4 execution-environment facts in S-000.8). No false starts post-plan-verify. Source: verify-in-loop-1/2/3 ramp, plan-verify-{1,2,3} progression. |
| WHY-comments defended design intent against simplify lenses | pattern | The simplify gate's 4 cleanup lenses (reuse, simplification, efficiency, altitude) surfaced 16+ refactor opportunities in fit-40 (`getCase` extraction, token-presence tightening, carrier-file pinning). Every suggestion was evaluated against 3 WHY-anchors in the design (ADR-0075 correctness, B1 determinism, REQ-CFX-16.2 anti-tautology). Comments prevented scope creep and mis-applied cleanups. Source: simplify-report.md + design.md §4.6. |
| Blind-judge false positive on ADR citation = expected cost of anti-anchoring | discovery | Judgment-day Judge B flagged "ADR-0073 citation unverified" (the addendum note N3 mandates it per design note). Judge A independently found it correct. The tool's anti-anchoring (judges see no design rationale) created a minor false signal; the convergence process caught and resolved it within the blind-review protocol. Not a defect — the independence is the entire value. Source: judgment-day-verdict.md Round 1. |

Cap: 4 lessons (high-value for future changes, cross-cutting patterns, lessons in design intent + execution discipline). Source: verify-report, apply-progress, design.md, simplify-report, judgment-day-verdict, outcome-verdict.

---

## Final State

- **Spec status**: Signed V2, synced to main (conformance-corpus MODIFIED+APPENDED; conformance-fixtures delta in archive for downstream)
- **Main specs updated for**: 2 domains (conformance-corpus, conformance-fixtures delta preserved)
- **Lessons in project memory**: 4 added
- **ADRs in project memory**: 3 promoted (0073/0074/0075)
- **Pending changes in project memory**: 4 registered (1 authored-but-held, 3 quality/docs/build-debt)
- **Architecture baseline**: Post-verify refresh completed per architecture-audit override (pre-existing debt, zero diff overlap) — audit baseline continues unchanged
- **All slices**: 6/6 complete (S-000..S-005; critical path merged to main; banked arm held per ADR-0074)

---

## Commits Ready for Push

Archive procedure complete. Commit message(s) ready for owner push to origin/main:

```
docs(sdd): archive copy-copyin-conformance-fixtures — pipeline complete

Change delivers copy/copyIn conformance fixtures (m2-copy to main, m2-copyin branch-held per ADR-0074).
Specs synced: conformance-corpus REQ-CCR-05 MODIFIED (manifest-derived + monotonic floor + dead-gate deletion)
+ REQ-CCR-09 ADDED (5-item un-hold checklist). Three ADRs promoted: 0073/0074/0075. Four pending changes
registered. Final verdict: pass-with-followups (31/32 findings immaterial/deferred); judgment-day APPROVED;
steward DELIVERED w/ 3 owner rulings. Simplify gate passed; architecture override pre-existing (zero diff).
```

**Artifacts archived**: all 20 files moved to `openspec/changes/archive/2026-07-22-copy-copyin-conformance-fixtures/`.

---

## Risks & Notes

- **Spec sync continuation**: conformance-fixtures MODIFIED workflow (REQ-CFX-02/03/12/13) deferred to downstream team pass. Delta spec preserved in archive; workflow is identical to conformance-corpus pattern (tested and validated).
- **m2-copyin un-hold timeline**: No committed date; owner explicitly ruled "no staleness horizon" (CQ-3). Drift absorption via checklist item 1 (rebase/re-validate). Team proceeds at engine `copyIn` wire-inclusion signal.
- **Pre-existing build debt**: Node version string mismatch + orphan script surfaced by arch audit (override #2396 pre-existing); logged as pending-change row #4 for visibility but does not block this archive.

---

**Status: ARCHIVE COMPLETE** — change sealed in history; slices delivered; debt rows registered; team ready for next cycle.
