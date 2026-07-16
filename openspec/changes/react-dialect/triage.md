# Triage: React (TSX/JSX) Dialect

**Classification**: L
**Decided at**: 2026-07-16T00:00:00Z
**Change name**: `react-dialect`

## Problem & Scope

> Schematic authors who need to mutate TSX/JSX files have no dialect that supports that syntax — the shipped TypeScript dialect covers plain .ts mutation only. A React (TSX/JSX) dialect closes that gap. Why now: dialect infrastructure (defineDialect/defineOpPack/withOps, coalescing handle, conformance kit) shipped and is proven by the first dialect; this is the second consumer of that contract.

```yaml
scope:
  in_scope:
    - "React (TSX/JSX) dialect plumbing: parse/print pair, file-extension matchers, find() author surface, conformance-kit proof"
    - "Exactly TWO initial mutation ops (the minimal op-pack) — which two is a proposal-phase recommendation"
    - "Docs for the new dialect surface"
  out_of_scope:
    - "The full catalog of common React mutations — explicitly deferred to a dedicated follow-up plan"
    - "Any change to the engine or wire protocol"
```

## Description Received

> New dialect for TSX/JSX mutation, mirroring the shipped TypeScript dialect's shape (parse/print pair, extension matchers, `find()` entry, op-pack). Exactly two ops for v1; docs required.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | New leaf `src/dialects/react/{ast,ops,index}.ts` (3, mirroring `src/dialects/typescript/`) + unit tests for parse/print/ops + conformance-kit hookup (`testDialect`/`testOpPack`) + fitness updates (FIT-01 leaf-isolation walk, FIT-02 no-sibling-dialect-import, FIT-04 `.d.ts` baseline, FIT-14 package-surface pin — all need the new subpath added) + `package.json#exports` (+1 subpath `./react`) + `docs/authoring-a-dialect.md`. Estimate 8-12 files. | L |
| Lines affected (estimated) | Precedent: TS dialect's 3 files total ~330 lines for 5 ops; this ships only 2 ops so source is smaller, but TDD tests typically run 2-3x source, plus new fitness assertions. Estimate 500-900 lines. | M/L |
| Bounded contexts | 1 (dialects leaf) — isolated, consumes the existing `core/define-dialect.ts` contract without touching core | S/M |
| New patterns | Variant of existing — explicitly framed by the requester as "the second consumer of that contract," reusing the exact `defineDialect`/`defineOpPack`/`withOps` recipe the TypeScript dialect already proved | M |
| Test types | Existing types (unit/fitness/conformance via `bun test`), new instances of each | M |

### Overrides Triggered
- **Sensitivity override — security (code execution), HIGH confidence**: `openspec/sensitive-areas.md` names the coalescing/containment/`.raw()` escape-hatch seam (`src/core/dialect-handle.ts`) as high-confidence sensitive precisely because it is "every dialect shares" it — arbitrary AST-mutation code runs at author-time through `.raw()`. A new dialect necessarily instantiates a NEW copy of this exact flagged surface for a new AST realm (TSX/JSX). This is not incidental use of a stable API from outside; it is a new leaf inside the flagged boundary. Forces **L minimum** regardless of size — directly precedented by the sibling in-flight change `ts-dialect-backend-ops` (`openspec/changes/ts-dialect-backend-ops/triage.md`), which hit the identical override when widening the TypeScript dialect's own op-pack.
- **Public API surface (corroborating, not itself an override)**: adds a new `package.json#exports` subpath (`./react`) — a semver contract addition, review-required per the `public-api (contract)` sensitive-areas row (medium confidence).

**Final classification**: **L** — sensitivity override (security/code-execution on the shared dialect `.raw()` seam) forces the floor to L; size/pattern criteria independently land at M-to-L boundary, and per tie-breaking rule the higher level is chosen regardless.

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` (deep) → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` → ready for `/build`
- Slice target: 4-7 per the L default — likely compresses toward the low end (3-5) once sliced, given the deliberately minimal two-op scope (same compression `ts-dialect-backend-ops` saw after its own re-cut)

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L — also owns registering the deferred "full React mutation catalog" as a pending change |
| QA Engineer | Always for L — JSX-specific edge cases (fragments, spread props, namespaced attributes, self-closing vs paired elements) for collision/idempotency test design |
| Architect | Always for L — confirms the new leaf is a true "variant of existing" (no core changes), ADR candidacy for any TSX-specific parse/print deviation |
| Security Engineer | CONDITIONAL — triggered: sensitive-area hit (`security (code execution)`, high confidence, direct match — new `.raw()` instance) |
| Tech Writer | CONDITIONAL — triggered: public API surface expansion (new subpath, semver contract) + docs deliverable is explicitly in scope |

Not applicable: UX Designer (no UI surface — this is a developer-facing SDK API, not an end-user interface); DBA (no data layer involved).

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- **Parser/printer dependency undetermined**: whether `ts-morph` (the SDK's sole runtime dependency, TypeScript-compiler-based) parses/prints TSX/JSX sufficiently for this dialect's needs, or whether a new dependency (e.g. a JSX-aware parser/printer) is required, is UNRESOLVED at triage — reading source to settle this is explore's job, not triage's. If a new dependency is needed, the existing "new external dependency → minimum M" override applies but is subsumed by the sensitivity-driven L floor already in effect. Explore MUST resolve this before propose.
- **Sibling in-flight change (`ts-dialect-backend-ops`)**: paused at `explore`, before `propose`, with an unresolved blocking decision (id: `a`) that the security engineer flagged as halt-worthy: an identifier-injection issue was empirically CONFIRMED against `ts-morph@28` — "name-position args splice raw; from-position args are escaped." If this react dialect's two v1 ops take any name/identifier-shaped argument (e.g. a component or prop name) and use `ts-morph` underneath, this same injection class plausibly applies from day one and should be designed against rather than rediscovered. Recommend explore reads that finding directly rather than re-deriving it.
- JSX-specific collision semantics (e.g. duplicate component imports, prop-name collisions, namespaced attributes) may not map cleanly onto the TypeScript dialect's `assertNoCollision` precedent — a design-phase decision, not a triage one.
- New `package.json#exports` subpath means FIT-04 (`.d.ts` baseline) and FIT-14 (package-surface pin) need explicit extension — flag for design's file-changes table.

## Halt?

No

## Notes for Next Phase

- `sdd-explore` should read `src/dialects/typescript/{ast,ops,index}.ts` in full (not just skimmed) as the structural precedent, plus `src/core/define-dialect.ts` and `src/core/dialect-handle.ts` for the shared contract surface.
- `sdd-explore` should also read `openspec/changes/ts-dialect-backend-ops/explore.md` (16k, already written) for its ts-morph identifier-injection finding and its "Layer-0 primitives" discussion — avoid re-deriving either from scratch.
- The "which two ops" decision is explicitly a proposal-phase recommendation per scope — do not let explore pre-commit to specific ops beyond surfacing candidates and tradeoffs.
- Confirm before propose whether `ts-morph`'s TSX `ScriptKind` handling covers this dialect's parse/print needs, or whether a second AST library must be introduced (a "two-realms" hazard already documented for the ts-morph/author-code boundary — a second library would add a THIRD realm needing the same treatment).
