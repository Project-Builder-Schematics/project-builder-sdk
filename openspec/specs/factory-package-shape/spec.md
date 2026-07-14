# Factory Package Shape Specification

**Spec version**: V5
**Status**: signed (owner, 2026-07-12 — V5: owner-authorized micro-unfreeze — reconcile
REQ-FPS-02's exports-map count to the shipped 5-entry reality; no behavioral change;
re-sign authorized for exactly this scope)
**Change**: `stage-5-first-dialect` (MODIFIED from V3: stage-4-typed-options)

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

Adding `package.json#bin` for the codegen bin MUST NOT alter the exports map beyond this
change's own AUTHORIZED addition. The exports map's expected set is FIVE entries — `.`,
`./commons`, `./conformance`, `./testing`, `./typescript` (`./testing` landed independently
on `main` via `stage-4b-testing-harness` ahead of this branch's own S-002 batch; `./typescript`
is this change's own addition, `foundations-skeleton` REQ-PKG-01) — and MUST NOT gain a
SIXTH. `package.json#dependencies` MUST contain EXACTLY the pinned `ts-morph` entry
(`typescript-dialect` REQ-TSD-06) and nothing else — the zero-deps invariant becomes a
one-deps invariant, still closed.

(Previously: the expected set was exactly three entries and `dependencies` was required to
stay absent/empty; `stage-5-first-dialect` is the first change authorized to grow both. V5:
reconciled the entry count from four to five — `./testing` landed on `main` via
`stage-4b-testing-harness` before this branch's own S-002 batch ran, a fact the original V4
text omitted; the shipped tests [`fit-09-pkg-exports-resolution.test.ts`,
`fit-14-package-surface.test.ts`] always asserted the correct five-entry reality.)

#### Scenario REQ-FPS-02.1: exports map is exactly five entries, dependencies is exactly ts-morph

- GIVEN the published package's `package.json` after this change
- WHEN its `exports` map is inspected
- THEN it is EXACTLY `.`, `./commons`, `./conformance`, `./testing`, `./typescript` — no
  more, no less
- AND a `bin` field is present pointing at the codegen executable
- AND `dependencies` contains EXACTLY one entry, `ts-morph`, exact-pinned (no caret/tilde)

#### Scenario REQ-FPS-02.2: Tarball contents — bin + typescript dist present, nothing else new (SEC-M2)

- GIVEN the package's publishable tarball listing (`bun pm pack --dry-run` or
  `npm pack --dry-run`) before and after this change
- WHEN the file lists are compared
- THEN the codegen bin's file(s) and the `dist/dialects/typescript/**` build output are present in
  the after-listing
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

### REQ-FPS-06: `dist/core/**` Ships Documented, Not Stripped

The tarball's `dist/core/**` entries MUST continue to ship — `./testing`'s runtime import
of `../core/context.ts` requires them physically present — and this decision MUST be
documented at the package-shape surface: `dist/core/**` ships intentionally, and
`@pbuilder/sdk/core` remains unreachable via `package.json#exports` (the ADR-0009 boundary
stays advisory-by-convention, not enforced by tarball exclusion).

**Out of scope (scope fence)**: no `defineFactory` relocation this change (owner-ruled,
stays `./testing`) and no FIT-09/FIT-14 exports-guard restructuring — this requirement
extends the existing exact-list assertions only, per REQ-FPS-02's unchanged five-entry
exports map and single `ts-morph` dependency.

#### Scenario REQ-FPS-06.1: FIT-14 baseline continues to include `dist/core/**` entries

- GIVEN the FIT-14 baseline (`test/fitness/pkg-surface-baseline.json`) regenerated for this change
- WHEN its `tarball` entry list is inspected
- THEN `dist/core/**` entries are present, unchanged in kind from before this change (contents may reflect REQ-PPH-05's `declarationMap: false`)

#### Scenario REQ-FPS-06.2: Package-shape documentation states the document-not-strip rationale

- GIVEN this domain's documentation surface (README or a linked doc)
- WHEN inspected
- THEN it states `dist/core/**` ships intentionally because `./testing` needs it present at runtime, and that `./core` stays unreachable via `exports` regardless

### REQ-FPS-07: No-Secrets Tarball Assertion

The packed tarball (`bun pm pack --dry-run`'s file listing) MUST contain no `.env` files,
no `.npmrc`, no key material (e.g. `.pem`, `.key`), and no other credential-looking
filenames — asserted POSITIVELY by an explicit check, never merely assumed via a baseline
diff.

#### Scenario REQ-FPS-07.1: Tarball listing is positively scanned for secret-like files

- GIVEN a fresh build and `bun pm pack --dry-run`'s file listing
- WHEN the listing is scanned against a credential-filename pattern set (`.env*`,
  `.npmrc`, `*.pem`, `*.key`, and equivalents)
- THEN zero matches are found, and the check runs as an explicit positive assertion, not
  as an inference from the FIT-14 baseline diff

#### Scenario REQ-FPS-07.2 [red-proof]: A simulated tarball listing containing a secret file is caught

- GIVEN a simulated `bun pm pack --dry-run` listing that includes a `.env` file
- WHEN the no-secrets check runs against it
- THEN it fails, naming the offending file

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api-stability (`package.json#bin`, exports map, tarball contents) | REQ-FPS-02, REQ-FPS-03, REQ-FPS-05 | Yes |
| security (supply-chain — tarball contents) | REQ-FPS-06, REQ-FPS-07 | Yes |

## Next Step

V2 incorporates blind spec-council feedback: REQ-FPS-02 extends FIT-14 to the tarball's
`files`/pack contents; a new REQ-FPS-05 closes the discoverability gap (bin usage output,
JSDoc `@example` workflow, reserved-name documentation). Surface to human for review.

V6 (stage-6-release-shape): REQ-FPS-06 extends the baseline to include `dist/core/**` with
documented rationale; REQ-FPS-07 adds positive no-secrets scanning to the tarball guard.
