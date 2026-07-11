# ADR-0036: Installed-consumer-vantage e2e lifecycle

- Status: Proposed
- Date: 2026-07-11
- Change: `stage-4b-testing-harness` (S-000 spike, elaborated S-004)
- Builds on: ADR-0033 (third audience `author-testing`), ADR-0034 (`./testing` containment)

## Context

The owner's outcome-proof (REQ-TES-06) requires proving reachability from a REAL installed
consumer's own vantage — exercising the package's `exports` map, which a relative
`dist`-path import never does. There is no repo precedent for a pack→install→import-by-name
test lifecycle.

## Decision

`ensureTscBuild()` (shared build fixture, §4.6a) → `bun pm pack` into a scratch dir
`.tmp-testing-e2e/` at the repo root (FIT-03's `.tmp-`-prefix idiom) → the scratch dir gets
its OWN `package.json` declaring `"@pbuilder/sdk": "file:<abs tarball path>"` →
`bun install --ignore-scripts`, run with `BUN_CONFIG_REGISTRY=http://127.0.0.1:9`
(non-routable — any accidental network dependence fails LOUDLY instead of silently fetching,
SEC-m2) → a consumer script run FROM the scratch dir imports the package's public subpaths
BY NAME (never a relative `dist` path). Because the scratch install runs with `cwd` set to
the scratch dir, it gets an isolated lockfile — the repo's own lockfile is asserted
byte-identical (hash-unchanged) before and after the install. The mechanism is offline-safe:
the SDK ships zero runtime dependencies (FIT-14), so only the local tarball ever installs.
The test runs serial; `afterAll` unconditionally `rm -rf`s the scratch dir (the tarball is
packed INTO it, so one removal covers both).

**S-000 spike-first**: the walking skeleton proves the mechanic itself — pack → install →
import-by-name resolves ONE symbol (`defineFactory` via `@pbuilder/sdk/testing`) — before
the full behavioural scenario suite (both `./commons` and `./testing` resolving, `./core`
rejecting, the founding-bug write/rejection proofs, REQ-TES-02/06) layers on in S-004.

## Consequences

- (+) The only mechanic in this repo that proves installed-consumer reachability; subsumes
  pending row W1's pack→install→resolution mechanic.
- (−) The heaviest single test in the suite (a full build + pack + install cycle) —
  mitigated by the shared build fixture (§4.6a) so no other test re-triggers its own build.
- (→) Closes the founding-bug loop at the PUBLISHED vantage once S-004 lands the write-only
  and all-or-nothing-rejection scenarios through this same lifecycle.

## Alternatives Considered

- **Relative `import("dist/testing/index.js")`** (explore approach C1) — rejected: never
  exercises the `exports` map, which is the exact gap the owner's amendment (third audience,
  `./testing` subpath) targets. A relative import would pass even if the `exports` entry
  were missing or malformed.
