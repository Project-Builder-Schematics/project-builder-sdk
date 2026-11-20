# Contributing to @pbuilder/sdk

Thank you for your interest in contributing. This document covers how to set up the project, run the test suite, and submit changes.

The test pyramid lives in [testing.md](testing.md), the code conventions in [conventions.md](conventions.md) and the release runbook in [releasing.md](releasing.md).

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

The code follows project-builder-architecture's bounded-context layout ([ADR-0083](../docs/adr/0083-hexagonal-layout.md)):

- `src/bounded-contexts/authoring/` — the factory, its schema and its edits: [Authoring](../docs/bounded-contexts/authoring.md).
- `src/bounded-contexts/runner-hosting/` — the runner bootstrap the engine starts: [Runner hosting](../docs/bounded-contexts/runner-hosting.md).
- `src/acl/irwire/`, `src/shared-kernel/`, `src/platform/` — the engine client, the code both contexts share, and helpers with no domain rules.
- `src/index.ts`, `src/commons/`, `src/testing/`, `src/conformance/`, `src/dialects/<name>/` — the public entries, thin barrels over the contexts.

The layering rule, where new code goes and how to read a fit-49 failure are in [conventions.md](conventions.md). Writing a dialect is in [authoring-a-dialect.md](../docs/guides/authoring-a-dialect.md).

## Pull request guidelines

1. One logical change per PR.
2. All tests must be green; typecheck must be clean.
3. New public exports require a JSDoc `@example` tag (enforced by FIT-06).
4. Changes to `src/commons/` public types require a corresponding `.d.ts` baseline update (`test/fitness/dts-baseline/`).
5. Use [Conventional Commits](https://www.conventionalcommits.org/) in commit messages.

## Security

Please read [SECURITY.md](../SECURITY.md) before submitting code that touches the engine client, the wire protocol, or the publish pipeline.

## Code of conduct

This project follows the [Contributor Covenant](../CODE_OF_CONDUCT.md). By participating, you agree to abide by its terms.
