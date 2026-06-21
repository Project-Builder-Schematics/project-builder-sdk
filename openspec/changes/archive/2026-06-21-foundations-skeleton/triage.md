# Triage: foundations-skeleton

**Classification**: L
**Decided at**: 2026-06-21
**Change name**: `foundations-skeleton`

## Problem & Scope

> The SDK architecture is fully decided (12 ADRs, `openspec/decisions/0001-0012`) but there is ZERO
> executable code. Without a publishable walking skeleton that proves the emit→read-your-own-write
> conversation end-to-end against the contract-fake engine AND locks the fitness functions in CI,
> every subsequent layer (L1 verbs, dialects, op-packs) has no spine and no guardrails. Hurting: the
> builders + future contributors. Why now: first executable step; the standalone spike was dropped
> (ADR-0007) in favor of validating the conversation here.

```yaml
scope:
  in_scope:
    - publishable @pbuilder/sdk package (Bun, type:module, exports map, first publish 0.0.0-dev)
    - public-repo standards (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue/PR templates, CI on forks/PRs)
    - walking skeleton (minimal factory → create directive lowered → contract-fake → read-your-own-write assertion)
    - contract-fake engine (EngineClient impl) + fake-engine test harness
    - golden-IR assertions on DirectiveFactory
    - fitness functions (commons→no AST, dialects leaves, only-bytes-cross-seam, .d.ts semver gate, @example, subpath budget, no-tree-persistence, two-surface/kit-boundary)
    - clean kit boundary (internal module, extraction-ready per ADR-0009)
    - conformance-kit scaffold (testDialect/testOpPack stubs + meta-tests; full impl deferred)
    - the two ADRs (verb->IR lowering table; single-package + subpath shape)
    - stub docs/authoring-a-dialect.md
  out_of_scope:
    - full L1 verb implementation (L1 change)
    - any real dialect / AST library / op-pack (T-M2)
    - real-engine integration (gated on engine §6)
    - publishing @pbuilder/sdk-kit as a separate package (extract later — ADR-0009)
    - read-staged (gated on engine §6)
    - full conformance-kit implementation
```

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected | package.json/tsconfig/exports + core (client/session/factory/handle/wire/context/fake) + commons stub + factory + tests (golden-IR/fitness/e2e) + CI + 4 repo-standard docs + dialect doc → ~15+ | L |
| Lines affected | thin skeleton, not full impl; ~800–1500 | L |
| Bounded contexts | 1–2 (the package + CI/publish surface) | L |
| New patterns | multiple foundational patterns (EngineClient port, Session/buffer, DirectiveFactory, ambient context, fitness functions, contract fake) — co-dependent, introduced together | L→XL |
| Test types | new types certain (golden-IR, fitness, type-level, contract-fake harness) | L |

### Overrides Triggered
- **Sensitivity (deployment/publish)**: npm `0.0.0-dev` publish + CI secrets/OIDC provenance → forces L minimum.
- **Sensitivity (supply-chain)**: PUBLIC package → security-engineer mandatory.
- **Public API**: exports map + dialect contract are public contracts → tech-writer mandatory.

**Final classification**: **L** — sensitivity (publish/supply-chain) forces L; size confirms it. NOT XL: one coherent package + an intentionally THIN walking skeleton; decomposing it would destroy the end-to-end-skeleton value. The multiple new patterns are handled by SPIDR slices WITHIN the change.

## Recommended Path

- Phase: **full Planner with Council**
- Skills (in order): `sdd-explore` (LIGHT — heavy groundwork already in the 12 ADRs + 2 council passes) → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target **5–7** slices, mandatory walking skeleton) → `sdd-verify --mode=plan`
- Slice target: 5–7

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L |
| Architect | Always for L |
| QA Engineer | Always for L; Strict TDD + contract-fake + fitness functions |
| Security Engineer | Sensitivity: publish/deployment + supply-chain |
| Tech Writer | Public API: exports map + dialect contract names freeze pre-publish |
| UX Designer | The authoring surface IS the product UX (two-audience DX) |

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- Publish provenance/OIDC must ship WITH this change (the first `0.0.0-dev` publish creates the credential) — security-engineer halt-worthy if done on PR/fork or without `--provenance`.
- Walking skeleton must assert REAL read-your-own-write content equality, not "did not throw" (QA halt-worthy).
- Contract-fake must faithfully mirror engine `design.md §4` (flush/coalescing) or every green is circular.
- Public names freeze at first publish (roadmap §8) — `commons` verbs + kit/dialect-contract names must be settled.

## Halt?

No.

## Notes for Next Phase

`sdd-explore` should be LIGHT: the architecture is decided across ADRs 0001-0012 + two council passes (architect/security/qa/tech-writer/ux). Explore consumes those as current-state, focuses on the EXECUTABLE gap (what files/scaffolding/tooling foundations-skeleton needs), not re-deriving the design. Engine contract to emit against: engine ADR-0028. Validate the kit/dialect-contract shape against ts-morph + postcss on paper (roadmap §7) before any name freeze.
