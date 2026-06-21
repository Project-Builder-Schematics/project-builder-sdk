# Proposal: L1 Author Surface — Walking Skeleton

**Change**: `l1-author-surface-skeleton` · **Triage**: M · **Parent**: `l1-author-surface` (#1 of 4)
**Persona lens**: business-analyst + pm (scope discipline)

## Intent

Today no single thread connects a typed `create` to an attributed author error. `create`'s `options` is bare `JsonValue` (`commons/index.ts:20-24`), `defineFactory` documents a *partial-write* contract — "if `fn` throws after buffering, those directives are STILL emitted... no rollback" (`context.ts:33-37`) — and the fake throws raw `ContractFake:` strings with no author vocabulary. The program needs a working integrated spine before #2/#3/#4 grow the value and failure halves into it. This skeleton threads all 6 seams thinly so every later sub-change extends a working whole, and — critically — exercises the two seams where `foundations-skeleton`'s masked CRITICALs lived (commit/discard, error-attribution) with a **real forced rejection** from day one, never a mock.

## Scope

### In Scope
- One typed `create<S>` with a SINGLE schema-derived option (type-level stub proving the SEAM-01 shape) → `typed-create-skeleton`
- Read-only `#pending` directive snapshot exposed to an author-side renderer (SEAM-02) → `dry-run-plan-skeleton`
- Minimal dry-run plan render of buffered commons directives in author vocabulary → `dry-run-plan-skeleton`
- Commit-on-success / discard-on-throw over the fake's staging tree (SEAM-03) → `commit-discard-contract`
- Thin error-attribution wrap: one forced rejection → author-vocabulary error (verb + path), SEAM-04 → `error-attribution-skeleton`
- Write-only-factory happy path holds with NO trailing `.read()` (obs 648) → `commit-discard-contract`

### Out of Scope
- Full type-level schema→options derivation + negative proofs — deferred to #2 `typed-options-and-read`
- Read-disk through the author surface, the fluent chain, async `read()` spike + ADR — deferred to #2
- Full error-attribution across every verb, mid-chain applied-boundary, W6 double-fault — deferred to #3 `error-and-commit-contract`
- Complete dry-run renderer, 4 MiB frame-cap (SEAM-05), `dist/core` tarball strip (SEAM-06) — deferred to #4 `dry-run-and-release-shape`

## Capabilities (contract with sdd-spec)

### New Capabilities
- `typed-create-skeleton`: one `create<S>` with a single schema-derived option (SEAM-01 shape, type-level only)
- `dry-run-plan-skeleton`: read-only buffer snapshot + minimal author-vocabulary plan render (SEAM-02)
- `commit-discard-contract`: commit-on-success / discard-on-throw over the fake staging tree (SEAM-03)
- `error-attribution-skeleton`: one forced rejection mapped to an author-vocabulary error (SEAM-04)

### Modified Capabilities
None — the skeleton seeds thin threads; the full capabilities are owned by #2/#3/#4.

## Approach

Thread the 6 seams with hardcoded values and a single op, reusing the dominant patterns: `Session` buffer/flush, `defineFactory` finally-flush, `ContractFake` staging tree. **Grow** `commit()`/`discard()` on the fake — do not invent a parallel mechanism. `create<S>` is a one-option type-level stub, not the full derivation. Two decisions design MUST formalise as ADRs (thin seeds, full versions owned downstream): **(ADR-1, SEAM-03)** the commit/discard contract *reverses* the documented partial-write JSDoc in `context.ts:33-37` to all-or-nothing — the skeleton rewords it and models it in the fake; real transactional commit is an engine §6 deliverable, marked as a dependency, not invented here. **(ADR-2, SEAM-04)** the error-attribution wrap deviates from the baseline (per explore) — a thin author-vocabulary mapping seeds the seam #3 freezes.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/commons/index.ts` | Modified | thin `create<S>` with one schema-derived option |
| `src/core/session.ts` | Modified | expose read-only `#pending` snapshot; commit/discard hook |
| `src/core/context.ts` | Modified | thread commit-on-success / discard-on-throw; reword partial-write JSDoc |
| `test/support/contract-fake.ts` | Modified | grow `commit()`/`discard()` over staging tree |
| thin error-attribution wrap | New | forced rejection → author-vocabulary error |
| minimal dry-run renderer | New | render buffered directives in author vocabulary |
| `test/skeleton/*` | New / Modified | cross-boundary seam tests (real forced rejection) |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mocking commit/error seams → vacuous integration gate (obs 648 green-but-broken) | High | Mandatory real forced-rejection cross-boundary test; fake unmocked both sides |
| Commit/discard reverses `context.ts` partial-write contract | Medium | Reword JSDoc to all-or-nothing, model in fake; engine §6 owns real transaction, marked as dependency |
| Type-level stub over-built into full derivation (scope creep into #2) | Medium | Single option only; spec asserts one schema-derived field, no parity proofs |

## Rollback Plan

This is a planning/dev change in pre-release `@pbuilder/sdk@0.0.0` — not yet published, no data, no migration, no consumer. Rollback = `git revert` of the skeleton commits on the feature branch (or discard the branch pre-merge). The contract-fake `commit()`/`discard()` additions are **test-only and additive** — safe to leave even if the source thread is reverted, as no published surface depends on them. Validate rollback by: (a) `commons/index.ts` `CreateOptions.options` returns to `JsonValue`; (b) `context.ts` JSDoc reads the original partial-write wording; (c) the full pre-skeleton test suite (148 tests) passes green. No author-entered data exists during the window — nothing is unrecoverable.

## Dependencies

- Engine §6 transactional commit + applied-boundary — the skeleton models these in the contract fake and marks the real-engine dependency; it does NOT implement them.

## Success Criteria

- [ ] A write-only typed factory (`create<S>` with one schema-derived option, NO trailing `.read()`) commits the full directive batch through the unmocked fake
- [ ] A factory that throws after buffering leaves the committed tree EMPTY and the staging tree discarded (SEAM-03, real rejection)
- [ ] A forced engine rejection surfaces an author-vocabulary error carrying verb + path (e.g. `create`/`rename`, NOT `ContractFake:`/`OpMove`) (SEAM-04)
- [ ] The dry-run render of a write-only chain equals the buffered `#pending` directives, importing no AST (SEAM-02, FIT-01 green)
- [ ] `create<S>` narrows `options` at the type level to the single schema-derived option (SEAM-01 shape); compile proof passes
- [ ] All 6 seams crossed by at least one cross-boundary test with the fake unmocked on both sides
