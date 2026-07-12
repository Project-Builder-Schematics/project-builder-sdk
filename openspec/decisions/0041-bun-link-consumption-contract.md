# ADR-0041: bun-link consumption contract — documented build-then-link ritual, no `prepare` script

- Status: Proposed (draft)
- Date: 2026-07-12
- Change: `stage-6-release-shape`
- Relates to: REQ-LC-01..05, REQ-AOD-02; ADR-0036 (packed-tarball e2e lifecycle)

## Context

`bun link` is the owner's everyday local-consumption loop and the canonical documented install path
until the L1-readiness gate. It resolves against the package's BUILT `dist/`, not `src/` — so
`dist/` must exist and be current before a consumer links. Two ways to guarantee that: (a) a
`prepare` lifecycle script that auto-builds on install/link, or (b) a documented build-then-link
ritual with an explicit `bun run build` step. No `prepare` script exists today (confirmed). The
choice sets both the documented ritual (REQ-AOD-02) and the shape of the `bun link` e2e leg.

## Decision

**Documented build-then-link ritual — no `prepare` script — PLUS an explicit convenience script.**
The quickstart and the e2e both do `bun run build` explicitly, THEN `bun link` (producer) /
`bun link @pbuilder/sdk` (consumer). The link leg carries a **dist-must-be-built precondition** (it
reuses `ensureTscBuild()` before linking) and cleans up with `bun unlink` in `afterAll`, honoring the
global-link-store hygiene the tarball leg's lockfile-based teardown does not cover (its isolation
invariant differs — the spec flags this).

`package.json#scripts` gains `"link:sdk": "bun run build && bun link"` — an explicit, opt-in npm
script the author TYPES, not a lifecycle hook the package manager runs automatically. Nothing
executes at install time; `bun link:sdk` is exactly the two-step ritual collapsed to one documented
command. The quickstart teaches `bun run link:sdk` as the one-liner, with the two-step ritual shown
immediately after as what it expands to (so the author who copy-pastes the ritual by hand, or reads
it before running the script, sees the identical steps). The e2e's link leg exercises this SAME
script, not a hand-rolled build+link sequence — the DX shortcut and the CI proof are the same code
path.

**Owner ruling (2026-07-12)**: the architect dissented in favor of a `prepare` lifecycle script,
arguing an e2e cannot catch a human forgetting to build before linking by hand outside the tested
path. The owner ruled to keep the no-`prepare` decision (supply-chain posture unchanged) and instead
mitigate the dissent's concern with the `link:sdk` convenience script — it reduces the forget-to-build
failure mode to "the author didn't run one documented command," which the quickstart makes the
default recommended path rather than the two-step ritual.

## Consequences

- (+) No lifecycle script runs on `bun link`/install — consistent with the placeholder's own
  "installing executes nothing" contract (ADR-0040) and the two-realms supply-chain caution; a
  linked consumer never triggers a surprise build with the producer's full toolchain.
- (+) Deterministic across Bun versions — `bun link`'s handling of `prepare` is not guaranteed
  stable, and the explicit ritual does not depend on it.
- (+) The `link:sdk` script gives the common case a single documented command, cutting the
  forget-to-build failure to "didn't run the one script" while keeping install-time execution at zero.
- (−) The author must remember to rebuild after changing `src/` before the link reflects it — the
  quickstart states this explicitly; the e2e's `ensureTscBuild()` precondition encodes it. The
  `link:sdk` script does not cover re-linking after a later `src/` edit — only the initial link.
- (−) (architect dissent, mitigated not eliminated) a human running the two-step ritual by hand,
  bypassing `link:sdk`, can still forget to build first; no e2e can catch that manual path. The
  convenience script narrows but does not close this gap.
- (→) The e2e link leg and the tarball leg share the `test/support/scratch-consumer.ts` seam, so the
  two local paths are proven at parity (REQ-LC-02.3), never a reduced smoke test.

## Alternatives Considered

- **`prepare` auto-build** — rejected: DX-convenient but adds a lifecycle script to the main package
  exactly where the change is otherwise removing install-time surprise; couples every consumer
  install/link to a full build, and drifts `dist/` implicitly; Bun's `prepare`-on-link behaviour is
  version-inconsistent, making the guarantee unreliable.
- **`bun link` against `src/` directly** — rejected: `src/` is `.ts` behind subpath `exports` that
  resolve to `dist/*.js`; linking source would bypass the `exports` map the e2e exists to exercise.
