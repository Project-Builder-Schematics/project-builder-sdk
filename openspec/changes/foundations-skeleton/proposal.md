# Proposal: foundations-skeleton

**Change**: `foundations-skeleton` · **Triage**: L · **Phase**: propose

## Intent

Stand up the **publishable, executable spine** of `@pbuilder/sdk`: a thin walking skeleton that proves
the `emit → read-your-own-write` conversation end-to-end **against the contract fake**, with the kit
boundary, golden-IR, and fitness functions born in CI from day one — so every later layer (L1 verbs,
dialects, op-packs) builds on a verified spine with guardrails. Instantiates ADRs 0001-0012.

## Scope

**In** (resolved with the user):
- Publishable `@pbuilder/sdk` (Bun, `type:module`, `exports` map, separate publish emit config), and the
  **CI publishes `0.0.0-dev` within this change** with **provenance/OIDC** (no long-lived token;
  publish job isolated from PR/fork builds).
- The core **kit** behind the ADR-0009 extraction-ready boundary: `EngineClient` port · `Session`
  (flush-before-read, 4 MiB cap) · `DirectiveFactory` (ADR-0028 shapes) · `BaseFileHandle` +
  `FoundHandle`/`WritableHandle` state machine · `AsyncLocalStorage` `RunContext` (ADR-0011).
- The **contract-fake engine** — the *sole* `EngineClient` impl in this change — + a **fake-fidelity**
  suite (eager array-order apply, Tree-first read, flush-before-read + served-from, fail-closed + force
  all 3 precedence rows, idempotent delete; porting the engine's ir-delete/ir-move GWT scenarios).
- The **walking skeleton** (`defineFactory` → `create` → flush → fake applies eagerly → `read` returns
  byte-exact written content) + **golden-IR** per ADR-0028 op (incl. `copy` shape-only).
- The **fitness functions** (roadmap §7's 6 + ADR-0008 no-tree + ADR-0009 no-kit-bleed), each shipped
  with a **proof it fires red**, in CI day one.
- Public-repo standards (CONTRIBUTING, CODE_OF_CONDUCT, **SECURITY with the explicit-trust statement**,
  issue/PR templates, CI on forks/PRs), stub `docs/authoring-a-dialect.md`, and the conformance-kit
  scaffold (`testDialect`/`testOpPack` stubs + meta-tests).
- Two ADRs the change formalizes (roadmap §1): **verb→IR lowering table** + **single-package + subpath
  shape** (with the monorepo-deferral trigger).

**Out**: full L1 verb implementation · any real dialect / AST library / op-pack (T-M2) · real bun-ipc
transport (engine HOSTS its own pinned sidecar — later, gated on engine §6) · publishing
`@pbuilder/sdk-kit` as a separate package (extract later — ADR-0009) · `read-staged` (engine §6) · the
full conformance-kit implementation · `copy` **apply-behaviour** against the fake (shape-only golden;
behaviour at T-M2) · **working `defineDialect`/`withOps` generics** (types + thin
signatures only; the first real dialect at T-M2 is the second user that earns them).

## Capabilities (the contract with sdd-spec)

| Cap | What it delivers |
|---|---|
| CAP-PKG | Publishable package shape: `exports` map, build + `.d.ts` emit, CI publishing `0.0.0-dev` with provenance/OIDC |
| CAP-KIT | The core kit (port/session/factory/handle/state/context) behind the extraction-ready ADR-0009 boundary |
| CAP-FAKE | The contract-fake `EngineClient` + fake-fidelity conformance (the downstream oracle) |
| CAP-SKEL | The walking skeleton: factory → create → flush → fake → **byte-exact read-your-own-write** |
| CAP-GIR | Golden-IR per ADR-0028 op (exact-key; `create` template unprocessed; `copy` shape-only) |
| CAP-FIT | The fitness functions + ADR-0008/0009 ones, each with a red-proof, CI day one |
| CAP-STD | Public-repo standards + SECURITY explicit-trust statement + stub authoring-a-dialect doc + the 2 ADRs |
| CAP-CONF | Conformance-kit scaffold (`testDialect`/`testOpPack` stubs + meta-tests; not full impl) |

## Approach

Build the **contract fake first** (it is the test oracle — ADR-0007; TDD against the engine's GWT
scenarios). Then `DirectiveFactory` + golden-IR (pure, isolated). Then `Session` + `RunContext` +
`commons.create`/`find` → the walking skeleton asserts read-your-own-write through the fake. Fitness
functions + repo standards + the publish pipeline land alongside, each gated red-first. `defineDialect`
ships **types only** to lock the boundary.

## Risks

- **Premature kit generics** — `defineDialect`/`withOps` with no real dialect. → types + thin signatures
  only; T-M2 is the second user.
- **Vacuous-green fitness** — FF#3 passes with `external_deps:[]`; FF#4 needs a `.d.ts` baseline. → each
  FF ships a red-proof (FF#3 with a fixture AST import).
- **Fake ≠ engine** — a sloppy fake makes every downstream test a false-green. → fake-fidelity suite
  porting the engine's ir-delete/ir-move GWT.
- **Publish credential exposure** — first `0.0.0-dev` publish creates the credential. → OIDC provenance,
  publish job isolated from PR/fork (security-engineer gate).
- **tsconfig `noEmit` vs publish** — dev config can't emit `.d.ts`. → separate build/emit config.

## Rollback Plan

Greenfield: rollback = revert the scaffolding (remove `src/`, `test/`, CI, `exports`); no production
impact. The `0.0.0-dev` publish is a dev tag — deprecate the version if needed; nothing downstream
depends on it yet.

## Success Criteria

Walking skeleton green with **byte-exact** read-your-own-write · all fitness functions green AND each
demonstrated red against a deliberate violation · golden-IR locked per ADR-0028 · `0.0.0-dev` published
via CI with provenance · repo-standard files present (SECURITY states explicit-trust) · the 2 ADRs
written · the kit boundary fitness-enforced (no author subpath re-exports a kit symbol) · the conformance
meta-test goes RED when a kit property is removed (CAP-CONF) · the handle type-negatives
(`create().remove`) fail to compile while positives compile (KIT-04).
