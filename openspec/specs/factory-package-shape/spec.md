# Factory Package Shape Specification

**Spec version**: V3
**Status**: signed (owner, 2026-07-07)
**Change**: `stage-4-typed-options`

**V2 → V3 delta**: added Scenario REQ-FPS-05.4 (README incremental-shipping qualifying
line) — the only change; REQ-FPS-05's requirement text and Scenarios .1/.2/.3 are stable.

## Purpose

Defines the canonical `factory.ts` + adjacent `schema.json` layout that the codegen bin and
the runner both consume, guards the public package surface this change adds
(`package.json#bin`) against silently drifting the existing `exports` map or reintroducing
a runtime dependency, and hosts the in-repo end-to-end demonstration (4.4) proving the
other four capabilities compose together. Retires the CQ-2 pending-changes row (a real
end-to-end typed-factory example vs. a synthetic matrix).

## Requirements

### REQ-FPS-01: Canonical Package Shape

A factory package MUST place its `schema.json` adjacent to (same directory as) its
`factory.ts` entry, discoverable by the bin and the runner without additional
configuration. This is also the bin's fixed output location (REQ-TFO-05).

#### Scenario REQ-FPS-01.1: schema.json discovered without a path argument

- GIVEN a factory package with `factory.ts` and a sibling `schema.json` in the same directory
- WHEN the bin is invoked against the package
- THEN it locates `schema.json` without an explicit path argument

### REQ-FPS-02: Package Surface Guard (FIT-14)

Adding `package.json#bin` for the codegen bin MUST NOT alter the existing `exports` map
(`.`, `./commons`, `./conformance` per FIT-09) and MUST NOT introduce a
`package.json#dependencies` entry.

#### Scenario REQ-FPS-02.1: exports map unchanged, only bin added, zero-deps preserved

- GIVEN the published package's `package.json` after this change
- WHEN its `exports` map is inspected
- THEN it is unchanged from the pre-change baseline (`.`, `./commons`, `./conformance` only)
- AND a `bin` field is present pointing at the codegen executable
- AND `dependencies` remains absent or empty

#### Scenario REQ-FPS-02.2: Tarball contents — bin present, nothing else new (SEC-M2)

- GIVEN the package's publishable tarball listing (`bun pm pack --dry-run` or
  `npm pack --dry-run`) before and after this change
- WHEN the file lists are compared
- THEN the codegen bin's file(s) are present in the after-listing
- AND no OTHER file beyond what this change's own REQs declare has newly entered the
  tarball

### REQ-FPS-03: Bin-to-Core Dependency Direction (FIT-15)

The codegen bin MAY import shared schema-parsing logic from `src/core` (or a
runtime-adjacent module), but no module under `src/`'s runtime path MAY import the bin or
any codegen-only code. The dependency arrow is bin→core only, never core→bin.

#### Scenario REQ-FPS-03.1: No runtime module imports the bin

- GIVEN the full module graph of `src/`
- WHEN it is scanned for imports of the bin/codegen entry point
- THEN no runtime module under `src/core`, `src/commons`, or `src/dialects` (or equivalent) imports it

### REQ-FPS-04: In-Repo End-to-End Typed-Factory Example

An in-repo reference schematic (canonical `factory.ts` + `schema.json` pair) MUST run
end-to-end against the fake engine client, demonstrating: schema-derived typed `O`, a
successful commit, and the parity/sufficiency fitness gates passing against its own
`schema.json`. This example MUST NOT import or depend on the `./testing` facade (out of
scope — `stage-4b-testing-harness`).

#### Scenario REQ-FPS-04.1: Reference schematic runs end-to-end

- GIVEN the reference schematic package with a real `schema.json` and a `defineFactory<O>` factory using the schema-derived `O`
- WHEN the e2e test runs it against the `ContractFake` (in-repo, no `./testing` import)
- THEN the factory runs to completion, its directives commit, and FIT-12/FIT-13 pass against its `schema.json`

### REQ-FPS-05: Discoverability (TW-F4)

The codegen bin invoked with no arguments or an unrecognized flag MUST print usage/`--help`
output (naming its purpose and expected invocation) rather than failing silently or
crashing uninformatively. `defineFactory`'s JSDoc `@example` MUST demonstrate the
schema-derived `O` + bin-invocation workflow end-to-end (bin invocation against a
`schema.json`, then the typed `defineFactory<O>` call) — routed to FIT-06 (example-JSDoc
fitness), which already enforces JSDoc `@example` presence/validity for public exports. The
reserved lifecycle names (`pre-execute`/`post-execute`) MUST be documented at this domain's
package-shape surface, not only discoverable by triggering a REQ-RLN-01 rejection.

**Naming-namespace note (TW-F6):** a reserved-name-as-resolved-input-key (rejected via
REQ-RBV-01.5, reason `invalid-input`) and a reserved-name-as-module-structure (rejected via
`reserved-lifecycle-names` REQ-RLN-01, reason `reserved-name`) are DELIBERATELY DISTINCT
failure reasons despite sharing the same literal strings — documented here as the
discoverability surface for that distinction.

#### Scenario REQ-FPS-05.1: Bin emits usage output on no-args/bad-flag

- GIVEN the bin is invoked with no arguments (or an unrecognized flag)
- WHEN it runs
- THEN it prints usage/help text naming its purpose and expected invocation, and does not crash uninformatively

#### Scenario REQ-FPS-05.2: defineFactory's JSDoc @example demonstrates the full workflow

- GIVEN `defineFactory`'s emitted JSDoc
- WHEN its `@example` is inspected (FIT-06)
- THEN it shows the bin invocation against a `schema.json` followed by a `defineFactory<O>` call using the generated type

#### Scenario REQ-FPS-05.3: Reserved names documented at the package-shape surface

- GIVEN this domain's documentation/doc-comment surface (REQ-FPS-01's home)
- WHEN inspected
- THEN `pre-execute`/`post-execute` are named as reserved, independent of triggering a rejection

#### Scenario REQ-FPS-05.4: README qualifies the incremental-shipping status (reverted in stage-4b)

This change ships the typed-input machinery in-repo but does NOT yet make the API installable
by external authors (that reachability lands with `stage-4b-testing-harness`). The README's
"typed inputs" claim MUST be qualified so a reader is not misled into expecting an installable
external-author API from this stage.

- GIVEN the repository `README.md` after this change
- WHEN its contents are read
- THEN it contains, VERBATIM, the qualifying line:
  `> **Note**: shipping incrementally — the external-author API (installable `defineFactory` + testing harness) lands with stage-4b.`
- AND the assertion pins this literal exactly (greppable, byte-for-byte), so drift fails the test
- AND this line is REVERTED when `stage-4b-testing-harness` lands (temporary, stage-scoped qualifier)

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api-stability (`package.json#bin`, exports map, tarball contents) | REQ-FPS-02, REQ-FPS-03, REQ-FPS-05 | Yes |

## Next Step

V2 incorporates blind spec-council feedback: REQ-FPS-02 extends FIT-14 to the tarball's
`files`/pack contents; a new REQ-FPS-05 closes the discoverability gap (bin usage output,
JSDoc `@example` workflow, reserved-name documentation). Surface to human for review.
