# ADR-0073: The Runner Closure Is Derived From the Emitted Realm by AST Parse; Errors Name Source

**Status**: Accepted · **Date**: 2026-07-25 · **Change**: `runner-integrity-manifest` (originally ADR-01)

## Context

The engine verifies digests of emitted bytes, so the manifest's file set must be the emitted one.
A source walk yields **24** because `src/core/engine-client.ts` is `import type`-only and tsc erases
it — an extra entry the engine treats as a closure mismatch, failing closed on 100% of installs.

Separately, `removeComments` is unset, so JSDoc survives into `dist/`: `authoring-error.js` quotes
`"@pbuilder/sdk/commons"` inside an `@example` (a false Constraint-3 alarm) and `context.js` quotes
`"./schema.generated.ts"` (a phantom closure node). Both files are among the 23. A verified day-one
failure, not a hypothesis.

## Decision

Derive the file set, the graph and every specifier-kind check from `dist/**` by parsing with
**ts-morph** (already an exact-pinned dependency). Report violations against the `src/**` path the
reader must edit, with the line attributed to the emitted realm. Treat "23" as a **regenerable
baseline**, not a contract constant.

## Rejected

- **Walk `src/**`.** Wrong by construction — 24 vs 23.
- **Regex scanning.** Fails on day one. Comment-stripping is not a repair: `/\/\/.*$/gm` truncates
  any line containing `file://`, and this repo has such lines. JSDoc-quoted imports are
  **structurally absent** from ts-morph's `getImportDeclarations()`, so parsing needs no stripping.
- **Reuse `test/support/import-scan.ts`.** Regex-based, source-realm, and `catch { continue }` on
  unreadable files — the precise silent-skip RCD-03.2 forbids.
- **Hard-code 23.** Makes a legitimate closure change a cross-repo breaking event; the engine
  confirmed their mirror does not hard-code it either.

## Consequences

ts-morph gains a build-time, unshipped importer outside `src/dialects/*/ast.ts` — an **additive**
architecture impact; the baseline still describes two importers and is registered for refresh in
`pending-changes.md`. The dynamic-import filter must use `SyntaxKind`; a raw kind number does not work.
