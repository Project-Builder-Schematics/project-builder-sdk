# Delta for Testing Story Docs

**Spec version**: V2
**Status**: signed (V2, owner, 2026-07-14)
**Change**: `bare-factory-migration`

**V1 → V2** (plan-verify gate iteration 1, gap #3): ADDED REQ-TSD-05 — closes the
zero-`defineFactory`/prose-softening coverage gap for `docs/{dry-run,authoring-verbs,
authoring-errors}.md`, previously only present in slice S-003's acceptance clause.

## MODIFIED Requirements

### REQ-TSD-01: README Testing Section

`README.md` MUST gain a section documenting `./testing`: what it's for, how to import
`runFactoryForTest` from it and pass a BARE author function directly (Previously: "how to
import `runFactoryForTest`/`defineFactory` from it"), and a minimal worked example. The bar
is author-observable: a first-time reader following ONLY the README must be able to write
a working test without reading source. The section MUST ALSO state: (a) the 0.x
semver-exemption, and (b) the `./testing` vs `./conformance` boundary. At least one of
{this README section, `runFactoryForTest`'s JSDoc `@example` (REQ-TSD-02)} MUST include a
worked example demonstrating `seed`, passed via the options bag (`{ seed }`), being read
back by the factory. The section MUST contain zero `defineFactory` occurrences.

#### Scenario REQ-TSD-01.1: README example is copy-runnable

- GIVEN the README's testing section example, copied verbatim into a test file with the correct import path
- WHEN the test is run
- THEN it passes with no modification beyond the import path

#### Scenario REQ-TSD-01.2: README states the 0.x semver exemption

- GIVEN the README's testing section
- WHEN inspected for stability language
- THEN it explicitly states `./testing` ships 0.x semver-exempt until validated by real use

#### Scenario REQ-TSD-01.3: README states the `./testing` vs `./conformance` boundary

- GIVEN the README's testing section
- WHEN inspected
- THEN it contains a one-line statement distinguishing the two

#### Scenario REQ-TSD-01.4: A seeded-read example exists in the README or the JSDoc

- GIVEN the README testing section and `runFactoryForTest`'s JSDoc `@example`, taken together
- WHEN inspected for `seed` usage
- THEN at least one demonstrates `runFactoryForTest(fn, input, { seed })` with the factory
  reading a seeded path back

#### Scenario REQ-TSD-01.5: Zero `defineFactory` tokens in the README testing section [new]

- GIVEN the README's testing section
- WHEN scanned for the literal token `defineFactory`
- THEN zero occurrences are found

### REQ-TSD-02: `runFactoryForTest` JSDoc Coverage, `seed` `@param`, and the FIT-06 Re-Export Cascade

`runFactoryForTest`'s JSDoc MUST carry: an `@param` tag documenting the options bag
(`{ seed?, packageDir? }`); an `@example` tag showing a COMPLETE author test — a BARE
factory function definition, an invocation via `runFactoryForTest`, and an assertion on the
result (Previously: the example showed "a `defineFactory` call, an invocation via
`runFactoryForTest`"); a stated inline result-shape type; and the 0.x semver-exemption
statement. FIT-06's `PUBLIC_PATHS` MUST widen to include `src/testing/index.ts`. Because
FIT-06 follows re-exports to their ORIGIN module, `defineFactory`'s origin JSDoc
(`src/core/context.ts`) MUST also carry an `@example` — per `factory-package-shape`
REQ-FPS-05.2, this origin example targets the runner/harness-internal audience, not the
author (a genuine re-aim, not a removal of the obligation). `Batch`/`Directive`'s origin
declarations MUST also carry an `@example`.

#### Scenario REQ-TSD-02.1: JSDoc example is complete and passes FIT-06, and is bare-shape

- GIVEN `runFactoryForTest`'s exported JSDoc block
- WHEN FIT-06 scans `./testing`'s public exports
- THEN `runFactoryForTest` carries an `@example` and an `@param` documenting the options bag
- AND the example shows a bare factory definition, a `runFactoryForTest` call, and an
  assertion — with zero `defineFactory` tokens in the example body

#### Scenario REQ-TSD-02.2: JSDoc states the 0.x semver exemption

- GIVEN `runFactoryForTest`'s JSDoc block
- WHEN inspected for stability language
- THEN it explicitly states `./testing` ships 0.x semver-exempt

#### Scenario REQ-TSD-02.3: The re-export cascade reaches origin declarations, now runner/harness-audience [red-proof, modified]

- GIVEN FIT-06 scanning with `PUBLIC_PATHS` including `src/testing/index.ts`, and a fixture
  where `defineFactory`'s JSDoc in `src/core/context.ts` is missing `@example`
- WHEN FIT-06 resolves the re-export chain to origin
- THEN the missing `@example` at the origin is flagged — the cascade obligation survives
  even though `defineFactory`'s own example now targets the internal audience
  (`factory-package-shape` REQ-FPS-05.2), not the author

## ADDED Requirements

### REQ-TSD-05: Author-Facing Reference Docs Reflect the Bare Contract

`docs/dry-run.md`, `docs/authoring-verbs.md`, and `docs/authoring-errors.md` MUST
contain zero `defineFactory` tokens. `docs/dry-run.md`'s runnable code fence (currently
importing and calling `defineFactory`) MUST be rewritten to the BARE
`(input) => void | Promise<void>` export shape and MUST fence-compile against the
current `runFactoryForTest` signature. The three files' PROSE mentions of "a
`defineFactory` run" (`dry-run.md:40`, `authoring-errors.md:51`,
`authoring-verbs.md:78`) — none of which are machine-compiled — MUST be reworded to
describe the same guarantee without naming `defineFactory` (e.g. "an active run" / "a
factory run", not "a `defineFactory` run"), since `defineFactory` is no longer
author-facing vocabulary.

#### Scenario REQ-TSD-05.1: `dry-run.md`'s code fence is bare and fence-compiles

- GIVEN `docs/dry-run.md`'s runnable code fence
- WHEN it is extracted and fence-compiled against the current `runFactoryForTest`
  signature
- THEN it compiles using a bare `(input) => void | Promise<void>` export, with zero
  `defineFactory` tokens in the fence

#### Scenario REQ-TSD-05.2: Prose mentions are softened, not merely deleted

- GIVEN the three prose sites: `dry-run.md:40`, `authoring-errors.md:51`,
  `authoring-verbs.md:78`
- WHEN each is inspected
- THEN each states the same guarantee (a verb/API usable only inside an active run)
  without the token `defineFactory` (e.g. "an active run" replacing "a `defineFactory`
  run")

#### Scenario REQ-TSD-05.3: Zero `defineFactory` tokens across the 3 doc files [red-proof]

- GIVEN `docs/dry-run.md`, `docs/authoring-verbs.md`, `docs/authoring-errors.md`
- WHEN each is scanned for the literal token `defineFactory`
- THEN zero occurrences are found in any of the three — a stray reintroduction in any
  file fails this scan
