# Pending Changes

Followups registered from archived changes. Visible to future `/plan` grooming.

## From `l1-author-surface-skeleton` (2026-06-22) — accepted as non-blocking at archive

| Description | Type | Size | Gating? |
|---|---|---|---|
| `typecheck:permissive-proof` bun wrapper masks tsc exit-2 (reports exit 0) — CI must invert via raw `tsc`/`npx tsc` (exit-2-as-success), else a regression that makes the negative proof compile clean reads as success | other | XS | Before CI relies on the permissive proof |

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
