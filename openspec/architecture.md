# Architecture — project-builder-sdk
Updated: 2026-06-21

## Layers
- @pbuilder/sdk [lib • TypeScript • Bun (no app framework)] — repo root (single-layer library)

## Topology

@pbuilder/sdk (lib • TypeScript • Bun)
└──►─ Project Builder engine          [JSON-RPC over stdio · EngineClient.emit/read/commit/discard · contract fake only]

◄── inbound · ──► outbound · ◄► bidirectional

## Pattern
- @pbuilder/sdk: custom — layered modules behind an IR-seam port
  Evidence: `src/commons/` (author verbs) → `src/core/` (Session, DirectiveFactory, handle-state) → `src/core/wire.ts` (Directive shapes) → `src/core/engine-client.ts` (single `EngineClient` port). No `adapters/`/`ports/`/`usecases/`/`domain/` folders; the seam is a single interface, not a hexagonal scaffold.

## Interconnection
- @pbuilder/sdk → Project Builder engine: JSON-RPC over stdio (planned) via the `EngineClient` port (`src/core/engine-client.ts`). No real client ships in `src/`; the only implementation is the contract fake at `test/support/contract-fake.ts`. Wire methods `ir.emit` / `tree.read` are not yet on the engine (ROADMAP §6).

## Scaffolding

@pbuilder/sdk:
  Primary:       commons/index.ts (author verbs: create/find/modify/remove/rename/move/copy)
                   ──► core/context.ts (currentContext / defineFactory, AsyncLocalStorage RunContext)
                   ──► core/session.ts (buffer + flush-before-read)
                   ──► core/directive-factory.ts (args ──► Directive)
                   ──► core/wire.ts (Directive / Batch shapes)
                   ──► core/engine-client.ts (EngineClient port ──► engine)
  Handle types:  commons/index.ts ──► core/handle-state.ts ──► core/base-handle.ts (ReadOps / WriteOps, open handle ADR-0010)
  Dialect kit:   core/define-dialect.ts (defineDialect / defineOpPack / withOps — thin stubs, generics deferred to T-M2)
  Conformance:   conformance/index.ts (testDialect / testOpPack — frozen signatures, throw until first dialect exists)

## Build / Deploy
npm package (`@pbuilder/sdk`, public, subpath exports) built by `tsc -p tsconfig.build.json` (emits `dist/` .js + .d.ts). • CI: GitHub Actions — `ci.yml` (build + `bun test` + strict typecheck + inverted permissive-proof gate) on non-main/PR; `publish.yml` on push to `main` (dev prerelease `0.0.0-dev.<sha>`, npm trusted publishing via OIDC, currently `--dry-run` awaiting registry trust).

## Public API
COMPACT: 0 REST, 0 GraphQL, 0 WS events, 0 gRPC — public surface is the `package.json#exports` subpath map (3 entries)
EXTENDED:
- `.` → `./dist/index.js` — umbrella; re-exports `./commons` only (core NOT re-exported, ADR-0009 internal boundary)
- `./commons` → `./dist/commons/index.js` — author verbs: `find`, `create`, `modify`, `remove`, `rename`, `move`, `copy`; types `CreateOptions`, `FoundHandle`, `WritableHandle`
- `./conformance` → `./dist/conformance/index.js` — `testDialect`, `testOpPack`; types `DialectFixture`, `OpPackFixture`

## Conventions
- New author verb → `src/commons/index.ts` (positional path + trailing options; lowers to a `Directive` via `DirectiveFactory`, buffered on the `Session`).
- New internal kit primitive → `src/core/` (re-exported from `src/core/index.ts`, the extraction-ready `@pbuilder/sdk-kit` boundary; never re-exported from the umbrella).
- Naming: kebab-case filenames (`base-handle.ts`, `directive-factory.ts`, `handle-state.ts`, `define-dialect.ts`).
- Public API = `package.json#exports` map + emitted `.d.ts` — every export is a semver contract (`.d.ts` semver gate fitness fit-04).
- Module split: `commons` (file-type-agnostic ops, no AST imports) vs dialect modules (library-specific AST ops, deferred).

