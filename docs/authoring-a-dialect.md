# Authoring a dialect

> **Status: stub** — content is deferred to T-M2, when the first real dialect (ts-morph or postcss)
> is written and the contributor API is fully validated. This file exists to satisfy the
> REQ-STD-01 acceptance bar (file present with titled outline).

---

## What is a dialect?

<!-- T-M2: explain that a dialect is an AST-library adapter — it teaches the SDK how to parse,
     mutate, and print a specific file type. A dialect bundles: file-extension matchers, a
     parse/print pair, and an op-pack (the mutation vocabulary). -->

## The kit contract (`@pbuilder/sdk-kit`)

<!-- T-M2: describe the EngineClient / Session / DirectiveFactory / BaseFileHandle interfaces;
     the extraction trigger (first external/2nd dialect per ADR-0014); versioning with
     kitContract integer; the two-audience boundary (ADR-0009). -->

## Writing your first op

<!-- T-M2: step-by-step walkthrough — defineOpPack, the op function signature, how the
     op reads the live AST from the handle and emits a modify directive. -->

## Testing with the conformance kit

<!-- T-M2: explain testDialect / testOpPack (ADR-0012); how to write a DialectFixture and
     OpPackFixture; what the suite asserts (parse/print round-trip byte-exact, single-op
     fidelity + unchanged-elsewhere, serializable-bytes invariant, leaf rule, mandatory
     adversarial samples); how to run `testDialect(fixture)` in your own test suite. -->

## Publishing and trust

<!-- T-M2: explain the explicit-trust posture (SECURITY.md); kitContract peer-dep range;
     provenance / OIDC publishing recommendations for community op-packs; the future
     trust-tier model (roadmap §10). -->
