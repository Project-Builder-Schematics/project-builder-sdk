# Publish Pipeline Hardening Specification

**Spec version**: V3
**Status**: signed (owner, 2026-07-12 — V3; placeholder deferred per steward CQ2)
**Change**: `stage-6-release-shape`

## Purpose

`publish.yml` carries `id-token: write` with no repo-owner guard and pins only
`oven-sh/setup-bun` — a fork with its own `main` can reach the OIDC-token-minting step
today (verified live). This domain hardens the EXISTING publish surface and never fires
it live.

**Out of scope (scope fences)**: NO registry write of any kind happens in this change —
"nothing fires" is literal. The npm placeholder publish (name reservation for
`@pbuilder/sdk`), formerly the one deliberate exception, is DEFERRED to the
public-package plan by owner ruling at steward foresight (2026-07-12, CQ2 — the
`@pbuilder` scope is already owner-controlled, so a placeholder buys no security today).
No GitHub Packages channel either (→ public-package plan, own /plan cycle, mentioned here
only as a forward pointer).

## Requirements

### REQ-PPH-01: W3 Repo-Owner Guard

The `publish.yml` job carrying `id-token: write` MUST be gated by a repo-owner condition
(`if: github.repository == '<owner>/<repo>'`). Rationale: a fork's push runs under the
FORK's own OIDC identity, which npm trusted publishing does not trust for `@pbuilder/sdk`,
and `--dry-run` already ships nothing — this guard is defense-in-depth stopping OIDC token
minting inside forks, not a live-publish hole.

#### Scenario REQ-PPH-01.1: Guard present and correctly scoped

- GIVEN `publish.yml`'s job definition
- WHEN the job carrying `id-token: write` is inspected
- THEN it has an `if:` condition comparing `github.repository` to the configured owner/repo

#### Scenario REQ-PPH-01.2 [red-proof]: Guard absence is detected

- GIVEN a simulated `publish.yml` job definition with `id-token: write` and no `if:` guard
- WHEN the guard-shape check runs against it
- THEN it fails, naming the missing guard

#### Scenario REQ-PPH-01.3: Trigger set is push-to-main only

- GIVEN `publish.yml`'s trigger (`on:`) block
- WHEN inspected
- THEN it contains ONLY `push: branches: [main]` — no `pull_request`,
  `pull_request_target`, or `workflow_dispatch` trigger (any of these would re-open a
  fork or manual path to the privileged job the repo-owner guard defends)

### REQ-PPH-02: SHA-Pinned Actions in `publish.yml`

Every `uses:` step in `publish.yml` MUST be pinned to a commit SHA — `actions/checkout` and
`actions/setup-node` join the already-pinned `oven-sh/setup-bun`.

#### Scenario REQ-PPH-02.1: Every `uses:` line is SHA-pinned

- GIVEN every `uses:` line in `publish.yml`
- WHEN each is inspected
- THEN each pins a 40-character commit SHA, not a floating tag (e.g. `@v4`)

#### Scenario REQ-PPH-02.2 [red-proof]: Today's unpinned actions fail this assertion

- GIVEN the CURRENT (pre-implementation) `publish.yml`, which pins only `setup-bun`
- WHEN the SHA-pin check runs against it
- THEN it fails on `actions/checkout@v4` and `actions/setup-node@v4`

### REQ-PPH-03: `--dry-run` Flag Pinned

The `npm publish` step in `publish.yml` MUST retain `--dry-run` as long as no live-publish
gate has been ratified — the structural form of "the publish button stays untouched."

#### Scenario REQ-PPH-03.1: `--dry-run` present in the publish command

- GIVEN `publish.yml`'s `npm publish` step
- WHEN its command line is inspected
- THEN `--dry-run` is present

#### Scenario REQ-PPH-03.2 [red-proof]: A simulated removal is caught

- GIVEN a simulated `npm publish` command line with `--dry-run` stripped
- WHEN the guard check runs against it
- THEN it fails, naming the missing flag

### REQ-PPH-04: Prebuild Clean

A `prebuild` script MUST remove `dist/` before `build` runs, so a local build cannot ship
stale artifacts.

#### Scenario REQ-PPH-04.1: `prebuild` removes `dist/` before `tsc` runs

