# Delta for Author Onboarding Docs

**Spec version**: V2
**Status**: signed (V2, owner, 2026-07-14)
**Change**: `bare-factory-migration`

**V1 → V2**: no change in this domain — carried forward unmodified as part of the same
unfreeze/re-sign cycle (plan-verify gate iteration 1, gaps #2/#3 land in
`author-test-harness` and `testing-story-docs`).

## Purpose Amendment

The main spec's scope fence — "**Out of scope (scope fence)**: no `defineFactory`
relocation — docs describe the CURRENT `./testing` import, unchanged" — is LIFTED by this
change. `bare-factory-migration` is precisely the `defineFactory` relocation this fence
anticipated and deferred; the owner direction (obs #2070, 2026-07-14) that motivates this
change post-dates the fence and supersedes it. No REQ-AOD-* text requires editing beyond
REQ-AOD-01 below — its OTHER scenarios already describe the quickstart's `factory.ts` in
shape-agnostic terms that hold whether the generated type wraps a bare export or a
`defineFactory`-wrapped one.

## MODIFIED Requirements

### REQ-AOD-01: Quickstart — Concrete Schema and Generated Types

`docs/quickstart.md` MUST walk a new author through: a concrete `schema.json`, running the
codegen bin to GENERATE typed options, a `factory.ts` that consumes the GENERATED type as
a BARE `(input: GeneratedType) => void | Promise<void>` export (Previously: the shape was
unconstrained by this REQ's text, and the doc content — now explicitly in scope per the
lifted fence above — showed a `defineFactory<GeneratedType>(...)`-wrapped export) — never a
hand-written generic — and a passing test via `runFactoryForTest`.

#### Scenario REQ-AOD-01.1: Quickstart contains a schema.json fixture and shows bin invocation

- GIVEN `docs/quickstart.md`
- WHEN read top to bottom
- THEN it contains a concrete `schema.json` example and the `pbuilder-codegen` invocation

#### Scenario REQ-AOD-01.2: `factory.ts` consumes the generated type as a bare export [modified]

- GIVEN the quickstart's `factory.ts` example
- WHEN inspected
- THEN it imports/uses the codegen-generated type as the parameter type of a BARE exported
  function — no `defineFactory` call and zero `defineFactory` tokens anywhere in the example

#### Scenario REQ-AOD-01.3: Quickstart's test example passes

- GIVEN the quickstart's `runFactoryForTest` example, copied verbatim (import path swapped per REQ-AOD-07)
- WHEN run
- THEN it passes
