# Proposal: TS Dialect Import/Export Ops — Group 1 (ts-dialect-backend-ops)

**Triage**: L (sensitivity override; size alone scores M under Scope V2)
**Persona lens**: none

## Intent

Schematic authors targeting backend TypeScript files have only two structured import ops today
(`addImport`/`removeImport`, named bindings only). Every other import/export gesture — default,
namespace, type-only, and side-effect imports, plus barrel re-exports and `export *` — forces the
author down to `.raw()`, which discards the idempotency, collision-safety, and branded-error
guarantees the dialect exists to provide. Backend is the primary consumer of the TS-only dialect,
and the op-pack composition architecture (ADR-0010) is already in place to receive these ops. This
change extends the exact mechanism `addImport`/`removeImport` already ship — module-specifier
addressing, name+module idempotency — with NO new abstraction, and closes a confirmed
identifier-injection gap on the `name`-position args of every op.

## Scope

### In Scope
- 7 new ops: `addDefaultImport`, `addNamespaceImport`, `addTypeImport`, `addSideEffectImport`,
  `addReExport`, `addExportAll`, `removeExport`
- Per-op idempotency identity + collision semantics (identities pinned in spec before TDD)
- Identifier validation on `name`-position args across ALL 12 ops (7 new + 5 existing) — decision (a)
- `assertNoCollision` widening to inspect default/namespace import bindings
- DAS-01.1 verb-guard + `ops-exact-set` allow-list extension 5→12
- Tests (Strict TDD) + conformance corpus + `docs/authoring-a-dialect.md` updates

### Out of Scope
- Groups 2-6 of the op-catalog ledger (type-level decls, member surgery, locators, query, composed ops)
- `export * as ns from 'm'` form — decision (d), deferred to pending (value-binding collision surface)
- `removeExport` beyond named re-exports; the missing remove counterparts — decision (c), registered as pending followups
- Any nested-node locator abstraction or value-returning op; framework-specific helpers; language-service analysis

## Capabilities

### New Capabilities
- `typescript-identifier-validation`: reject non-identifier `name` args on every TS op via branded `dialectError` (injection guard)

### Modified Capabilities
- `typescript-dialect`: 7 new import/export ops + `assertNoCollision` widening to default/namespace bindings
- `dialect-authoring-standards`: DAS-01.1 verb-guard set grows 5→12 shipped ops

## Approach

Approach 1 from exploration (owner-ratified): each op is a self-contained function over
`SourceFile.add{Import,Export}Declaration`/`get{Import,Export}Declaration`, mirroring `addImport`'s
existence-check-then-insert-or-merge shape — no shared find-or-create helper (that is Group 4
territory; premature here). Three ts-morph quirks stay locally visible per op: `setDefaultImport`
overwrites, `setNamespaceImport` throws on named coexistence, and type-only has two grammars —
decision (b) pins `addTypeImport` to ALWAYS emit a separate `import type { X } from 'm'` statement.
`addExportAll` is module-only (decision d). Identifier validation is a single shared predicate
applied at each op's boundary.

**Decisions for `sdd-design` to formalise as ADRs**: (1) default-vs-default collision — reject
(ADR-0039-consistent) vs ts-morph overwrite; (2) namespace-vs-named coexistence — new declaration
vs reject; (3) `assertNoCollision` widening and whether it retroactively tightens
`addFunction`/`addVariable`/`addClass`; (4) the identifier-validation predicate as a possible
ADR-0039 amendment. Reserve ADR numbers at design (3 concurrent post-main branches).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modified | 7 new ops, `assertNoCollision` widening, identifier validation |
| `src/dialects/typescript/index.ts` | Modified | `TypeScriptOps` type + op-pack literal 5→12 |
| `src/dialects/typescript/ast.ts` | Read-only | parse/print sufficient, no new AST |
| `src/core/{dialect-handle,define-dialect}.ts` | Read-only | coalescing/composition machinery unchanged |
| `docs/authoring-a-dialect.md` | Modified | document 7 ops + merge/collision/validation rules |
| `test/dialects/typescript/dialect.test.ts` | Modified | `ops-exact-set` allow-list 5→12 |
| `test/docs/security-authoring-guard.test.ts` | Modified | DAS-01.1 verb loop 5→12 |
| `test/dialects/typescript/*import-variants*` (new) | Created | idempotency + collision + injection tests, golden fixtures |
| `test/conformance/*` | Modified | op-pack corpus widened |
| `openspec/sensitive-areas.md` | Modified | enumerate new op names in the op-pack row |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Identifier-injection on `name` args (confirmed vs ts-morph@28) | High | Validation covers all 12 ops; per-op injection tests; security-engineer review |
| `assertNoCollision` ignores default/namespace bindings (verified gap) | Medium | Design decides widening scope + retroactive effect; ADR |
| `setNamespaceImport` throws on named coexistence | Medium | Explicit new-decl-vs-reject strategy in spec, not copy-paste |
| Default-vs-default silent overwrite (silent desired-state mutation) | Medium | Spec picks reject vs overwrite; ADR-0039-consistent ruling |
| `ops-exact-set`/DAS-01.1 arrays missed across 7 ops | Medium | Both are CI gates (fail loud); explicit slice checklist |
| Public API surface 5→12 semver contract | Medium | FIT-04/FIT-14 + exact-set `toEqual` allow-list |
| add/remove asymmetry (decision c) confuses authors | Low | Documented explicitly; remove counterparts registered as pending |

## Rollback Plan

Additive to an existing op-pack; consumed only locally (`bun link`, 0.x, no live publish — nothing
reaches external consumers). Rollback before merge = revert the feature commits on
`ts-dialect-backend-ops`: the 7 new ops vanish, `ops-exact-set` returns to 5 sorted keys, DAS-01.1
returns to 5 verbs, and the new golden fixtures are removed. The only non-purely-additive edits are
the `assertNoCollision` widening and the identifier-validation tightening on the 5 EXISTING ops —
reverting them restores prior (weaker) behaviour with no data loss (no migrations, no persisted
state). Validate: `ops-exact-set` asserts 5 keys, full suite + conformance green, no residual
`addDefaultImport`-family symbols in `dist/`.

## Dependencies

- `ts-morph@28.0.0` — already installed and exact-pinned; all 7 ops map to verified API surface. No new deps.

## Success Criteria

- [ ] 7 new ops chainable off `ts.find(path)`, each with idempotency + collision tests
- [ ] `ops-exact-set` allow-list = 12 sorted keys (`toEqual` green); DAS-01.1 covers all 12
- [ ] Identifier validation rejects injection payloads on `name` args across all 12 ops (branded `dialectError`), one test per op
- [ ] `addTypeImport` emits separate `import type { X } from 'm'` (decision b) — golden fixture byte-exact
- [ ] `addExportAll` covers `export * from 'm'` only (decision d); module-only idempotency
- [ ] Full suite + conformance corpus green
- [ ] Pending rows resolved at archive: (22) folded in; (16) + (23) explicitly reaffirmed as deferred

## Pending-Debt Disposition (fold-in-or-reaffirm)

- **(22) identifier validation** — FOLDED IN (decision a), covers all 12 ops.
- **(16) DAS-01.1 derive-verb-set-from-op-pack-type** — REAFFIRMED DEFERRED. The array is extended
  5→12 as mandatory maintenance this change (its 3rd hand-edit), but the derive-from-type refactor
  stays out of scope (no-new-abstraction constraint); re-registered at archive.
- **(23) `defineDialect`-direct reserved-name bypass** — REAFFIRMED DEFERRED (inherited, not newly
  triggered; belongs to a future dialect-authoring-standards REQ).
