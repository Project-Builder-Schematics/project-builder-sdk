# Pending Changes

Followups registered from archived changes. Visible to future `/plan` grooming.

> **Groomed 2026-07-04** against the WHAT-level delivery plan (`openspec/objectives-plan.md`).
> Every row carries a **Stage** tag from that plan (or an explicit "not now"). The stage item is
> now the unit of scheduling; this file remains the debt ledger of record.

## From `typed-options-and-read` (2026-06-24) — accepted as non-blocking at archive

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| **Forward note** (was "design input for #3"; #3 superseded): `EngineClient.read` no longer throws on not-found — it returns `undefined` (ADR-01). Error-attribution design MUST treat not-found as a return value, NOT an attributable error | other | — | **Design input for Stage 2.1** | **2.1** |
| JD test-hardening (low): `permissive-proof.guard.test.ts` — derive the red-proof simulated line from `idiom2Lines[0]` instead of hardcoded 57; tighten `parseDiagnostics` regex / `fileMatch` for path-collision robustness (theoretical) | refactor | XS | — | **1.6** |
| CQ-1: read trichotomy affordance — lint rule or named result helper for `=== undefined` to prevent callers from using truthiness-coalescing accidentally | refactor | S | — | **2.3** |
| CQ-2: real end-to-end typed-factory example (actual schema type, real options object, real file) vs synthetic matrix in `typed-create.test.ts` | docs | S | — | **4.4** |

> Note: `typecheck:permissive-proof` masked-exit followup (from #1 skeleton archive) is DONE — resolved by `permissive-proof.guard.test.ts` in this change. Removed from pending.

## From `foundations-skeleton` (2026-06-21) — accepted as non-blocking at archive

| Description | Type | Size | Gating? | Stage |
|---|---|---|---|---|
| W3 · `publish.yml` repo-owner guard (`if: github.repository == '…'`) — fork-own-`main` reaches OIDC | security | XS | **Before first LIVE publish** | **6.2** |
| W1 · REQ-PKG-01 live-resolution smoke test (pack→install→assert `/core` throws, `/commons` resolves) | edge-case | S | Before live publish | **6.2** |
| W2 · FIT-01 import-graph depth — follow relative imports transitively (catch AST via `core`) | refactor | S | Before first real dialect | **5.0 (hard pre-gate)** |
| W5 · REQ-STD-01 guarding test (SECURITY verbatim sentence + dialect-doc outline) | docs | XS | — | **5.7** |
| W6 · `defineFactory` finally-flush must preserve the original `fn` error if flush also rejects | refactor | XS | — | **1.5** |
| W7 · FIT-04 unconditional `beforeAll` rebuild instead of fragile mtime gate | refactor | XS | — | **1.6** |
| Pin `actions/checkout` + `actions/setup-node` to commit SHAs (match `setup-bun`) | security | XS | — | **6.2** |
| `dist/core/**` ships in tarball — strip or document the ADR-0009 boundary as advisory | docs | S | At `@pbuilder/sdk-kit` extraction | **6.2 (strip-or-document)** |
| Add a `prebuild` clean so a local build can't ship stale `dist/` artifacts | refactor | XS | — | **6.2** |
| `test/conformance/meta.test.ts` — drop the tautological `[red-proof]` label | docs | XS | — | **1.6** |
| `withOps` op-name collision diagnostic (ADR-0010) | refactor | S | T-M2 | **5.3** |

### Fake-semantics questions (REFRAMED 2026-07-04 — was "resolve against the real engine")

The problem statement makes the contract fake the **legitimate counterpart**, so these can no
longer defer to a real engine. **★ DECISION D1 is RATIFIED — ADR-0017** (fail-closed; `move`
gains `force?`; `modify` requires existence). Stage 1.3 closes the fake to match.

| Question | Stage |
|---|---|
| Fake `move` silently overwrites an existing destination — ratified fail-closed + `force` (ADR-0017) | **1.3 (implement)** |
| Fake `modify` of a non-existent path materializes the file — ratified as ERROR (ADR-0017) | **1.3 (implement)** |
