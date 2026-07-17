# Delta for local-consumption

**Spec version**: V2
**Status**: signed (owner, 2026-07-16)
**Change**: `react-dialect`

(V2: V1's Scope Fence question — should the tarball leg also gain a `./react` probe? — is
RESOLVED per orchestrator ruling, conditional on on-disk precedent. Precedent VERIFIED:
`test/e2e/installed-consumer.e2e.test.ts` lines 237-285 probe `./typescript` on the tarball
leg (REQ-LC-03.1's own assertion, added when that subpath shipped), and lines 338-353 on the
bun-link leg. The every-subpath-both-legs pattern holds, so REQ-LC-03 is now MODIFIED to
extend its probe set with `./react` — the minimal-mechanical consistency edit, not scope
creep. The V1 Scope Fence section is removed accordingly.)

## MODIFIED Requirements

### REQ-LC-01: Bun-Link Subpath Resolution Parity

A `bun link`-installed consumer MUST resolve every public subpath (`.`, `./commons`,
`./conformance`, `./testing`, `./typescript`, `./react`) by package name, matching the
packed-tarball leg's guarantee, and `@pbuilder/sdk/core` MUST stay unresolvable.

(Previously: the enumerated set was five subpaths — `.`, `./commons`, `./conformance`,
`./testing`, `./typescript`. `react-dialect` adds `./react` as the 6th public subpath;
`@pbuilder/sdk/core` stays unresolvable, unchanged.)

#### Scenario REQ-LC-01.1: All six subpaths resolve via bun link

- GIVEN a sibling consumer with `@pbuilder/sdk` installed via `bun link`
- WHEN it imports `.`, `./commons`, `./conformance`, `./testing`, `./typescript`, and
  `./react` by package name
- THEN all six resolve successfully

(Previously: asserted five subpaths; `./react` was absent from the set.)

#### Scenario REQ-LC-01.2: `./core` stays unresolvable via bun link

- GIVEN the same `bun link`-installed consumer
- WHEN it imports `@pbuilder/sdk/core`
- THEN the import fails to resolve

(Unchanged.)

### REQ-LC-02: Bun-Link Founding-Bug Scenario Parity

The `bun link` e2e scenario set MUST assert the SAME founding-bug behaviours the tarball
leg already proves — a write-only factory's directives commit to a golden tree, and an
all-or-nothing rejection surfaces an author-assertable `AuthoringError` — count-parity with
the tarball leg's scenario set, never a reduced smoke test.

(Previously: unchanged body — this requirement's own MODIFIED status is triggered solely by
its .3 scenario's cross-reference to REQ-LC-01's subpath count, corrected below to stay
internally consistent with REQ-LC-01's growth to six.)

#### Scenario REQ-LC-02.1: Write-only commit reproduced via bun link

- GIVEN a factory that only calls `create()` and never reads
- WHEN it runs through the `bun link`-installed `./testing` entry via `runFactoryForTest`
- THEN the committed tree contains exactly the created file, byte-exact

(Unchanged.)

#### Scenario REQ-LC-02.2: All-or-nothing rejection reproduced via bun link

- GIVEN a factory whose `create()` collides with a seeded path
- WHEN it runs through the `bun link`-installed entry
- THEN the result's `error` is an `AuthoringError` instance with `reason: "path-collision"`
  and the committed tree is empty

(Unchanged.)

#### Scenario REQ-LC-02.3: Scenario-set count parity

- GIVEN the `bun link` leg's scenario count and the tarball leg's scenario count in
  `test/e2e/installed-consumer.e2e.test.ts`
- WHEN they are compared
- THEN the `bun link` leg asserts the same set — six-subpath resolution, `/core`
  unreachable, write-only commit, all-or-nothing rejection — not a subset

(Previously: read "five-subpath resolution" — corrected to "six-subpath resolution" to stay
consistent with REQ-LC-01's growth. No new behaviour; this scenario's own count follows
REQ-LC-01's enumerated set, whatever size it is.)

### REQ-LC-03: Tarball Path Retained as Release-Shape Verification

The packed-tarball install path MUST remain the release-shape verification vehicle; adding
`bun link` is additive, never a replacement of the existing tarball scenarios. The
tarball leg's probe set is NOT frozen at today's set — it MUST be extended to also
resolve `./react`, alongside the existing coverage (which already extends to
`./typescript`), and future extensions remain additive.

(Previously: the additive-extension clause named `./typescript` as the probe the set "MUST be
extended to also resolve" — that extension shipped (verified on disk:
`test/e2e/installed-consumer.e2e.test.ts:260,284`). V2 (this change): the same
every-subpath-both-legs pattern extends the probe set with `./react`; the requirement's
retention-and-additivity core is unchanged.)

#### Scenario REQ-LC-03.1: Tarball scenarios remain green as the probe set extends

- GIVEN `test/e2e/installed-consumer.e2e.test.ts` after this change
- WHEN the pre-existing tarball-leg scenarios run alongside the extended probe set
- THEN the pre-existing scenarios pass with the same assertions they had before this
  change, AND the extended probe set additionally resolves `./react`

(Previously: the "additionally resolves" target was `./typescript`; now `./react` — the
scenario's shape is identical, its target advances with each shipped subpath.)

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (supply-chain — installed-consumer vantage) | REQ-LC-01, REQ-LC-02, REQ-LC-03, REQ-LC-04, REQ-LC-05 | Yes |

## Downstream Mechanical Consequences (non-REQ, flagged for design/slice)

- FIT-09 (`test/fitness/fit-09-pkg-exports-resolution.test.ts`)'s exact-list assertion
  (`[".", "./commons", "./conformance", "./testing", "./typescript"]`) and FIT-14
  (`test/fitness/pkg-surface-baseline.json`)'s committed `exports`/tarball baseline both need
  the `./react` entry added. These are mechanical baseline regenerations flowing from
  REQ-LC-01's growth above — no new REQ-ID is needed; FIT-09/FIT-14 already exist to catch any
  drift between the committed baseline and the shipped surface.
