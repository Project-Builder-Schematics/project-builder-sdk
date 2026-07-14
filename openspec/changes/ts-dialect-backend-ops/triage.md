# Triage: TS Dialect Backend Ops (Tier 1 mutation + import + query ops)

**Classification**: L
**Decided at**: 2026-07-14T00:00:00Z
**Change name**: `ts-dialect-backend-ops`

## Problem & Scope

> Schematic authors targeting backend TypeScript projects have only 5 structured ops in the TypeScript dialect (addImport, addFunction, addVariable, addClass, removeImport — all top-level inserts). The dominant backend codegen gesture is SURGERY inside existing structures (registering elements in config arrays/object literals, adding type-level declarations, re-exporting through barrels) plus READ/CONFIRM queries (verify a file has an import/element before or after editing). Today all of that forces authors down to the `.raw()` escape hatch, losing idempotency guarantees, collision safety, and the branded error contract. Why now: backend is the primary consumer of the TS-only dialect (frontend rarely uses vanilla TS files), and the op-pack composition architecture (ADR-0010) is already in place to receive new atomic ops.

```yaml
scope:
  in_scope:
    - "Tier 1 mutation ops: addArrayElement, addObjectProperty, addInterface, addTypeAlias, addEnum, addReExport"
    - "Import variants: addTypeImport, addDefaultImport, addNamespaceImport"
    - "Query/confirm ops (read-only predicates): hasImport, hasDeclaration (minimum; exact set refined in spec)"
    - "Internal Layer-0 primitives shared across ops: node locators + namespace-aware collision predicates (value-namespace vs type-namespace)"
    - "Idempotency semantics per registration op (identity criterion defined before implementation)"
    - "Tests per Strict TDD + conformance suite updates"
  out_of_scope:
    - "Tier 2 (class surgery: addClassProperty, addClassMethod, addConstructorParam, addDecorator, addImplements) — registered as pending change"
    - "Tier 3 (addInterfaceProperty, addEnumMember, addUnionMember, addStatementToFunction, removeDeclaration) — registered as pending change"
    - "Layer-2 composed ops (registerInArray, addInjectedDependency, addEndpoint) — future change after atomic layer stabilizes"
    - "Any framework-specific (Nest/Express/TypeORM) helpers"
    - "Language-service / scope-aware analysis (dialect stays syntactic, per REQ-TSD-02.3 no-LS commitment)"
```

## Scope V2 — owner re-cut (2026-07-14, supersedes the yaml above)

Council pushback (architect + PM, independent convergence: "XL disguised as L" — 3 mechanisms,
~6 implied ADRs, 11 signatures frozen at once) was accepted by the owner. The full op catalog
was re-cut into complexity-ordered groups (ledger: `openspec/pending-changes.md`, section
"dialect op-catalog ledger"); THIS change narrows to **Group 1 — import/export variants**, the
simplest group: it extends the exact mechanism `addImport`/`removeImport` already shipped
(module-specifier addressing, name+module idempotency identity, ratified merge precedent) and
introduces NO new abstraction.

```yaml
scope_v2:
  in_scope:
    - "addDefaultImport(name, from) — import X from 'm'"
    - "addNamespaceImport(name, from) — import * as X from 'm'"
    - "addTypeImport(name, from) — import type { X } from 'm' (merge posture vs existing value imports decided in spec)"
    - "addSideEffectImport(from) — import 'm'"
    - "addReExport(name, from) — export { X } from './x' (barrel gesture)"
    - "addExportAll(from) — export * from './x'"
    - "removeExport(name, from) — mirror of removeImport for re-export clauses"
    - "Idempotency semantics per op (identity: name+module or module-only, defined in spec before implementation)"
    - "Collision semantics: default-vs-default conflict, namespace-vs-named coexistence — decided in spec"
    - "Tests per Strict TDD + conformance suite + ops-exact-set allow-list update"
  out_of_scope:
    - "Groups 2-6 of the op-catalog ledger (type-level declarations, member surgery, nested locator surgery, query ops, composed ops) — each registered as its own pending change"
    - "The nested-node locator abstraction (Group 4 territory)"
    - "Any value-returning op (Group 5 territory — frozen-kit return-channel ADR required first)"
    - "Framework-specific helpers (explicit non-goal, never in the dialect)"
    - "Language-service / scope-aware analysis (dialect stays syntactic, REQ-TSD-02.3)"
```

**Classification under V2**: size criteria alone now score **M** (one mechanism family, ~7 ops,
no new internal layer), but the **sensitivity override stands** — `src/dialects/typescript/**`
is `security (code execution): high` and this change still widens the shipped op-pack —
so the floor remains **L**: full Council, walking skeleton, mandatory security-engineer.
Slice target revised to 3-5. Tech-writer stays (7 new public ops, semver contract).

