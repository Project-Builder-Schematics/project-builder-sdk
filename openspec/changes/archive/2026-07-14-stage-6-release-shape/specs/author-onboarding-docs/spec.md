# Author Onboarding Docs Specification

**Spec version**: V2
**Status**: signed (owner, 2026-07-12 — V2)
**Change**: `stage-6-release-shape`

## Purpose

The only way to learn `@pbuilder/sdk` today is cloning the repo and reading tests; the
README's "typed inputs" example is hand-written, not generated. This domain produces the
doc set that takes a new author from a local install to a passing typed factory using ONLY
the docs, and reconciles the planning docs (ROADMAP, problem statement, pending-changes)
for the terminal stage. Each doc is DONE when it is sufficient for the docs-only
walkthrough (REQ-AOD-07/08) — not comprehensive-reference complete; that bar belongs to
the future public-package plan.

**Out of scope (scope fence)**: no `defineFactory` relocation — docs describe the CURRENT
`./testing` import, unchanged.

## Requirements

### REQ-AOD-01: Quickstart — Concrete Schema and Generated Types

`docs/quickstart.md` MUST walk a new author through: a concrete `schema.json`, running the
codegen bin (`pbuilder-codegen`) to GENERATE typed options, a `factory.ts` that consumes
the GENERATED type — never a hand-written generic, superseding the README's current
hand-written example — and a passing test via `runFactoryForTest`.

#### Scenario REQ-AOD-01.1: Quickstart contains a schema.json fixture and shows bin invocation

- GIVEN `docs/quickstart.md`
- WHEN read top to bottom
- THEN it contains a concrete `schema.json` example and the `pbuilder-codegen` invocation that generates types from it

#### Scenario REQ-AOD-01.2: `factory.ts` consumes the generated type

- GIVEN the quickstart's `factory.ts` example
- WHEN inspected
- THEN it imports/uses the type the codegen bin generated, not a hand-written generic type parameter

#### Scenario REQ-AOD-01.3: Quickstart's test example passes

- GIVEN the quickstart's `runFactoryForTest` example, copied verbatim (import path swapped per REQ-AOD-07)
- WHEN run
- THEN it passes

### REQ-AOD-02: Install Ritual — `bun link` First, Tarball as Alternative

The quickstart MUST document the `bun link` install ritual FIRST, with the packed-tarball
path documented as the alternative. It MUST NOT instruct `npm install @pbuilder/sdk`
(not available yet).

#### Scenario REQ-AOD-02.1: `bun link` appears before the tarball alternative

- GIVEN the quickstart's install section
- WHEN read in order
- THEN the `bun link` ritual precedes the tarball-install alternative

#### Scenario REQ-AOD-02.2: No `npm install @pbuilder/sdk` instruction

- GIVEN the quickstart's full text
- WHEN scanned for install commands
- THEN no `npm install @pbuilder/sdk` (or equivalent live-registry install) instruction is present

### REQ-AOD-03: Six-Verb Reference with Read-Trichotomy Rule

A verb-reference doc MUST document all six author verbs (`create`, `modify`, `remove`,
`rename`, `move`, `copy`) and the `find().read()` read-trichotomy rule.

#### Scenario REQ-AOD-03.1: All six verbs and the read-trichotomy rule are documented

- GIVEN the verb-reference doc
- WHEN scanned for each of the six verb names and a read-trichotomy explanation
- THEN all seven elements are present

### REQ-AOD-04: Dialect Usage — Linked, Not Duplicated

The doc set MUST link the existing `docs/authoring-a-dialect.md` house doc as the
dialect-usage entry, following its established structure, without duplicating its content.

#### Scenario REQ-AOD-04.1: Quickstart or doc index links `authoring-a-dialect.md`

- GIVEN the quickstart or a doc index page
- WHEN scanned for dialect-usage guidance
- THEN it links `docs/authoring-a-dialect.md` rather than re-authoring dialect content

### REQ-AOD-05: Error Contract in Author Vocabulary

An error-contract doc MUST document `AuthoringError` in author vocabulary — `verb`,
`path`, `reason` — without engine-internal terminology (wire directives, IR batch codes).

#### Scenario REQ-AOD-05.1: Doc names verb/path/reason and stays in author vocabulary

- GIVEN the error-contract doc
- WHEN scanned for `AuthoringError`'s fields and for engine-internal terms
- THEN `verb`, `path`, and `reason` are named, and no wire-level/IR-batch terminology appears

### REQ-AOD-06: Dry-Run Usage — Function on `./commons`, Not a Subpath

