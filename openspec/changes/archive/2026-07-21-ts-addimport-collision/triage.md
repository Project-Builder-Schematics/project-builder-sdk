# Triage: TS Dialect addImport Collision Fix

**Classification**: L
**Decided at**: 2026-07-17T21:00:00Z
**Change name**: `ts-addimport-collision`

## Problem & Scope

> Who hurts — any schematic author using the SHIPPED TS dialect's `addImport` on files with type-only/default/namespace/aliased imports or same-named local declarations. What pain — silently broken emitted code: type-only merge → runtime ReferenceError; cross-module/value-namespace collision → SyntaxError at consumer parse; aliased import → silent no-op. Why now — the CLAIMED model was just built and proven for the React dialect (spec V8, judgment-day APPROVED, archived 2026-07-17); the fix is cheapest while fresh, and `src/dialects/typescript/**` is registered security-sensitive (code execution: high).

```yaml
scope:
  in_scope:
    - "row 459: addImport merge-defect family — type-only merge, same-name across import shapes (default/namespace/aliased), cross-module + value-namespace collisions — ADOPTING the proven CLAIMED model from React spec V8 (REQ-RXD-05), not re-deriving"
    - "row 342: type-contamination bug (same defect family)"
    - "row 343: replace the determinism-only 'idempotency' test with a true seed-with-own-output shape"
    - "row 460: trust-boundary JSDoc backfill on touched functions"
    - "unfreeze + amend REQ-TSD-01 (informally mandates current naive behaviour); new algorithm states its posture on the shipped addImport(first-match)/removeImport(all-matches) asymmetry"
  out_of_scope:
    - "resuming ts-dialect-backend-ops Group 1 (row 339) — stays paused, standalone change confirmed by owner"
    - "TS dialect ops beyond addImport (and the removeImport posture statement)"
    - "the semver/consumer-impact call on silent-merge→loud-reject — owner decision at spec time"
  pending_explore_recommendation:
    - "row 340: CONFIRMED raw-splice injection via addImport `name` (security axis, distinct from correctness). Explore evaluates fold-in vs separate change; owner decides at propose/spec. NOT settled scope."
```

## Description Received

> Fix the TypeScript dialect's `addImport` (`src/dialects/typescript/ops.ts:22-32`) so it stops emitting invalid bindings, by adopting the proven CLAIMED model already shipped for the React dialect (`assertNoCollision` at `ops.ts:54-75` exists in the same file but addImport doesn't use it). Includes a type-contamination fix, an idempotency-test backfill, JSDoc trust-boundary notes, and unfreezing REQ-TSD-01.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | `src/dialects/typescript/ops.ts` (rewrite + JSDoc), `test/dialects/typescript/ops-declarations.test.ts` (addImport cases + row 343 rewrite), `openspec/specs/typescript-dialect/spec.md` (REQ-TSD-01 amendment), possibly 1 shared predicate module if explore's hoist-to-core question resolves that way. Estimate 3-5 files. | M |
| Lines affected (estimated) | Algorithm port + adaptation (not new derivation) ~50-100 lines source, plus near-miss-mutant/hostile-battery test scenarios (Strict TDD, tests typically 2-3x source per this project's own precedent) — estimate 250-450 lines | M/L |
| Bounded contexts | 1 (TypeScript dialect) — but see sensitivity override | S |
| New patterns | Proven pattern PORTED from React dialect (`boundNamesIn`/`satisfiesIdempotency`/`isValueNamespaceClaimed`), not derived — variant of existing, adapted to TS's addImport(first-match) shape | M |
| Test types | Existing type (`bun test`), but binding test discipline carried over: near-miss mutants required when probes substitute for RED, hostile battery must discriminate which validator is wired | M |

### Overrides Triggered
- **Sensitivity override — security (code execution), high confidence**: `project/sensitive-areas` (#1998) names `src/dialects/typescript/**` explicitly at high confidence ("`.raw` runs arbitrary author code against a live AST; op-pack has a destructive op + fail-loud reject path"). Forces **L minimum** regardless of size.
- **Public API surface**: `addImport`/`removeImport` sit under the `/typescript` `package.json#exports` key — behaviour change (silent-merge → loud-reject) is a semver-relevant contract change (review-required, `public-api (contract)` row, medium confidence).

**Final classification**: **L** — sensitivity override forces the floor; size criteria alone would plausibly score M, but the binding constraint from the orchestrator (per project's own registry) and the public-API behaviour change both corroborate L is the right amount of rigor, not just the mandatory minimum.

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` (deep — includes the row 340 fold-in/separate recommendation) → `sdd-propose` → `sdd-spec` (unfreeze REQ-TSD-01) → `sdd-design` → `sdd-slice` (target 4-6 slices) → ready for `/build`
- Slice target: 4-6 — plausible split: merge-defect algorithm port (row 459/342) / idempotency test backfill (row 343) / JSDoc backfill (row 460) / REQ-TSD-01 amendment + posture statement, with row 340 as a possible 5th-6th if explore folds it in

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L — also owns the row 339 (Group 1) and row 340 (if deferred) pending-changes bookkeeping |
| QA Engineer | Always for L — near-miss mutant + hostile battery test design is explicitly binding for this change |
| Architect | Always for L — the hoist-shared-predicate-to-core vs mirror-in-TS-leaf design question interacts with ARCH-2 (validatedOp/reject-tail vs JSX-grammars split) |
| Security Engineer | CONDITIONAL — triggered: sensitive-area hit (`security (code execution)`, high confidence, direct path match); also scopes the row 340 fold-in/separate recommendation |
| Tech Writer | CONDITIONAL — triggered: public API behaviour change (silent-merge→loud-reject) on a semver-contract op, plus JSDoc trust-boundary backfill (row 460) needs clarity review |

## Spec Reference

`spec_source: internal` — no reference captured.

## Risks Flagged at Triage

- Row 340 (raw-splice injection) is a CONFIRMED but NOT settled-scope item — explore must bring a fold-in-vs-separate recommendation with tradeoffs; do not let it silently expand scope without an owner decision at propose/spec.
- Behaviour change on a shipped, publicly exported op (silent-merge → loud-reject) is a semver/consumer-impact call reserved for the owner at spec time — do not resolve it unilaterally in design.
- The addImport(first-match)/removeImport(all-matches) asymmetry (judgment-day Issue 2 precedent) must get an explicit posture statement in the new algorithm, not be left implicit.
- Architect must guard the hoist-to-core vs mirror-in-leaf decision against silently deepening ARCH-2's split before it's ratified.

## Halt?

No

## Notes for Next Phase

`sdd-explore` should read `src/dialects/typescript/ops.ts` (full, including `assertNoCollision` at :54-75), `src/dialects/react/ops.ts` (`boundNamesIn`/`satisfiesIdempotency`/`isValueNamespaceClaimed`), `openspec/specs/react-dialect/spec.md` REQ-RXD-05, `test/dialects/typescript/ops-declarations.test.ts` (current row-343 idempotency test to see exactly what it fails to prove), and `openspec/specs/typescript-dialect/spec.md` REQ-TSD-01 before proposing. Lesson from react-dialect applies verbatim: adopt the proven model, don't re-derive it (`sdd/react-dialect/judgment-day-verdict`).
