# Triage: Context Singleton Dual-Instance Fix

**Classification**: M
**Decided at**: 2026-07-19T00:00:00Z
**Change name**: `context-singleton-fix`

## Problem & Scope

> The engine repo (`sdk-live-conformance`, PC-PROTO-02) is BLOCKED on M1: the first live conformance run revealed that the shipped runner (`dist/bin/pbuilder-runner.js`) fails every authoring verb (`AuthoringError: authoring verbs can only be used while a schematic is running`, exit 4) when the factory is loaded from `.ts` source per the corpus convention. Engine-diagnosed root cause with control experiment: dual Bun module instance of `core/context` — dist runner resolves `dist/core/context.js`, the `.ts` factory's imports resolve `src/core/context.ts` → two `AsyncLocalStorage` singletons; `defineFactory` enters one, verbs consult the other. Hurting: engine team, blocked now.

```yaml
scope:
  in_scope:
    - module-identity-safe context singleton in src/core/context.ts
    - dist-runner e2e regression test spawning dist/bin/pbuilder-runner.js against a .ts-source factory
    - sweep-and-report sibling module-local singletons with the same hazard
  out_of_scope:
    - corpus fixture changes
    - the handoff's .ts-source factory convention
    - engine-side changes
    - compiling fixture factories into the built graph (rejected alternative)
```

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected | context.ts (fix) + new dist-e2e test file + likely a unit test touching context.ts's public surface = 2-3 | S/M |
| Lines affected | new e2e file comparable to existing `test/fake/fake-engine-harness.e2e.test.ts` (131 lines) + fixture support + ~20-40 line context.ts change ≈ 150-200 | M |
| Bounded contexts | 1 (core singleton) but the e2e test adds a build-artifact-dependent test surface (dist freshness) — a second concern | M |
| New patterns | `globalThis`/`Symbol.for`-keyed singleton registry — grepped `src/`: zero prior `Symbol.for` usage anywhere in the codebase. Standard idiom, but first use here = variant of existing, not a from-scratch design | M |
| Test types | existing test TYPE (subprocess-spawn e2e already exists at `test/fake/fake-engine-harness.e2e.test.ts`, spawns the SOURCE runner) but a NEW setup requirement: this test depends on a fresh `dist/` build existing before it can run meaningfully | S/M |

### Overrides Triggered
None from `openspec/sensitive-areas.md` — verified against the file directly. `context.ts` is not part of the registry's "security (code execution)" row (that's `.raw()` + `dialect-handle.ts`'s containment seam) nor "public-api (contract)" (`./core` is explicitly NOT in `package.json#exports` per ADR-0034 — this fix stays off the public contract surface). No migration, no new external dependency.

**Final classification**: M — no single criterion alone forces M, but "new pattern for this codebase" + "new build-artifact-dependent test setup" + total line/file count both land past S's ceiling. Tie-breaking rule applied: chose the higher level.

## Recommended Path

- Phase: light Planner
- Skills to invoke (in order): `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 2-4 slices)
- Slice target: 2-4

## Recommended Personas (M)

| Role | Reason |
|---|---|
| Architect | Always for M — this touches a foundational core module's singleton lifecycle |
| Business Analyst | Always for M |

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- **Sibling hazard sweep (verified by read + grep)**: 4 other module-local singleton-shaped state variables share the exact same structural risk (module-scope ambient state, no dual-resolution guard) but are UNCONFIRMED — no control experiment has proven they're actually hit:
  - `hadBom` — `src/dialects/typescript/ast.ts:25`, `src/dialects/react/ast.ts:23` (WeakMap<SourceFile, boolean>)
  - `astHandlePaths` — `src/core/dialect-handle.ts:37` (WeakMap<object, string>)
  - `runInFlight` — `src/transport/runner.ts:172` (module `let` flag)
  - `realFd1Write` — `src/transport/framing.ts:75` (module `let`)
  Recommend `sdd-explore` assess reachability of each under the corpus's dual-resolution scenario; if any are live-reachable, register as fast-follow M changes rather than folding into this one (scope explicitly limits this change to `context.ts`).
- New e2e test's dependency on a fresh `dist/` build is a CI/test-ordering risk — design phase must specify how staleness is prevented or detected (pretest build step vs. explicit guard).
- `dist/core/**` ships in the tarball but is unreachable via `package.json#exports` (ADR-0034) — the fix must stay `@internal`, not become an accidental new public surface.

## Halt?

No

## Notes for Next Phase

`sdd-explore` should read the engine's control-experiment transcript/diagnosis in full (referenced but not reproduced here) before proposing the exact singleton-registry key shape (`globalThis[Symbol.for(...)]` vs. alternatives). Confirm whether the corpus fixture's import specifiers are bare-package vs. relative-to-src — that resolution detail determines whether the fix must ALSO touch anything the fixture imports besides `context.ts` directly.