A dry-run usage doc MUST document `dryRun()` as a function importable from the installed
`./commons` entry (`import { dryRun } from "@pbuilder/sdk/commons"`) — NOT as its own
subpath — demonstrating iteration over the returned `DryRunEntry[]` before any directive
is emitted.

#### Scenario REQ-AOD-06.1: Doc imports `dryRun` from `./commons`

- GIVEN the dry-run usage doc
- WHEN its import example is inspected
- THEN it imports `dryRun` from `@pbuilder/sdk/commons`, not from a dedicated subpath

#### Scenario REQ-AOD-06.2: Doc demonstrates iterating `dryRun()` entries

- GIVEN the dry-run usage doc
- WHEN its example code is inspected
- THEN it shows iterating over `dryRun()`'s returned entries

### REQ-AOD-07: Docs-as-Test — Machine Leg (Linked/Installed Swap Target)

The quickstart's fenced TypeScript code blocks MUST execute green as automated tests,
extracted via the `test/docs/testing-story-docs.test.ts` extraction harness
(`extractSection` + fenced-block parsing), with the import swap target being the
LINKED or INSTALLED `@pbuilder/sdk` package — NEVER a relative `src/` path.

#### Scenario REQ-AOD-07.1: Quickstart code blocks run green against the linked/installed package

- GIVEN the quickstart's fenced TypeScript blocks, extracted via the shared markdown-section harness
- WHEN each is run with its import resolved against the `bun link`ed or tarball-installed package
- THEN each block passes unmodified beyond the import specifier

#### Scenario REQ-AOD-07.2 [red-proof]: A `src/`-relative swap target is never the mechanism

- GIVEN the machine-leg test's swap logic
- WHEN inspected
- THEN it resolves against the linked/installed package name, and no code path substitutes a relative `src/` import as the swap target

### REQ-AOD-08: Docs-as-Test — Human Leg (Recorded Walkthrough)

A fresh reader MUST complete one recorded, one-pass walkthrough from local install to a
passing typed factory using ONLY the docs — never opening `src/` or `test/` — producing a
binary verdict (pass/fail) recorded as evidence for this change.

#### Scenario REQ-AOD-08.1: Recorded walkthrough yields a binary verdict without src/test access

- GIVEN a fresh reader following only the published docs
- WHEN they attempt to reach a passing typed factory against the fake
- THEN the walkthrough is recorded with a binary pass/fail verdict, and the reader never opens `src/` or `test/`

### REQ-AOD-09: Planning-Doc Reconciliation

`ROADMAP.md`, the Stage 6 problem statement, and `openspec/pending-changes.md` MUST be
mutually consistent: rows 27, 33, 34, 35, 86, and 143 marked retired; row 74 formally
excluded and re-tagged to the cross-repo engine-gated bucket (not Stage 6, no real
`EngineClient` exists in this repo); L2+ explicitly marked out of scope; and the Stage 6
milestone text states release-READINESS, not a release.

Additionally (V2, council ruling D8): rows 56 (`BATCH_CAP_BYTES`) and 142 (provenance
go-live checklist) MUST be re-tagged to the PC-PROTO-01/public-package bucket; row 175's
trigger MUST be re-pointed at the sdk-kit extraction/public-package plan (superseding its
V1 trigger); and a NEW pending-changes entry MUST record that the GitHub Environment
required-reviewers gate is a MANDATORY precondition of removing `--dry-run` (go-live),
deferred to the public-package plan — making security's conditional acceptance of the
`--dry-run` pin (REQ-PPH-03) durable rather than implicit.

#### Scenario REQ-AOD-09.1: Rows 27/33/34/35/86/143 show retired status

- GIVEN `openspec/pending-changes.md` after this change
- WHEN rows 27, 33, 34, 35, 86, and 143 are inspected
- THEN each is marked retired/closed

#### Scenario REQ-AOD-09.2: Row 74 is re-tagged away from Stage 6

- GIVEN row 74 (EmitRejection port conformance)
- WHEN its Stage tag is inspected
- THEN it no longer reads "6" and instead names the cross-repo engine-gated bucket

#### Scenario REQ-AOD-09.3: ROADMAP states release-readiness, not a release

- GIVEN `ROADMAP.md`'s Stage 6 section after this change
- WHEN its milestone text is read
- THEN it states Stage 6 delivers release-readiness, with the first live publish deferred to a separate future gate

#### Scenario REQ-AOD-09.4: Rows 56 and 142 re-tagged to the PC-PROTO-01/public-package bucket

- GIVEN `openspec/pending-changes.md` after this change
- WHEN rows 56 and 142 are inspected
- THEN each names the PC-PROTO-01/public-package bucket, not Stage 6

#### Scenario REQ-AOD-09.5: Row 175's trigger is re-pointed at the sdk-kit extraction/public-package plan

