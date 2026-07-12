# Proposal: Stage 5b — Dialect breadth

**Change**: `stage-5b-dialect-breadth` · **Triage**: L · **Persona lens**: none

## Intent

Stage 5 shipped a deliberately thin TypeScript dialect: `.raw()` plus one structured op
(`addImport`). Every other edit the problem space names — export a function, remove an import,
add a class or variable — forces authors down `.raw()`, surrendering the type-safety, chaining,
and coalescing the dialect exists to provide. The stage-5 reckoning stated it verbatim: "if 5b
never lands, the recipe stays half-proven." This change is the committed-next obligation
(owner-affirmed CQ-4) that turns the founded recipe into a proven-general one and ships the
pain statement's second named example ("export a function") as a real typed op — while
resolving three deferred correctness questions the thin surface could not exercise: `withOps`
collision, `runOp` async containment, and the modify-after-AST-op last-write-wins policy.

## Scope

### In Scope
- Op breadth on `./typescript`: `removeImport`, `addFunction`/`addVariable`/`addClass` (± export).
- `withOps` collision diagnostic (runtime, fail-closed) with RED + GREEN proofs.
- Conformance-kit tail: mandatory adversarial samples, leaf rule, real-base-dialect rule.
- `runOp` async containment via one shared contained-invoke helper (row 137).
- Modify-after-AST-op policy: REJECT with a pinned message (row 136).
- Refactors: `deepEqual` extraction (146), `isPending()` (141), memoized-getter closure clear (145).

### Out of Scope
- `pruneUnusedImports` — DEFERRED (owner ruling: syntactic-only detection deletes live code).
- A second real dialect; engine-side changes; README front-door + provenance checklist (Stage 6).
- Row 144 (BOM hoist) and row 141's FIT-01/`AuthoringError{origin}` half — re-tag, do not delete.

## Capabilities

### New Capabilities
None — this change extends the one bounded context stage-5 established.

### Modified Capabilities
- `typescript-dialect`: adds `removeImport` + `addFunction`/`addVariable`/`addClass` (± export); destructive ops carry `dryRun()` preview visibility.
- `dialect-generics`: `withOps` collision throws fail-closed at composition; `runOp` async ops are contained like `.raw()`.
- `modify-coalescing`: `.modify(content)` after a pending AST op on the same path rejects (supersedes today's silent last-write-wins).
- `dialect-conformance`: kit injects the mandatory adversarial samples, the leaf rule, and the real-base-dialect rule.

## Approach

Extend the established op-authoring pattern: each new op is a pure `(ast, ...args) => void`
matching `addImport`'s call rhythm, idempotency posture, and `dialect operation failed:` error
prefix — composed into ONE expanded shipped pack. Per owner ruling #4, shipped packs are
disjoint-by-convention (ADR-0010) and cannot collide, so the collision proof uses a
deliberately-colliding FIXTURE pack in the test suite, typed over the real `SourceFile` Ast and
kept OUTSIDE the conformance kit (ADR-0012 amendment forbids reviving a toy dialect there).
`runOp` and `runRaw` route through one shared contained-invoke helper so their containment
cannot drift; awaiting inside `runOp` blocks subsequent chained ops until it settles
(author-order semantics). Design must formalise four ADRs — row-136 reject, `runOp` containment
(ADR-0037 amendment), collision runtime-throw (ADR-0010 amendment), `deepEqual` placement
(FIT-17) — and HALT if the approach would spawn a sixth. Design also promotes the
`security (code execution)` row to HIGH and fixes the stale "Review Required" paragraph.
Cut lever (pre-authorised): if apply trends XL, `addVariable`/`addClass` are cut FIRST, no re-ask.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/dialects/typescript/ops.ts` | Modified | new op implementations |
| `src/dialects/typescript/index.ts` | Modified | compose expanded shipped pack |
| `src/dialects/typescript/ast.ts` | Modified | locate/insertion helpers, deterministic positions |
| `src/core/dialect-handle.ts` | Modified | row 136 reject, 137 shared helper, 145 closure clear |
| `src/core/define-dialect.ts` | Modified | `withOps` collision diagnostic |
| `src/core/session.ts` | Modified | `isPending()` (row 141) |
| `src/conformance/index.ts` | Modified | adversarial samples, leaf + real-base rules, `deepEqual` |
| `src/testing/contract-fake.ts` | Modified | `deepEqual` extraction |
| kit-internal shared module | New | shared `deepEqual` (no public symbol, FIT-17) |
| `test/dialects/**`, `test/conformance/**`, `test/fitness/fit-01-*` | Modified/Create | op tests, colliding fixture pack, FIT-01 fix |
| `typescript.index.d.ts` (FIT-04 baseline) | Modified | new op signatures on frozen `./typescript` |
| `openspec/sensitive-areas.md` | Modified | promote code-execution row HIGH, fix stale paragraph |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Row 136 silent data loss if only documented | High | REJECT with pinned message; red characterisation baseline first |
| Row 137 async op rejection floats uncontained | Medium | One shared contained-invoke helper on both paths |
| Collision fixture typed against retired toy dialect | Medium | Fixture MUST type over real `SourceFile`, outside the kit |
| Destructive `removeImport` surprises the author | Medium | `dryRun()` preview visibility acceptance criterion (BA halt-worthy) |
| New op signature drifts from frozen `addImport` | Medium | Same call rhythm, idempotency, error prefix; per-op collision policy pinned |
| Change balloons toward XL | Medium | Cut lever (addVariable/addClass first); 6-ADR tripwire → halt + re-triage |
| `deepEqual` extraction shifts shipped surface | Low | Kit-internal, no public symbol; FIT-17 + FIT-04 baseline gate |

## Rollback Plan

Fully reversible — no persisted state (ADR-0008, no tree persistence), no data migration. Revert
this change's commits: the new ops are additive to `./typescript` exports (semver-additive, 0.x —
removing them breaks no prior consumer, they did not exist before). The row-136 reject reverts to
the pre-existing silent LWW, which the red characterisation test documents as the prior baseline.
The `deepEqual` extraction reverts cleanly (internal, no public symbol). Validate rollback: full
suite green at the parent commit AND the FIT-04 `.d.ts` baseline reverts byte-identical to
stage-5's. No unrecoverable author data (edits are in-run only).

## Dependencies

None. `ts-morph` already landed in stage-5 (ADR-0038); no new runtime dependency, no new subpath.

## Success Criteria

- [ ] `addFunction` (± export) ships as a typed op — the pain's second example no longer needs `.raw()`.
- [ ] `removeImport` ships; a destructive op's effect is visible via `dryRun()` before commit; byte-exact golden.
- [ ] `withOps` collision proven by BOTH a RED test (colliding fixture packs → fail-closed throw) AND a GREEN test (disjoint packs compose clean).
- [ ] Conformance kit injects the 6 mandatory adversarial samples (empty/comment-only/4 MiB/CRLF/BOM/duplicate-target), contributor cannot opt out; leaf + real-base-dialect rules land.
- [ ] `.modify(content)` after a pending same-path AST op throws (pinned message); red characterisation test of today's LWW lands first.
- [ ] `runOp` async op contained via one shared helper on both `runRaw`/`runOp`; a scenario pins that awaiting blocks subsequent chained ops (author-order).
- [ ] Every new/destructive-op test is byte-exact (never count-only); the no-reparse invariant holds via a parse call-count spy across multi-op chains.
- [ ] ≤6 ADRs at design; FIT-04 `.d.ts` baseline updated for the new signatures; full suite green.