## Description Received

> Add 11 new TypeScript dialect ops (6 Tier-1 mutation ops, 3 import variants, 2 query/confirm ops) plus the shared Layer-0 primitives (node locators, namespace-aware collision predicates) and per-op idempotency semantics they depend on, replacing `.raw()` as the only way to do in-place surgery on backend TS files.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | Touches all 3 existing dialect files (`ops.ts` 165 lines / `ast.ts` 101 / `index.ts` 63), adds ≥1 new Layer-0 primitives module, updates `test/dialects/typescript/ops-exact-set.test.ts` (allow-list), adds tests for 11 new ops (TDD), updates conformance suite, likely touches `docs/authoring-a-dialect.md` (op-pack is documented there). Estimate 10-15 files. | L |
| Lines affected (estimated) | Current op-pack is ~33 lines/op avg for 5 simple insert ops; 11 new ops (several requiring locator + collision logic, not just insertion) plus a new shared primitives layer plus idempotency-focused tests (TDD ⇒ tests often 2-3x source) — estimate 800-1500 lines | L |
| Bounded contexts | 1 (TypeScript dialect) — but see sensitivity override below | S/M on its own |
| New patterns | New: a shared internal Layer-0 primitive layer (node locators + namespace-aware collision predicates) that no current op-set has — not a variant of an existing pattern, a new internal architecture layer within the dialect | L |
| Test types | Existing type (`bun test`) but new *shape* of assertion: idempotency-identity tests per op, plus read-only query/predicate tests — variant of existing | M |

### Overrides Triggered
- **Sensitivity override — security (code execution)**: `openspec/sensitive-areas.md` names `src/dialects/typescript/**` at **high confidence** explicitly for this reason: "the op-pack itself now includes a destructive op... and a fail-loud reject path... a security-motivated edit depends on landing correctly." This change directly widens that same op-pack. Forces **L minimum** regardless of size, per the registry's own reminder.
- **Public API surface**: every new op is a `package.json#exports` semver-contract addition (11 new public ops) — not a security override, but review-required per the `public-api (contract)` row (medium confidence).

**Final classification**: **L** — sensitivity override (security/code-execution on `src/dialects/typescript/**`) forces the floor to L, independently corroborated by size/pattern-novelty criteria (new shared primitive layer, 10-15 files, 800-1500 lines).

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` (deep) → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 4-7 slices) → ready for `/build`
- Slice target: 4-7 — likely grouped by op family (mutation ops / import variants / query ops / shared primitives) rather than 1 slice per op

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L — also owns registering Tier 2/3/Layer-2 deferrals as pending changes at close |
| QA Engineer | Always for L — idempotency-identity test design, collision-predicate edge cases, exact-set allow-list maintenance |
| Architect | Always for L — Layer-0 primitives design (node locators, namespace-aware collision predicates), dependency direction vs `ast.ts`/`ops.ts`, ADR candidacy |
| Security Engineer | CONDITIONAL — triggered: sensitive area hit (`security (code execution)`, high confidence, direct path match) |
| Tech Writer | CONDITIONAL — triggered: public API surface expansion (11 new public ops, semver contract, naming/doc clarity for `docs/authoring-a-dialect.md`) |

## Spec Reference

`spec_source: internal` — no reference captured.

## Risks Flagged at Triage

- Security-sensitive path (`src/dialects/typescript/**`, op-pack widening) explicitly named in the project's sensitive-areas registry — security-engineer review is not optional here.
- New shared Layer-0 primitive layer (node locators + namespace-aware collision predicates) must not erode the syntactic-only / no-language-service commitment (REQ-TSD-02.3, explicitly called out as out-of-scope) — architect must guard this boundary in design.
- Idempotency identity criterion is listed in-scope as "defined before implementation" — must land in spec/design before `sdd-apply`, not be improvised mid-slice (Strict TDD is active).
- `test/dialects/typescript/ops-exact-set.test.ts` is an allow-list gate — every new op must be added there or CI fails; easy to miss across 11 new ops.
- Tier 2, Tier 3, and Layer-2 composed ops are explicitly deferred — must be registered in `openspec/pending-changes.md` at archive, not silently dropped.

## Halt?

No

## Notes for Next Phase

`sdd-explore` should read `src/dialects/typescript/{ops.ts,ast.ts,index.ts}`, `test/dialects/typescript/ops-exact-set.test.ts`, `docs/authoring-a-dialect.md`, and ADR-0010 (op-pack composition) before proposing. Namespace-aware collision predicates (value vs type namespace) are the trickiest new primitive — flag TS declaration-merging edge cases (e.g. a name existing as both a type and a value) for QA/Architect attention.
