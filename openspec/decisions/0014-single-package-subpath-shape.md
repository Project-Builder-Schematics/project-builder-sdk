# ADR-0014: Single-package distribution and subpath-exports shape

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Builds on: ADR-0009 (two audiences, monorepo deferral), ADR-0012 (conformance kit),
  ADR-0001 (SDK emits wire directives).
- Formalises: what S-004 (build/exports) implemented and REQ-PKG-01/02 specified.

## Context

The SDK has two audiences (ADR-0009): schematic **authors** and dialect **contributors**. The
contributor kit (`src/core`) is an internal module, designed for extraction but not yet published
separately. The distribution shape must (a) satisfy authors with clean, narrow imports, (b) keep
the contributor boundary honest without a premature monorepo split, and (c) leave the monorepo
extraction mechanical rather than requiring re-architecture.

## Decision

### One package: `@pbuilder/sdk`

Ship v1 as a **single npm package** (`@pbuilder/sdk`). The contributor kit (`src/core`) is an
internal module behind a clean, extraction-ready boundary — NOT a published package. This
defers monorepo complexity until it is earned.

### Subpath exports (package.json#exports)

Three subpaths are wired; the kit and dialect subpaths are NOT:

| Subpath | Resolves to | Audience | Notes |
|---|---|---|---|
| `.` (umbrella) | `dist/index.js` + `dist/index.d.ts` | Authors | Re-exports the commons surface only — `src/index.ts` → `src/commons/index.ts` |
| `./commons` | `dist/commons/index.js` + `dist/commons/index.d.ts` | Authors | The canonical author import (`@pbuilder/sdk/commons`) |
| `./conformance` | `dist/conformance/index.js` + `dist/conformance/index.d.ts` | Contributors / Testers | The conformance kit scaffold (ADR-0012) |
| `./core` | **Not wired — fails resolution** | — | Internal only; blocked by `exports` |
| `./internal` | **Not wired** | — | Reserved |
| `./kit` | **Not wired** | — | Reserved for future `@pbuilder/sdk-kit` extraction trigger |

The dialect subpath pattern (`@pbuilder/sdk/<dialect>`) is **documented, not wired**: no dialect
is shipped in v1. Dialects are community packages that import from `@pbuilder/sdk-kit` (the
future extracted kit). See "monorepo-deferral trigger" below.

### Bleed prevention

A fitness function (FIT-08) asserts no author subpath (`./commons`, `.`, `./conformance`)
re-exports any kit symbol (`EngineClient`, `Session`, `DirectiveFactory`, `ContractFake`,
`RunContext`, `defineFactory`, `currentContext`, `defineDialect`, `defineOpPack`, `withOps`,
`ReadOps`, `WriteOps`, `WritableHandleRef`). The boundary is enforced on every CI run.

### Monorepo-deferral trigger

The monorepo split (extracting `@pbuilder/sdk-kit`) fires on the **first** of these conditions:

1. **First external/community dialect** — a dialect outside the `@pbuilder` org imports the kit.
   Until then, the internal boundary suffices.
2. **Second dialect** — a second dialect (even internal) joins the repo. At two dialects the
   shared kit warrants an independent release cadence.

Until the trigger fires, the kit stays internal. The extraction is mechanical: move `src/core` to
a new `packages/sdk-kit/` workspace, publish as `@pbuilder/sdk-kit`, update the `@pbuilder/sdk`
dependency to point at it. No interface changes required (the boundary was clean from day one).

### ESM-only, Bun-native

The build emits **ESM only** (`.js` + `.d.ts` per subpath, via `tsconfig.build.json`). No CJS
shim. The dev `tsconfig.json` is `noEmit` — type-checks only.

## Consequences

- Authors import `@pbuilder/sdk` or `@pbuilder/sdk/commons` — they never see the kit.
- Importing `@pbuilder/sdk/core` fails at resolution time (blocked by `exports`) — the boundary
  is enforced by the module system, not just convention.
- When the monorepo trigger fires, no interface changes are required — only package extraction.
- The conformance kit is reachable at `@pbuilder/sdk/conformance` for contributors and CI.
- The dialect subpath pattern is reserved via documentation; wiring it prematurely would mean
  shipping an unvalidated contract (the dialect API is not frozen until T-M2).
