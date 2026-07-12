# Triage: Stage 5b — Dialect breadth

**Classification**: L
**Decided at**: 2026-07-12T00:00:00Z
**Change name**: `stage-5b-dialect-breadth`

## Problem & Scope

> Schematic authors using `@pbuilder/sdk` got a deliberately THIN TypeScript dialect in
> stage-5: `.raw()` plus exactly one structured op (`addImport`). Every other real edit the
> problem space names — export a function, remove an import, add a class/variable, prune
> unused imports — forces authors down `.raw()`, surrendering the type-safety, chaining, and
> coalescing guarantees the dialect exists to provide. The dialect-authoring recipe (second
> audience: dialect authors) is FOUNDED on one dialect and stays half-proven: the steward
> reckoning at stage-5 archive stated verbatim "if 5b never lands, the recipe stays
> half-proven". `withOps` collision diagnostic and the conformance-kit tail were deferred with
> it. Why now: `stage-5b-dialect-breadth` is the COMMITTED-NEXT obligation ratified at stage-5
> archive (owner-affirmed CQ-4, reckoning flag #2), and 9 tagged followups in pending-changes
> explicitly say "do alongside 5b" — context is freshest now, immediately after stage-5 merged
> (PR #16).

```yaml
scope:  # AMENDED by owner scope ruling 2026-07-12 (post-council; see section below)
  in_scope:
    - "Op breadth for the TypeScript dialect: removeImport, addFunction/addVariable/addClass ± export (the set stage-5's spec declared out of scope, openspec/specs/typescript-dialect/spec.md Purpose section). addVariable/addClass carry the PRE-AUTHORISED cut lever: if design/apply trends toward the parent's XL estimate they are cut FIRST, no further owner consultation needed."
    - "withOps collision diagnostic (deferred at stage-5). RESOLVED TOPOLOGY (owner ruling #2, post-explore): ONE expanded shipped pack; the collision proof uses a deliberately-colliding FIXTURE pack in the test suite (shipped packs are disjoint-by-convention per ADR-0010 and can never collide). Design must reconcile the ADR-0012 amendment constraint (no toy-dialect fixture in CONFORMANCE code — the test-suite fixture is outside the kit)."
    - "Conformance-kit tail (ADR-0012 deferral, openspec/decisions/0012-conformance-kit.md)"
    - "[stage-5b] followup rows (openspec/pending-changes.md): 136 (modify(content)-after-AST-op last-write-wins — MANDATORY design decision: reject or document), 137 (runOp async containment), 138 (DAS-01.1 negative-guard broadening docs), 139 (TSD-04.1 own-property/stack sweep vs real ts-morph error tracking), 140 (mid-chain print-failure containment + fixture), 141 KEPT HALF (batch-grouping annotation-or-assert + Session.isPending() only), 145 (memoized-getter closure-ref clear), 146 (deepEqual extraction to kit-internal shared module)"
  out_of_scope:
    - "README front-door dialect entry (Stage 6.3 row)"
    - "Provenance go-live checklist (Stage 6.2 row)"
    - "A SECOND real dialect"
    - "Engine-side changes (cross-repo)"
    - "Row 144 (BOM/encoding hoist to core handle seam) — CUT by owner ruling: premature one-user abstraction; its own trigger ('when the second dialect lands') contradicts this change's out-of-scope. Re-tag to the second-dialect milestone; do NOT delete the ledger row."
    - "Row 141 SPLIT HALF: FIT-01 extensionless-relative-import blind spot (fitness lineage) + AuthoringError{origin} promotion (closed-union public MAJOR per ADR-0020, Stage-2 error-taxonomy lineage) — re-tag to their lineage homes; pull back in ONLY if design proves one blocks a new op."
    - "pruneUnusedImports — DEFERRED by owner ruling #2 (post-explore, 2026-07-12): without the language service (frozen out by REQ-TSD-02.3 / ast.ts no-LS commitment), unused-detection has false-positive modes that DELETE live author code (side-effect, type-only, re-export, JSX imports) — unanimous council finding. Modest convenience value does not justify the SDK's first silently-destructive op. Register as pending change with this rationale; revisit if/when a language-service-sanctioned design exists. removeImport (explicit target, no inference) STAYS in scope."
```

## Owner Scope Ruling (2026-07-12, post-council)

The blind triage council (architect + pm, independent) CONVERGED on two carve-outs; the owner
RATIFIED them ("Aceptar carve-outs"):

1. **Row 144 cut** — BOM/encoding hoist re-tagged to the second-dialect milestone (one-user
   abstraction today; its own gating trigger is out of this change's scope).
2. **Row 141 split** — FIT-01 + AuthoringError{origin} re-tagged to fitness / Stage-2
   error-taxonomy lineage; batch-grouping annotation-or-assert + `Session.isPending()` stay in.

Conditions of entry (carried into explore/design prompts): `prune-unused-imports` gated on
resolving REQ-TSD-02's no-language-service freeze; collision diagnostic gated on a real
≥2-pack topology or honest re-deferral. Deferral lever if the change balloons (PM, design-time,
NOT exercised now): `addVariable`/`addClass` first — the named pain closes with
`addFunction`±export + the import pack. XL tripwires armed: 6+ ADRs at design, or apply-time
size trending toward the parent's XL estimate → halt + re-triage.

### Owner Ruling #2 (2026-07-12, post-explore — four product questions resolved)

1. **pruneUnusedImports: DEFERRED honestly** (unanimous council risk finding — syntactic-only detection can silently delete live code). Import pack keeps `removeImport` only.
2. **addVariable/addClass: IN, cut-lever armed** — they prove op-authoring generality at low marginal cost (dialect-local); cut FIRST without re-asking if the change trends XL.
3. **Row 136 modify-after-AST-op: direction = REJECT (pinned message)** — fail-loud coherence; a security-motivated edit must not be silently resurrected. Design writes the formal ADR (owner ratifies at spec/design signing); QA's characterisation test pinning today's LWW lands FIRST as the red baseline. *(Error CLASS corrected by Owner Ruling #3: `dialectError`, NOT `AuthoringError` — the original wording was an orchestrator drafting error that contradicted this same ruling's row-141 deferral.)*
4. **Pack topology: ONE expanded shipped pack + deliberately-colliding fixture pack in the test suite** for the collision proof (architect position over explore-skill's two-shipped-packs — shipped packs are disjoint-by-convention and can never collide; no real imports-only consumer named).

### Owner Ruling #3 (2026-07-12, post-propose — four policy pins for spec)

1. **Row-136 reject error class: `dialectError`** (plain Error, frozen `dialect operation failed:` prefix — the seam's containment vocabulary). NOT the public `AuthoringError`: adding a reason value is a closed-union MAJOR (ADR-0020) and was deferred OUT by the row-141 split. Corrects the drafting error in Ruling #2 item 3.
2. **Reckoning bar RATIFIED (PM)**: discharge of the committed-next = named pain typed (`addFunction`±export) AND generality proven (collision diagnostic + conformance tail). S-D/S-F class work is NON-cuttable; the cut lever may touch ONLY addVariable/addClass (and debt riders 139/141-half/145/146 before those). The steward reckoning judges against this bar.
3. **`removeImport` of an absent import: idempotent no-op** (zero directives emitted) — mirrors `addImport` idempotency (REQ-TSD-03.10), declarative desired-state mental model.
4. **Add-op on an existing same-name declaration: REJECT** (pinned `dialectError` message), applies cross-kind (existing `const foo` + `addFunction("foo")` = same collision). The asymmetry with `addImport`'s merge/idempotent semantics MUST be a DECLARED, justified spec decision (imports merge naturally; duplicate top-level declarations produce invalid TS and are almost always author error).

### Owner Ruling #4 (2026-07-12, post-spec-V1 — two spec pins ratified)

1. **The four new op signatures are RATIFIED as pinned in spec V1** (REQ-TSD-01 V5): `removeImport(name, from)` · `addFunction(name, source, {export?})` · `addVariable(name, initializer, {export?, kind?: "const"|"let"|"var"})` · `addClass(name, source, {export?})`. Source-as-string expresses full bodies (no empty-stub risk — BA P1 resolved).
2. **Add-op collision namespace: VALUE-namespace + import bindings.** Collides: existing `function`/`const`/`let`/`var`/`class` declarations AND import bindings. Does NOT collide: `type`/`interface` (legal TS coexistence — rejecting would be an author-surprising false positive). Syntactic kind-distinction, no language service needed.

## Description Received

> Committed-next follow-up to `stage-5-first-dialect` (archived 2026-07-12): widen the
> deliberately thin TS dialect op-pack, resolve the deferred `withOps` collision diagnostic and
> conformance-kit tail, and settle the modify-after-`.raw()` last-write-wins design question
> both judgment-day judges flagged.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | ~10-14: `src/dialects/typescript/ops.ts` (5+ new ops: removeImport, pruneUnusedImports, addFunction/Variable/Class ± export), `src/dialects/typescript/ast.ts`, `src/core/dialect-handle.ts` (BOM/encoding hoist + collision diagnostic seam), `src/conformance/index.ts` (tail: adversarial samples, leaf rule, real-base-dialect rule), `src/testing/contract-fake.ts` + new kit-internal shared module (`deepEqual` dedup), plus matching test files | **L** |
| Lines affected (estimated) | ~600-1200: 5+ op implementations with tests, collision diagnostic + tests, conformance kit tail assertions, refactors (batch-grouping, memoized-getter closure fix, `AuthoringError{origin}` promotion) | **L** |
| Bounded contexts | 1 (the established TypeScript-dialect + conformance-kit system from stage-5) — this change EXTENDS existing modules/patterns via the SEAMS stage-5 already proved, it does not open new bounded contexts (unlike stage-5's own pre-ruling XL analysis, which was building the system from scratch) | **S/M** |
| New patterns | Variant of existing (op-authoring pattern reused for 5 new ops, same shape as `addImport`); one genuine design decision (modify-after-`.raw()` last-write-wins policy) is a POLICY choice, not a new structural pattern | **M** |
| Test types | Existing types (op fixtures, conformance harness, golden-IR) extended, no new test infrastructure required | **S/M** |

### Overrides Triggered

- **Sensitivity override — security (code execution)**: `openspec/sensitive-areas.md` names `src/core/dialect-handle.ts` ("the coalescing/containment seam every dialect shares") as a live medium-confidence row; this change touches that seam directly (BOM/encoding hoist + collision diagnostic). Forces minimum L.
- **Sensitivity override — security (third-party trust)**: same registry names `ts-morph` paths as live medium-confidence; the new structured ops execute against the same live AST realm. Forces minimum L.
- **public-api (contract)**: `package.json#exports` / `@pbuilder/sdk/typescript` subpath (frozen, REQ-TSD-01) gains 5+ new exported ops — each is a semver contract addition. Registry rates this `medium`, review-required for breaking-adjacent changes.

**Final classification**: **L** — sensitivity overrides (code execution, third-party trust) force the floor to L regardless of the size criteria, which independently land S/M/L; this matches the pre-forecast already recorded in the stage-5 archive triage (`stage-5-typescript-dialect` persona table: "expect L, sensitivity override live → full council + Security Engineer + Tech Writer"). Not XL: unlike stage-5's own from-scratch build, this change extends ONE already-established bounded context (the TS dialect + conformance kit stage-5 already proved) rather than opening new ones.

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` → `sdd-verify --mode=plan` → `/build` (`sdd-apply` ⇄ `sdd-verify` in-loop) → `sdd-verify --mode=final` → `sdd-archive`
- Slice target: 4-7

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L |
| QA Engineer | Always for L |
| Architect | Always for L |
| Security Engineer | Sensitivity overrides live: `.raw()`/AST code-execution seam + third-party (ts-morph) trust boundary, both touched directly by this change |
| Tech Writer | New public API surface: 5+ ops added to the frozen `@pbuilder/sdk/typescript` exported subpath |

UX Designer and DBA not triggered — no UI surface, no data/schema layer touched.

## Spec Reference

`spec_source: internal` — no reference captured.

## Risks Flagged at Triage

- Design MUST resolve the modify-after-`.raw()` last-write-wins question explicitly (reject or document) — both judgment-day judges at stage-5 converged on this independently; treat as a mandatory design input, not an optional nice-to-have.
- `withOps` collision diagnostic and the conformance-kit tail were deferred specifically because stage-5 could not prove them against a single op-pack / thin surface (ADR-0012 forbids proving conformance against stubs) — this change is what finally makes that proof possible; design should verify no other proof gaps were silently inherited from the thin scope.
- Two sensitive-area rows this change touches are still `confidence: medium`, not yet promoted — Security Engineer participation is non-negotiable across explore/design/verify-final per the registry's own reminder.
- The `deepEqual` dedup row (pending-changes.md line 146) has package-surface baseline implications (`src/conformance/index.ts` + `src/testing/contract-fake.ts` are both shipped/published) — architecture baseline may need a refresh after this lands.

## Halt?

No

## Notes for Next Phase

- `sdd-explore` should read `openspec/specs/typescript-dialect/spec.md` (frozen REQ-TSD-01 subpath + `addImport` signature) and `openspec/decisions/0012-conformance-kit.md` before proposing — do not re-derive the frozen contract.
- Read the stage-5 archive's `outcome-verdict.md` and `north-star.md` (`openspec/changes/archive/2026-07-12-stage-5-first-dialect/`) for the exact CQ-4 / reckoning-flag-#2 wording this change is discharging.
- The `[stage-5b]`-tagged rows in `openspec/pending-changes.md` are the exploration checklist AS AMENDED by the owner scope ruling above: rows 136-140, 141 (kept half only), 145, 146 in; row 144 and 141's FIT-01/AuthoringError half OUT (re-tag, don't delete).
