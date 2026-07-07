# Triage: Stage 3 — dry-run exposure

**Classification**: M — owner-ratified 2026-07-06, conditional (see Owner Ratification). Skill recommendation was L; retained below as record.
**Decided at**: 2026-07-06
**Change name**: `stage-3-dry-run-exposure`

## Problem & Scope

> Schematic authors cannot see what their run will emit before it happens — the dry-run renderer
> exists (`src/dry-run/plan.ts`, pure and complete) but nothing exports it publicly and no
> author-facing API feeds it from the Session. It hurts because objective O2 (coverage line 5)
> promises "the author can see the plan of what they are about to emit before it happens" and today
> that renderer is dead code. Why now: Stage 1 (ir-bedrock) is merged to main and the
> objectives-plan sequencing makes Stage 3 parallelizable with Stage 2's build.

```yaml
scope:
  in_scope: ["DECISION D3 — dry-run exposure shape (in-factory verb vs runner-level mode vs
    ./dry-run subpath) + plan vocabulary (author `remove` vs wire tag `delete`), ADR-recorded",
    "Session snapshot → author-facing plan wiring: read-only pending-directives snapshot from
    Session reaches dryRunPlan, exposed per D3", "Exports + fitness update: package.json#exports
    entry (or fold into ./commons), FIT-09 and test/dry-run/no-import.test.ts updated"]
  out_of_scope: ["Engine execution / disk", "Prompt UX from schema.json", "Anything Stage 5
    (dialects, coalescing, conformance kit bodies)", "Real wire (ir.emit/tree.read)"]
```

## Description Received

> objectives-plan Stage 3 (3.1-3.3): expose the existing pure `dryRunPlan` renderer to authors via
> a ratified surface shape, wired read-only off `Session`'s pending-directive buffer.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected | ~5-7 (session.ts, plan.ts or new export entry, package.json, test/dry-run/*, no-import.test.ts, FIT-09, 1 ADR) | M |
| Lines affected | ~150-300 | M |
| Bounded contexts | 2 (`core/session.ts` + `dry-run`/public-exports surface) | L |
| New patterns | undecided — D3's "in-factory verb" option would weave a new author-facing verb into every factory chain (new); "./dry-run subpath" option reuses the existing `./commons`/`./conformance` subpath pattern (variant). Outcome not yet ratified. | L (conservative, pending D3) |
| Test types | existing types (unit + fitness) | M |

### Overrides Triggered

None of the hard sensitivity overrides (auth/payments/privacy/security/deployment/db-migration)
fire. `package.json#exports` is a registered sensitive area (`public-api (contract)`,
confidence: low, "review-required for breaking changes") — noted as a risk below, not applied as
a hard override since this addition is additive, not breaking.

**Final classification**: L — the bounded-contexts criterion (core + dry-run/public-exports = 2)
and the still-open new-pattern risk from D3 both independently land in L's band; per the matrix
rule the highest-scoring criterion sets the floor. Matches sibling Stage 2's classification and
rigor.

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` →
  `sdd-slice` (target 4-5) → verify-plan → `sdd-apply` ⇄ verify-in-loop → verify-final →
  `sdd-archive`
- Slice target: 4-5

## Recommended Personas (L only)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L — scope discipline against Stage 3's narrow 3-item list, parallelizability with Stage 2 |
| Architect | Always for L — D3 is a ★ decision needing an ADR; exposure shape affects structural boundaries (core-blind, AST-blind invariants of `plan.ts`) |
| QA Engineer | Always for L — plan == buffered directives invariant, FIT-09 and no-import fitness updates |
| Tech Writer | Public API contract: `package.json#exports`, author-facing vocabulary decision (`remove` vs `delete`) |

Not triggered: UX Designer (no traditional UI — this is a programmatic SDK surface; DX ergonomics
already covered by BA/PM/Architect), Security Engineer (no auth/payments/privacy/security touched),
DBA (no schema/data layer).

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- D3 is unresolved with three candidate shapes of materially different invasiveness (subpath
  utility = additive/low-risk; runner-level mode = moderate; in-factory verb = new pattern woven
  into every factory chain, semver-sensitive). Ratify before 3.2 starts, per the plan's own
  sequencing note.
- `dryRunPlan` already emits wire tag `"delete"` where the author verb is `remove` — the vocabulary
  half of D3 is a pre-existing inconsistency, not new code; confirm the ratified rendering doesn't
  silently ship the wire tag to authors.