- GIVEN `package.json#scripts`
- WHEN `bun run build` is invoked (which runs `prebuild` first per npm lifecycle convention)
- THEN any pre-existing `dist/` content is removed before the `tsc` step begins

### REQ-PPH-05: `declarationMap` Disabled

`tsconfig.build.json#compilerOptions.declarationMap` MUST be `false`.

#### Scenario REQ-PPH-05.1: `declarationMap` is `false`

- GIVEN `tsconfig.build.json`
- WHEN `compilerOptions.declarationMap` is read
- THEN it is `false`

#### Scenario REQ-PPH-05.2: No `.d.ts.map` file ships in the tarball

- GIVEN a fresh build and `bun pm pack --dry-run`'s file listing
- WHEN the listing is scanned for `.d.ts.map` extensions
- THEN none are present

### REQ-PPH-06: Sequencing — Prebuild-Clean and `declarationMap` Land Before FIT-14 Baseline Regen

The `prebuild` clean script and `declarationMap: false` MUST land, and be reflected in a
fresh build, BEFORE `test/fitness/pkg-surface-baseline.json` is regenerated for this
change. Regenerating the baseline against a stale build (declarationMap still `true`, or
leftover `.d.ts.map` files from a dirty `dist/`) would poison the committed baseline with
entries the final shape does not have — the current baseline has 34 such entries today.

#### Scenario REQ-PPH-06.1: Regenerated baseline contains zero `.d.ts.map` entries

- GIVEN the FIT-14 baseline regenerated for this change
- WHEN its `tarball` entry list is scanned for `.d.ts.map`
- THEN zero matches are found

### REQ-PPH-07: Placeholder Publish Content Fence — DEFERRED

DEFERRED to the public-package plan by owner ruling at steward foresight, 2026-07-12 —
see pending-changes "Public-package plan" row; the V2 text travels with that plan.

~~#### Scenario REQ-PPH-07.1: Stub package.json has no exports map and no dist payload~~

~~#### Scenario REQ-PPH-07.2: Stub's `main` entry does not resolve to real code~~

~~#### Scenario REQ-PPH-07.3: `publish.yml` never fires the placeholder automatically~~

~~#### Scenario REQ-PPH-07.4: Deprecation is a documented step in the owner runbook~~

~~#### Scenario REQ-PPH-07.5: Stub has no lifecycle scripts~~

~~#### Scenario REQ-PPH-07.6: Stub has zero dependencies~~

~~#### Scenario REQ-PPH-07.7: Stub ships a "NOT A RELEASE" README warning~~

~~#### Scenario REQ-PPH-07.8: Stub manifest is committed in-repo and auditable~~

~~#### Scenario REQ-PPH-07.9 [red-proof]: CI inertness test asserts the full stub contract~~

~~#### Scenario REQ-PPH-07.10 [red-proof]: Dry-run rehearsal success is not proof of inertness~~

### REQ-PPH-08: Placeholder Semver Floor Constraint — DEFERRED

DEFERRED to the public-package plan by owner ruling at steward foresight, 2026-07-12 —
see pending-changes "Public-package plan" row; the V2 text travels with that plan.

~~#### Scenario REQ-PPH-08.1: Chosen placeholder version sorts above `0.0.0-dev.*`~~

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| deployment (`.github/workflows/publish.yml`, OIDC) | REQ-PPH-01, REQ-PPH-02, REQ-PPH-03 | Yes |
| security (supply-chain — published package surface) | REQ-PPH-07, REQ-PPH-08 (DEFERRED — see public-package plan) | Yes |

## Open Flags for Design

- ~~Exact placeholder version value (must satisfy REQ-PPH-08's sort-above constraint) — ADR.~~ Moot — REQ-PPH-08 deferred.
- SHA-pin scope for `ci.yml` (open question from explore, no publish credentials there) —
  design decides whether to extend REQ-PPH-02's pattern to `ci.yml` or leave it out of scope.
- Workflow-guard assertions (REQ-PPH-01, REQ-PPH-03) should be YAML-parsed or job-anchored
  rather than string/regex matched — a commented-out `if:` line or a stray substring match
  would let a mutation survive a naive text check.
- Consider scoping `id-token: write` to the publish job rather than declaring it at
  workflow level (least privilege) — design decision, not yet a REQ.
