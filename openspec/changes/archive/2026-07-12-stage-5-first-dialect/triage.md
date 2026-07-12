# Triage: Stage 5 — First dialect: `modify` becomes real

**Classification**: L — owner-ruled (executor recommended XL; see Owner Ruling below)
**Decided at**: 2026-07-11T00:00:00Z
**Change name**: `stage-5-first-dialect`

## Problem & Scope

> Who is hurting: schematic authors. What pain: `modify` is a stub today — there is no way to
> mutate an existing source file. Authors who need to add an import or export a function must
> eject to raw text manipulation, losing type-safety, chaining, and IR fidelity. There is also no
> predictable recipe for adding future AST libraries. Why now: Stages 1–4 (fidelity, error
> attribution, dry-run, typed options) are all merged — Stage 5 is the O1+O2 convergence proof and
> the only remaining blocker before release shape (Stage 6).

```yaml
scope:
  in_scope:
    - "FIT-01 transitive import-graph pre-gate (5.0)"
    - "D5 ratification: ts-morph + dependency posture (5.1)"
    - "real defineDialect/defineOpPack/withOps with a universal .raw() escape hatch op (5.2)"
    - "op-name collision diagnostic (5.3)"
    - "modify coalescing: N AST edits -> one modify directive, chainable with move/copy (5.4)"
    - "the TypeScript dialect + starter op-pack: add/remove import, prune unused imports, add function/variable/class with or without export (5.5)"
    - "conformance kit bodies testDialect/testOpPack (5.6)"
    - "dialect authoring docs + SECURITY guard (5.7)"
  out_of_scope:
    - "a second dialect"
    - "L2+ reserved-name ops"
    - "release packaging / exports map (Stage 6)"
    - "stage-4b-testing-harness"
    - "the real engine wire"
```

## Description Received

> Implement Stage 5 of the ratified objectives plan — "First dialect: `modify` becomes real"
> (`openspec/objectives-plan.md` Stage 5, items 5.0-5.7). Owner has de-facto ratified part of
> D5: first dialect = TypeScript via ts-morph (dependency posture — dependency vs
> peerDependency — still open inside D5). Owner design input: modify's read path must go
> through `Session.read` (flush-before-read + read-your-own-writes staging per ADR-0015), never
> a direct client read; the coalescing <-> flush-seed-rule interaction (Stage 3 design §4.6b)
> must be treated explicitly in design.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | ~18-22: `src/core/define-dialect.ts` rewrite + collision-diagnostic helper + `Session`/`EngineClient` modify-read + coalescing touch points + FIT-01 test extension + new TS dialect subpath (parse/print pair, handle, 6+ starter ops, index) + `src/conformance/index.ts` real implementation + golden-IR fixtures + `docs/authoring-a-dialect.md` + SECURITY guard test + `package.json` new dependency | **XL** |
| Lines affected (estimated) | ~1800-2500+: AST parse/print pair, 6 starter ops with tests, coalescing logic touching the flush path, conformance kit body implementing 7 named guarantees (byte-exact round-trip, fidelity, coalescing-to-one, seam serializability, leaf rule, adversarial samples, real-base-dialect rule), fixtures, docs | **XL** |
| Bounded contexts | 5: (1) core generics `define-dialect.ts`/`withOps`, (2) `Session`/`EngineClient` flush+coalescing, (3) new TypeScript dialect package (own subpath), (4) conformance kit, (5) docs + SECURITY guard | **XL** |
| New patterns | Multiple new: dialect/op-pack generic composition (ADR-0010), AST-ready-to-use coalescing (ADR-0006), first external runtime dependency (ts-morph), conformance-kit-as-test-generator (ADR-0012) | **XL** |
| Test types | New types certain: golden-IR fixture tests, dialect-specific conformance harness, type-level generic proofs, adversarial fixture samples | **XL** |

### Overrides Triggered

- **New external dependency** (ts-morph, first one in the repo) → forces minimum M (subsumed below).
- **Sensitivity override — security (code execution)**: `openspec/sensitive-areas.md` names "the L2 `.raw(ast => …)` escape hatch" as an anticipated confidence-low row; items 5.2/5.5 in this change are exactly what lands it. Forces minimum L.
- **Sensitivity override — security (third-party trust)**: same registry names "dialect packages" as an anticipated row; D5 (5.1) and the starter op-pack (5.5) are exactly what activates it. Forces minimum L.
- **Spans 3+ bounded contexts** → forces **XL**, mandatory decomposition (Step 5 of `sdd-triage`).

