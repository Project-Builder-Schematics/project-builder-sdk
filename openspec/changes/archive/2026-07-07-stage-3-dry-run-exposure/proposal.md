# Proposal: Stage 3 — dry-run exposure

**Change**: `stage-3-dry-run-exposure` · **Triage**: M · **Persona lens**: none

## Intent

The pure dry-run renderer (`src/dry-run/plan.ts`) is complete but is dead code from an
author's perspective: nothing in `package.json#exports` or `src/commons/index.ts` reaches it,
and no author-facing API feeds it from the `Session`. This breaks objective O2 coverage line 5
— "the author can see the plan of what they are about to emit before it happens." Stage 1 is
merged and the plan's sequencing makes this work parallelizable with Stage 2. The work is
EXPOSURE + vocabulary ratification, not renderer logic: wire an ambient read-only accessor and
render the plan in author vocabulary (`remove`, never wire `delete`).

## Scope

### In Scope
- Author-facing read-only accessor folded into `./commons` returning `DryRunEntry[]` for the
  current run's buffered directives (`currentContext().session.pendingSnapshot()` → `dryRunPlan`).
- Author-verb vocabulary rendering: `dryRunPlan` emits `remove`, never wire tag `delete`, via a
  stage-3-local 6-entry wire→author map plus a consistency test against the ratified vocabulary.
- Exports + fitness updates: `./commons` surfaces the new named export (no new subpath); FIT-09
  exact-subpath assertion and FIT-04 `.d.ts` baseline regenerated; `no-import.test.ts` stays green.

### Out of Scope
- Engine execution / disk writes; prompt UX from `schema.json`; any Stage 5 material (dialects,
  coalescing, conformance bodies); real wire (`ir.emit`/`tree.read`).
- Runner-level dry-run mode (reaches `context.ts` lifecycle — would re-triage to L; not chosen).
- Any edit to `Session.flush()` / attribution — that is Stage 2's lane and a drift signal.
- Content/bytes preview — the plan is shape-level (`{verb, path}`); enrichment is an invariant breach.

## Capabilities

### New Capabilities
- `dry-run-plan-exposure`: author-facing `./commons` accessor returning `DryRunEntry[]` for the run's buffer.

### Modified Capabilities
- `dry-run-plan-skeleton`: renderer output pinned to author vocabulary (`remove` not `delete`) + local map.

## Approach

Fold the exposure into `src/commons/index.ts` as a read-only accessor over
`pendingSnapshot()` → `dryRunPlan`, per the owner-ratified D3 shape. This matches the dominant
pattern (every author verb already routes through `commons` → `currentContext()`), adds no
subpath (ADR-0014 keeps exactly 3), keeps `plan.ts` core-blind, and leaves `Session` untouched.
Authors receive `DryRunEntry[]` only; the `readonly Directive[]` snapshot (semver-frozen wire
type) never crosses to the public API. The vocabulary map is duplicated local to stage-3 — the
existing signed `dry-run-plan-skeleton` REQ-04 already mandates author vocabulary, which the
current code violates by emitting the wire tag; this change reconciles code to spec and
re-baselines `plan.test.ts`. Design must formalise three ADRs: (1) D3 exposure shape
(fold-into-commons over new subpath); (2) author-verb vocabulary rendering + map-location choice
(local map, explicitly rejecting reuse of stage-2's `core/authoring-error.ts` map — couples the
builds — and a new shared module — reopens stage-2's frozen design); (3) register the single-source
map-extraction followup in `pending-changes` once stage-2 and stage-3 both merge.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/commons/index.ts` | Modified | add read-only `dryRun` accessor wiring `pendingSnapshot()` → `dryRunPlan` |
| `src/dry-run/plan.ts` | Modified | apply local wire→author map so `verb` renders `remove`; type-only wire import, stays core-blind |
| `src/dry-run/index.ts` | Read-only | already re-exports `dryRunPlan`/`DryRunEntry` |
| `src/core/session.ts` | Read-only | `pendingSnapshot()` consumed unchanged (Stage 2 owns `flush()`) |
| `package.json#exports` | Modified (additive) | `./commons` surfaces one more named export; no new subpath |
| `test/dry-run/plan.test.ts` | Modified | re-baseline expectation to author verbs |
| `test/dry-run/no-import.test.ts` | Read-only | must stay green (no runtime core import in `src/dry-run/**`) |
| `test/fitness/fit-10-*pkg-exports*` | Modified | FIT-09 exact-subpath assertion stays `[".","./commons","./conformance"]` |
| `test/fitness/dts-baseline/commons.index.d.ts` | Modified | regen additively (FIT-04 flags removals only) |
| vocabulary consistency test | New | local 6-entry map == ratified author vocabulary |
| e2e author-preview test | New | author obtains plan == buffered directives before flush |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Merge contention on `src/commons/index.ts` with stage-2 | High | Local map (no cross-import); flag build sequencing to scheduler |
| Vocabulary map drifts from ratified author vocabulary | Medium | Consistency test gates the map against the ratified set |
| Stale `.d.ts` baseline hides the new export (silent gap) | Medium | Regenerate `commons.index.d.ts` in the same slice; FIT-04 in scope |
| `plan.ts` core-blindness breached while applying map | Low | Map is pure data (type-only wire import); `no-import.test.ts` gates it |
| Public-api semver: additive export mistaken as breaking | Low | Additive-only; FIT-09/FIT-04 confirm no key removed, no subpath added |

## Rollback Plan

Fully additive and reversible. Revert the change commit(s): removes the `dryRun` accessor from
`src/commons/index.ts`, reverts `plan.ts` to wire-tag emission, drops the new `./commons` named
export and the two new tests, and restores the prior `commons.index.d.ts` baseline and
`plan.test.ts` expectation. No migration, no persisted data, no engine side-effects — the plan is
read-only over an in-memory buffer. The package is an unreleased dev prerelease (publish is
`--dry-run`), so no external consumer depends on the new export. Validate rollback: full `bun test`
green (FIT-09, FIT-04, `no-import.test.ts` included) against the pre-change baseline.

## Dependencies

- None. Independent of stage-2 landing by design (local map avoids the coupling); parallelizable
  per objectives-plan sequencing.

## Success Criteria

- [ ] Inside a run, an author obtains `DryRunEntry[]` where plan == buffered directives (e2e green)
- [ ] `dryRunPlan` renders `remove` for delete-op directives; no wire tag `delete` in author output
- [ ] Local 6-entry wire→author map matches the ratified author vocabulary (consistency test green)
- [ ] `./commons` surfaces the accessor; FIT-09 asserts exactly `[".","./commons","./conformance"]`
- [ ] `commons.index.d.ts` baseline regenerated; FIT-04 green
- [ ] `test/dry-run/no-import.test.ts` green (no runtime core import in `src/dry-run/**`)
- [ ] Public surface exposes `DryRunEntry[]` only; `readonly Directive[]` snapshot absent from public `.d.ts`
- [ ] Full `bun test` suite green

## Caveats from Exploration

- Caveat: author-verb vocabulary open question (keep `delete` vs render `remove`; map location).
  How addressed: resolved by owner ratification 2026-07-06 — render `remove` via a stage-3-local
  map; formalised in Scope + Approach (design writes the ADR). Not inherited silently.
