# Proposal: Stage 4 — Typed Factory Options (stage-4-typed-options)

**Triage**: L · **Persona lens**: none (executor draft; council review runs after)

## Intent

`schema.json` is a schematic's INPUT CONTRACT, but today it has no teeth. `defineFactory<O>` (`src/core/context.ts:38`) takes `O` as a bare hand-supplied generic and invokes `fn(o)` with zero validation, and nothing keeps `schema.json` ↔ the factory's assumed input type ↔ CLI-prompt sufficiency in sync — three-way drift. The promised differentiator "one source, parity enforced" (objectives-plan O2) does not exist. The 2026-07-06 engine handoff moved schematic-model ownership to the SDK, so this must be pinned pre-v1: the input-typing mechanism is cheap now and semver-locked once published, and the engine is heading to real-wire integration.

## Scope

### In Scope
- 4.1 D4 ADR: `schema.json` → TS-type derivation via an npm-shipped dev-time codegen bin (mechanism + rejected alternatives).
- 4.2 Parity fitness (edit `schema.json` without regenerating → build breaks) + schema-sufficiency fitness (per-property type & label hard-fail, enum choices hard-fail; default/required/description advisory). New FIT numbers start at FIT-12.
- 4.3 Factory package shape (`factory.ts` + adjacent `schema.json`) + `pre-execute`/`post-execute` reserved-name enforcement + fail-closed run-boundary validation of resolved inputs.
- 4.4 End-to-end typed-factory example, in-repo (retires CQ-2).

### Out of Scope
- D7 / `./testing` facade + `defineFactory` reachability → separate change `stage-4b-testing-harness`. The 4.4 example must NOT depend on it.
- `add`/`remove` collection-level enforcement → L2 (reserved-by-documentation only here).
- Prompt RENDERING (Go CLI); re-typing `create<S>` template options; dialects/Stage 5; L2 composition; real wire; monorepo extraction.

## Capabilities (contract with sdd-spec)

### New Capabilities
- `typed-factory-options`: derive `defineFactory<O>` input type from `schema.json` via a shipped dev-time codegen bin.
- `schema-contract-parity`: schema↔type drift breaks the build; schema-sufficiency (type/label/enum) as fitness contract.
- `run-boundary-input-validation`: fail-closed validation of resolved inputs at `defineFactory` pre-`als.run`, input-side attribution.
- `reserved-lifecycle-names`: enforce `pre-execute`/`post-execute` at the schematic (factory-module) level only.
- `factory-package-shape`: canonical `factory.ts` + adjacent `schema.json` layout the bin and runner consume.

### Modified Capabilities
- `authoring-error-contract` (Stage 2, DEFERRED): add reason value(s) (candidates `invalid-options`, `reserved-name`) as a COORDINATED amendment applied only after Stage 2 archives or on explicit owner unfreeze — never a silent edit. sdd-spec pins candidate names; the enum edit is sequenced, not made now.

## Approach

Framing (resolves the ADR-0018 tension on paper): wire-level judgments — paths, serializability, conflicts — stay ENGINE-owned; schema-conformance of the author's OWN input contract is SDK-owned, upstream of the wire. Stage 4 lives entirely on the SDK side of that line.

Anchor correction: the mechanism types `defineFactory<O>` factory inputs, NOT `create<S>` (an unrelated, already-shipped template-interpolation plane). The objectives-plan 4.1/4.2 `create<S>` reference is stale — flag the plan amendment for archive.

