# Delta for Factory Package Shape

**Spec version**: V2
**Status**: signed (owner, 2026-07-12 — V2)
**Change**: `stage-6-release-shape` (MODIFIED from V5: stage-5-first-dialect, signed)

## ADDED Requirements

### REQ-FPS-06: `dist/core/**` Ships Documented, Not Stripped

The tarball's `dist/core/**` entries MUST continue to ship — `./testing`'s runtime import
of `../core/context.ts` requires them physically present — and this decision MUST be
documented at the package-shape surface: `dist/core/**` ships intentionally, and
`@pbuilder/sdk/core` remains unreachable via `package.json#exports` (the ADR-0009 boundary
stays advisory-by-convention, not enforced by tarball exclusion).

**Out of scope (scope fence)**: no `defineFactory` relocation this change (owner-ruled,
stays `./testing`) and no FIT-09/FIT-14 exports-guard restructuring — this requirement
extends the existing exact-list assertions only, per REQ-FPS-02's unchanged five-entry
exports map and single `ts-morph` dependency.

#### Scenario REQ-FPS-06.1: FIT-14 baseline continues to include `dist/core/**` entries

- GIVEN the FIT-14 baseline (`test/fitness/pkg-surface-baseline.json`) regenerated for this change
- WHEN its `tarball` entry list is inspected
- THEN `dist/core/**` entries are present, unchanged in kind from before this change (contents may reflect REQ-PPH-05's `declarationMap: false`)

#### Scenario REQ-FPS-06.2: Package-shape documentation states the document-not-strip rationale

- GIVEN this domain's documentation surface (README or a linked doc)
- WHEN inspected
- THEN it states `dist/core/**` ships intentionally because `./testing` needs it present at runtime, and that `./core` stays unreachable via `exports` regardless

### REQ-FPS-07: No-Secrets Tarball Assertion

The packed tarball (`bun pm pack --dry-run`'s file listing) MUST contain no `.env` files,
no `.npmrc`, no key material (e.g. `.pem`, `.key`), and no other credential-looking
filenames — asserted POSITIVELY by an explicit check, never merely assumed via a baseline
diff.

#### Scenario REQ-FPS-07.1: Tarball listing is positively scanned for secret-like files

- GIVEN a fresh build and `bun pm pack --dry-run`'s file listing
- WHEN the listing is scanned against a credential-filename pattern set (`.env*`,
  `.npmrc`, `*.pem`, `*.key`, and equivalents)
- THEN zero matches are found, and the check runs as an explicit positive assertion, not
  as an inference from the FIT-14 baseline diff

#### Scenario REQ-FPS-07.2 [red-proof]: A simulated tarball listing containing a secret file is caught

- GIVEN a simulated `bun pm pack --dry-run` listing that includes a `.env` file
- WHEN the no-secrets check runs against it
- THEN it fails, naming the offending file

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (supply-chain — tarball contents) | REQ-FPS-06, REQ-FPS-07 | Yes |
| public-api-stability (exports map, unchanged) | REQ-FPS-06 (references REQ-FPS-02) | Yes |

## Open Flags for Design

- The `document-not-strip` decision needs its own ADR per the proposal's Approach section
  (design must formalise it, sequenced after the graduation-decoupling ruling already made
  at explore/triage — `defineFactory` stays `./testing`, so no relocation blocks this ADR).