## Data flow
- Author verb (`create`/`modify`/…) → `DirectiveFactory.{op}` → `Session.buffer(directive)` → (on `read()` or run-end `finally`) `Session.flush()` → `EngineClient.emit(Batch)` → engine.
- Read path: handle `read()` → `Session.read(path)` → `Session.flush()` (flush-before-read, read-your-own-writes) → `EngineClient.read(path)`.
- Run lifecycle: `defineFactory(fn)` builds `RunContext` (Session + DirectiveFactory) in an `AsyncLocalStorage`, runs `fn`, then `flush()` + `commit()` on success / `discard()` on throw (`try { run; flush; commit } catch { discard; throw }` — no `finally`). All-or-nothing contract: a throw mid-run discards staged directives — committed state stays empty, no partial write at the seam (`src/core/context.ts`). The transactional staging→commit boundary is owned by the engine (`EngineClient.commit`/`discard`), modeled in the contract fake; real engine §6 (l1-author-surface-skeleton ADR-01, reversing the prior partial-write contract).
- Dry-run path (SEAM-02): `Session.pendingSnapshot()` exposes a read-only `Directive[]` copy → `src/dry-run/plan.ts` `dryRunPlan(snapshot)` renders author-vocabulary `{verb, path}` entries. AST-blind / core-blind: imports ONLY `type Directive` from `wire.ts` (fitness-scanned).
- Error attribution (SEAM-04): `Session.flush` wraps the `EngineClient.emit` call site, translating a raw engine rejection to an `AuthoringError{verb, path}` (author vocabulary, no engine text) via `src/core/authoring-error.ts` before it reaches `defineFactory`.

## Testing
- unit/contract: `bun test` @ `test/skeleton/*.test.ts` (Session, context, directive-factory, handle-chaining, read-your-own-write), `test/fake/*.test.ts` (contract-fake fidelity), `test/conformance/meta.test.ts`
- golden: `bun test` @ `test/golden-ir/golden-ir.test.ts` (+ `fixtures.ts`) — IR wire-shape snapshots
- fitness: `bun test` @ `test/fitness/fit-01..09-*.test.ts` (9 functions: commons-no-AST, dialect-leaf-rule, commons-bundle-budget, .d.ts semver gate, serializable-bytes, example-jsdoc, no-tree-in-core, no-kit-bleed, pkg-exports-resolution)
- type-level: `expect-type` @ `test/types/*.test.ts`; negative type proofs @ `test/types/permissive-proof.ts` via `tsconfig.permissive-proof.json` (non-zero exit IS success, inverted in CI)
- coverage: `bun test --coverage` (threshold not yet enforced)

## Notes
- `package.json#files: ["dist"]` ships the WHOLE `dist/` tree — including `dist/core/**` (`base-handle`, `context`, `define-dialect`, `directive-factory`, `engine-client`, `handle-state`, `session`, `wire`, `index`) — into the published tarball, despite `src/core/index.ts` declaring the core kit an internal boundary (ADR-0009) and the umbrella `src/index.ts` deliberately NOT re-exporting it. The subpath `exports` map exposes only `.`, `./commons`, `./conformance`; `./core` is unmapped but the files are present in the tarball.
- The `EngineClient` port (`src/core/engine-client.ts`) surface is `emit` / `read` / `commit` / `discard` (`commit`/`discard` added by l1-author-surface-skeleton for the all-or-nothing transaction boundary — ADDITIVE; `emit`/`read` signatures unchanged). It has NO production implementation in `src/`. The sole implementation is the contract fake `test/support/contract-fake.ts` (two-phase staging/committed model). The real JSON-RPC transport is unbuilt — `ir.emit` / `tree.read` (and the real transactional commit) are not yet on the engine wire (ROADMAP §6, lines 168–169).
- `conformance/index.ts` exports `testDialect` / `testOpPack` whose bodies `throw` ("full conformance implementation is not yet available — no dialect exists yet"); the surface is frozen but unimplemented (deferred to T-M2).
- `core/define-dialect.ts` (`defineDialect` / `defineOpPack` / `withOps`) are thin stubs — real generics (AST type param, op-pack intersection, handle factory) deferred to T-M2.
- `publish.yml` provisions Node 22 (`actions/setup-node`) for the npm CLI/OIDC publish step while `package.json#engines` declares `bun >=1.0.0` only and no `engines.node` — Node is the publish tooling, Bun the runtime; not a runtime-version mismatch.