**Final classification**: **XL** — files (~20), lines (~2000+), bounded contexts (5), and new-pattern count all independently land in the XL band; two anticipated sensitive-area rows (code execution, third-party trust) go live in this exact change; this is also the plan document's own "largest/riskiest" stage (first external dependency, real generics, coalescing) — no single criterion is borderline, all point the same direction.

## Halt — XL Decomposition Required

Do NOT proceed to slice-level planning for this change as one unit. Suggested decomposition
into 3 dependency-ordered sub-changes (mirrors the plan's own 5.0→5.7 dependency chain and gives
clean SEAMS):

- **`stage-5a-dialect-generics`** (est. M) — 5.0 (FIT-01 transitive pre-gate), 5.1 (D5 ADR:
  ts-morph + dependency posture), 5.2 (real `defineDialect`/`defineOpPack`/`withOps` incl. the
  `.raw()` op), 5.3 (op-name collision diagnostic). Walking skeleton: proves the generic
  contract without requiring the full dialect to exist yet. SEAM exposed: the
  `DialectDefinition`/`OpPack` generic surface that 5b implements against.
- **`stage-5b-typescript-dialect`** (est. L) — 5.4 (modify coalescing — needs a real AST to
  prove one-`modify`-per-chain) + 5.5 (the TypeScript dialect + starter op-pack: add/remove
  import, prune unused imports, add function/variable/class with/without export). Consumes the
  5a generic contract; introduces the actual ts-morph dependency and the `Session.read`
  flush-before-read integration (ADR-0015) the owner flagged. Largest, riskiest sub-change —
  carries both sensitivity overrides live.
  - Cross-check reminder for 5b's design phase: the coalescing <-> flush-seed-rule interaction
    (Stage 3 design §4.6b) must be resolved explicitly — do not re-derive from memory.
- **`stage-5c-conformance-and-docs`** (est. M) — 5.6 (conformance kit bodies, run against the
  real dialect from 5b) + 5.7 (dialect authoring docs + SECURITY guard). Depends on 5b existing
  and stable.

Re-invoke `/plan` separately for each sub-change name above — OR accept the **Program Layer**:
the orchestrator can offer `sdd-program`, turning `stage-5-first-dialect` into an initiative with
these three sub-changes, declared SEAMS, and an integration gate after each.

## Owner Ruling (2026-07-11) — L single change, disciplined scope

The XL halt was surfaced to the owner alongside the dissenting council perspectives (architect
and PM, both blind, both L-conditional). Owner ruled: **L, one change, thin scope** — the
program decomposition is rejected because its seams are not honest (ADR-0012 forbids proving
conformance against stubs; coalescing is unprovable without a real AST; the generics are
consumed by everything downstream in one typecheck). Precedent: the stage-4 / stage-4b
committed-next split. The XL line-count estimate assumed full op-pack and conformance breadth;
that breadth is exactly what this ruling defers.

**Rescoped contract (supersedes the yaml block above):**

```yaml
scope:
  in_scope:
    - "FIT-01 transitive import-graph pre-gate (5.0) — walking-skeleton slice S-000, MUST land before ts-morph enters the repo"
    - "D5 ADR: TypeScript via ts-morph + dependency posture (5.1)"
    - "real defineDialect/defineOpPack/withOps with the universal .raw() escape hatch op (5.2)"
    - "modify coalescing: N AST edits -> one modify directive, chainable with move/copy, Session.read flush-before-read integration (5.4)"
    - "the TypeScript dialect at its own subpath + THIN starter op-pack: .raw() plus 1-2 load-bearing structured ops, starting with import-add; design may argue one more (5.5, thinned)"
    - "conformance kit core subset: byte-exact round-trip, single-op fidelity + unchanged-elsewhere, coalescing-to-one-modify, seam-serializability (only serializable bytes cross — a planted .raw() op smuggling a closure/AST must fail loudly), planted-violation-fails incl. a serializability violation instance (5.6, core; seam-serializability added post-ruling on security-engineer explore finding: it carries the .raw() code-execution invariant and must not sit in the deferred tail)"
    - "minimal ACCURATE dialect authoring doc + SECURITY guard REQ-STD-01 (5.7, thinned)"
  out_of_scope:
    - "a second dialect"
    - "L2+ reserved-name ops"
    - "release packaging / exports map (Stage 6)"
    - "stage-4b-testing-harness"
    - "the real engine wire"
    - "FOLLOWUP CHANGE (register as committed-next at slice/archive): op-pack breadth (import remove / prune-unused, add function/variable/class with/without export), withOps collision diagnostic (5.3 — single pack has no cross-pack collision to prove), conformance kit tail (adversarial samples, leaf rule, real-base-dialect rule), exhaustive authoring doc (overlaps Stage 6.3)"
```

