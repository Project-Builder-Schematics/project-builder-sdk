# Triage: L1 Author Surface — Walking Skeleton

**Classification**: M
**Decided at**: 2026-06-21
**Change name**: `l1-author-surface-skeleton`
**Parent program**: `l1-author-surface` (sub-change #1 of 4)

> Inherited from the program decomposition (`openspec/changes/l1-author-surface/program.md`). The
> skeleton is the program walking skeleton: the thinnest end-to-end thread that crosses ALL 6 seams,
> so an integrated whole exists before any half grows. Classified M (thin, hardcoded values allowed,
> single op) — but it must touch every seam with a REAL boundary, never a mock.

## Problem & Scope

> The program needs a working integrated spine before #2/#3/#4 plug in. Today no thread connects a
> typed `create` → directive buffer → dry-run render → commit/discard → attributed error. The skeleton
> builds that thread thinly so every later sub-change grows a working whole, and so the two riskiest
> seams (commit/discard, error-attribution — where foundations-skeleton's masked CRITICALs lived) are
> exercised by a real forced rejection from day one.

```yaml
scope:
  in_scope:
    - one typed create<S> with a SINGLE schema-derived option (thin type-level proof, not the full derivation)
    - the directive buffer snapshot exposed to an author-side renderer (SEAM-02, read-only)
    - a MINIMAL dry-run plan render of the buffered commons directives (author vocabulary)
    - commit/discard over the fake's staging tree (SEAM-03): success commits, thrown fn discards
    - a THIN error-attribution wrap (SEAM-04): one forced rejection → author-vocabulary error (verb + path)
    - write-only-factory path holds (obs 648 — the primary use case, no trailing .read())
  out_of_scope:
    - full type-level schema→options derivation + negative proofs (→ #2 typed-options-and-read)
    - read-disk through the author surface, the fluent chain, the async spike + ADR (→ #2)
    - full error-attribution across every verb, mid-chain applied-boundary, W6 (→ #3)
    - the complete dry-run renderer + 4 MiB frame-cap + dist/core tarball close (→ #4)
```

## Criteria Evaluation
| Criterion | Evidence | Score |
|---|---|---|
| Files affected | contract fake (commit/discard), session/context (thread), commons (create<S> stub), a thin error wrap, tests | M |
| Lines | thin thread, hardcoded — ~150-300 | M |
| Bounded contexts | 1-2 (commons surface + core/fake) | M |
| New patterns | variant — threads patterns the program already defined; no novel pattern invented here | M |
| Test types | cross-boundary seam tests (real forced rejection); write-only path | M |

### Overrides Triggered
None (no sensitivity override). Public-API surface review deferred to the sub-changes that freeze it (#2/#3/#4).

**Final classification**: M — thin walking skeleton; light Planner.

## Recommended Path
- Phase: light Planner — `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 2-4 slices)
- Exploration: REUSED from the program-level deep explore (`sdd/l1-author-surface/explore`, obs 653) — narrowed to the thin-thread scope in `explore.md`. No fresh 3-persona explore for an M skeleton.

## Recommended Personas (M)
Architect + Business Analyst (light, per M routing).

## Spec Reference
spec_source: internal — no reference captured. Program is internal; no upstream tickets.

## Notes for Next Phase
- The skeleton MUST exercise SEAM-03 (commit/discard) and SEAM-04 (error-attribution) with a REAL forced rejection from the fake, not a mock — else the integration gate is vacuous (program risk HIGH).
- Real transactional commit + applied-boundary are engine §6 deliverables; the skeleton models them in the contract fake and marks the dependency.
- Reuse existing patterns: `Session` buffer/flush, `defineFactory` finally-flush, `ContractFake` staging tree. Grow `commit()`/`discard()` on the fake; do not invent a parallel mechanism.