- `plan.ts`'s current purity (AST-blind, core-blind, single type-only import from `wire.ts`) is a
  structural invariant (SEAM-02/REQ-04/REQ-05 per its own header comment) — the Session-wiring in
  3.2 must stay read-only and must not import `plan.ts` into anything that violates that boundary.
- `package.json#exports` is a registered sensitive area (semver contract) — confirm the ratified
  D3 shape is additive, not a breaking change to any existing export.
- No dependency on `stage-2-error-attribution` per the plan's sequencing (Stages 3 and 4 are
  mutually independent and independent of Stage 5) — confirmed no overlap found in
  `stage-2-error-attribution/` artefacts touching `dry-run` or `plan.ts`.

## Halt?

No — proceed to `sdd-explore`. Read ADR-0003/0014 (existing subpath-naming precedent) and the
`plan.ts` header comment (SEAM-02/REQ-04/REQ-05) first.

## Notes for Next Phase

`3.2 exists-when`: an author can obtain the plan of buffered directives before flush, tested
plan == buffered directives. `dryRunPlan` itself needs no changes (pure, complete) — the work is
wiring + exposure + vocabulary ratification, not renderer logic. Check whether the "in-factory
verb" option under consideration would require access to Session internals beyond a read-only
snapshot (risk of breaking `plan.ts`'s core-blindness if done carelessly).

## Owner Ratification (2026-07-06)

Council split 2-1: skill executor recommended L (bounded-contexts + open D3 new-pattern risk);
architect and pm blind lenses independently returned M. Owner ratified **M conditional**.

Decisive code facts (verified by both lenses): `Session.pendingSnapshot()` already exists
(`src/core/session.ts:29`, built for the dry-run renderer, defensive copy typed
`readonly Directive[]`), and `src/dry-run/index.ts` already re-exports `dryRunPlan` +
`DryRunEntry`. The change is exposure-only glue; the commitment weight (ADR + semver surface) is
covered by the M pipeline's spec/design/ADR trail without a walking skeleton.

Conditions attached:

1. **Re-triage to L if D3 ratifies the runner-level-mode option** — it reaches into
   `src/core/context.ts`'s all-or-nothing run lifecycle (transaction boundary).
2. **Tech-writer joins spec and design** (public API contract: exports map + author vocabulary).

Pipeline: M light — council architect + business-analyst (+ tech-writer per condition 2),
`sdd-slice` target 2-4, plan-verify gate, arch hooks active (M).

Corrections to this artefact's own findings, from the blind lenses:

- The "no overlap with stage-2" claim is too strong. Concrete overlap exists:
  `src/commons/index.ts` is the highest-contention merge file (stage-2 adds AuthoringError
  re-export clusters there; stage-3's accessor/re-export likely lands there too), and the
  `delete`→`remove` verb mapping will have TWO runtime consumers (stage-2
  `src/core/authoring-error.ts` verb-map + stage-3 `src/dry-run/plan.ts` rendering). Name the
  author-verb vocabulary as a cross-change contract — ADR candidate: "author-verb vocabulary
  source: one map or two, and where" (note: a shared map cannot live in `src/core` — `plan.ts`
  is core-blind per the no-import fitness).
- Stage-2 precedent binds the vocabulary half of D3: owner already ratified author verbs for
  `AuthoringError` (`verb: 'remove'`, never wire `'delete'`, resolving the ADR-0013 conflict).
- Sequencing constraint (pm): stage-3 stays READ-ONLY on the Session side — it consumes the
  existing `pendingSnapshot()`; if design finds itself editing `flush()`/attribution, that is
  stage-2's lane and a drift signal.
- The naive `./dry-run` subpath option is architecturally self-contradictory as stated: a
  standalone pure `dryRunPlan(snapshot)` is useless to an author with no snapshot; grabbing
  ambient context requires a runtime core import, which `test/dry-run/no-import.test.ts`
  forbids inside `src/dry-run/**`. The D3 ADR must resolve where the ambient wiring lives
  (e.g. in commons, which already imports `currentContext`).
- Public surface constraint: authors receive `DryRunEntry[]` only — the `readonly Directive[]`
  snapshot (semver-frozen wire type) must never reach the public API; `pendingSnapshot()` stays
  core-internal.
