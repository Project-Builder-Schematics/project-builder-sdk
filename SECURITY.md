# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in `@pbuilder/sdk`, please report it privately
via [GitHub Security Advisories](https://github.com/Project-Builder-Schematics/project-builder-sdk/security/advisories/new)
rather than opening a public issue. We aim to acknowledge reports within 5 business days.

Please include: affected version, a description of the issue, and a minimal reproduction
if possible.

## Trust model — read before importing dialects or op-packs

`@pbuilder/sdk` is an extensible authoring layer: the community publishes **dialects** and
**op-packs** as separate npm packages that you import into your schematics.

Importing any dialect or op-pack runs its code with full process privilege; there is no sandbox or signing in v1; vet before importing.

A dialect you import can read your environment, your filesystem, and the network exactly as your own code can.

Treat third-party dialects and op-packs the way you treat any other npm dependency that runs at
author time:

- **Vet the source** before importing — prefer packages whose code you have read or whose authors
  you trust.
- **Pin versions** and review diffs on upgrade.
- **Scope blast radius** — run untrusted schematics in a throwaway environment, not against
  credentials or repositories you cannot afford to expose.

This is an explicit, documented trade-off: the extensibility model favours a low barrier for
community contribution. Sandboxing and signing are tracked as future work; until they ship, the
trust boundary is **you, at import time**.

## `.modify()` and the conformance kit

The `.modify(ast => …)` escape hatch executes dialect and schematic code with full process privilege — it is NOT a sandbox. The serialization seam (only plain strings cross to the engine) is the ONLY containment guarantee; it bounds what data leaves a run, not what code may do while running. Vet any dialect or op-pack before importing it.

Passing the conformance kit (`@pbuilder/sdk/conformance`) is not a security attestation: it proves a dialect keeps the seam serializable and its ops faithful, not that the dialect's `.modify()` code is safe to execute.

## Package-local read trust posture (v1)

`create({ templateFile })`, `copyIn`, and `scaffold` each read a source that lives on the
factory package's own disk. The full trust posture (ADR-0077, `package-source-io-hygiene`
REQ-PSH-05), stated plainly rather than summarized:

The SDK provides no containment guarantee for package-local reads.

Path-carrying directives are re-checked by the engine at apply time (`by-reference-copy-wire` REQ-BRC-02, verified live).

Owner-verified 2026-07-29: the engine rejects apply-time modifications that route through a symlink.

By-value and inline content crossing the wire have no boundary control on either side — this is the v1 trusted-author model.

Symlink escape from `packageDir` is an accepted, documented residual (`package-source-io-hygiene` REQ-PSH-04).

Windows UNC and drive-relative source forms are not screened SDK-side — that is the engine's obligation (`by-reference-copy-wire` REQ-BRC-08).

See [ADR-0077](./openspec/decisions/0077-relocate-containment-boundary-out-of-sdk.md) and
[Authoring verbs](./docs/authoring-verbs.md#package-local-reads-the-boundary) for the full
context and the per-path-class boundary table.

## Runner integrity manifest

Published releases carry `dist/runner-manifest.json`, which lets the engine check that the runner's pre-factory bootstrap — 23 files plus `package.json` — is the code we published. It is not a sandbox, not a signature, and not a check on the dialect, op-pack, or `node_modules` code that loads afterwards; those remain governed by the trust model above. See [docs/runner-integrity-invariants.md](./docs/runner-integrity-invariants.md).

## Publish pipeline

Releases are published from the protected `main` branch only, via npm trusted publishing (OIDC)
with provenance attestation. No long-lived publish token exists in CI. Fork pull requests cannot
reach the publish workflow and are never granted publish credentials.
