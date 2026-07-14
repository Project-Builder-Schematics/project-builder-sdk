# Delta for Factory Package Shape

**Spec version**: V2
**Status**: signed (V2, owner, 2026-07-14)
**Change**: `bare-factory-migration`

**V1 → V2**: no change in this domain — carried forward unmodified as part of the same
unfreeze/re-sign cycle (plan-verify gate iteration 1, gaps #2/#3 land in
`author-test-harness` and `testing-story-docs`).

## MODIFIED Requirements

### REQ-FPS-04: In-Repo End-to-End Typed-Factory Example

An in-repo reference schematic (canonical `factory.ts` + `schema.json` pair,
`test/fixtures/typed-factory/factory.ts`) MUST run end-to-end against the fake engine
client, demonstrating: schema-derived typed `O`, a successful commit, and the
parity/sufficiency fitness gates passing against its own `schema.json`. The reference
schematic's EXPORTED factory is the BARE typed `(input: O) => void | Promise<void>`
function (Previously: exported a `defineFactory<O>(...)`-wrapped value); the e2e test that
drives it performs the wrap internally via `defineFactory<O>` — this is exactly the
runner/harness-internal usage the migration relocates `defineFactory` to. This example
MUST NOT import or depend on the `./testing` facade (unchanged from before — out of scope,
`stage-4b-testing-harness`).

#### Scenario REQ-FPS-04.1: Reference schematic runs end-to-end

- GIVEN the reference schematic package with a real `schema.json` and a BARE factory
  function using the schema-derived `O`
- WHEN the e2e test wraps it via `defineFactory<O>` and runs it against the `ContractFake`
  (in-repo, no `./testing` import)
- THEN the factory runs to completion, its directives commit, and FIT-12/FIT-13 pass
  against its `schema.json`

### REQ-FPS-05: Discoverability (TW-F4)

The codegen bin invoked with no arguments or an unrecognized flag MUST print usage/`--help`
output rather than failing silently. The AUTHOR-facing discoverability guarantee — a JSDoc
`@example` demonstrating the schema-derived `O` + bin-invocation workflow end-to-end — now
lives on the BARE-shape example (author-onboarding-docs REQ-AOD-01's quickstart, cross-
referenced from this domain), not on `defineFactory`'s own JSDoc (Previously: "
`defineFactory`'s JSDoc `@example` MUST demonstrate the schema-derived `O` + bin-invocation
workflow"). `defineFactory`'s OWN JSDoc `@example` (kit-internal declaration, FIT-06's
re-export-cascade target per `testing-story-docs` REQ-TSD-02) MAY re-aim at the
runner/harness-internal audience — showing the bin-invocation + typed-`O` + INTERNAL wrap
pattern, not an author-facing call. The reserved lifecycle names documentation requirement
is unchanged.

#### Scenario REQ-FPS-05.1: Bin emits usage output on no-args/bad-flag

- GIVEN the bin is invoked with no arguments (or an unrecognized flag)
- WHEN it runs
- THEN it prints usage/help text naming its purpose and expected invocation

#### Scenario REQ-FPS-05.2: Discoverability is satisfied by the bare-shape quickstart, `defineFactory`'s own example re-aims internal [modified]

- GIVEN `docs/quickstart.md` (REQ-AOD-01) and `defineFactory`'s emitted JSDoc `@example`
- WHEN each is inspected
- THEN the quickstart demonstrates the bin invocation + generated `O` + BARE factory
  function workflow (the author-facing discoverability path), AND `defineFactory`'s own
  `@example` demonstrates the bin invocation + generated `O` + internal `defineFactory<O>`
  wrap (FIT-06-valid, audience-appropriate, no longer claimed as the author's own path)

#### Scenario REQ-FPS-05.3: Reserved names documented at the package-shape surface

- GIVEN this domain's documentation/doc-comment surface
- WHEN inspected
- THEN `pre-execute`/`post-execute` are named as reserved