- GIVEN row 175 after this change
- WHEN its trigger text is read
- THEN it names the sdk-kit extraction/public-package plan as the trigger, superseding its V1 wording

#### Scenario REQ-AOD-09.6: A new pending-changes entry records the required-reviewers go-live precondition

- GIVEN `openspec/pending-changes.md` after this change
- WHEN scanned for the GitHub Environment required-reviewers gate
- THEN a new entry states it is a MANDATORY precondition of removing `--dry-run`
  (go-live), deferred to the public-package plan

### REQ-AOD-10: Demo Narrative Restructure (pending row 86)

The objectives-plan end-state demo narrative (`openspec/objectives-plan.md`) MUST call
`dryRun()` before any read or dialect-open, so the shown plan is not partial under
eager-flush.

#### Scenario REQ-AOD-10.1: Demo narrative sequences `dryRun()` before the first read/dialect-open

- GIVEN the end-state demo narrative text in `openspec/objectives-plan.md`
- WHEN its sequence of operations is read in order
- THEN `dryRun()` is called before any `read()` or dialect `find()` call

### REQ-AOD-11: Consumer-Side Typecheck Leg for the Quickstart's Typed Factory

The quickstart's typed factory MUST typecheck via `tsc --noEmit` INSIDE a scratch
consumer — with its own `tsconfig.json` and `typescript` devDependency — resolving the
installed or linked `@pbuilder/sdk` package's `.d.ts` files. Runtime green alone is
insufficient because types are erased at runtime; only a consumer-side `tsc` run proves
the generated types are real and usable from outside the repo.

#### Scenario REQ-AOD-11.1: Scratch consumer's `tsc --noEmit` passes against the quickstart's typed factory

- GIVEN a scratch consumer with its own `tsconfig.json` and `typescript` devDependency,
  the `@pbuilder/sdk` package installed or linked, and the quickstart's `factory.ts`
  example copied in verbatim
- WHEN `tsc --noEmit` runs inside the scratch consumer
- THEN it exits zero

#### Scenario REQ-AOD-11.2 [red-proof]: A non-existent generated field reference fails `tsc`

- GIVEN the same scratch consumer, with the quickstart's `factory.ts` example modified to
  reference an `Input` field the generated type does not have
- WHEN `tsc --noEmit` runs inside the scratch consumer
- THEN it fails with a type error naming the missing field — proving the consumer-side
  typecheck leg actually resolves and checks against the generated `.d.ts`, not a
  permissive stub

### REQ-AOD-12: Sensitive Areas Registry Reconciliation

`openspec/sensitive-areas.md` MUST be amended to reflect this change's hardened publish
posture: the deployment row's confidence MUST move low→medium, with
`.github/workflows/publish.yml` added to its paths and the hardened posture (SHA-pins,
repo-owner guard, trigger-surface restriction) noted; the supply-chain row MUST note the
documented `dist/core/**` ship-not-strip decision (REQ-FPS-06) and the SHA-pin convention
(REQ-PPH-02); and the blanket "Review Required" sentence claiming "none reflect existing
code" MUST be corrected, since this change's rows now do.

#### Scenario REQ-AOD-12.1: Deployment row moves low→medium confidence with `publish.yml` in paths

- GIVEN `openspec/sensitive-areas.md`'s deployment row after this change
- WHEN inspected
- THEN its confidence reads medium, `.github/workflows/publish.yml` is listed in its
  paths, and the hardened posture is noted

#### Scenario REQ-AOD-12.2: Supply-chain row notes the `dist/core` decision and SHA-pin convention

- GIVEN `openspec/sensitive-areas.md`'s supply-chain row after this change
- WHEN inspected
- THEN it references the documented `dist/core/**` ship-not-strip decision and the
  SHA-pin convention

#### Scenario REQ-AOD-12.3: The "none reflect existing code" blanket sentence is corrected

- GIVEN `openspec/sensitive-areas.md`'s "Review Required" section after this change
- WHEN read
- THEN it no longer blanket-states that none of the rows reflect existing code

## Sensitive Areas Coverage

No sensitive areas apply directly to this domain (docs-only); it inherits public-API
framing from `factory-package-shape`/`publish-pipeline-hardening` by reference only.
REQ-AOD-12 is the exception — it directly edits the sensitive-areas registry itself.

## Open Flags for Design

- Exact doc filenames beyond `docs/quickstart.md` (verb reference, error contract,
  dry-run usage) — design assigns concrete paths following `docs/authoring-a-dialect.md`'s
  naming convention.
- Whether the human-leg walkthrough (REQ-AOD-08) is performed by the owner or a
  designated fresh reader, and where its record is persisted — design/slice decision.
