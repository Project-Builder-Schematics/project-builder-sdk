# Exploration: author-emulation e2e for the scaffold mutation family (author-emulation-e2e-scaffold)

**Triage**: L
**Persona lens**: none (synthesis pass; architect/qa/ba framing folded in)

## Cross-Change Lessons Consulted

- Pattern from `stage-3-dry-run-exposure` / `stage-5-first-dialect`: "A worktree-scoped
  refresh/state silently drops unmerged sibling surface" — directly operative here: BUILD is
  gated on `schematic-local-files` (unmerged), and this plan runs in its own worktree. Any
  artifact this exploration produces that assumes today's `src/` shape must be re-verified once
  the sibling merges, not trusted as final.
- Pattern from `stage-4b-testing-harness`: "Evaluator diversity catches what green in-loop
  verifies miss" — relevant to design: the shared IR-report infra is explicitly cross-cutting
  (future changes depend on it), so its own council/verify pass should be adversarial, not a
  rubber stamp.
- No prior change addressed IR-capture/report infra directly — this is the first.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author runs a realistic multi-file generator (templates, binary assets, typed options, naming tokens) through `scaffold`/`copyIn`/`create({templateFile})` | none — all 7 `test/e2e/*` files run 2-4 directive surgical paths against `ContractFake`, none author-emulation-shaped | Create |
| Author/future-engine-team inspects the captured IR (golden baseline + engine-handoff corpus + human report) at the `EngineClient` seam | none — no capture/report infra exists beyond ad hoc `makeSpyClient` in individual tests | Create |

## Current State

Two existing golden idioms, both content-comparison, neither IR-capture infra: (1)
`test/golden-ir/fixtures.ts` — hand-written `Directive`/`Batch` literals compared via
`toEqual` (structural, in-source); (2) `test/support/golden.ts` + `test/dialects/typescript/golden/*.txt`
— committed byte-exact files loaded from disk, used by dialect/conformance/e2e print-fidelity
checks. `test/support/spy-client.ts`'s `makeSpyClient` wraps `ContractFake`, pushing every
emitted `Batch` into an array — used ad hoc per-test today, not as shared capture
infra. `src/testing/index.ts`'s `runFactoryForTest` (the third audience) already returns
`{tree, emitted, error}` — `emitted` is the same `Batch[]` shape a capture module would want.
7 `test/e2e/*` files exist; 6 are `ContractFake`-based surgical paths, 1
(`installed-consumer.e2e.test.ts`) proves package-resolution, none realistic-author-shaped.

`schematic-local-files` spec V3 (9 domains, all signed) pins `scaffold`, `copyIn`,
`create({templateFile})` — confirmed via `rg "scaffold|copyIn" src/` returning ZERO matches:
unimplemented in this worktree. Its `design.md` already ratified the wire encoding (ADR-0043:
`copyIn` as an additive 7th `Directive` op), a new `src/scaffold/` leaf (ADR-0044),
`AuthoringReason` 8→12 (ADR-0045), and eager `packageRoot` ceiling seeding (ADR-0046) — these
are consumed, not re-decided, by this change. Its own `design.md` File Changes table already
claims `test/e2e/scaffold.e2e.test.ts` for ITS OWN basic e2e coverage (see Risks).

