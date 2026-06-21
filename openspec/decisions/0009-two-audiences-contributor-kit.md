# ADR-0009: Two audiences — the contributor contract boundary (`@pbuilder/sdk-kit`)

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Amends: ADR-0002 (`core` "internal kit" → an internal boundary designed for later publication as the
  contributor surface).
- Builds on: roadmap §4 (DX), §7 (dialect contract frozen pre-publish), §10 (monorepo deferred to the
  2nd dialect).

## Context

The SDK has **two first-class audiences with distinct surfaces**: (A) schematic **authors** who USE it
to write schematics — ergonomics is paramount; (B) dialect **contributors** — many people will come to
add AST libraries or pre-configured op-sets — extensibility is paramount. The surfaces must not bleed.
ADR-0002's `core` was "internal"; for contributors it must become a real, versioned contract.

## Decision

- **Two surfaces.** AUTHOR = `@pbuilder/sdk/commons` + `@pbuilder/sdk/<dialect>` (verbs, typed options,
  namespace import). CONTRIBUTOR = the **kit** (`EngineClient`, `Session`, `DirectiveFactory`,
  `BaseFileHandle`, `defineDialect`, `defineOpPack`).
- **Designed now, extracted later** (decided): v1 ships as a **single package** with the kit as an
  internal module behind a **clean, extraction-ready boundary**. The kit is **extracted and published
  as `@pbuilder/sdk-kit`** when the first external/community dialect arrives — honoring the roadmap §10
  monorepo deferral while keeping the boundary honest from day one.
- **Naming:** the published contributor package is **`@pbuilder/sdk-kit`** (not `-core` — "core" invites
  authors to reach in; "kit" announces "you build with this"). Hooks are **`parse` / `print`** (not
  `serialize`, which collides with wire serialization and stays reserved for it).
- **Versioning (on publication):** `@pbuilder/sdk-kit` carries its **own semver**, independent of the
  author SDK. A dialect/op-pack declares compatibility via a `peerDependencies` range **and** a
  `kitContract` integer (the kit-contract major it was built against), checked at load for a
  named-audience error.
- **Bleed-prevention:** the author `package.json#exports` exposes only `./commons` and `./<dialect>` —
  no `/core`, no `/internal`; a fitness function asserts no public author subpath re-exports a kit
  symbol.

## Consequences

- The monorepo trigger stays deferred (roadmap §10), but the kit boundary is clean from v1 so
  extraction is mechanical.
- The kit ships `0.x` (semver-exempt) until the first real dialect (T-M2) validates the contract;
  public-locked at L1. Per roadmap §7 the contract shape is validated on paper against **two** dialects
  (ts-morph + postcss) before freeze.
- **Security:** a community **op-pack carries the same privilege as a full dialect** (it holds the live
  AST and can run arbitrary JS via `.raw`) and is *more* numerous / less-vetted — treat dialects and
  op-packs as **one trust unit**. v1 is **explicit-trust** and MUST say so plainly in `SECURITY.md`
  (importing any dialect/op-pack runs its code with full process privilege; no sandbox/signing in v1).
  `@pbuilder/sdk-kit` is the ecosystem-wide blast-radius target → provenance/OIDC publish + ~zero
  runtime deps. Do NOT foreclose the deferred trust model: keep a single `Session.emit` chokepoint,
  `EngineClient` as the sole read seam for third-party code, and package-identity preserved through
  op-pack composition.
