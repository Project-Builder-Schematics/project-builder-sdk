# Contributing to @pbuilder/sdk

Thank you for your interest in contributing. This document covers how to set up the project, run the test suite, and submit changes.

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0

## Setup

```sh
git clone https://github.com/Project-Builder-Schematics/project-builder-sdk.git
cd project-builder-sdk
bun install
```

## Running tests

```sh
bun test                     # full suite
bun run typecheck            # strict typecheck (noEmit)
bun run typecheck:permissive-proof   # must exit non-zero — that is the pass signal
bun run build                # emit ESM + .d.ts to dist/
```

All four commands must pass before submitting a pull request. CI enforces them.

## Test pyramid

The suite mirrors an explicit four-layer pyramid — `test/pyramid/pyramid-codification.test.ts`
enforces this table structurally, so keep it in sync with the directories it names.

| Layer | Directory | Runs without engine? | Example test |
|---|---|---|---|
| unit | `test/golden-ir` | Yes | `test/golden-ir/golden-ir.test.ts` |
| fitness | `test/fitness` | Yes | `test/fitness/fit-08-no-kit-bleed.test.ts` |
| integration | `test/fake` | Yes | `test/fake/move-fail-closed.test.ts` |
| e2e | `test/e2e` | Yes | `test/e2e/author-to-tree.e2e.test.ts` |

Every layer runs against `ContractFake` (`test/support/contract-fake.ts`) — a real engine is
never required to exercise any of them.

The table lists each layer's canonical home; two additional directories belong to the
integration layer without being its canonical home: `test/skeleton` (cross-module and handle
behavior through `defineFactory`) and `test/types` (compile-time contract pins). CI's bare
`bun test` runs every directory regardless.

### Where does my change belong?

| Contribution type | Layer(s) | Home |
|---|---|---|
| New verb / wire op | unit + integration | `test/golden-ir` (directive shape) + `test/fake` (fake seam behavior) |
| New fitness invariant | fitness | `test/fitness` |
| Cross-module / handle behavior | integration | `test/fake` or `test/skeleton` |
| Full author-facing story | e2e | `test/e2e` |

## Architecture

The codebase is split into three layers:

- `src/core/` — internal kit (extraction-ready; not exposed in package exports).
- `src/commons/` — the author-facing public surface (`@pbuilder/sdk` and `@pbuilder/sdk/commons`).
- `src/conformance/` — the ecosystem test scaffold (`@pbuilder/sdk/conformance`).

Dialect and op-pack authors consume `src/commons/`. Contributor kit details are in `docs/authoring-a-dialect.md`.

## Pull request guidelines

1. One logical change per PR.
2. All tests must be green; typecheck must be clean.
3. New public exports require a JSDoc `@example` tag (enforced by FIT-06).
4. Changes to `src/commons/` public types require a corresponding `.d.ts` baseline update (`test/fitness/dts-baseline/`).
5. Use [Conventional Commits](https://www.conventionalcommits.org/) in commit messages.

## Publishing a release

Publication is manual-only. Preparing or merging the workflow is not authorization
to publish. The owner must first confirm npm trusted publishing binds
`@pbuilder/sdk` to `Project-Builder-Schematics/project-builder-sdk`, workflow
`publish.yml`, environment `npm`, with direct npm publication permission and the
previous unbound mapping removed or replaced. Retain required reviewers, main-only
deployment and disabled protection bypass. Where self-review is allowed,
self-review is not independent review.

After that confirmation and workflow merge, obtain **separate first-live authorization**.
The owner selects **Actions → Publish → Run workflow → main** and approves the
`npm` environment request. Wrong refs or repositories are refused; pending or
rejected approval cannot start the publisher. Never dispatch just to test trust.

The workflow checks out the immutable dispatch SHA, installs with the frozen lockfile,
builds explicitly, runs the full suite and typecheck, then validates the public package
identity, stable declared version, matching release heading and npm configuration.
Only confirmed exact-version absence permits one provenance-enabled publication to
`https://registry.npmjs.org`, public access, `latest`. It never stamps or bumps a
version, creates tags/releases, chooses another channel or falls back to a token.
The retained `prepublishOnly` hook may rebuild; this is not a promise that the final
published bytes equal the earlier tested build. Noncancelling package concurrency
prevents overlapping runs, but is not a durable FIFO queue or registry reservation.

Read the run summary's package, declared version (or explicit `unavailable`), SHA,
registry, channel and outcome:

| Outcome | Meaning / next action |
|---|---|
| blocked | No publish command was reached; resolve the failed gate before another authorized request. |
| attempted | The command started; registry effects are unknown, including after a failure. |
| command succeeded | npm exited zero; owner registry confirmation is still outstanding. |
| registry confirmed | Owner checked the exact version, `latest` target and provenance source SHA/run. |

After a duplicate or ambiguous failure, inspect the registry before considering
another dispatch. Inconclusive inspection never authorizes a retry. An existing
version does not prove this run published it. Do not automatically retry, bump,
retag, downgrade provenance or switch authentication. A workflow rollback disables
future attempts; it cannot remove already distributed package bytes.

First-live acceptance requires the owner's registry checks above, with the run and
registry evidence recorded. Passing tests, dry-run, `whoami`, and configuration
confirmation alone cannot establish live activation. The command harness uses
isolated process and registry fixtures; its lifecycle-failure simulation proves
invocation versus simulated upload ordering, not npm's real upload behavior or
external approval/OIDC enforcement.

## Security

Please read [SECURITY.md](SECURITY.md) before submitting code that touches the engine client, the wire protocol, or the publish pipeline.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to abide by its terms.
