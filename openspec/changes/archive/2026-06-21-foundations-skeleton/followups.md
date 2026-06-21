# Followups — foundations-skeleton

Accepted at archive time (user decision: archive with followups). None are blocking: the
walking skeleton is correct, all REQ-* pass, and blind judgment-day reached 0 criticals over 3
rounds. These are hardening / coverage-depth items surfaced by the adversarial review.

## Real (non-critical) — address before first LIVE publish or first real dialect

- **W3 · publish guard** — add `if: github.repository == 'Project-Builder-Schematics/project-builder-sdk'`
  to the `publish` job in `.github/workflows/publish.yml`. A fork pushing to its own `main` would
  otherwise run the (currently dry-run) publish under the fork's OIDC. **Gating precondition for
  removing `--dry-run`.**
- **W1 · REQ-PKG-01 live resolution** — `test/fitness/fit-09-pkg-exports-resolution.test.ts` asserts the
  `exports` map *shape*, not behaviour. Add a pack→install→resolve CI smoke test that an
  `@pbuilder/sdk/core` import throws `ERR_PACKAGE_PATH_NOT_EXPORTED` while `/commons` resolves.
- **W2 · FIT-01 import-graph depth** — the commons AST scan is single-level; a transitive AST import via
  `src/core/**` would pass (FIT-03 bundle scan is a partial backstop). Follow relative imports
  transitively, or scan the bundled module graph. Latent (no core deps exist yet).
- **W5 · REQ-STD-01 guard** — add a test asserting `SECURITY.md` contains the explicit-trust sentence
  verbatim and `docs/authoring-a-dialect.md` has its section headings (the lone REQ without a test).
- **W6 · error masking** — `defineFactory`'s `finally` flush can replace the original `fn` error if the
  flush also rejects. Wrap so the original error is preserved (suppress/aggregate the flush error).
- **W7 · FIT-04 freshness** — the mtime gate is fragile on same-second `git checkout`; prefer an
  unconditional `beforeAll` rebuild (the build is cheap) over mtime comparison.

## Suggestions / hygiene

- Pin `actions/checkout@v4` + `actions/setup-node@v4` to commit SHAs (matching the `setup-bun` pin).
- `dist/core/**` ships in the tarball (kit JS importable by deep path). ADR-0009 boundary is advisory in
  v1 — strip `dist/core` from the published files or document the boundary as conventional at the
  `@pbuilder/sdk-kit` extraction.
- Build does not clean `dist/` first → stale artifacts can linger locally (CI is fresh-checkout, so the
  published tarball is unaffected). Add a `prebuild` clean to avoid a local-publish footgun.
- `test/conformance/meta.test.ts` red-proofs are tautological (mutate a spread copy); the primary
  `toHaveProperty` is the real guard — drop the misleading `[red-proof]` label.
- `withOps` silently overwrites on op-name collision — add a readable diagnostic at T-M2 (ADR-0010).
- FIT-02 (dialect leaf rule) is vacuous until `src/dialects/` exists; FIT-08 could derive its kit-symbol
  set from `src/core/index.ts` exports rather than a hand-maintained list.

## Engine-fidelity questions (confirm against the real engine — engine §6)

- Fake `move` silently overwrites an existing destination (no fail-closed / no `force`), unlike
  create/rename/copy. Confirm the engine's `move` semantics; align the fake (FAKE-06 oracle fidelity).
- Fake `modify` of a non-existent path materializes the file rather than erroring. Confirm engine
  `modify`-of-missing semantics.
