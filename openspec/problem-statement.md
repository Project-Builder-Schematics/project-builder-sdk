# Problem Statement — @pbuilder/sdk

- Status: Ratified by the owner, 2026-07-04
- Canonical: this file wins over `ROADMAP.md` and any prior planning framing wherever they conflict.
- Companion: the WHAT-level delivery plan lives in `openspec/objectives-plan.md`.

## Who

Developers writing Project Builder schematics.

## Pain

They have no typed, ergonomic way to describe file-tree mutations — and no way to turn that
intent into the IR the Project Builder engine consumes. Without this SDK, a schematic is raw
Tree/AST plumbing with untyped options: mechanically indistinguishable from an ad-hoc script.

## Why now

The engine owns execution but has no developer-facing half. This repo is that half.
**"The developer authors; the engine enforces."**

## The two objectives

1. **IR generation** — turn author intent into correct wire directives for the six mutations:
   `create`, `move`, `rename`, `delete` (exported as `remove`), `copy`, `modify`. The IR is the
   product — a connected engine is NOT required to deliver it; the engine is simulated by a
   contract fake, which is a **legitimate counterpart, not a stopgap**.
2. **Developer experience** — how authors import and use the SDK's libraries and modules.
   Inspired by Angular Schematics, then simplified and adapted: `factory.ts` + `schema.json`,
   direct verbs instead of Tree/Rule/chain composition plumbing, dialect selection by import
   (`@pbuilder/sdk/commons`, `@pbuilder/sdk/<dialect>`), typed options.

## Invariant principles (non-negotiable)

- **Everything happens inside a factory.** Reading files, implementing mutations — all authoring
  behaviour is expressed within `factory.ts`. No SDK surface outside the factory context.
- **The SDK never touches the target tree.** Every read is a question to the engine and returns a
  virtual copy of the content. Simulable via the contract fake.
- **The SDK never processes templates.** `create` carries the Go template + options
  uninterpreted; the engine renders (see `src/core/wire.ts`).
- **The AST never crosses the seam.** `modify` is where the SDK has its greatest impact (the
  per-file-type AST dialect libraries), but only final bytes travel in the IR. The engine stays
  AST-blind.
- **The engine boundary is ONE abstraction.** The engine owns all file control — reading,
  mutating, and validating (including paths: the SDK never reads, validates, or normalizes
  author paths; they travel verbatim, and validity is engine judgment). The SDK only sends and
  receives: every input from the engine and every output to the engine crosses the single
  `EngineClient` port (`src/core/engine-client.ts`), so any counterpart — the contract fake or
  a future real client — plugs in with zero SDK changes.

## Quality attribute — testability (first-class)

The SDK must stay EASY to test at four layers, for two audiences — this repo's contributors AND
schematic/dialect authors:

1. **Unit** — pure pieces (directive factory, renderers, type-level proofs) testable with no
   engine at all.
2. **Fitness** — the architectural invariants above enforced structurally in CI (the FIT-*
   suite).
3. **Integration** — cross-boundary behavior against the unmocked contract fake.
4. **End-to-end** — a whole factory run: `factory.ts` → emitted batch → fake virtual tree.

The single engine port + the in-memory contract fake are the enabling design: swapping the
counterpart is what makes every layer cheap.

## Definition of IR correctness (without a real engine)

A mutation is IR-correct when all three hold:

1. **Golden-IR** — the exact `Batch` envelope (`protocolVersion, force, instructions` order, per
   `src/core/wire.ts`) for the author program is pinned in `test/golden-ir/` fixtures.
2. **Fake-contract** — the contract fake (`test/support/contract-fake.ts`) applies the directive
   with ratified semantics (read-your-own-write; all-or-nothing commit/discard, ADR-0015; read
   trichotomy, ADR-0016), pinned by `test/fake/` tests.
3. **Fitness invariants** — commons-imports-no-AST, only-serializable-bytes-cross-the-seam, and
   no-tree-persistence-in-core stay structurally green.

## Out of scope

- Executing mutations / owning the disk (engine territory).
- The real engine wire (`ir.emit` / `tree.read` — engine board, different repo).
- Prompt UX from `schema.json` (the engine consumes the same schema for prompts).
- L2 composition (`invoke`/`extends`), cross-collection, external collections/trust.
- Monorepo extraction (single package + subpath exports is the v1 shape).
