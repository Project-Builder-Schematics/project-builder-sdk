# Exploration: L1 Walking Skeleton (l1-author-surface-skeleton)

**Triage**: M · **ready_for_proposal**: yes
**Source**: REUSED + narrowed from the program-level deep exploration `sdd/l1-author-surface/explore` (obs 653, 3-persona: architect/qa/ba). No fresh explore re-run — the program explore is hours-fresh, L-depth, and covers the entire surface this skeleton threads. This artefact narrows it to the thin thread.

## Cross-Change Lessons Consulted
- obs 648 — the WRITE-ONLY factory is the primary use case; the skeleton's happy path must hold with no trailing `.read()`. The error/commit seams are exactly where foundations-skeleton's masked CRITICALs lived → the skeleton must force a REAL rejection, not a mock.

## Affected Flows (A1 — thin thread)
| Flow | Current E2E spec | Expected action |
|---|---|---|
| Write-only typed `create` → directive → minimal dry-run → commit → success | `test/skeleton/*` (flush exists; typed/dry-run/commit do NOT) | Modify |
| Forced rejection → discard → one attributed author error | none (raw `ContractFake:` strings today) | Create |

## Current State (grounded — same code the program explore read)
- `create(path, {template, options: JsonValue})` exists in `src/commons/index.ts:18-24` (untyped options).
- `Session` buffers directives, flushes before read / at run-end (`src/core/session.ts`); `defineFactory` flushes in `finally` (`src/core/context.ts:47-54`).
- `ContractFake` (`test/support/contract-fake.ts`) applies eagerly to an in-memory staging tree, op-by-op, throwing raw `ContractFake: …` on rejection. NO commit/discard phase, NO error attribution, NO dry-run render.

## Architecture Touchpoints (A3 — against baseline obs 652)
| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `commons/index.ts` | modify | thin `create<S>` with one schema-derived option (type-level stub) | aligns |
| `core/session.ts` + `context.ts` | modify | thread commit-on-success / discard-on-throw; expose `#pending` snapshot for the renderer | aligns |
| `test/support/contract-fake.ts` | modify | grow `commit()`/`discard()` over the staging tree (SEAM-03) | aligns |
| thin error-attribution wrap | new (thin) | one forced rejection → author-vocabulary error (SEAM-04 seed) | deviates → ADR (thin, full in #3) |
| minimal dry-run renderer | new (thin) | render buffered commons directives in author vocabulary (SEAM-02 seed) | aligns |

## Approaches
**Single approach — thinnest thread, reuse dominant patterns.** No alternatives worth tabling for a walking skeleton: thread the 6 seams with hardcoded values and a single op, reusing `Session`/`defineFactory`/`ContractFake`. Grow `commit()`/`discard()` on the fake rather than inventing a parallel mechanism. The type-level `create<S>` is a thin stub (one option) proving the SEAM-01 shape, not the full derivation (that is #2).

## Risks
- **HIGH** — if the skeleton mocks the commit/error seams instead of forcing a real rejection, the integration gate is vacuous (obs 648 class of green-but-broken). Mitigation: a real forced-rejection cross-boundary test.
- **MED** — commit/discard reverses the current `context.ts` partial-write JSDoc contract; the skeleton rewords it to all-or-nothing and models it in the fake. Engine §6 owns the real transactional commit — marked as a dependency, not invented.

## Open Questions
open_questions: none — the 4 program-level product questions are resolved (obs 654); the skeleton inherits those decisions. Technical details (frame-cap value, full derivation) belong to #2/#3/#4, out of skeleton scope.

## Ready for Proposal
**Status**: yes — scope is the thin thread, recommendation is singular, decisions inherited from the program. Proceed to `sdd-propose`.