Sensitivity overrides remain LIVE (`.raw()` code execution; third-party dialect trust): full
arch + purpose hooks, security-engineer persona mandatory in explore/design/verify-final,
adversarial review at evaluate. The XL analysis above is retained for the record; if apply-time
reality contradicts the thin-scope premise (line count ballooning toward the executor's
estimate), halt and re-triage rather than shoehorn.

## Recommended Personas

For `sdd-program` (XL initiative planning):

| Role | Reason |
|---|---|
| Architect | Always for XL/program |
| PM | Always for XL/program |
| Business Analyst | User-facing impact — schematic authors are the direct consumers; this stage is explicitly the plan's "DX proof" |

For each sub-change's own L/M pipeline once decomposed (informational, not binding — each
sub-change re-triages independently):

- `stage-5a-dialect-generics`: expect M → Architect + Business Analyst light council.
- `stage-5b-typescript-dialect`: expect L, sensitivity override live → full council
  (Business Analyst, PM, QA Engineer, Architect) **+ Security Engineer** (both sensitive-area
  rows fire here) **+ Tech Writer** (new public subpath = public API contract).
- `stage-5c-conformance-and-docs`: expect M, sensitivity override still live (docs cover the
  `.raw()` hatch and third-party dialect trust) → Architect + Business Analyst + **Security
  Engineer** conditional.

## Spec Reference

`spec_source: internal` — no reference captured.

## Risks Flagged at Triage

- Two anticipated sensitive-area rows (`security (code execution)`: `.raw()` hatch;
  `security (third-party trust)`: dialect packages) go live in this exact change — currently
  `confidence: low` in `openspec/sensitive-areas.md`; recommend promoting both to
  `medium`/`high` with concrete paths once `stage-5b` lands, per that file's own reminder.
  Security Engineer participation is mandatory downstream regardless of sub-change sizing.
- First external runtime dependency in the repo (ts-morph) — supply-chain surface, no vetting
  process exists yet; D5's "dependency posture" sub-decision (dependency vs peerDependency) has
  real consumer-facing implications (bundle size, version-lock conflicts with the SDK's own
  ts-morph version) and should not be rubber-stamped.
- Owner-specified design constraint (modify's read MUST go through `Session.read`, never a
  direct client read; ADR-0015 flush-before-read) is a correctness invariant, not a suggestion —
  design phase for `stage-5b` must show this explicitly, not assume it.
- `objectives-plan.md`'s Decision Points table still lists D4 as "open" even though
  `stage-4-typed-options` triage/design ratified it — the plan document has not been
  reconciled post-Stage-4 (PR #11 already merged per git log). Not a blocker for Stage 5 triage,
  but flag for the next `objectives-plan.md` reconciliation pass (Stage 6.4 scope).

## Notes for Next Phase

- Do not attempt to slice `stage-5-first-dialect` as a single unit — `sdd-apply` will not have a
  coherent design/slices contract for a change this size.
- ADRs 0003, 0004, 0006, 0010, 0012, 0014, 0015 already exist in `openspec/decisions/` and are
  directly relevant — `sdd-explore`/`sdd-design` for each sub-change should read them, not
  re-derive.
- Repo currently has zero runtime dependencies (`package.json` `dependencies` block does not
  exist yet, only `devDependencies`) — `stage-5a` or `stage-5b`'s design must decide whether to
  introduce a `dependencies` block for the first time or scope ts-morph as a peerDependency (this
  is exactly D5's open dependency-posture question).
