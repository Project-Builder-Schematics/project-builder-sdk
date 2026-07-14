# Exploration: TS dialect import/export op-pack widening — Group 1 (ts-dialect-backend-ops)

**Triage**: L (sensitivity override; size alone scores M per Scope V2 re-cut)
**Persona lens**: none

## Cross-Change Lessons Consulted

Engram `mem_search` (queries: collision/merge/ts-morph import namespace) returned **zero hits**
— per the `schematic-local-files` lesson ("Worktree engram-namespace gap during planning"), this
worktree's engram namespace doesn't see prior-change observations; `openspec/lessons-learned.md`
is the durable record and was read directly (592 lines, all entries). Relevant:

- `stage-5b-dialect-breadth`: "Trailing positional args after variable-arity author-facing args
  are structurally fragile" — checked, does NOT apply: all 7 new ops are fixed-arity
  `(name, from)`/`(from)`/`(name, from)`, no trailing-optional-after-variadic shape.
- `stage-5-first-dialect` / `stage-2-error-attribution`: "Cross-branch ADR/FIT collision: reserve
  ranges at plan time" — `architecture.md`'s Notes show 3 concurrent post-main changes; if design
  drafts a new ADR here, reserve its number explicitly.
- `stage-5b-dialect-breadth`: "Blind council + judgment-day discovered real defects in-loop
  missed" (collision-namespace gaps specifically) — directly on-topic; §Risks below surfaces a
  live collision-namespace gap by the same mechanism.
- `foundations-skeleton`/`stage-4b`: adversarial/blind review is load-bearing for this exact class
  of bug (collision-namespace, merge semantics) — informs the QA/security personas' framing, not
  actionable here.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Backend-TS import/export surgery via `ts.find(path)` chain | `test/e2e/dialect-modify.e2e.test.ts` (exercises `addImport`/`.raw()` only) | Modify — extend with default/namespace/type/side-effect import + re-export/export-all/removeExport chains |

No flow is newly *created*; the existing "open a TS file, chain ops, one coalesced `modify`"
flow gains 7 more chainable verbs. Today an author needing `import Foo from "m"`,
`import * as ns from "m"`, `import type {X} from "m"`, `import "m"`, or any `export`/barrel
gesture must drop to `.raw()`, losing idempotency + collision safety (the problem statement).

## Current State

`ops.ts` ships 5 ops today: `addImport`/`removeImport` (named-binding imports only) +
`addFunction`/`addVariable`/`addClass` (shared `assertNoCollision`). `addImport` merges into an
existing same-module named-import clause or inserts fresh; `removeImport` deletes a named
specifier, or the whole statement on the last binding (guarding default/namespace coexistence).
`index.ts` composes these via `defineOpPack`/`withOps`; `ops-exact-set.test.ts` allow-lists the
sorted key set (currently 5, `toEqual` not `toContain` — anti-smuggle).

**ts-morph@28.0.0 API surface, verified against the installed `.d.ts`** (not guessed):
- `SourceFile.addImportDeclaration(structure)` / `addExportDeclaration(structure)` both accept
  `{ moduleSpecifier, defaultImport?, namespaceImport?, namedImports?, isTypeOnly? }` /
  `{ moduleSpecifier?, namespaceExport?, namedExports?, isTypeOnly? }` respectively — mirror-shaped,
  strong precedent for reusing `addImport`'s exact mechanism on the export side.
