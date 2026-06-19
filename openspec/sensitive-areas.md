# Sensitive Areas: project-builder-sdk

**Detected at**: 2026-06-19

> Greenfield repo — there is **no code yet**, so every entry below is **anticipated** (forward-looking),
> recorded at `confidence: low` so `sdd-triage` flags it the moment the corresponding code lands.
> The dominant amplifier here is that this is a **PUBLIC npm package**: anything published is consumed
> by the world, and the supply-chain/trust surface is real from the first release.

| Area | Anticipated paths | Confidence | Reason | Note |
|---|---|---|---|---|
| security (supply-chain) | published package surface | low | PUBLIC npm package — consumers run our code; a compromised release ships to everyone | Sensitivity is the *publish boundary*, not a single file. Provenance + pinned publish creds required. |
| security (code execution) | the L2 `.raw(ast => …)` escape hatch | low | `.raw` runs arbitrary author code against a live AST at author-time | Only final `[]byte` crosses the IR seam — closures never do. Boundary discipline must be enforced. |
| security (third-party trust) | dialect packages (`@acme/pbuilder-sdk-*`) | low | Community dialects are third-party code depending on a PUBLIC contract | No threat model / signing / trust tiers yet (SDK_DOSSIER §8 gap #7). |
| security (IPC) | JSON-RPC wire to the Go engine sidecar | low | Cross-process boundary; the engine treats Bun as hostile (engine `bunipc`) | Only serializable messages cross; TS never touches Go internals. |
| deployment | `.github/workflows/`, npm publish | low | CI + `npm publish` secrets (NPM_TOKEN / OIDC provenance), publish scope | Lands with foundations-skeleton CI. Upgrade to **high** once secrets exist. Security-engineer review then mandatory. |
| public-api (contract) | `package.json#exports`, emitted `.d.ts` | low | Every exported symbol is a semver contract; breaking it breaks every consumer | Not a security concern — a *stability* one. Treated as review-required for breaking changes. |

## Review Required

All entries are `confidence: low` and **anticipated** — none reflect existing code. Re-run
`/sdd-init force=true` (or update this file) once `foundations-skeleton` lands real paths, and promote
the relevant rows to `medium`/`high` with concrete paths.

> Reminder: a sensitive-area change overrides triage to a minimum of **L** regardless of size. The
> publish boundary and the IPC wire are the two most likely to trip this once code exists.
