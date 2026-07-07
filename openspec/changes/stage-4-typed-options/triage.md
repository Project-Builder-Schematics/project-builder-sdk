# Triage: Stage 4 — Typed Factory Options (schema.json input contract)

**Classification**: L
**Decided at**: 2026-07-06T00:00:00Z
**Change name**: `stage-4-typed-options`

## Problem & Scope

> `schema.json` is the schematic's INPUT CONTRACT — what the end user must provide for the schematic to work. Today that contract has no teeth in the SDK: the factory receives resolved inputs as a bare hand-supplied generic (`defineFactory<O>`, src/core/context.ts:38), nothing validates the resolved inputs at the run boundary, and nothing keeps schema.json ↔ the factory's assumed input type ↔ CLI prompts in sync (three-way drift). The promised differentiator "one source, parity enforced" (objectives-plan O2) does not exist. Additionally, the engine handoff (2026-07-06) transferred schematic-model ownership to the SDK: schema validation, typed inputs, and lifecycle reserved names (`add`/`remove`/`pre-execute`/`post-execute`) are SDK-side, and reserved names have zero coverage in any stage. Why now: pre-v1 the input-typing mechanism is cheap to decide and semver-locked once published; the engine is heading to PC-TM-01/PC-PROTO-01, so the schematic model must be pinned SDK-side before real-wire integration.

```yaml
scope:
  in_scope:
    - "4.1 ★D4 decision, RE-ANCHORED: the input-typing mechanism for defineFactory<O> factory inputs (NOT create<S>). Three candidate paths: (a) hand-supplied O for v1, (b) schema.json → TS-type codegen (dev-time bin shipped by the npm package, Prisma-style), (c) TS schema as source (e.g. Zod 4) → emit schema.json as build artifact (no codegen; first runtime dependency tradeoff)."
    - "4.2 input-contract parity: one source, drift breaks the build; schema.json must be SUFFICIENT for prompt derivation (labels, descriptions, defaults, types) — parity-as-contract, owner-ratified 2026-07-06."
    - "4.3 factory package shape (factory.ts + schema.json) + lifecycle reserved names enforcement (add/remove/pre-execute/post-execute) + runtime validation of resolved inputs at the run boundary."
    - "4.4 end-to-end typed-factory example (debt CQ-2)."
    - "4.5 ★D7 decision: schematic-author testing story (public ./testing subpath vs documented pattern)."
  out_of_scope:
    - "Prompt RENDERING / prompt UX (Go CLI's job; the SDK only guarantees schema sufficiency)."
    - "Re-typing create options — PINNED: create<S> template-data options are author-defined, per-file, already shipped (typed-options-and-read); structurally independent of schema.json."
    - "Dialects/Stage 5, L2 composition (invoke/extends), real wire (PC-PROTO-01), monorepo extraction."
```

## Description Received

> Stage 4 of the objectives-plan: pin the input-typing mechanism for `defineFactory<O>`, make schema.json ↔ factory-input-type ↔ CLI-prompt-sufficiency a contract (not a convention), define the factory package shape with lifecycle reserved-name enforcement and run-boundary validation, ship an end-to-end typed-factory example, and ratify the schematic-author testing story (public `./testing` subpath vs documented pattern). Also absorbs an ownership-transfer item from the 2026-07-06 engine handoff: reserved-name enforcement (`add`/`remove`/`pre-execute`/`post-execute`) is SDK-side and currently has zero coverage.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | `src/core/context.ts` (defineFactory), possible new schema-validation module, possible new dev-time `bin`/codegen tool (if path b), `package.json#exports`, new `./testing` public subpath + implementation, reserved-name enforcement + tests, type-level tests (`test/types/`), new e2e typed-factory example + test, docs — realistically 10-15 files | L |
| Lines affected (estimated) | New validation layer + possible codegen tool + new public testing subpath + example + tests — plausibly 600-1500+ depending on D4 path | L |
| Bounded contexts | 4: (1) runtime/factory execution (`context.ts`/`defineFactory`), (2) type system / build tooling (schema→type derivation or codegen), (3) public API surface (`exports`, new `./testing` subpath), (4) cross-repo contract (Go CLI prompt-sufficiency parity) | L (borders XL but stays within one repo/package — not 3+ independently-shippable systems) |
| New patterns | Schema-driven type derivation/validation is a genuinely new pattern not present anywhere in `src/`; reserved-name lifecycle enforcement is also new | L |
| Test types | New type-level test harness (schema-derived types), new e2e example test, new reserved-name enforcement tests, possible codegen-output tests | L |

