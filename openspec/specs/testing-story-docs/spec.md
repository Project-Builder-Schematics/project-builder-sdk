# Testing Story Docs Specification

**Spec version**: V2
**Status**: signed (owner, 2026-07-10, stage-4b-testing-harness)
**Change**: `stage-4b-testing-harness`

## Purpose

A harness nobody can discover is not delivered. This domain makes `./testing` positively
documented — a README section an author can follow start-to-finish, a JSDoc `@example` on
`runFactoryForTest` showing a COMPLETE test (FIT-06 house style), the sequence-gated
revert of Stage-4's incremental-shipping qualifying-line, and the ADR-0009 amendment that
literally names the third audience. The 0.x semver exemption is COMMUNICATED, not just
decided — in the README AND in `runFactoryForTest`'s JSDoc, not only in ADR-0033.

## Requirements

### REQ-TSD-01: README Testing Section

`README.md` MUST gain a section documenting `./testing`: what it's for, how to import
`runFactoryForTest`/`defineFactory` from it, and a minimal worked example. The bar is
author-observable: a first-time reader following ONLY the README must be able to write a
working test without reading source. The section MUST ALSO state, explicitly: (a) that
`./testing` ships 0.x semver-exempt (mirroring the kit) until validated by real use, and
(b) a one-line boundary statement distinguishing `./testing` from `./conformance` —
testing an author's OWN factory vs. `./conformance` conformance-tests a dialect or op-pack
implementation (parse/print fidelity), not a factory (the two are easy to confuse by name
alone). At least one of {this README section, `runFactoryForTest`'s JSDoc `@example`
(REQ-TSD-02)} MUST include a worked example demonstrating the `seed` parameter being read
back by the factory.

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
- THEN it contains a one-line statement distinguishing `./testing` (testing an author's own
  factory) from `./conformance` (conformance-tests a dialect or op-pack implementation —
  parse/print fidelity — not a factory)

#### Scenario REQ-TSD-01.4: A seeded-read example exists in the README or the JSDoc

- GIVEN the README testing section and `runFactoryForTest`'s JSDoc `@example`, taken together
- WHEN inspected for `seed` usage
- THEN at least one of the two demonstrates calling `runFactoryForTest` with a non-empty
  `seed` record and the factory reading a seeded path back

### REQ-TSD-02: `runFactoryForTest` JSDoc Coverage, `seed` `@param`, and the FIT-06 Re-Export Cascade

`runFactoryForTest`'s JSDoc MUST carry: an `@param` tag documenting `seed`
(`Record<string,string>`, the SOLE seeding channel); an `@example` tag (FIT-06 requires
this of every public export) showing a COMPLETE author test — a `defineFactory` call, an
invocation via `runFactoryForTest`, and an assertion on the result; a stated inline type
for the result shape (`tree`, `emitted: Batch[]`, `error: AuthoringError | unknown`) —
`emitted` keeps its current field name, but its type MUST be stated explicitly in the doc
comment; and an explicit statement that `./testing` ships 0.x semver-exempt until
validated by real use. FIT-06's `PUBLIC_PATHS` MUST widen to include `src/testing/index.ts`.
Because FIT-06 follows re-exports to their ORIGIN module, this widening CASCADES:
`defineFactory`'s origin JSDoc (`src/core/context.ts`) MUST also carry an `@example`, and
`Batch`/`Directive`'s origin declarations (`src/core/wire.ts`) — type-only re-exported —
MUST also carry an `@example` (a literal value example suffices for a type). This is a
genuine new doc obligation on kit-internal declarations that were never scanned before
`./testing` existed.

#### Scenario REQ-TSD-02.1: JSDoc example is complete and passes FIT-06

- GIVEN `runFactoryForTest`'s exported JSDoc block
- WHEN FIT-06 scans `./testing`'s public exports (`PUBLIC_PATHS` now including `src/testing/index.ts`)
- THEN `runFactoryForTest` is found to carry an `@example` tag and an `@param` tag documenting `seed`
- AND the example's content includes a factory definition, a `runFactoryForTest` call, and an assertion on its result — not merely an import line

#### Scenario REQ-TSD-02.2: JSDoc states the 0.x semver exemption

- GIVEN `runFactoryForTest`'s JSDoc block
- WHEN inspected for stability language
- THEN it explicitly states `./testing` ships 0.x semver-exempt until validated by real use

#### Scenario REQ-TSD-02.3: The re-export cascade reaches origin declarations [red-proof]

- GIVEN FIT-06 scanning with `PUBLIC_PATHS` including `src/testing/index.ts`, and a fixture
  where `defineFactory`'s JSDoc in `src/core/context.ts` is missing `@example`
- WHEN FIT-06 resolves `./testing`'s re-export of `defineFactory` to its origin
- THEN the missing `@example` at the origin is flagged as a violation — proving the
  widening is not satisfied by documenting only the facade's re-export statement

### REQ-TSD-03: README Qualifying-Line Revert (Sequence-Gated)

Once `stage-4-typed-options` archives with its README incremental-shipping qualifying-line
(REQ-FPS-05.4) landed, THIS change MUST revert that line. This REQ's slice is sequenced
STRICTLY after that archive. If `stage-4-typed-options` has not archived when this change
builds, this REQ's slice is DEFERRED — never silently dropped or marked done without the
revert actually happening.

#### Scenario REQ-TSD-03.1: Revert lands only after Stage-4 archives

- GIVEN `stage-4-typed-options` has archived and its qualifying-line is present in `README.md`
- WHEN this change's revert slice runs
- THEN the qualifying-line is removed from `README.md` and no other README content changes

#### Scenario REQ-TSD-03.2: Revert is deferred, not skipped, if Stage-4 hasn't archived yet

- GIVEN `stage-4-typed-options` has NOT archived at the time this change is built
- WHEN this change's other slices complete
- THEN this REQ's slice is explicitly marked deferred (tracked as a followup), not closed as satisfied

### REQ-TSD-04: ADR-0009 Amendment Content

The ADR-0009 amendment (ADR-0033) MUST literally state: a third audience named
`author-testing`; its own entry, `./testing`; and that `./testing` ships 0.x
semver-exempt (mirroring the kit) until validated by real use. The amendment extends the
two-audience boundary — it MUST NOT redefine or remove the existing AUTHOR/CONTRIBUTOR
split.

#### Scenario REQ-TSD-04.1: Amendment names the third audience and its terms

- GIVEN the ADR-0009 amendment text
- WHEN inspected for required content
- THEN it contains the literal phrase `author-testing`, names `./testing` as its entry, and states 0.x semver-exemption
- AND the original AUTHOR/CONTRIBUTOR two-audience decision text is preserved, not rewritten
