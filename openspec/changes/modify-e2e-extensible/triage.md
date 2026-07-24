# Triage: Extensible E2E Harness + Modify Operator Coverage

**Classification**: L
**Decided at**: 2026-07-22T00:00:00Z
**Change name**: `modify-e2e-extensible`

## Problem & Scope

> The SDK has one e2e test for scaffolding, built because scaffolding composes many operations and we wanted an end-to-end guarantee. That e2e only covers copy/copyIn and create. Missing operator coverage: rename, replaceContent, delete, modify. Modify is the next big one and spans two dialects — the user accepts splitting into one change per dialect if covering both here proves too heavy. Hard requirement: the e2e approach must be easily extensible — adding coverage for a future operator must be an XS/S increment, never another L.

```yaml
scope:
  in_scope:
    - "extensible e2e harness/architecture for operator coverage"
    - "e2e coverage for Modify across both dialects (explicit fallback pre-agreed with the user: split by dialect into separate changes if too heavy)"
  out_of_scope:
    - "e2e coverage for rename, replaceContent, delete (future increments on the extensible base)"
    - "changes to the operators' implementations themselves (this change only adds e2e coverage)"
```

## Description Received

> See Problem & Scope above (verbatim from orchestrator's Problem & Scope Gate).

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | New golden fixtures (seed/expected/factory) for TypeScript-dialect Modify and React-dialect Modify; new or extended e2e test file(s) alongside `test/e2e/dialect-modify.e2e.test.ts` (TS-only today, no React-dialect e2e exists) and `test/e2e/scaffold.e2e.test.ts`; a generalized/extensible harness module (or hardening of the existing `conformance/m2-*` fixture-corpus pattern + its `fit-40-conformance-corpus-integrity.test.ts` guard) so a future operator is XS/S to add; docs/ADR for the extensibility contract. Estimate 10-15 files. | L |
| Lines affected (estimated) | Two dialects' worth of golden fixtures + e2e assertions + harness generalization + fitness-guard updates — estimate 600-1300 lines | L |
| Bounded contexts | 2 (TypeScript dialect `src/dialects/typescript/**`, React dialect `src/dialects/react/**`), sharing one test-infra substrate (the `conformance/` fixture corpus + `fit-40` guard) rather than a 3rd distinct context | L |
| New patterns | The hard requirement ("adding an operator must be XS/S, never L") demands formalizing/generalizing the sync-site-enforcement pattern the two most recent changes (`m2-copy`, `m2-copyin`) just landed per-operator — a genuine extensibility-contract design, not a one-off feature | L |
| Test types | Existing types (bun test, golden-fixture diffing via the `conformance/m2-*` corpus + e2e `.test.ts`), but the extensibility contract itself is a new fitness-function concern (will very likely need new/renumbered FIT- guards) | M/L |

### Overrides Triggered

- **Sensitivity override — security (code execution), high confidence**: `project/sensitive-areas` (#1998) names `src/dialects/typescript/**` explicitly at high confidence ("`.raw` runs arbitrary author code against a live AST"). This change's in-scope work directly drives e2e/conformance coverage of the dialect `.modify()` path in that exact area. Direct precedent: `ts-addimport-collision` triage (#2305) applied this same floor to a change touching the identical path, forcing L even where size alone would have scored M. Forces **L minimum** regardless of size.

**Final classification**: **L** — corroborated by two independent signals: (1) size/pattern criteria land at L on their own (2 dialects + a genuine extensibility-contract design), and (2) the sensitivity override on `src/dialects/typescript/**` forces the floor per project precedent.

Not XL: only 2 bounded contexts are touched (TypeScript dialect, React dialect) sharing one test-infra substrate — this does not meet the "3+ bounded contexts" XL trigger. The user's own pre-agreed fallback (split into one change per dialect) is preserved as an explicit contingency, not a pre-ordained decomposition — if `sdd-slice` reveals the combined scope is too heavy, route back through `/replan` or the Program Layer at that point rather than forcing it now.

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` (deep) → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 5-7 slices) → ready for `/build`
- Slice target: 5-7 — plausible split: harness/extensibility-contract design (foundation) / TypeScript-dialect Modify e2e (first dialect, proves the harness) / React-dialect Modify e2e (second dialect — should land cheap, demonstrating the extensibility requirement) / fitness-guard wiring (`fit-40` or a new guard) / docs-ADR for the extensibility contract

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L — also owns the dialect-split fallback as a tracked contingency, and the deferred rename/replaceContent/delete operators as pending-changes debt |
| QA Engineer | Always for L — golden-fixture/e2e coverage design across two dialects is exactly this lens's remit |
| Architect | Always for L — the extensibility-contract design (what makes a future operator XS/S) is a structural decision, not a feature |
| Security Engineer | CONDITIONAL — triggered: sensitive-area hit (`security (code execution)`, high confidence, direct path match on `src/dialects/typescript/**`) |

No UX Designer (no UI surface). No DBA (no schema/data layer). Tech Writer not triggered at triage — open question for explore/design: does generalizing the harness touch the PUBLIC `/conformance` subpath export (`src/conformance/index.ts`, listed in `public-api (contract)` sensitive-areas row) or does it stay confined to the internal, non-exported `conformance/` fixture-corpus directory? If the former, design should add Tech Writer.

## Spec Reference

`spec_source: internal` — no reference captured.

## Risks Flagged at Triage

- **Naming collision to disambiguate in spec**: the wire-level `Directive.op === "modify"` (used today by `replaceContent`, see `conformance/m2-modify/factory.ts` + `src/conformance/run-vehicle.ts`) is a DIFFERENT concept from the dialect-level AST `.modify()` operator (`ts.find(...).modify(ast => ...)`, `test/e2e/dialect-modify.e2e.test.ts`) that this change's problem statement means by "Modify." Explore/spec must name these distinctly to avoid REQ-ID or fixture-ID collisions.
- **Existing fixtures may partially contradict the "missing coverage" premise**: `conformance/m2-delete/` and `conformance/m2-rename-move/` already exist on disk with seed/expected/factory files, alongside `m2-copy`/`m2-copyin` (recently landed, sync-site-enforced) and `m2-modify` (which is actually `replaceContent`, not the dialect Modify operator this change targets). Explore must determine whether delete/rename-move are genuinely wired+enforced (matching the recent `m2-copy`/`m2-copyin` "sync-site enforcement" pattern) or merely declared placeholders under the `REQ-CFX-11` "honesty boundary" — this changes both the out-of-scope framing and how much of the extensibility harness already exists vs. still needs building.
- **FIT-guard numbering collision risk**: per cross-change lesson `project/lessons-learned` #2086, concurrently-planned changes have collided on the same FIT- number before (`FIT-23`). If another change is in flight touching `fit-40-conformance-corpus-integrity.test.ts` or adjacent fitness guards, reserve numbers at slice/plan time.
- **React dialect not explicitly named in the sensitive-areas registry** (only `src/dialects/typescript/**` is listed at high confidence) — explore should flag whether `src/dialects/react/**` warrants the same registry entry given this change exercises it equivalently.

## Halt?

No

## Notes for Next Phase

`sdd-explore` should read: `test/e2e/dialect-modify.e2e.test.ts` (existing TS-dialect Modify e2e, S-002 — no React-dialect equivalent exists today), `test/e2e/scaffold.e2e.test.ts` (the "one e2e test for scaffolding" the problem statement refers to), the `conformance/m2-copy/` and `conformance/m2-copyin/` fixture pairs plus their recent "sync-site enforcement" commits (`52952a9`, `7a03b62`) as the closest existing precedent for what "extensible" should generalize, `test/fitness/fit-40-conformance-corpus-integrity.test.ts` (678 lines — the REQ-CFX-11 honesty-boundary / declared-artefact mechanism), and `src/conformance/index.ts` + `src/conformance/run-vehicle.ts` (the separate, already-exported `/conformance` dialect-op-conformance kit — distinct from the root `conformance/` fixture corpus, do not conflate the two in spec). Precedent change `author-emulation-e2e-scaffold` (`project/lessons-learned` #2090, archived 2026-07-14) built a comparable byte-deterministic corpus + fitness-guard cluster — worth comparing its extensibility choices against what "XS/S per future operator" actually demands.
