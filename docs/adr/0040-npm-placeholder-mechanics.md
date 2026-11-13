# ADR-0040: npm placeholder mechanics — inert stub, `0.0.1` floor, manual publish-then-deprecate

- Status: Deferred (owner ruling at steward foresight, 2026-07-12)
- Date: 2026-07-12
- Change: `stage-6-release-shape`
- Relates to: REQ-PPH-07, REQ-PPH-08; builds on ADR-0034 (ship-unmapped containment)

**Deferral note**: this decision's content travels to the future public-package plan (steward CQ2
— the `@pbuilder` scope is already owner-controlled, so an inert placeholder buys no security
today); the reasoning below (the `0.0.1` semver floor, the inertness contract) is preserved
in-file for that plan to consume, not deleted.

## Context

Stage 6 delivers release-READINESS, not a release — nothing publishes the product. The one
deliberate exception is reserving the `@pbuilder/sdk` name inside the owner's already-active
`@pbuilder` npm scope, so the canonical identity cannot be squatted before the L1-readiness gate.
The reservation must ship ZERO product code and execute nothing on install (a name-reservation stub
is a classic supply-chain footgun if it carries lifecycle scripts or a resolving `main`). Two exact
values need pinning: WHERE the manifest lives (auditable, committed) and WHAT version it takes —
`publish.yml`'s dry-run scheme implies `0.0.0-dev.<sha>` prereleases could exist on the `dev` tag,
and npm versions are immutable, so the placeholder must sort ABOVE them (REQ-PPH-08). `0.0.0` itself
is disqualified: the root `package.json` already carries `version: "0.0.0"`, so publishing the
placeholder at that exact identity collides two artifacts on one version string, and every future
`0.0.0-dev.<sha>` dev build would become semver-a-prerelease-of-an-already-released-version — a
straight semver inversion (council-ruled 2-0, evidence-based).

## Decision

- **Manifest**: committed at `tools/npm-placeholder/package.json` — `{ name: "@pbuilder/sdk",
  version: "0.0.1", license: "MIT", private: false, files: ["README.md"] }`. NO `exports`, NO
  `scripts` (no `preinstall`/`install`/`postinstall`/`prepare`), NO `dependencies` of any kind,
  and `main` absent (or a one-line throwing shim). It ships only `package.json` + a README stating
  "NOT A RELEASE — name reservation" and linking this repo. `RUNBOOK.md` sits beside it (owner
  instructions) and is EXCLUDED from the pack by `files: ["README.md"]`.
- **Version floor = `0.0.1`, non-prerelease, published to `latest`**: a patch bump sorts above
  every `0.0.0-dev.<sha>` prerelease under semver §11 (any release outranks a prerelease of the
  same base, and `0.0.1 > 0.0.0` outright regardless) — but the robustness comes from the PATCH
  bump, not from a fragile release-vs-prerelease label comparison against `0.0.0`. It is the
  minimal value that (a) does not collide with the root `package.json`'s own `0.0.0` identity and
  (b) sorts above the entire `0.0.0-dev.*` line without relying on prerelease-label semantics. The
  `dev`-tag prerelease scheme stays `0.0.0-dev.<sha>` — those strings differ from both `0.0.0` and
  `0.0.1`, so no immutability collision. The real release train starts at `0.1.0`+ per the
  public-package plan, so consuming `0.0.1` costs nothing.
- **Runbook**: `tools/npm-placeholder/RUNBOOK.md` documents a MANUAL, out-of-band owner publish
  (`cd tools/npm-placeholder && npm publish --access public`) followed IMMEDIATELY by
  `npm deprecate @pbuilder/sdk@0.0.1 "Placeholder — not yet released; do not depend on this."`
  (REQ-PPH-07.4). `publish.yml` never fires it (REQ-PPH-07.3).
- **Guard**: `fit-22` asserts the full inertness contract against the committed manifest, including
  a `bun pm pack --dry-run` listing free of any `dist/**`/product file, and the semver-floor sort.

## Consequences

- (+) The name is reserved with an auditable, inert, install-safe artifact; a passing publish dry-run
  is explicitly NOT accepted as proof of inertness (REQ-PPH-07.10) — the structural assertions run
  independently.
- (−) `0.0.1` is permanently consumed on npm; the immediate deprecation means the npm page and every
  install of the reserved name warn (accepted — that is the point).
- (→) When the public-package plan runs, the real first release publishes at `≥ 0.1.0` over a
  reserved, owner-controlled name with no squatting risk.

## Alternatives Considered

- **`0.0.0`** — rejected (council 2-0, evidence-ruled): the root `package.json` is ALREADY `0.0.0`,
  so publishing the placeholder at that exact version collides two distinct artifacts on one
  identity string. Worse, it inverts semver for every future dev build: `publish.yml` stamps
  `0.0.0-dev.<sha>` on the `dev` tag, and a prerelease is defined RELATIVE TO its release version —
  publishing `0.0.0` as a release means every `0.0.0-dev.<sha>` is thereafter a prerelease of an
  ALREADY-RELEASED version, which is backwards (prereleases precede their release, they don't
  follow it). `0.0.1` avoids both problems with a plain, robust patch bump.
- **A high prerelease floor (e.g. `0.0.0-reserve`)** — rejected: any prerelease sorts BELOW the
  `0.0.0`/`0.0.1` release line and is fragile against future dev-scheme changes; a clean release
  version is unambiguous and minimal.
- **Deprecate-later / never** (V1's original stance) — rejected at spec V2 (security+architect
  convergence): an undeprecated reserved name reads as a shipped release to tooling and humans;
  immediate `npm deprecate` makes the "not a release" status machine- and human-visible.
- **Uncommitted, publish-time-only manifest** — rejected: not auditable; REQ-PPH-07.8 requires the
  published bytes to match a version-controlled manifest.
