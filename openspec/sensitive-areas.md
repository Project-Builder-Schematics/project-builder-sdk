# Sensitive Areas: project-builder-sdk

**Detected at**: 2026-06-19

> Greenfield repo — there is **no code yet**, so every entry below is **anticipated** (forward-looking),
> recorded at `confidence: low` so `sdd-triage` flags it the moment the corresponding code lands.
> The dominant amplifier here is that this is a **PUBLIC npm package**: anything published is consumed
> by the world, and the supply-chain/trust surface is real from the first release.

| Area | Anticipated paths | Confidence | Reason | Note |
|---|---|---|---|---|
| security (supply-chain) | published package surface, incl. `./testing` (`src/testing/**`, ships `ContractFake` in the tarball) | medium | PUBLIC npm package — consumers run our code; a compromised release ships to everyone. `./testing` (stage-4b-testing-harness, 2026-07-12) is a THIRD published entry carrying normative test machinery, guarded by FIT-08/FIT-10/FIT-17/FIT-18 + a dts negative-declaration scan (structural, fail-closed) | Sensitivity is the *publish boundary*, not a single file. Provenance + pinned publish creds required. FIT-17 currently scans `src/`-derived minified builds as a proxy for `dist/` — a pending followup asks it to scan shipped `dist` entries directly. |
| security (code execution) | the L2 `.raw(ast => …)` escape hatch | low | `.raw` runs arbitrary author code against a live AST at author-time | Only final `[]byte` crosses the IR seam — closures never do. Boundary discipline must be enforced. |
| security (third-party trust) | dialect packages (`@acme/pbuilder-sdk-*`) | low | Community dialects are third-party code depending on a PUBLIC contract | No threat model / signing / trust tiers yet (SDK_DOSSIER §8 gap #7). |
| security (IPC) | JSON-RPC wire to the Go engine sidecar | low | Cross-process boundary; the engine treats Bun as hostile (engine `bunipc`) | Only serializable messages cross; TS never touches Go internals. |
| deployment | `.github/workflows/`, npm publish | low | CI + `npm publish` secrets (NPM_TOKEN / OIDC provenance), publish scope | Lands with foundations-skeleton CI. Upgrade to **high** once secrets exist. Security-engineer review then mandatory. |
| public-api (contract) | `package.json#exports` (now 4 keys: `.`/`./commons`/`./conformance`/`./testing`; `./core` stays absent), emitted `.d.ts` | medium | Every exported symbol is a semver contract; breaking it breaks every consumer. `./testing` (stage-4b-testing-harness, 2026-07-12) adds a third author-facing entry, 0.x semver-exempt until validated by real use (ADR-0033) | Not a security concern — a *stability* one. Treated as review-required for breaking changes. FIT-10's port-guard allow-list note now spans `src/**` (was `src/core/**` only) — the single allow-listed path is `src/testing/contract-fake.ts`. |

## Review Required

All entries are `confidence: low` and **anticipated** — none reflect existing code. Re-run
`/sdd-init force=true` (or update this file) once `foundations-skeleton` lands real paths, and promote
the relevant rows to `medium`/`high` with concrete paths.

> Reminder: a sensitive-area change overrides triage to a minimum of **L** regardless of size. The
> publish boundary and the IPC wire are the two most likely to trip this once code exists.
