# Triage: Stage 2 — error-to-author attribution

**Classification**: L
**Decided at**: 2026-07-05
**Change name**: `stage-2-error-attribution`

## Problem & Scope

> An author whose schematic is rejected today cannot tell WHICH verb failed or WHY: `session.ts`
> attributes every rejection to `instructions[0]`, `toAuthoringError` discards the engine's raw
> text by design, mid-chain failures don't report what already applied. Why now: Stage 1 landed
> three rejection families (ADR-0017 collisions, ADR-0018 round-trip/cap) marked
> RAW-UNTIL-STAGE-2.1 — this stage freezes the error contract everything after builds on.

```yaml
scope:
  in_scope: ["2.1 full attribution coverage (every verb, mid-chain applied-boundary,
    flush-vs-commit-time, structured rejection; session.ts + authoring-error.ts)",
    "2.2 D2 structured cause access (ADR)", "2.3 read-trichotomy helper (debt CQ-1)",
    "2.4 error-origin taxonomy engine vs SDK (ADR)", "4 registered Stage-2.1 pending-changes.md rows"]
  out_of_scope: ["Stage 3 dry-run", "Stage 4 typed options", "Stage 5 conformance-kit property",
    "Stage 6 real-engine cap + live publish", "any real engine client"]
```

## Description Received

> objectives-plan Stage 2 (2.1-2.4) + its 4 registered followups; re-absorbs superseded L1 #3.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected | ~10-14 (3 core, commons helper, 2 ADRs, 2 tests updated + new per-verb/taxonomy tests) | L |
| Lines affected | ~400-800 | L |
| Bounded contexts | 2 (core + commons; tests mirror) | L |
| New patterns | structured rejection type + origin taxonomy — new, not variant | L |
| Test types | new leak-scan + origin-distinguishability proof tests | L |

**Overrides**: Cross-cutting — attribution spans `session.ts`, `authoring-error.ts`, `context.ts`,
a new commons helper, `test/skeleton` + `test/fake` → floor **L**.

**Final classification**: L — override sets the floor; size independently sits in L's band.

## Recommended Path

- Phase: full Planner with Council
- Skills: `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 4-6) →
  verify-plan → `sdd-apply` ⇄ verify-in-loop → verify-final → `sdd-archive`
- Slice target: 4-6

## Recommended Personas (L only)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Tracks the 4 followups as debt |
| Architect | D2 + 2.4 are ★ decisions needing ADRs |
| QA Engineer | Mid-chain/flush-vs-commit edges, leak-scan proof |
| Tech Writer | `AuthoringError` is public; D2 + 2.4 change author vocabulary |

Not triggered: UX (no UI), Security (no auth/payments/privacy), DBA (no schema).

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- D2 and taxonomy (2.4) are ★ decisions — sequence both before the rewrite, not after.
- `authoring-error.ts` already defers "rich cause" (unused `_raw`) — check for other
  RAW-UNTIL-STAGE-2.1 markers in `session.ts`/`context.ts`.
- `AuthoringError` is exported/public — confirm additions are additive, not a semver break.
- The 4 pending-changes.md rows must be explicitly closed or re-deferred in design.

## Halt?

No — proceed to `sdd-explore`. Read ADR-0017/0018/0019 and the 4 pending-changes.md rows first.

## Notes for Next Phase

Read-not-found stays a VALUE (ADR-0016), never an error. 2.1 exists-when: every verb's rejection
carries verb + primary path + applied-boundary, zero engine/fake vocabulary leaks. 2.4 exists-when:
taxonomy ADR-recorded + a test proves origin is distinguishable without reading internals.
