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

## Security

Please read [SECURITY.md](SECURITY.md) before submitting code that touches the engine client, the wire protocol, or the publish pipeline.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to abide by its terms.