D4 = codegen bin (ratified): `schema.json` stays the hand-authored source; the bin parses it as DATA only (no eval/dynamic import), writes scoped to the project, and runs by EXPLICIT author invocation — NO postinstall, ever. A regenerate-and-diff CI gate is mandatory from slice 1 (reuse the FIT-04 spawn-build-and-diff pattern; lessons-learned #648 staleness trap). Validation sits at `context.ts:51`, pre-`als.run`: nothing staged on rejection (all-or-nothing preserved trivially), no silent coercion, no-schema case is a LOUD documented opt-out, and error messages never echo raw input values. Reserved names span TWO namespaces: `pre-execute`/`post-execute` resolved from the factory MODULE structure only (never from resolved inputs or schema field names); `add`/`remove` are collection-level → deferred to L2.

Decisions for sdd-design to formalise as ADRs: (1) codegen mechanism + generator dependency choice (JSON-Schema→TS dependency vs hand-rolled subset parser — names the tradeoff, design decides); (2) reserved-name namespace semantics; (3) run-boundary error shape + input-side attribution site; (4) package-shape discovery (how the bin locates `schema.json` relative to `factory.ts`).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/core/context.ts` | Modified | run-boundary validation call site; `O` typing source per D4 |
| new schema-parity module (`src/core/`) | New | schema↔type derivation + resolved-input validator |
| new dev-time codegen `bin` | New | `schema.json` → TS type; new distribution primitive |
| `package.json` (`bin` field) | Modified | ships the bin in the tarball; new semver surface |
| `src/core/authoring-error.ts` | Read-only | frozen Stage-2 enum; reason extension deferred/coordinated |
| `test/fitness/` (FIT-12+) | New | parity + schema-sufficiency + staleness gates |
| reference schematic + e2e test | New | canonical `factory.ts`+`schema.json`, executed in-repo |
| `openspec/decisions/` (ADRs) | New | D4, reserved-name, error-shape, package-shape |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Codegen staleness (repeat of FIT-04 trap #648) | High | regenerate-and-diff CI gate from slice 1, non-negotiable |
| Cross-change enum collision (Stage 2 in build) | Medium | coordinate: extend enum only post-Stage-2-archive/unfreeze; never silent |
| `bin` = new supply-chain + public-API surface | Medium | no postinstall; parse as data only; project-scoped writes; security review |
| FIT-number collision (Stage 2 owns FIT-11) | Low | Stage 4 claims FIT-12+ |
| Mis-attribution to emit seam (`write-rejected`) | Medium | intercept at run boundary; tests assert the SITE |
| Zero type-level coverage for `defineFactory<O>` | Medium | new type-level tests are part of the capability, not incidental |

## Rollback Plan

Pre-v1, unpublished, git-tracked. Revert by: (1) `git revert` the slice commits touching `src/core/context.ts` (validation call site) and the schema-parity module — `defineFactory<O>` returns to the bare pass-through generic; (2) remove the `bin` field from `package.json` and delete the codegen executable + its generated `.ts` outputs (dev-time only, no runtime state); (3) delete the FIT-12+ fitness tests and the reference schematic/e2e example. No data migration, no external services, no consumer state — nothing published to npm during this change, so no consumer is exposed. The Stage-2 enum is untouched (extension deferred), so no cross-change rollback is needed. Validate rollback: `bun test` green on the pre-change suite (243 baseline), `package.json` has no `bin`, and no generated artifact remains.

## Dependencies

- Stage 2 (`stage-2-error-attribution`) is IN BUILD concurrently; its signed V2 `authoring-error-contract` is read-only here. The reason-enum extension is a coordinated amendment sequenced AFTER Stage 2 archives (or explicit owner unfreeze). This gates freezing the final run-boundary throw shape.
- Objectives-plan amendment (correct the stale `create<S>` anchor) — flagged for archive.

## Success Criteria

- [ ] `defineFactory<O>` input type derives from `schema.json` via the shipped bin; a demo factory type-checks against it.
- [ ] Editing `schema.json` without regenerating breaks the build (FIT-12 negative proof) AND regenerating restores green (positive proof).
- [ ] Schema-sufficiency fitness hard-fails a property missing type or label, and an enum missing choices; advisory fields do not fail.
- [ ] A resolved input violating the schema is rejected at `defineFactory` pre-`als.run`, nothing staged, message echoes no raw input value; test asserts the SITE (not the emit seam).
- [ ] A factory module declaring `pre-execute`/`post-execute` is rejected; enforcement reads module structure only.
- [ ] In-repo e2e runs a typed factory end-to-end against the fake (retires CQ-2), with no dependency on `./testing`.
- [ ] Untyped/no-schema factories still compile (opt-out is loud but non-breaking); full suite green on FIT-12+.

## Caveats from Exploration

Exploration returned `ready_for_proposal: partial` — the four blockers are now owner-ratified and encoded above:
- D4 mechanism (product) → resolved: codegen bin (§Approach, `typed-factory-options`).
- D7 exposure (product) → resolved: split out to `stage-4b-testing-harness` (Out of Scope).
- Reserved-name namespace (product) → resolved: two namespaces; `pre`/`post-execute` in, `add`/`remove` to L2 (`reserved-lifecycle-names`).
- Error taxonomy (technical) → resolved: coordinated deferred Stage-2 enum extension (Modified Capabilities + Dependencies).
