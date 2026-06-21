# Exploration: foundations-skeleton

**Phase**: explore (LIGHT — design decided across ADRs 0001-0012 + 2 council passes)
**ready_for_proposal**: partial → `ready` once the product open-questions are answered.

## Current state — the executable gap

Greenfield executable surface. **Exists** (config only): `package.json` (`@pbuilder/sdk` 0.0.0, `type:module`, Bun 1.3.11, scripts `test`/`typecheck`), `tsconfig.json` (`strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` + `noEmit` + `moduleResolution:bundler`), `LICENSE` (MIT), `README`, `ROADMAP`, full `openspec/` (12 ADRs), `.sdd/`, `.atl`. **Missing — everything executable**: no `src/`, no `test/`, no `package.json#exports`, no build/`.d.ts` pipeline, no linter, no CI, no fitness tests, none of the public-repo standards files.

## Scope-determining finding (must ratify before propose)

The engine is the **HOST**: it spawns its OWN embedded, **hash-pinned** Bun sidecar; the wire (4-byte length-prefixed JSON frames, request/response, `fs.readFile` host-callback, 4 MiB cap) is **engine-owned**. The SDK does **not** dial into the engine. Therefore foundations-skeleton's `EngineClient` has **exactly ONE implementation: the contract fake**. Real bun-ipc transport is a **later track** (engine-backed release, §6), OUT of this change. This aligns with ADR-0007 + roadmap §6/§9. (`config.yaml`'s "over the existing bun-ipc wire" is misleading — flag for correction.)

## Scaffolding plan (affected areas)

```
package.json        # + exports: "." (umbrella→commons), "./commons", "./conformance"; NO "./core"/"./internal"/"./kit"
                    # + build/dts/lint scripts; reserved (un-exported) dialect subpath documented, wired at T-M2
src/
  core/             # === ADR-0009 KIT BOUNDARY (extraction-ready → @pbuilder/sdk-kit) ===
    engine-client.ts · session.ts · directive-factory.ts · wire.ts
    base-handle.ts · handle-state.ts · context.ts (AsyncLocalStorage) · define-dialect.ts (TYPES+thin only)
    contract-fake.ts · index.ts (future kit root)
  commons/index.ts  # find/create/copy — skeleton wires create (+find stub). NO AST.
  conformance/index.ts  # testDialect/testOpPack stubs + meta-test placeholder (ADR-0012)
  index.ts          # umbrella, re-exports commons surface only
test/ fitness/ · skeleton/ · conformance/
+ CONTRIBUTING · CODE_OF_CONDUCT · SECURITY · issue/PR templates · CI (forks/PRs) · docs/authoring-a-dialect.md (stub)
```

## Approaches + tradeoffs (tooling the ADRs leave open)

- **Linter:** Biome (config candidate; lean) vs ESLint+Prettier — but FF#1/#2/#5 live in **bun-tests** (import-graph + JSON-roundtrip) regardless, since a test can't be disabled per-line.
- **FF#4 .d.ts semver gate:** committed `.d.ts` snapshot + CI diff (lean, Bun-native) vs api-extractor. Needs a **separate emit config** (dev tsconfig is `noEmit`).
- **FF#3 payload budget:** `bun build --analyze` of `/commons` + forbidden-module probe; **must ship with a fixture AST import proving it fires red** (else vacuous-green with `external_deps:[]`).
- **Type-level tests:** `expect-type` (positive) + `@ts-expect-error` (negative) + the **permissive-Handle mutation proof**; lean `expect-type` (single Bun runner).
- **Mutation-resistance:** no runner (StrykerJS Bun support immature) → enforced by **discipline** (paired asserts + meta-tests "remove a property → red"); must be mandatory.

## Caveats for spec/design (carry forward)

- Skeleton ships `defineDialect`/`defineOpPack`/`withOps` **types + thin signatures ONLY** — NOT working generics; T-M2 (first real dialect) is the second user that earns them. Resist premature abstraction.
- The **fake-fidelity conformance suite** (eager array-order apply, Tree-first read, flush-before-read + served-from tag, fail-closed + force **all 3 precedence rows**, idempotent delete) is a spec REQ — the fake is the oracle for everything downstream (ADR-0007).
- **Every fitness function ships with a red-proof.** Walking-skeleton e2e = **byte-exact read-your-own-write content equality** (NOT "did not throw").

## ADR candidates (this change formalizes — roadmap §1)

verb→IR lowering table · single-package + subpath-exports shape (+ monorepo-deferral trigger) · (candidate) tooling-stack.

## open_questions

**product (surfaced to user now):** (1) acceptance bar = **fake-only**, real engine deferred? (2) `0.0.0-dev` publish DONE within this change vs follow-up? (3) dialect subpath **reserved-only** vs working no-op? (4) `copy` in golden-IR shape-only [orchestrator leaning: include — wire shape is pinned].
**technical (inject into spec/design):** Biome vs ESLint+Prettier · dts-gate snapshot+diff vs api-extractor · FF#3 mechanism+threshold+red-proof fixture · type-level lib (`expect-type`) · mutation-resistance enforcement (discipline vs runner).

## ready_for_proposal

**partial** → `ready` once the product questions are answered (esp. the fake-only scope boundary + publish trigger). Technical questions ride into spec/design without blocking.
