# Sensitive Areas: project-builder-sdk

**Detected at**: 2026-06-19

> Greenfield repo — there is **no code yet**, so every entry below is **anticipated** (forward-looking),
> recorded at `confidence: low` so `sdd-triage` flags it the moment the corresponding code lands.
> The dominant amplifier here is that this is a **PUBLIC npm package**: anything published is consumed
> by the world, and the supply-chain/trust surface is real from the first release.

| Area | Anticipated paths | Confidence | Reason | Note |
|---|---|---|---|---|
| security (supply-chain) | published package surface, incl. `./testing` (`src/testing/**`, ships `ContractFake` in the tarball) | medium | PUBLIC npm package — consumers run our code; a compromised release ships to everyone. `./testing` (stage-4b-testing-harness, 2026-07-12) is a THIRD published entry carrying normative test machinery, guarded by FIT-08/FIT-10/FIT-17/FIT-18 + a dts negative-declaration scan (structural, fail-closed) | Sensitivity is the *publish boundary*, not a single file. Provenance + pinned publish creds required. FIT-17 currently scans `src/`-derived minified builds as a proxy for `dist/` — a pending followup asks it to scan shipped `dist` entries directly. `dist/core/**` ships in the tarball by documented decision (ADR-0034 amendment, REQ-FPS-06) — shipped but unreachable via `package.json#exports`; every publish-surface `uses:` action is 40-hex SHA-pinned (REQ-PPH-02) as this row's supply-chain convention (`stage-6-release-shape`, 2026-07-14). |
| security (code execution) | the L2 `.raw(ast => …)` escape hatch, now concrete at `src/dialects/typescript/**` (the TypeScript dialect's `.raw()` surface plus the widening structured op-pack — `addImport`/`addFunction`/`removeImport`, ts-morph realm) and `src/core/dialect-handle.ts` (the coalescing/containment/fail-closed seam every dialect shares) | high | `.raw` runs arbitrary author code against a live AST at author-time, and the op-pack itself now includes a destructive op (`removeImport`) and a fail-loud reject path (row-136, ADR-0039) that a security-motivated edit depends on landing correctly. `stage-5-first-dialect` (2026-07-12) landed these paths for real; `stage-5b-dialect-breadth` (2026-07-12) widened the op-pack and promoted this row from `medium` per its own registry-deliverable obligation (S-002) | Only final `[]byte` crosses the IR seam — closures never do. Boundary discipline must be enforced. The two-realms hazard (a different ts-morph version loaded by the author) is documented, not solved — `docs/authoring-a-dialect.md` + `SECURITY.md`, guarded by `test/docs/security-authoring-guard.test.ts`. |
| security (third-party trust) | dialect packages (`@acme/pbuilder-sdk-*`); `package.json#dependencies` — now concrete: `ts-morph`, the SDK's own FIRST runtime dependency (`stage-5-first-dialect`, 2026-07-12) | medium | Community dialects are third-party code depending on a PUBLIC contract; a first-party runtime dependency is also supply-chain surface — exact-pinned, committed lockfile, provenance-attested publish (REQ-TSD-06) | No threat model / signing / trust tiers yet for community dialects (SDK_DOSSIER §8 gap #7). `ts-morph`'s own supply chain is scoped by FIT-01's leaf-isolation walk (never reaches `src/commons/**`). |
| security (IPC) | JSON-RPC wire to the Go engine sidecar | low | Cross-process boundary; the engine treats Bun as hostile (engine `bunipc`) | Only serializable messages cross; TS never touches Go internals. |
| deployment | `.github/workflows/`, `.github/workflows/publish.yml`, npm publish | medium | CI + `npm publish` secrets (NPM_TOKEN / OIDC provenance), publish scope. `stage-6-release-shape` (2026-07-14) hardened `publish.yml`: a repo-owner guard (W3, `if: github.repository == '…'`), 40-hex SHA-pinned actions (`actions/checkout`, `actions/setup-node`, `oven-sh/setup-bun`), job-scoped `id-token: write`, and a trigger surface restricted to `push: branches: [main]` (no `pull_request`/`workflow_dispatch`) — `--dry-run` stays pinned, so no live publish fires yet | Lands with foundations-skeleton CI; hardened posture landed by `stage-6-release-shape`. Upgrade to **high** once `--dry-run` is removed for the first live publish (gated on the required-reviewers precondition, `openspec/pending-changes.md`). Security-engineer review then mandatory. |
| public-api (contract) | `package.json#exports` (now 4 keys: `.`/`./commons`/`./conformance`/`./testing`; `./core` stays absent), emitted `.d.ts` | medium | Every exported symbol is a semver contract; breaking it breaks every consumer. `./testing` (stage-4b-testing-harness, 2026-07-12) adds a third author-facing entry, 0.x semver-exempt until validated by real use (ADR-0033) | Not a security concern — a *stability* one. Treated as review-required for breaking changes. FIT-10's port-guard allow-list note now spans `src/**` (was `src/core/**` only) — the single allow-listed path is `src/testing/contract-fake.ts`. |

## Review Required

All rows above now reflect CONCRETE, landed code (paths, not anticipations) — `security
(code execution)` and `security (third-party trust)` promoted from their original
`anticipated`/`confidence: low` state as `stage-5-first-dialect` and `stage-5b-dialect-breadth`
(2026-07-12) landed the real paths; `deployment` promoted low→medium as `stage-6-release-shape`
(2026-07-14) hardened `publish.yml` (repo-owner guard, SHA pins, trigger-surface restriction).
`security (IPC)` is the sole remaining lower-confidence row — the JSON-RPC wire to the Go engine
sidecar has no concrete code in this repo yet; re-run `/sdd-init force=true` (or update this
file) once it lands for real.

> Reminder: a sensitive-area change overrides triage to a minimum of **L** regardless of size. The
> publish boundary and the IPC wire are the two most likely to trip this once code exists.