Reference schematic `crud-graphql-mongo`: real Angular-schematics factory, `files/` tree with
`__name@dasherize__`/`__name@singular@dasherize__` filename tokens (maps to `folder-scaffold`
REQ-FSC-05's token-translation pipeline), `dto/`/`entities/` subfolders, single/multi-project
split. Its own `schema.json` is a near-empty `{properties: {}}` — typed options are thin in
this sample; "parametric typed options" in our scope should follow the SDK's OWN Stage-4
pattern (`test/fixtures/typed-factory/` — `schema.json` + `pbuilder-codegen`-generated
`schema.generated.ts` + a typed `run()`), not copy the reference's schema literally. No
`dasherize`/`singularize`/`camelize` helper exists anywhere in `src/` — confirmed by grep — and
none is needed: per `wire.ts`'s own doc comment, `template`/`pathTemplate` are opaque strings
to the SDK, and `{= name | dasherize =}` filter syntax is engine-template-DSL territory. This
is a real evidence-boundary limit, not a DX gap (see Risks).

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `test/support/` (shared test helpers) | extend | new capture/report module beside `spy-client.ts`/`golden.ts` | aligns |
| new committed golden-baseline dir (3rd golden idiom) | new | `Batch[]`-run-level capture is a different unit than either existing idiom (single-directive fixture; single-file byte print) | deviates → needs ADR reconciling 3 idioms (council flag) |
| `src/scaffold/`, `src/core/wire.ts` `copyIn` op, `src/testing/contract-fake.ts`, `src/conformance/run-vehicle.ts` | read-only (external dependency) | landed by `schematic-local-files`, consumed once merged | aligns (no touch by this change) |
| `src/dialects/typescript/**`, `src/core/dialect-handle.ts` (sensitive, code-execution) | none | scope excludes dialect/`.raw()`/ts-morph | aligns / not touched |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `test/support/spy-client.ts` | Modify | extend or wrap for run-level capture across a full author-emulation run |
| `test/support/` (new capture + report-render module) | Create | shared IR-capture + human-readable report, designed for reuse by future mutation-family changes |
| new committed golden-baseline directory (scaffold scenarios) | Create | 3-audience report's in-repo baseline half |
| new engine-handoff corpus location | Create | provisional/v0 (no real consumer until PC-PROTO-01) — location/format is an open question |
| `test/e2e/{name}.e2e.test.ts` (name TBD — collision risk, see Risks) | Create | the author-emulation e2e itself |
| `test/fixtures/{author-emulation-crud-fixture}/` (factory + schema.json + files/ tree) | Create | the authored generator being emulated, crud-graphql-mongo-shaped |
| `.gitignore` | Modify | R1 — per-run rendered report/log must be ignored |
| `src/scaffold/*`, `src/core/wire.ts`, `src/testing/contract-fake.ts`, `src/conformance/run-vehicle.ts` | Read-only | external dependency from `schematic-local-files`, unimplemented today |
| `openspec/changes/schematic-local-files/specs/*` (9 domains) | Read-only | signed contract this e2e's scenario matrix must cite by REQ-ID |

## Sensitive Areas Crosscheck

No sensitive areas touched — scope excludes `src/dialects/typescript/**`/`.raw()`/ts-morph
(the concrete code-execution/third-party-trust rows) and no auth/payments/privacy/deployment
surface. Confirms triage's no-override finding.

## Approaches

### 1. Reuse `makeSpyClient` + extend `test/support/`, add a justified third golden idiom
**Description**: Wrap or extend `spy-client.ts` for full-run capture (it already collects every
emitted `Batch`); add a new `test/support/` module that renders the captured array into (a) a
committed golden baseline per scenario, (b) a provisional engine-handoff corpus, (c) a
gitignored human-readable report. Document why this is a third idiom, not a duplicate of the
other two (different unit: whole-run `Batch[]`, not one directive or one file's bytes).
**Pros**: reuses the proven capture seam; matches the existing convention that shared helpers
live in `test/support/`; minimal new machinery.
**Cons**: three golden idioms in one repo needs an explicit reconciling note/ADR or it reads as
drift.
**Effort**: Medium.
**Pattern fit**: hybrid — reuses `spy-client.ts`, adds a justified new corpus format.

### 2. Unify all golden idioms into one generalized capture harness (rejected)
**Description**: Retrofit `test/golden-ir/` and `test/dialects/typescript/golden/` onto the new
capture module so the whole repo has one mechanism.
**Pros**: eliminates idiom fragmentation.
**Cons**: touches already-shipped, already-archived stages' tests for a change scoped ONLY to
the scaffold family — direct scope creep against this change's own `out_of_scope` bullets and
against triage's L (not XL) sizing.
**Effort**: High.
**Pattern fit**: new pattern, but wrong altitude for this change.

## Recommendation

Approach 1. It reuses the proven `makeSpyClient` seam, matches the "shared helper → `test/support/`"
convention, and keeps scope inside the scaffold family as triage requires. The three-idiom
concern is real but addressable with a short reconciling note in design (per council flag #2) —
not a reason to retrofit unrelated stages' tests.

## Risks

- **Filename collision**: `schematic-local-files/design.md` already claims
  `test/e2e/scaffold.e2e.test.ts` for its own basic coverage. This change's e2e file needs a
  distinct name (e.g. `author-emulation-scaffold.e2e.test.ts`) decided at design time, or a
  merge will silently clobber one file's content with the other's.
- **Rendering evidence boundary**: `ContractFake`/`runFactoryForTest` never render
  `{{}}`/`{= =}` templates — this e2e can only assert emitted directive/pathTemplate SHAPE
  (e.g. the literal string `{= name | dasherize =}`), never the dasherize/singularize-rendered
  output the reference schematic exhibits. Must be stated as an explicit evidence boundary in
  spec, mirroring `by-reference-copy-wire` REQ-BRC-04.
- **Corpus authority unresolved**: whether the engine-handoff corpus is committed (like the
  golden baselines) or ephemeral is not yet decided (see Open Questions) — carries directly
  into design's file-layout decision.
- **Build gate**: `scaffold`/`copyIn` are confirmed absent from `src/` — this exploration and
  propose/spec/design may proceed, but slices touching real scenarios are gated on
  `schematic-local-files` merging.
- **Pre-existing, unrelated suite failures**: `bun test` in this worktree shows 4 pre-existing
  failures (`pbuilder-codegen` CLI hostile-schema/malformed-schema tests, FIT-14 package-surface
  baseline) — all `dist/`-build-dependent, unrelated to this change's topic; noted so it isn't
  misattributed to this exploration.

## Open Questions

- type: technical
  question: "Where do the new golden-baseline directory and the e2e test file live, and what
  name avoids the `test/e2e/scaffold.e2e.test.ts` collision with `schematic-local-files`'s own
  design.md-claimed path?"
  why_it_matters: "Directory/file layout is a contract future per-mutation-family changes will
  copy; an unresolved collision silently overwrites content at merge time."
- type: technical
  question: "Is the engine-handoff corpus one committed file, one-per-scenario, or JSON-lines —
  and is it the SAME artifact as the committed golden IR baseline (viewed two ways) or a
  separate file?"
  why_it_matters: "Propose/spec will pin file shape as a REQ; getting this wrong forces slice
  rework once design corrects it."
- type: product
  question: "Owner requirements (obs #937) settle that the per-run RENDERED REPORT is
  gitignored and 'golden baselines stay in-repo' — but obs #936 lists 'engine-handoff corpus'
  as a THIRD, separate bullet from golden baselines. Is the corpus itself committed (durable
  engine contract) or regenerated/gitignored per run?"
  why_it_matters: "If unresolved, propose/spec may accidentally commit an unbounded-growing
  corpus, or gitignore the artifact meant to be the durable engine-facing contract."

## Ready for Proposal

**Status**: partial
**Halt routing**: n/a (not a hard blocker)
**Reason**: The codebase investigation is complete and grounded (existing infra read, signed
specs read, reference schematic read, absence of scaffold/copyIn in `src/` confirmed). One
product-level ambiguity (corpus committed vs ephemeral) and two technical ambiguities (file
naming collision, corpus file shape) are real enough that proceeding to propose without
resolving the product question risks re-work if propose assumes the wrong answer.
**Recommended action**: Orchestrator surfaces the product open question to the user before
`sdd-propose`; the two technical open questions carry forward into `sdd-spec`/`sdd-design`.
Re-triage check: file/context footprint is unchanged from triage's estimate (~20-30 files,
still bounded 2 contexts) — NOT XL-shaped, L holds.