### Overrides Triggered

- **Security boundary — input validation**: problem statement explicitly names "nothing validates the resolved inputs at the run boundary" as the gap to close. The matrix's sensitivity override ("Touches security boundaries: input validation...") forces L minimum.
- **Public API stability (semver-locked)**: `project/sensitive-areas` registry (engram #646) already flags "`package.json#exports` + emitted `.d.ts` — every export a semver contract; breaking it breaks every consumer. Review-required for breaking changes." D4 and D7 are both explicitly framed by the owner as semver-sensitive, pre-v1-cheap-to-decide calls (D4: "THE semver-sensitive DX call"). New public surface is likely: a `./testing` subpath (D7) and possibly a dev-time `bin` tool (D4 path b).
- **New external dependency (conditional on D4)**: candidate path (c) — "TS schema as source (e.g. Zod 4) → emit schema.json" — is explicitly flagged by the objectives-plan as "first runtime dependency tradeoff." Not yet decided, but in scope of this change's own D4 decision, so the override applies preemptively; forces minimum M on its own, moot given L already applies.
- **Cross-repo contract**: schema-sufficiency-for-prompts is a parity contract with the Go CLI (external repo) — not UI/UX work in-scope here, but the design phase must be careful not to let SDK scope creep into prompt rendering (explicit guard rail).

## Final classification: L — sensitivity override (input validation at the run boundary) plus the already-registered public-API-stability sensitive area both independently force L; size criteria (bounded contexts, new pattern, semver-locked decision) corroborate independently.

## Recommended Path

- Phase: Full Planner with Council
- Skills to invoke (in order): `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 4-7 slices, walking skeleton mandatory) → `sdd-verify --mode=plan` → `/build` (`sdd-apply` ⇄ `sdd-verify` in-loop) → `sdd-verify --mode=final` → `sdd-archive`
- Slice target: 4-7 (walking skeleton first; D4/D7 decisions likely gate the first 1-2 slices before parallel work on 4.2-4.4 opens up)

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L |
| Architect | Always for L — layering across runtime/type-system/public-API is the core of this change |
| QA Engineer | Always for L |
| Security Engineer | Sensitivity override triggered: input validation at the run boundary + public-API/supply-chain sensitive area (registry #646) |
| Tech Writer | Public contract exposed: `schema.json` as a documented input contract, new `./testing` public subpath, cross-repo parity contract with the Go CLI — naming and contract clarity matter |

Not needed: UX Designer (prompt rendering is explicitly out of scope — Go CLI's job, no UI surface in this repo); DBA (no database/data-layer schema — `schema.json` is a JSON input-contract schema, not a persistence schema).

## Spec Reference

spec_source: internal — no reference captured (write_mode: sync, per `sdd-init/project-builder-sdk/spec-source`, engram #645).

## Risks Flagged at Triage

- D4 and D7 are both architecturally load-bearing AND semver-locked pre-v1 — the design phase should treat them as ADR-gated checkpoints before slicing proceeds, not decisions to revisit mid-slice.
- The conflict already logged in `openspec/pending-changes.md` (auto-prompt parity vs. the out-of-scope guard rail on prompt UX) is UNRESOLVED and sits squarely in this change's scope (4.2) — propose/spec phases must surface it explicitly rather than silently pick a side.
- Path (c) under D4 (Zod-as-source) would be the SDK's first runtime dependency — if chosen, this triggers the "new external dependency" override formally and should prompt a supply-chain look from the security-engineer persona already in the council.
- Reserved-name enforcement (`add`/`remove`/`pre-execute`/`post-execute`) currently has ZERO test coverage anywhere in the codebase per the engine-handoff note — explore should confirm this gap before design assumes any existing scaffolding.

## Halt?

No

## Notes for Next Phase

`sdd-explore` should: (1) confirm zero existing coverage for reserved lifecycle names; (2) read `src/core/context.ts` (defineFactory) and `src/commons/index.ts` (create<S>) in full to ground the two-plane distinction (factory inputs vs create template-data, already pinned as structurally independent); (3) surface the unresolved auto-prompt-parity conflict from `openspec/pending-changes.md` as an explicit `open_questions[type=product]` item for the orchestrator to raise with the user before propose; (4) treat D4/D7 as the two decisions that gate everything else in this change — propose should frame them as the first walking-skeleton slice's exit criteria.
