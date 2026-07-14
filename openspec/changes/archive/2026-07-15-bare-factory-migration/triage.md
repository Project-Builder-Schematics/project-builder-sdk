# Triage: Bare-Factory Migration

**Classification**: L
**Decided at**: 2026-07-14T04:15:34Z
**Change name**: `bare-factory-migration`

## Problem & Scope

> Every schematic author must wrap their factory in `defineFactory` — ceremony encoding no decision, a forgettable failure point (missing/double-wrap → cryptic TypeError under the future runner), scaling with schematic count. Owner direction obs #2070 (2026-07-14): authors export the bare typed `(input: Input) => void | Promise<void>` function; `defineFactory` becomes runner/test-harness-internal, never author vocabulary. Why now: the engine↔SDK wire design assumes the bare shape; migrating first simplifies `pbuilder-runner` and lets future author artifacts land in final shape.

```yaml
scope:
  in_scope:
    - Rewrite 5 author docs to bare-factory shape + their fence-compile tests
    - runFactoryForTest: accept bare fn, wrap via SAME internal path the future runner uses
    - Remove defineFactory from public exports (./testing) + update the affected surface-guard baselines — FIT-08 allowlist + FIT-04 dts (ORCHESTRATOR ANNOTATION 2026-07-14, plan-verify iter-1 gap #1 reconciliation; the original wording named FIT-09/FIT-14 from the early blast-radius estimate — stale: FIT-14 is key-level and correctly untouched by a symbol-only removal, FIT-09 is superseded by the FIT-08 allowlist mechanism; semantic scope unchanged)
    - Update author-emulation-e2e-scaffold corpus (PR #24) wrapped → bare
    - Transition/compat decision for already-wrapped exports (design phase)
  out_of_scope:
    - pbuilder-runner bin, StdioEngineClient, wire spec (separate plan)
    - Go CLI / engine repo, collection.json
    - Factory scaffold tooling, npm publish / go-live
```

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files | ~13-15: 5 docs, 3 doc-fence tests, 2 src, 3 fitness/guard, 1-2 corpus | L |
| Lines | ~400-800 | L |
| Contexts | 1 (single author surface) | S/M |
| Patterns | New: wrapped-exports transition decision | L |
| Test types | Existing only | M |

Overrides: breaking public API change → min M; sensitivity `public-api(contract)` row (medium, "review-required") → weighs L.

**Final**: L — file count + new decision point land L; single context keeps short of XL.

## Recommended Path
Full Planner + Council: sdd-explore → propose → spec → design → slice (4-7) → verify-plan → `/build`

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst / PM / QA / Architect | Always for L |
| Tech Writer | Removes a public export, rewrites 5 docs |

## Spec Reference
internal — no reference captured

## Risks
- File count near L/XL line — explore must pin exact list; re-triage if 3+ contexts surface
- Wrap-parity claim unverifiable until the runner exists — design must make it testable

## Halt?
No

## Notes for Next Phase
Explore: confirm `ir-transcript.test.ts`/`m20-conformance-parity.test.ts` construct vs merely consume `defineFactory`; check `package.json#exports` vs `src/testing/index.ts`-only edit; read `docs/engine-sdk-wire-design.md`. Route wrapped-exports transition as `open_questions[type=technical]`.
