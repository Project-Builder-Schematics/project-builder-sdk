# Pending Changes

Followups registered from archived changes. Visible to future `/plan` grooming.

## From `typed-options-and-read` (2026-06-24) — accepted as non-blocking at archive

| Description | Type | Size | Gating? |
|---|---|---|---|
| **#3 forward note**: `EngineClient.read` no longer throws on not-found — it returns `undefined` (ADR-01). Sub-change #3 (`error-and-commit-contract`) error-attribution design MUST treat not-found as a return value, NOT an attributable error | other | — | **Design input for #3** |
| JD test-hardening (low): `permissive-proof.guard.test.ts` — derive the red-proof simulated line from `idiom2Lines[0]` instead of hardcoded 57; tighten `parseDiagnostics` regex / `fileMatch` for path-collision robustness (theoretical) | refactor | XS | — |
| CQ-1: read trichotomy affordance — lint rule or named result helper for `=== undefined` to prevent callers from using truthiness-coalescing accidentally | refactor | S | — |
| CQ-2: real end-to-end typed-factory example (actual schema type, real options object, real file) vs synthetic matrix in `typed-create.test.ts` | docs | S | — |

> Note: `typecheck:permissive-proof` masked-exit followup (from #1 skeleton archive) is DONE — resolved by `permissive-proof.guard.test.ts` in this change. Removed from pending.

## From `foundations-skeleton` (2026-06-21) — accepted as non-blocking at archive

| Description | Type | Size | Gating? |
|---|---|---|---|
| W3 · `publish.yml` repo-owner guard (`if: github.repository == '…'`) — fork-own-`main` reaches OIDC | security | XS | **Before first LIVE publish** |
| W1 · REQ-PKG-01 live-resolution smoke test (pack→install→assert `/core` throws, `/commons` resolves) | edge-case | S | Before live publish |
| W2 · FIT-01 import-graph depth — follow relative imports transitively (catch AST via `core`) | refactor | S | Before first real dialect |
| W5 · REQ-STD-01 guarding test (SECURITY verbatim sentence + dialect-doc outline) | docs | XS | — |
| W6 · `defineFactory` finally-flush must preserve the original `fn` error if flush also rejects | refactor | XS | — |
| W7 · FIT-04 unconditional `beforeAll` rebuild instead of fragile mtime gate | refactor | XS | — |
| Pin `actions/checkout` + `actions/setup-node` to commit SHAs (match `setup-bun`) | security | XS | — |
| `dist/core/**` ships in tarball — strip or document the ADR-0009 boundary as advisory | docs | S | At `@pbuilder/sdk-kit` extraction |
| Add a `prebuild` clean so a local build can't ship stale `dist/` artifacts | refactor | XS | — |
| `test/conformance/meta.test.ts` — drop the tautological `[red-proof]` label | docs | XS | — |
| `withOps` op-name collision diagnostic (ADR-0010) | refactor | S | T-M2 |

### Engine-fidelity questions (resolve against the real engine — engine §6)
- Fake `move` silently overwrites an existing destination (no fail-closed / `force`), unlike create/rename/copy.
- Fake `modify` of a non-existent path materializes the file rather than erroring.
