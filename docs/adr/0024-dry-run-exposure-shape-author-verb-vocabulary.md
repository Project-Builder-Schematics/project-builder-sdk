# ADR-0024: Dry-run exposure shape + author-verb vocabulary

- Status: Accepted
- Date: 2026-07-07
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0011 (ambient run context); ADR-0014 (single-package subpath shape —
  exactly three subpaths); ADR-0009 (two-audiences boundary — author DATA types may
  cross, kit machinery may not); ADR-0013 (verb→IR lowering, six frozen wire ops).
- Closes: DECISION D3 (`openspec/objectives-plan.md`, Stage 3).
- Origin: change `stage-3-dry-run-exposure` (archived 2026-07-07).

## Context

The pure `dryRunPlan` renderer (`src/dry-run/plan.ts`) is complete but unreachable by
authors (O2 coverage line 5 unmet), and it emits the wire tag `delete` where the author
verb is `remove`. D3 must fix BOTH the exposure shape and the vocabulary without touching
`Session`, `context.ts` lifecycle, or stage-2's lane. `plan.ts` is core-blind by fitness
(`test/dry-run/no-import.test.ts` forbids runtime core imports inside `src/dry-run/**`),
so ambient wiring cannot live inside the renderer.

## Decision

Owner-ratified, three parts:

1. **EXPOSURE** — fold a zero-argument read-only accessor `dryRun()` into `./commons`
   over `currentContext().session.pendingSnapshot()` → `dryRunPlan`; no new subpath.
2. **VOCABULARY** — render the author verb for every op (`remove`, never wire `delete`)
   via a frozen six-row wire→author map (`WIRE_TO_AUTHOR_VERB` in `plan.ts`).
3. **MAP LOCATION** — the map is DUPLICATED local to `src/dry-run/**`, gated by a
   consistency test (`test/dry-run/vocabulary-consistency.test.ts`); it is NEVER
   imported from stage-2's `src/core/authoring-error.ts`. Single-source extraction is
   a registered post-merge followup (`openspec/pending-changes.md`), not this change's
   scope.

## Consequences

- (+) Matches the dominant author-verb idiom (every `./commons` verb already sources
  ambient context via `currentContext()`); zero new subpaths (ADR-0014 holds at three).
- (+) `plan.ts` stays core-blind; `Session`/`context.ts` untouched — read-only
  consumption of the existing `pendingSnapshot()`.
- (+) The wire snapshot type (`readonly Directive[]`) is consumed inside the accessor
  body only — it never reaches the public `.d.ts` (ADR-0009 boundary).
- (−) A second copy of the wire→author map exists (drift risk) — mitigated by the
  consistency test plus the registered extraction followup once stage-2 and stage-3
  both merge.

## Alternatives Considered

- **Runner-level dry-run mode** — rejected: reaches into `context.ts`'s all-or-nothing
  transaction boundary, triggering the triage condition to re-classify to L;
  disproportionate for exposure-only glue.
- **New `./dry-run` subpath exporting `dryRunPlan(snapshot)`** — rejected: a standalone
  renderer is useless to an author with no snapshot, and grabbing ambient context needs
  a runtime core import that `no-import.test.ts` forbids inside `src/dry-run/**`; also
  a permanent fourth semver subpath (ADR-0014 deviation).
- **Keep wire-tag `delete` vocabulary** — rejected: ships two vocabularies for one
  operation (`remove` in stage-2 errors, `delete` in the dry-run plan) to the same
  author in the same window.
- **Shared map in `src/core`** — rejected: `plan.ts` is core-blind (no-import fitness);
  couples two independently-scheduled builds and reopens stage-2's frozen design.
