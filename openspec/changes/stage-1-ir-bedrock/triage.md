# Triage: Stage 1 — IR bedrock: wire correctness & fake fidelity

**Classification**: L
**Decided at**: 2026-07-04
**Change name**: `stage-1-ir-bedrock`

## Problem & Scope

> Schematic authors need the IR bedrock correct and frozen-safe. Today: `move` lacks `force?` on
> the wire (semver risk — freezing it absent is the expensive mistake), the 4 MiB batch cap has no
> defined unit/encoding anywhere in `src/`, emission determinism is unproven, the fake does not
> model the wire (no JSON round-trip at emit — ADR-0018 unimplemented), ADR-0017's fail-closed
> rules are unimplemented in production + fake, the `EngineClient` port is the sole seam by
> convention but not structurally guarded (no FIT-10), and the four-layer test pyramid is implicit,
> not codified. Why now: every later stage (error attribution, dry-run, dialects) freezes
> semantics Stage 1 defines — cheapest to change now, semver-locked later.

```yaml
scope:
  in_scope: ["1.1 golden-IR completeness+determinism", "1.3 ADR-0017 closure (move force?+fake fail-closed)",
    "1.4 frame-cap unit/encoding ADR+flush enforcement+empty-batch run-end", "1.5 W6 double-fault preservation",
    "1.6 XS test-debt batch", "1.7-impl fake JSON round-trip+path/conflict pinning",
    "1.8 FIT-10 structural port guard", "1.9 test-pyramid doc+explicit e2e suite"]
  out_of_scope: ["Stage 2 attribution (2.x)", "dry-run (3.x)", "typed options (4.x)", "dialects (5.x)",
    "release shape (6.x)", "real engine wire", "re-deciding D1/D6 (implementation only)"]
```

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files | ~18-22 (4 core, commons, fake, golden-ir×2, fake-test×4, fitness×2, conformance, e2e×2-3, ADR, doc) | L/near-XL |
| Lines | ~900-1400 (repo lean: 10 core files, 1 commons, 9 fitness tests today) | L |
| Contexts | 2 (`core`+`commons`; tests mirror, not separate) | L |
| Patterns | FIT-10/frame-cap = variants of existing fitness/flush patterns | M |
| Test types | e2e formalizes an implicit layer; +1 fitness test | L |

**Overrides**: cross-cutting (1.4/1.8/1.9 hit core+commons+4 test suites) → floor L. No
sensitivity override (auth/payments/deploy untouched; supply-chain is Stage 6's). `force?` is
additive, FIT-04-guarded. No migration/new dependency.

**Final: L** — override sets the floor; size is at L's ceiling, not past it.

## Decomposition Assessment

ONE L change, not split: 8 items share 2 contexts + one freeze deadline (Stage 2 needs all);
1.1/1.3/1.4/1.7 share `contract-fake.ts`. Slice band 6-7. If slicing exceeds 8 or files grow
materially, escalate to split: wire/fake fidelity (1.1,1.3,1.7) vs guardrails+pyramid
(1.4,1.5,1.6,1.8,1.9).

## Recommended Path

Full Planner+Council → explore → propose → spec → design → slice (6-7) → verify-plan → apply ⇄
verify-in-loop → verify-final → archive.

## Recommended Personas (L only)

Always: Business Analyst, PM, Architect (port guard/layering), QA Engineer (determinism,
fail-closed, guard proofs). Conditional: Tech Writer (public param on `move`; 1.9's doc). Not
triggered: UX, Security, DBA.

## Spec Reference

spec_source: internal — none captured.

## Risks Flagged at Triage

- Size is at L's ceiling — re-validate in `sdd-explore`.
- `force?` on `move` is public API — prove non-breaking via FIT-04.
- 1.4's cap ADR isn't a ★ Decision — Architect confirms scope at design.
- Settle 1.3's fake before 1.4/1.7 build on it (shared file).

## Halt?

No — proceed to `sdd-explore`. Read ADR-0017/ADR-0018 in full first; only pending-changes.md's
1.5/1.6 rows apply here.