- `ImportDeclaration.setDefaultImport(text)` **overwrites** any existing default import (renames
  it) — no merge-safe default setter exists. A `SourceFile` may hold multiple import declarations
  from the same module (already proven by `removeImport`'s own multi-declaration tests).
- `ImportDeclaration.setNamespaceImport(text)` **throws `InvalidOperationError` if a named import
  already exists on that declaration** (ts-morph's own doc comment) — confirms namespace and
  named imports are grammar-mutually-exclusive on one declaration. `addImport`'s "merge into
  existing same-module decl" strategy cannot be reused verbatim for namespace imports.
- `ImportSpecifier`/`ExportSpecifier` each carry their OWN `isTypeOnly()`/`setIsTypeOnly()`
  (inline `import { type X }`), distinct from the whole-declaration `isTypeOnly` on
  `ImportDeclaration`/`ExportDeclaration`/`ImportClause`/`ExportDeclaration` (`import type {X}`).
  Two structurally different ways to express "this binding is type-only" exist.
- `export * from './x'` = an `ExportDeclaration` with no `namespaceExport` and no `namedExports`;
  `export * as ns from './x'` sets `namespaceExport`. Same mutual-exclusivity shape as imports.
- `assertNoCollision` (ops.ts, private) checks function/variable/class/enum/module declarations
  **and named-import bindings only** — it does **not** inspect `getDefaultImport()` /
  `getNamespaceImport()` identifiers. Verified by reading the function body directly (ops.ts:54-75).

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/dialects/typescript/ops.ts` | extend | 7 new op functions; possibly widen `assertNoCollision` | aligns |
| `src/dialects/typescript/index.ts` | extend | `TypeScriptOps` type + `defineOpPack` literal grow 5→12 keys | aligns |
| `src/dialects/typescript/ast.ts` | read-only | parse/print pair unaffected; no new AST needs | aligns |
| `src/core/dialect-handle.ts` / `define-dialect.ts` | read-only | coalescing/collision/composition machinery already sufficient | aligns |
| `docs/authoring-a-dialect.md` | extend | document 7 ops, merge posture, collision rules | aligns |
| `test/dialects/typescript/ops-exact-set.test.ts` | extend | allow-list 5→12, sorted | aligns |
| `test/docs/security-authoring-guard.test.ts` (REQ-DAS-01.1) | extend | hardcoded verb-name loop needs 7 more entries — **3rd consecutive change to hand-edit this array** (pending-changes row (16) resurfaces) | aligns |

No `deviates` rows: Scope V2's whole framing ("extends the exact mechanism already shipped,
introduces NO new abstraction") holds against the baseline — confirmed by direct code reading,
not assumed from the triage's own claim.

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modify | 7 new ops + possible `assertNoCollision` widening |
| `src/dialects/typescript/index.ts` | Modify | `TypeScriptOps` type, op-pack literal, JSDoc |
| `docs/authoring-a-dialect.md` | Modify | document new ops + merge/collision semantics |
| `test/dialects/typescript/ops-exact-set.test.ts` | Modify | allow-list 5→12 |
| `test/docs/security-authoring-guard.test.ts` | Modify | REQ-DAS-01.1 loop 5→12 names |
| `test/dialects/typescript/ops-import-variants.test.ts` (new) | Created | idempotency + collision tests per op |
| `test/dialects/typescript/golden/*.txt` (new set) | Created | before/after byte-exact fixtures per op |
| `test/conformance/typescript-conformance.test.ts` | Modify | op-pack fixture likely widened for new ops |
| `openspec/sensitive-areas.md` | Modify | `security (code execution)` row's op-pack list already anticipates widening — update enumerated op names |
| `openspec/decisions/0039-fail-loud-rejection-incoherent-operations.md` | Read-only / possible amendment | collision-namespace ruling may need an amendment if default/namespace-import collision is adopted |
| `src/dialects/typescript/ast.ts` | Read-only | confirmed no changes needed (parse/print sufficient) |
| `src/core/dialect-handle.ts`, `define-dialect.ts` | Read-only | confirmed coalescing/composition machinery needs no changes |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (code execution), high | `src/dialects/typescript/**` | Yes — sensitivity override already forced L; confirmed accurate, no escalation needed |

## Approaches

### 1. Mirror `addImport`/`removeImport`'s exact per-op mechanism (recommended)
**Description**: Each of the 7 ops is a self-contained function using `SourceFile.addImportDeclaration`/`addExportDeclaration`/`getImportDeclaration`/`getExportDeclaration`, following the same existing-check-then-insert-or-merge shape `addImport` already uses — no new internal abstraction layer.
**Pros**: Matches the dominant pattern (today's 5 ops are each self-contained, only `assertNoCollision` is shared); smallest, most auditable diff; is exactly what Scope V2's "no new abstraction" framing calls for; keeps each op's ts-morph quirk (default-overwrite, namespace-exclusivity) locally visible instead of hidden behind a generic helper.
**Cons**: Some duplication across ops (existence-check-before-insert appears independently ~5 times); `assertNoCollision` still needs widening as a genuinely shared piece regardless of which approach is chosen.
**Effort**: Medium. **Pattern fit**: matches `src/dialects/typescript/ops.ts` directly.

### 2. Shared internal find-or-create-declaration helper across all import/export ops
**Description**: One parametrized internal helper (`findOrCreateImportDecl`/`findOrCreateExportDecl`) that every op calls, DRYing the existence-check-then-insert step.
**Pros**: Removes duplication; one place to encode ts-morph's default-overwrite/namespace-exclusivity quirks.
**Cons**: Is itself a small internal abstraction layer the owner's re-cut explicitly moved OUT of this change's scope (Group 4 owns "the PUBLIC locator/addressing abstraction... the hardest-to-reverse API decision"); premature generalization risk before Groups 2-4 land with genuinely different addressing needs (YAGNI); re-opens exactly the "new internal layer" concern Council flagged when re-cutting the original XL.
**Effort**: Medium-High. **Pattern fit**: new pattern, not present in `ops.ts` today.

## Recommendation

**Approach 1.** The owner's own re-cut rationale ("extends the exact mechanism... introduces NO
new abstraction") is a design constraint, not just framing — Approach 2's DRY benefit is real but
premature: it would commit to a shared helper shape one change before Group 4 (the change that
actually needs to reason hard about addressing/locators) exists to inform it. `assertNoCollision`'s
necessary widening (see Risks) is not a counter-example — it is EXTENDING an existing shared
predicate the pattern already established (ADR-0039), not introducing a new one.

## Risks

- **Collision-predicate gap (verified, not theoretical)**: `assertNoCollision` today ignores
  default/namespace import bindings — `addFunction("x", ...)` after a hypothetical
  `addDefaultImport("x", "m")` would NOT collide today, yet `x` already occupies the value
  namespace. Design must decide whether `assertNoCollision` widens to check
  `getDefaultImport()`/`getNamespaceImport()`, and whether that widening also retroactively
  benefits `addFunction`/`addVariable`/`addClass`.
- **`setNamespaceImport` throws on named-import coexistence**: naively adapting `addImport`'s
  "merge into existing same-module decl" strategy for `addNamespaceImport` will runtime-throw an
  uncontained `InvalidOperationError` when that declaration already carries named imports — needs
  an explicit strategy (new declaration vs. reject), not a copy-paste of `addImport`'s logic.
- **Pending-debt fold-in-or-reaffirm** (pending-changes.md's own rule, "must fold in or re-affirm
  deferral, never orphan"): items (16) DAS-01.1 hardcoded verb-list (this is its 3rd hit), (22)
  TS-identifier injection hardening on `name` params (applies identically to the new ops' `name`
  args), (23) `defineDialect`-direct bypass of reserved-name checks (inherited, not newly
  triggered) — propose/design must explicitly decide on each, not silently skip.
- **ADR numbering collision**: 3 concurrent post-main changes already claimed ADR ranges per
  `architecture.md`'s branch-scope note; if design drafts an ADR-0039 amendment, reserve the
  number at plan time.
- Public API surface grows 5→12 ops — every new export is a semver contract (FIT-04/FIT-14); no
  new subpath, so lower risk than a new dialect, but still review-required per the
  `public-api (contract)` sensitive row.

## Open Questions

- type: technical
  question: "Default-vs-default collision: when `addDefaultImport(name, from)` targets a module
  that already has a default import under a DIFFERENT name, reject (ADR-0039-style
  `dialectError`) or overwrite (ts-morph's native `setDefaultImport` behavior)? Same name → no-op
  is uncontroversial; different name is the open case."
  why_it_matters: "ts-morph provides no merge-safe default setter; picking overwrite silently
  changes an existing binding's name, which is exactly the kind of silent-desired-state mutation
  ADR-0039 rejected for `.modify()`-after-pending-op."

- type: technical
  question: "Namespace-vs-named coexistence: when the target module's existing declaration
  already has named imports, `addNamespaceImport` cannot call `setNamespaceImport` on it
  (ts-morph throws). Open a NEW separate declaration for the namespace binding, or reject as an
  authoring conflict?"
  why_it_matters: "Determines whether `addNamespaceImport` can ever safely mirror `addImport`'s
  merge strategy, or needs a structurally different insert path from day one."

- type: technical
  question: "`addTypeImport` merge posture: merge into an EXISTING value-import declaration via
  per-specifier `ImportSpecifier.setIsTypeOnly(true)` (`import { type X }`) vs. always emit a
  separate whole-declaration `import type { X } from 'm'`?"
  why_it_matters: "Changes the op's idempotency identity and its interaction with `addImport`'s
  own declaration-merging — both are valid TS, ts-morph supports both mechanically."

- type: technical
  question: "Should `assertNoCollision` widen to check `getDefaultImport()`/`getNamespaceImport()`
  identifiers, and if so, does that widening retroactively change `addFunction`/`addVariable`/
  `addClass`'s existing (currently narrower) collision behavior?"
  why_it_matters: "A verified real gap (see Current State) — leaving it unresolved ships
  `addDefaultImport`/`addNamespaceImport` with a weaker guarantee than their sibling ops, an
  inconsistency ADR-0039's own posture argues against."

- type: technical
  question: "`removeExport`'s whole-statement-deletion guard: does it need the same
  default/namespace-coexistence check `removeImport` carries, given `ExportDeclaration`'s
  `namespaceExport`/`namedExports` are mutually exclusive (simpler than import's 3-way
  default+namespace+named mix, since exports have no 'default export' binding to protect)?"
  why_it_matters: "Getting this wrong risks the exact whole-statement-corruption class
  `removeImport`'s own guard was built to prevent."

- type: technical
  question: "Confirm the idempotency-identity table before implementation (per Scope V2's own
  requirement): `addDefaultImport`/`addNamespaceImport`/`addTypeImport`/`addReExport` =
  name+module; `addSideEffectImport`/`addExportAll` = module-only; `removeExport` mirrors
  `removeImport`'s name+module removal target."
  why_it_matters: "Strict TDD means these identities must be pinned in spec BEFORE tests are
  written, not discovered mid-apply."

- type: technical
  question: "Pending-changes items (16)/(22)/(23): fold into this change's scope or explicitly
  re-affirm deferral in the archive ledger?"
  why_it_matters: "pending-changes.md's own blast-radius linkage note requires an explicit
  decision per group, not silent orphaning — item (16) in particular is now hit a 3rd time by
  this exact change."

## Ready for Proposal

**Status**: yes
**Reason**: Scope V2 is well-bounded and precedent-strong (`addImport`/`removeImport` already
ship the exact mechanism being extended); every one of the 7 ops maps onto a concrete,
verified-real ts-morph API surface (`addImportDeclaration`/`addExportDeclaration` structures);
no sensitive-area escalation or architectural deviation was found. The open questions are exactly
the class the triage's own Scope V2 text already deferred to spec ("decided in spec") — they are
inputs to `sdd-propose`/`sdd-spec`, not blockers to proposing.
**Recommended action**: Proceed to `sdd-propose`.
