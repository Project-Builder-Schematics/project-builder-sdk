# Triage: Author-Emulation E2E — Scaffold Family

**Classification**: L
**Decided at**: 2026-07-13T00:00:00Z
**Change name**: `author-emulation-e2e-scaffold`

## Problem & Scope

> Before engine construction resumes (post stage-6), the SDK's trust rests on surgical, fake-based e2e tests: 6 of the 7 files in test/e2e/ run against ContractFake with 2-4 directive paths each. Nothing exercises the SDK the way a REAL schematic author would — a full generator with templates + binary assets, naming transforms, module wiring, and parametric options (reference shape: nestjs-schematics crud-graphql-mongo). The IR contract the future engine must honor is invisible: it lives only inside test asserts. Who hurts: the owner at engine-integration time — SDK gaps (DX friction, missing helpers, contract holes) will surface at the worst possible moment. Why now: stage-6-release-shape is the last planned SDK change before returning to the engine, and schematic-local-files (the `scaffold` verb) is finishing its build — this is the first moment the scaffold mutation family is expressible.

```yaml
scope:
  in_scope:
    - "Author-emulation e2e for the SCAFFOLD mutation family only: a realistic authored schematic (crud-graphql-mongo-shaped: template files + binary assets, parametric typed options) exercising scaffold, copyIn, and create({templateFile}) as a real author would"
    - "Parametric scenario matrix simplest→most complex (defaults; naming/option variations; oversized asset by-reference per REQ-CCL-06; exactly-at-cap and one-byte-over batches per REQ-04.2/04.3; oversized/binary templateFile fails loud per REQ-FEH-02)"
    - "IR capture + report infra at the EngineClient seam, designed shared/reusable by future per-mutation changes: golden IR baselines in-repo + engine-handoff corpus + human-readable report"
  out_of_scope:
    - "Other mutation families (create/modify dialect chains, move/rename, copy, remove, copyIn-as-its-own-family) — own pending changes. Disambiguation (verify-plan-1 Judge A): 'copyIn-as-its-own-family' means a future dedicated per-family change; a standalone copyIn(...) CALL inside this change's scaffold fixture is in_scope item 1 (REQ-AEG-01)"
    - "Combinations across mutation families — capstone pending change"
    - "The engine itself / real-wire integration / PC-PROTO-01"
    - "Live registry, publish, or public-package plan items"
    - "Stryker-style src/ mutation testing — groomable separately"
```

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected | ~20-30 (reference crud-graphql-mongo has ~20 fixture files; +shared IR-capture/report infra +e2e specs +golden baselines) | L (fixture volume is low-complexity boilerplate, not L-per-file review cost) |
| Lines affected | ~1500-2000 est. (fixtures + infra + scenario matrix), much of it template/generated | L |
| Bounded contexts | 2 (test/e2e fixture-authoring surface; new shared capture/report infra module) | L |
| New patterns | 1 coherent new pattern: author-emulation fixture e2e + IR-capture/report infra (bundled) | L |
| Test types | New: golden-IR-baseline e2e, engine-handoff corpus | L |

### Overrides Triggered
- Cross-cutting concern (Other Overrides): IR-capture/report infra is explicitly "designed SHARED/reusable by future per-mutation changes" — an observability-style addition spanning future test suites → **forces minimum L**.

No sensitivity override fires: scope excludes dialect `.raw()` / ts-morph (the registry's concrete code-execution and third-party-trust rows, `project/sensitive-areas` #646) and touches no auth/payments/privacy/deployment/DB-migration surface. No new runtime dependency planned.

**Final classification**: L — cross-cutting shared-infra override, corroborated by file/line volume and a genuinely new (if singular) pattern. Not XL: bounded contexts = 2 (not 3+), and scope is already the correctly-sized first sub-change of the owner's pre-decomposed program vision (Engram #936) — re-decomposing further would split tightly-coupled infra from its first real usage.

## Recommended Path

- Phase: full Planner with Council
- Skills: sdd-explore → sdd-propose → sdd-spec → sdd-design → sdd-slice → sdd-verify(plan, ⇄ max 3)
- Slice target: 4-7 (SPIDR)

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L |
| QA Engineer | Always for L |
| Architect | Always for L |
| Tech Writer | Engine-handoff corpus is an external contract for the future engine team |

Not triggered: UX Designer (no UI surface), Security Engineer (no sensitivity override), DBA (no data layer).

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- BUILD is gated on `schematic-local-files` archiving (scaffold verb not yet in code); planning phases are NOT gated and may proceed now.
- File-count estimate is volume-heavy from fixture boilerplate — if sdd-explore finds the true footprint exceeds L, re-triage rather than silently absorb.
- IR-capture/report infra is shared-by-design: design phase must produce a contract future per-mutation changes can consume without rework.

## Halt?

No.

## Notes for Next Phase

sdd-explore: read `openspec/changes/schematic-local-files/specs/*` (REQ-CCL-06, REQ-04.2/04.3, REQ-FEH-02 cited above) and the reference schematic at `/mnt/d/Projects/Project-Builder-Repos/nestjs-schematics/src/builder-generate/crud-graphql-mongo`. Consult Engram #936 (program vision) and #646 (sensitive areas, to confirm no drift into dialect surface).
