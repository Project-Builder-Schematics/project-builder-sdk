# Exploration: dry-run exposure (stage-3-dry-run-exposure)

**Triage**: M
**Persona lens**: none

## Cross-Change Lessons Consulted

- Triage record (`sdd/stage-3-dry-run-exposure/triage`, engram #733/#734): owner-ratified M
  conditional; `Session.pendingSnapshot()` and `src/dry-run/index.ts` re-exports already exist;
  D3 shape narrowed by blind lenses to "fold into `./commons`"; runner-level mode forces re-triage
  to L (out of scope here); naive `./dry-run` subpath ruled self-contradictory.
- `stage-2-error-attribution` design/slices (parallel, in-plan, not yet built): ratifies the
  author-verb vocabulary — `AuthoringVerb` drops `"delete"` for `"remove"`; a `delete`→`remove`
  verb-map is added to `src/core/authoring-error.ts` (`primaryPath`/`verbFor`, design §4.3-4.4).
  This is a live cross-change contract, not yet code — stage-3 must reconcile with it, not assume
  it merged.
- ADR-0014 (single-package subpath shape): exactly 3 subpaths wired (`.`, `./commons`,
  `./conformance`); a 4th subpath is a documented-shape deviation requiring its own ADR, reinforcing
  the "fold into `./commons`" reading over a new `./dry-run` subpath.
- No prior pattern/discovery/bugfix memories specific to dry-run beyond the triage record itself.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author previews buffered directives before flush | none found (no `test/e2e/dry-run*` file; `test/e2e/author-to-tree.e2e.test.ts` doesn't call `dryRunPlan`) | Create |

## Current State

`src/dry-run/plan.ts` is complete and untouched-since-write: `dryRunPlan(snapshot)` maps each
`Directive` to `{verb, path}` using the **wire op tag** as `verb` (`delete`, not `remove`) —
`test/dry-run/plan.test.ts:13-14` pins this explicitly ("`dryRunPlan` uses the wire tag per design
§4.4"). `src/dry-run/index.ts` re-exports `dryRunPlan`/`DryRunEntry` but nothing in
`package.json#exports` or `src/commons/index.ts` reaches it — dead code from the author's
perspective. `Session.pendingSnapshot()` (`session.ts:29`) returns a defensive-copy
`readonly Directive[]`; `src/commons/index.ts` already imports `currentContext` for every verb, so
`currentContext().session.pendingSnapshot()` is a one-line reach. `test/dry-run/no-import.test.ts`
statically forbids any runtime import from `src/dry-run/**` into `src/core/**` — `plan.ts` cannot
gain ambient access itself; wiring must happen at the call site (`commons`), not inside the renderer.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `commons/index.ts` (author verbs) | extend | new read-only accessor calling `currentContext().session.pendingSnapshot()` → `dryRunPlan` | aligns |
| `dry-run/plan.ts` | none (read-only) | pure renderer stays untouched; no core import added | aligns |
| `package.json#exports` | modify (additive) | new public export surfaced from `./commons` re-export, no new subpath | aligns |
| `src/core/authoring-error.ts` (stage-2, parallel) | shared concern, not modified here | owns the `delete`→`remove` verb-map stage-2 introduces; stage-3's vocabulary choice must reconcile, not duplicate blindly | deviates *(see Open Questions — vocabulary source)* |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/commons/index.ts` | Modify | add `dryRun()`-style accessor wiring `pendingSnapshot()` → `dryRunPlan` |
| `src/dry-run/plan.ts` | Read-only | confirm no change needed; renderer is complete |
| `src/dry-run/index.ts` | Read-only | already re-exports correctly |
| `src/core/session.ts` | Read-only | confirm `pendingSnapshot()` needs no change (stage-2 owns `flush()`/attribution edits) |
| `package.json` | Modify | no new subpath; `./commons`'s existing entry now surfaces one more named export |
| `test/fitness/fit-09-pkg-exports-resolution.test.ts` | Modify | keys assertion (`:59-61`) stays `[".", "./commons", "./conformance"]` if folded into commons — only if a new subpath were chosen would this need a 4th key |
| `test/fitness/dts-baseline/commons.index.d.ts` | Modify | regenerate to add the new export (additive, FIT-04 only flags removals) |
| `test/dry-run/no-import.test.ts` | Read-only | confirms the constraint the wiring must respect; no change needed |
| `test/dry-run/plan.test.ts` | Modify (conditional) | only if the vocabulary decision changes `plan.ts`'s wire-tag emission |
| `openspec/changes/stage-2-error-attribution/*` | Read-only | cross-change contract check; no edits — stage-2 owns its own files |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| public-api (contract) | `package.json#exports`, `src/commons/index.ts` public exports | Yes — noted as risk, not a hard override (additive, not breaking) |

No other registered sensitive area (auth/payments/privacy/security/deployment/db-migration) is
touched.

## Approaches

### 1. Fold into `./commons` — read-only accessor over `pendingSnapshot()`

**Description**: Add one function in `src/commons/index.ts` (e.g. `dryRun()`) that reads
`currentContext().session.pendingSnapshot()` and passes it to `dryRunPlan`, returning
`DryRunEntry[]`. No new subpath, no `Session`/`context.ts` edits, `plan.ts` stays untouched.
**Pros**: Matches the dominant pattern (every author verb already goes through
`commons/index.ts` → `currentContext()`); zero new subpaths (ADR-0014-compliant); additive-only
`.d.ts`/`package.json` delta; keeps `plan.ts` core-blind per its own invariant.
**Cons**: None material — the "runner-level mode" and naive "`./dry-run` subpath" alternatives are
both foreclosed for M (former forces re-triage to L per the triage's own condition; latter is
self-contradictory since ambient wiring needs a core import forbidden inside `src/dry-run/**`).
**Effort**: Low.
**Pattern fit**: matches existing `src/commons/index.ts` (every verb: `currentContext()` →
`session.buffer(...)`); this is a read, not a write, but the same ambient-access idiom.

## Recommendation

Fold dry-run exposure into `src/commons/index.ts` as a read-only accessor over
`pendingSnapshot()` → `dryRunPlan`. This is the only approach compatible with the M scope: it
touches no sensitive Session-internals boundary, adds no subpath (ADR-0014), and requires zero
change to the already-complete, invariant-protected `plan.ts`. The remaining open work is naming
the accessor and resolving the author-verb vocabulary (below) — not renderer logic.

## Risks

- **Vocabulary drift with stage-2** (parallel build): `plan.ts` currently emits wire tag `delete`;
  stage-2 ratifies `AuthoringVerb` without `delete` (author-facing `remove` only) and adds its own
  `delete`→`remove` map inside `src/core/authoring-error.ts`. If stage-3 ships unchanged, authors
  see `delete` in the dry-run plan but `remove` in error attribution — an inconsistent surface
  shipped in the same window. Mitigation: resolve at design/ADR time (see Open Questions).
- **Merge contention on `src/commons/index.ts`**: stage-2 adds `AuthoringError` re-export clusters
  there in parallel; stage-3 adds the accessor. Both land in the same file — sequencing/rebase risk,
  not a design risk, but worth flagging to `sdd-propose`/whoever schedules the two builds.
- **Test churn if vocabulary flips**: `test/dry-run/plan.test.ts` currently pins wire-tag output
  with an explicit rationale comment; changing that output means editing a test that documents a
  prior deliberate decision, not just adding coverage — the ADR should say so explicitly.
- **`.d.ts` baseline regen discipline**: FIT-04 only flags *removals*; the new export is safe by
  that gate, but the baseline file itself must be regenerated as part of this slice or FIT-04 will
  compare against a stale baseline that simply doesn't mention it (silent gap, not a failure).

## Open Questions

- type: product
  question: "Author-verb vocabulary for the exposed plan — does `dryRunPlan`'s output keep the wire
    tag `delete`, or does it render `remove` to match stage-2's ratified `AuthoringError` vocabulary?
    If `remove`: where does the `delete`→`remove` map live — reused from stage-2's
    `src/core/authoring-error.ts` (import from core into the `commons` wiring layer, which already
    depends on core) or duplicated as a second map local to `commons`? Option A (keep `delete`,
    no translation): zero extra work, ships an inconsistency with stage-2's error vocabulary as
    experienced by the same author in the same release. Option B (translate to `remove`, shared
    map imported from `core/authoring-error.ts`): one source of truth, but stage-2 must land (or be
    coordinated) first, and `plan.ts`'s own test needs updating for the new expectation at the
    `commons`-wiring layer, not inside `plan.ts` itself (which stays wire-tag-emitting and
    untouched, per its own invariant). Option C (duplicate a small map local to commons): no
    stage-2 sequencing dependency, but two maps drift over time."
  why_it_matters: "This is the D3 vocabulary half flagged at triage as still open; deciding it by
    silent default (leaving `plan.ts`'s current test as the de facto answer) ships a cross-surface
    inconsistency the owner has not actually seen stated as a choice."

## Ready for Proposal

**Status**: yes
**Halt routing**: n/a
**Reason**: The exposure-shape half of D3 is settled by existing code + ADR-0014 (fold into
`./commons`); the vocabulary half is a genuine, narrow, well-bounded open question that `sdd-propose`
and `sdd-spec` can carry forward as an explicit decision point rather than a blocker — it does not
change the shape of the accessor, only one field's value mapping.
**Recommended action**: Proceed to `sdd-propose` with the vocabulary question surfaced to the owner
before or during `sdd-spec` (tech-writer joins per the triage's Condition 2 — this is exactly the
kind of naming/vocabulary call that persona exists for).
