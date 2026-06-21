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

**Importing a dialect or op-pack executes its code with the full privileges of your process.**
There is no sandbox, no capability isolation, and no package signing in v1. A dialect you import
can read your environment, your filesystem, and the network exactly as your own code can.

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

## Publish pipeline

Releases are published from the protected `main` branch only, via npm trusted publishing (OIDC)
with provenance attestation. No long-lived publish token exists in CI. Fork pull requests cannot
reach the publish workflow and are never granted publish credentials.
