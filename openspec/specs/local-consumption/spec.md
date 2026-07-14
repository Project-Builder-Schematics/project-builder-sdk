# Local Consumption Specification

**Spec version**: V2
**Status**: signed (owner, 2026-07-12 — V2)
**Change**: `stage-6-release-shape`

## Purpose

The near-term consumer of `@pbuilder/sdk` is local — `bun link` (the owner's everyday loop)
and/or a packed tarball — not a live npm publish. This domain guarantees `bun link`
resolution parity with the existing packed-tarball leg (`test/e2e/installed-consumer.e2e.test.ts`,
ADR-0036) so both local paths give the same reachability and behavioural guarantees before
either is documented as the install story.

**Out of scope (scope fence)**: no live npm publish of the product package; no GitHub
Packages channel (→ public-package plan). Both fences apply here because "local
consumption" could otherwise be read as implying either.

**Mechanism note (plan-verify iter 1, G-1)**: the triage scope line "6.1 … FIT-09 extended"
is discharged as follows — FIT-09 remains the exports-SHAPE guard (its exact 5-entry
assertion, unchanged per REQ-FPS-06's no-restructuring fence); LIVE resolution is proven by
the installed-consumer e2e legs (REQ-LC-01/LC-03), and the shipped-surface half by the
FIT-14 baseline (REQ-PPH-06/FPS-06). FIT-09 itself gains no new assertions in this change.

## Requirements

### REQ-LC-01: Bun-Link Subpath Resolution Parity

A `bun link`-installed consumer MUST resolve every public subpath (`.`, `./commons`,
`./conformance`, `./testing`, `./typescript`) by package name, matching the packed-tarball
leg's guarantee, and `@pbuilder/sdk/core` MUST stay unresolvable.

#### Scenario REQ-LC-01.1: All five subpaths resolve via bun link

- GIVEN a sibling consumer with `@pbuilder/sdk` installed via `bun link`
- WHEN it imports `.`, `./commons`, `./conformance`, `./testing`, and `./typescript` by package name
- THEN all five resolve successfully

#### Scenario REQ-LC-01.2: `./core` stays unresolvable via bun link

- GIVEN the same `bun link`-installed consumer
- WHEN it imports `@pbuilder/sdk/core`
- THEN the import fails to resolve

### REQ-LC-02: Bun-Link Founding-Bug Scenario Parity

The `bun link` e2e scenario set MUST assert the SAME founding-bug behaviours the tarball
leg already proves — a write-only factory's directives commit to a golden tree, and an
all-or-nothing rejection surfaces an author-assertable `AuthoringError` — count-parity with
the tarball leg's scenario set, never a reduced smoke test.

#### Scenario REQ-LC-02.1: Write-only commit reproduced via bun link

- GIVEN a factory that only calls `create()` and never reads
- WHEN it runs through the `bun link`-installed `./testing` entry via `runFactoryForTest`
- THEN the committed tree contains exactly the created file, byte-exact

#### Scenario REQ-LC-02.2: All-or-nothing rejection reproduced via bun link

- GIVEN a factory whose `create()` collides with a seeded path
- WHEN it runs through the `bun link`-installed entry
- THEN the result's `error` is an `AuthoringError` instance with `reason: "path-collision"` and the committed tree is empty

#### Scenario REQ-LC-02.3: Scenario-set count parity

- GIVEN the `bun link` leg's scenario count and the tarball leg's scenario count in `test/e2e/installed-consumer.e2e.test.ts`
- WHEN they are compared
- THEN the `bun link` leg asserts the same set — five-subpath resolution, `/core` unreachable, write-only commit, all-or-nothing rejection — not a subset

### REQ-LC-03: Tarball Path Retained as Release-Shape Verification

The packed-tarball install path MUST remain the release-shape verification vehicle; adding
`bun link` is additive, never a replacement of the existing tarball scenarios. The
tarball leg's probe set is NOT frozen at today's set — it MUST be extended to also
resolve `./typescript`, alongside the existing five-subpath coverage, and future
extensions remain additive (V2: council ruling, closes a plan-verify gap left open in V1).

#### Scenario REQ-LC-03.1: Tarball scenarios remain green as the probe set extends

- GIVEN `test/e2e/installed-consumer.e2e.test.ts` after this change
- WHEN the pre-existing tarball-leg scenarios run alongside the extended probe set
- THEN the pre-existing scenarios pass with the same assertions they had before this
  change, AND the extended probe set additionally resolves `./typescript`

### REQ-LC-04: Bin Executability From Consumer Install

The `pbuilder-codegen` bin MUST be executable from a consumer install on BOTH legs — the
tarball-installed consumer's `node_modules/.bin` and the `bun link`-installed consumer —
generating types from a `schema.json`, proving the bin ships, its shebang works, and the
quickstart's codegen step is real.

#### Scenario REQ-LC-04.1: Bin runs from the tarball-installed consumer's `node_modules/.bin`

- GIVEN a tarball-installed consumer with a `schema.json` fixture
- WHEN `node_modules/.bin/pbuilder-codegen` is invoked against it
- THEN it generates the expected typed output file

#### Scenario REQ-LC-04.2: Bin runs from the `bun link`-installed consumer's `node_modules/.bin`

- GIVEN a `bun link`-installed consumer with a `schema.json` fixture
- WHEN `node_modules/.bin/pbuilder-codegen` is invoked against it
- THEN it generates the expected typed output file

#### Scenario REQ-LC-04.3 [red-proof]: A missing bin or broken shebang is caught

- GIVEN a simulated consumer install where the bin entry is absent from
  `node_modules/.bin`, or its shebang line is malformed
- WHEN the bin-executability check runs against it
- THEN it fails, naming the missing bin or broken shebang

### REQ-LC-05: Dry-Run Invocation Parity Across Both Legs

BOTH the `bun link` and tarball legs MUST INVOKE `dryRun()` through the installed/linked
`./commons` entry and assert a non-empty returned plan — key-presence checks on the
`./commons` export are too weak; the guarantee is that calling the function actually
works end-to-end through the installed package boundary.

#### Scenario REQ-LC-05.1: `bun link` leg invokes `dryRun()` via `./commons` with a non-empty plan

- GIVEN a `bun link`-installed consumer running a factory through `./commons`
- WHEN `dryRun()` is called before any directive is emitted
- THEN it returns a non-empty `DryRunEntry[]` plan

#### Scenario REQ-LC-05.2: Tarball leg invokes `dryRun()` via `./commons` with a non-empty plan

- GIVEN a tarball-installed consumer running a factory through `./commons`
- WHEN `dryRun()` is called before any directive is emitted
- THEN it returns a non-empty `DryRunEntry[]` plan

#### Scenario REQ-LC-05.3 [red-proof]: Key-presence-only assertion is insufficient

- GIVEN a simulated check that only asserts `dryRun` is a key present on the `./commons`
  module namespace, without calling it
- WHEN compared against this requirement
- THEN it fails to satisfy REQ-LC-05 — the requirement demands invocation with a
  non-empty-plan assertion, not mere key presence

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (supply-chain — installed-consumer vantage) | REQ-LC-01, REQ-LC-02, REQ-LC-04, REQ-LC-05 | Yes |

## Open Flags for Design

- `bun link` auto-build via a `prepare` script vs. a documented build-then-link ritual — no
  `prepare` script exists today (confirmed); design must pick one and the e2e scenario
  reflects whichever ritual is chosen.
- Link-leg cleanup needs `bun unlink` in `afterAll` plus global-link-store hygiene — the
  `bun link` leg's isolation invariant differs from the tarball leg's lockfile-based check
  and design must not reuse the tarball leg's teardown as-is.
- This domain's REQs prove the exports CONTRACT reachable through the installed/linked
  package boundary only — they never claim to prove files-filtering or tarball-surface
  correctness (that is `factory-package-shape`'s domain, esp. REQ-FPS-06/07); verified no
  REQ in this file overclaims that scope — spec wording must keep it that way.
