# Architecture — project-builder-sdk
Updated: 2026-07-12

## Layers
- @pbuilder/sdk [lib • TypeScript • Bun (no app framework)] — repo root (single-layer library)
  - **src/dialects/ (first dialect leaf, NEW stage-5)**: `src/dialects/typescript/` — the FIRST real dialect, published at `@pbuilder/sdk/typescript`. `index.ts` (the `find(path)` entry verb + `addImport` op-pack composition), `ast.ts` (the ts-morph `parse`/`print` pair — the ONLY module that imports ts-morph), `ops.ts` (the `addImport` structured op). Leaf-isolated: nothing under `src/commons/**` or the shared kit reaches it; FIT-02 forbids a dialect importing a sibling dialect.
  - **src/core/dialect-handle.ts (coalescing seam, NEW stage-5)**: the kit-internal handle factory (`createDialectHandle`) that owns ADR-0006's seam — read-through-parse once, hold ONE live AST across a chain, serialize once (lazy, memoized) at flush. Thenable (private `#tail` promise queue); registers itself on the run-boundary join. Kit-internal, no public subpath, not fitness-pinned (only the PUBLIC `find` + the `Handle<State,Ast,Ops>` TYPE are frozen).
  - **src/core/schema/ (stage-4)**: the shared schema cluster (parse/validate/locate/emit-mapping) behind the IR seam, consumed by both runtime (run-boundary check) and the bin (codegen).
  - **src/testing/ (author-testing sub-surface, stage-4b)**: the THIRD audience. `runFactoryForTest` facade + the normative `ContractFake` (relocated here) + shared rejection-message dictionary. Shipped via `./testing`, in-memory only (no fs, no real engine).
  - **bin/ (build-time tooling, stage-4)**: `bin/pbuilder-codegen.ts` + `bin/emit-type.ts` — a zero-dep codegen CLI shipped via `package.json#bin`, OUTSIDE `src/` (FIT-15 bin→core one-way rule).

## Topology

@pbuilder/sdk (lib • TypeScript • Bun)
└──►─ Project Builder engine          [JSON-RPC over stdio · EngineClient.emit/read/commit/discard · contract fake only]

@pbuilder/sdk/typescript (first dialect • NEW stage-5)
└──►─ ts-morph@28.0.0                  [in-process AST parse/print · FIRST runtime dependency · reachable ONLY from src/dialects/typescript/**]

@pbuilder/sdk/testing (author-testing facade • in-memory)
└──►─ ContractFake (in-memory)        [runFactoryForTest wraps the normative fake · RecordingClient spy · NO engine, NO fs, NO target tree]

@pbuilder/sdk/conformance (dialect-conformance kit • REAL bodies stage-5)
└──►─ run-vehicle (kit-internal)      [in-memory EngineClient-shaped transport · drives REAL runs via defineFactory · NOT exported, FIT-08]

pbuilder-codegen (build-time CLI • TypeScript • Bun-built node-target bundle)
├─◄── author's factory package        [reads <package-dir>/schema.json · fs, write-contained to project root]
└──►─ author's factory package        [writes <package-dir>/schema.generated.ts · type-only, inert]

◄── inbound · ──► outbound · ◄► bidirectional
Note 1: ts-morph is the SDK's FIRST runtime `dependency` (exact-pinned `28.0.0`, committed `bun.lock`). It is LEAF-ISOLATED — imported only by `src/dialects/typescript/{ast,index,ops}.ts`; FIT-01's transitive import-graph walk proves it never reaches `src/commons/**` at any depth.
Note 2: the `./typescript` dialect edge is IN-PROCESS (a library call), not the engine wire. Only final `[]byte` (the printed AST) crosses the IR seam as a `modify` directive's `content`; the live ts-morph `SourceFile` never does.
Note 3: `./conformance`'s `run-vehicle.ts` is a kit-internal, in-memory transport that satisfies the port SHAPE via a LOCAL structural interface — it never names the `EngineClient`/`EmitRejection` port type (FIT-10) and is never re-exported (FIT-08). It is a SEPARATE, deliberately thin implementation from `src/testing/contract-fake.ts` (each has a distinct purpose; neither is the other).
Note 4: `./testing` and `pbuilder-codegen` retain their stage-4/4b postures — no engine edge, in-memory/write-contained I/O only.

## Pattern
- @pbuilder/sdk: custom — layered modules behind an IR-seam port, plus dialect leaves
  Evidence: `src/commons/` (author verbs) → `src/core/` (Session, DirectiveFactory, handle-state, dialect-handle) → `src/core/wire.ts` (Directive shapes) → `src/core/engine-client.ts` (single `EngineClient` port); `src/dialects/`, `src/dry-run/`, `src/testing/` sit beside `core` as deliberately-isolated leaves. No `adapters/`/`ports/`/`usecases/`/`domain/` folders; the seam is a single interface, not a hexagonal scaffold.
- **`src/dialects/typescript/` cluster (NEW stage-5)**: an author-facing dialect leaf. `index.ts` composes the sanctioned kit surface ONLY (`defineDialect`/`defineOpPack`/`withOps` from `core/define-dialect.ts`) — no port-internal machinery imported anywhere in the tree (FIT-08/FIT-10). `ast.ts` is the sole ts-morph importer: a FROZEN `ManipulationSettings` + a CONTENT-derived `newLineKind` (never host-OS), a fresh `Project` per parse (never a module-level singleton), no language-service formatter, and a WeakMap-tracked BOM re-prepend (ts-morph@28.0.0's `getFullText()` strips a leading BOM — the module owns byte-exact BOM round-trip). `ops.ts`' `addImport` merges into an existing same-module clause, else inserts fresh; idempotent.
- **`src/core/dialect-handle.ts` (coalescing seam, NEW stage-5, ADR-0037)**: a `DialectHandleController` owns `#tail` (a private promise queue), the ONE live AST, and ONE open lazy-getter `modify` directive whose `content` resolves exactly once at flush. `#ensureOpen()` re-registers a FRESH directive by IDENTITY check against `session.pendingSnapshot()` — turning a global mid-chain flush into the exactly-two-modifies split (FIT-19). An EAGER shadow-catch is attached to `#tail` in the same turn each op chains, closing the pre-drain `unhandledRejection` window. Inherited write verbs (`modify`/`rename`/`move`/`copy`/`remove`) are RE-OWNED here (enqueued on `#tail` to preserve author order), returning the same thenable handle. An async `.raw()` callback is awaited INSIDE the same containment (council fix). This is EXECUTOR LATITUDE — only the public `find` + `Handle` TYPE are frozen.
- **`src/conformance/` cluster (REAL bodies, stage-5, ADR-0012 amendment)**: `testDialect`/`testOpPack` graduated from throwing stubs to real `Promise<void>` bodies that drive REAL runs through `defineFactory` against the kit-internal `run-vehicle.ts` (in-memory transport). DC-01..05 assertions observe an EMITTED, coalesced batch — ADR-0012 forbids mocking/bypassing the emit seam, so a real run is mandatory. `run-vehicle.ts` is internal-use only, never re-exported.
- **`src/core/schema/` cluster (stage-4)**: cohesive core module behind the IR seam (array model, hand-rolled JSON locator), shared by runtime + bin.
- **`src/testing/` cluster (stage-4b)**: author-facing test-harness leaf reusing the SAME IR seam; `contract-fake.ts` is the sole normative `ContractFake implements EngineClient` (FIT-18 parity-by-identity).
- **Run-boundary validation site (stage-4, ADR-0029/0030)**: `context.ts` `validateAtRunBoundary()` + `checkReservedNames()` run pre-`als.run`; does NOT split the engine boundary (invariant #5 holds at the wire).

## Interconnection
- @pbuilder/sdk → Project Builder engine: JSON-RPC over stdio (planned) via the `EngineClient` port (`src/core/engine-client.ts`). No real client ships in `src/`; the only normative implementation is the contract fake at `src/testing/contract-fake.ts`. Wire methods `ir.emit` / `tree.read` are not yet on the engine (ROADMAP §6).
- **@pbuilder/sdk/typescript → ts-morph (NEW stage-5)**: an in-process library call. `src/dialects/typescript/ast.ts` imports `Project`/`NewLineKind`/`QuoteKind`/`IndentationText`/`SourceFile` from ts-morph and constructs a fresh in-memory-FS `Project` per parse. ts-morph is a plain, EXACT-pinned `dependencies` entry (`28.0.0`, ADR-0038), committed `bun.lock`, published with npm provenance.
- **@pbuilder/sdk/conformance → run-vehicle (NEW stage-5)**: in-process. `conformance/index.ts` imports `createRunVehicle` from `./run-vehicle.ts` (internal), builds a fresh isolated in-memory transport per exercise, and drives a real `defineFactory` run through it, collecting emitted batches for content assertions.
- @pbuilder/sdk/testing (facade) → ContractFake: in-process method calls only (stage-4b). NO network, NO fs, NO engine.
- pbuilder-codegen (bin) → author's factory package: filesystem read of `schema.json`, write of `schema.generated.ts`, write-contained to the invoking project root (stage-4). NO network, NO engine, NO target-tree access.

## Scaffolding

@pbuilder/sdk:
  Primary:        commons/index.ts (author verbs: create/find/modify/remove/rename/move/copy + dryRun)
                    ──► core/context.ts (currentContext / defineFactory<O>; AsyncLocalStorage RunContext with session + factory + dialects; run-boundary schema validation + reserved-name scan)
                    ──► core/session.ts (buffer + flush-before-read + pendingSnapshot)
                    ──► core/directive-factory.ts (args ──► Directive)
                    ──► core/wire.ts (Directive / Batch shapes)
                    ──► core/engine-client.ts (EngineClient port ──► engine)
  Dialect surface: dialects/typescript/index.ts (find(path): Handle<"found", SourceFile, AddImportOps>)
                    ──► core/define-dialect.ts (defineDialect / defineOpPack / withOps — REAL generics, Handle<State,Ast,Ops>)
                    ──► core/dialect-handle.ts (createDialectHandle — #tail queue, one live AST, lazy-getter modify, run-boundary join)
                    ──► dialects/typescript/ast.ts (ts-morph parse/print, frozen settings, BOM round-trip) + dialects/typescript/ops.ts (addImport)
  Run-boundary join: core/context.ts DialectRegistryImpl (register/drain via Promise.allSettled, re-throws first rejection) — defineFactory sequences als.run ──► dialects.drain() ──► session.flush() ──► commit()
  Conformance:     conformance/index.ts (testDialect / testOpPack — REAL Promise<void> bodies, DC-01..05)
                    ──► conformance/run-vehicle.ts (createRunVehicle — kit-internal in-memory transport, LOCAL structural port, never exported)
  Testing facade:  testing/index.ts (runFactoryForTest<O> + RunResult) ──► testing/contract-fake.ts (sole normative ContractFake) ──► testing/rejection-messages.ts
  Schema cluster:  core/context.ts ──► core/schema/{schema-discovery,schema-parse,schema-locate,schema-validate,input-rejection}.ts
  Codegen bin:     bin/pbuilder-codegen.ts ──► bin/emit-type.ts ──► src/core/schema/* [bin→core direction ONLY, FIT-15]
  Error attrib:    core/session.ts flush ──► core/authoring-error.ts (whole-batch attribution, closed 8-value reason union)
  Dry-run:         commons/index.ts dryRun() ──► dry-run/index.ts ──► dry-run/plan.ts (AST-blind + core-blind, type-only import of wire.ts)
  Handle types:    commons/index.ts ──► core/handle-state.ts ──► core/base-handle.ts (ReadOps / WriteOps, open handle ADR-0010)

## Build / Deploy
npm package (`@pbuilder/sdk`, public, subpath exports) built by a TWO-STEP `build`: `tsc -p tsconfig.build.json` (emits `dist/` .js + .d.ts — incl. `dist/dialects/typescript/**`, `dist/testing/**`, `dist/conformance/**`, `dist/core/**`) THEN `bun build bin/pbuilder-codegen.ts --outfile dist/bin/pbuilder-codegen.js --target node --banner "#!/usr/bin/env node"`. `package.json#bin: { "pbuilder-codegen": "dist/bin/pbuilder-codegen.js" }`. `package.json#files: ["dist"]` ships the whole `dist/` tree. **`dependencies: { "ts-morph": "28.0.0" }` — the FIRST runtime dependency (exact-pinned, no range), committed `bun.lock`.** `devDependencies`: `@types/bun`, `expect-type`, `typescript`. `engines.bun >= 1.0.0` only (no `engines.node` — Bun-native; Node is publish/end-user-install tooling for the codegen bin's `#!/usr/bin/env node` shebang). • CI: GitHub Actions — `ci.yml` (build + `bun test` + strict typecheck) on non-main/PR; `publish.yml` on push to `main` (dev prerelease `0.0.0-dev.<sha>`, npm trusted publishing via OIDC + provenance, currently `--dry-run`).

## Public API
COMPACT: 0 REST, 0 GraphQL, 0 WS events, 0 gRPC — public surface is `package.json#exports` (**5 subpaths**) + `package.json#bin` (1 CLI)
EXTENDED:
- `.` → `./dist/index.js` — umbrella; re-exports `./commons` ONLY. Core / `./testing` / `./typescript` NOT re-exported.
- `./commons` → `./dist/commons/index.js` — author verbs `find`, `create`, `modify`, `remove`, `rename`, `move`, `copy`; `dryRun(): DryRunEntry[]`; `AuthoringError` + `AuthoringVerb`/`AuthoringReason`/`AuthoringOrigin`, `classifyContent`/`ContentState`; types `CreateOptions`, `FoundHandle`, `WritableHandle`, `DryRunEntry`, `DryRunVerb`. `AuthoringReason` is a CLOSED 8-value union.
- `./conformance` → `./dist/conformance/index.js` — `testDialect`, `testOpPack` (REAL bodies, stage-5); types `DialectFixture`, `OpPackFixture`, `OpExercise`. Does NOT export `run-vehicle` (FIT-08).
- `./testing` → `./dist/testing/index.js` (stage-4b, ADR-0033) — `runFactoryForTest<O>`, `RunResult`, re-exported `defineFactory`, types `Batch`, `Directive`. Does NOT export `ContractFake`. 0.x semver-EXEMPT.
- **`./typescript` → `./dist/dialects/typescript/index.js` (NEW stage-5, ADR-0014 amendment / ADR-0038)** — the first real dialect. Exports `find(path): Handle<"found", SourceFile, AddImportOps>`. Namespace-import surface (ADR-0003): `import * as ts from "@pbuilder/sdk/typescript"; ts.find(path).addImport(name, from)`. The handle is awaitable (thenable), chainable, exposes the universal `.raw(ast => …)` escape hatch + the `addImport` op. FIT-04 baselines its `.d.ts` from first commit; FIT-14 pins the export + `dist/dialects/typescript/**` tarball entries. Wiring exactly one dialect subpath establishes NO general dialect-naming convention; monorepo extraction stays deferred (fires on the SECOND, or first EXTERNAL, dialect).
- **`pbuilder-codegen` (bin, stage-4)** → `dist/bin/pbuilder-codegen.js` — CLI deriving `schema.generated.ts` from `<package-dir>/schema.json`, write-contained (SEC-4), first line exactly `#!/usr/bin/env node`.
- `defineFactory<O>` is exported from `src/core/index.ts` (NOT the umbrella, ADR-0009); ALSO re-exported from `./testing`. `defineDialect`/`defineOpPack`/`withOps` + the `Dialect`/`OpPack`/`Handle` TYPES are the FROZEN dialect-authoring kit surface (from `src/core/define-dialect.ts`, consumed by `./typescript` and `./conformance`).
- No `./core`, `./dry-run`, `./schema`, or `./dialects/*` (other than `./typescript`) subpath exists in `exports`; those files ship in the tarball but are unmapped.

## Conventions
- New author verb → `src/commons/index.ts`.
- New internal kit primitive → `src/core/` (re-exported from `src/core/index.ts`, the extraction-ready `@pbuilder/sdk-kit` boundary; never from the umbrella). EXCEPTION — a port-internal core type (e.g. `EmitRejection`) stays OUT of the barrel to keep FIT-10's guard meaningful.
- **New dialect → its own `src/dialects/<name>/` leaf (NEW stage-5)**, published at `@pbuilder/sdk/<name>`. A dialect composes ONLY the sanctioned kit surface (`defineDialect`/`defineOpPack`/`withOps`) — never port-internal machinery (FIT-08/FIT-10) — and MUST NOT import a sibling dialect (FIT-02, leaf rule). Exactly ONE module per dialect may import its AST library (`ast.ts`), keeping FIT-01's commons-no-AST transitive walk clean.
- **AST-library imports are confined to a single per-dialect `ast.ts` (NEW stage-5)**; ts-morph is exact-pinned in `dependencies` and reachable only from `src/dialects/typescript/**`.
- **The coalescing dialect handle lives at `src/core/dialect-handle.ts` (NEW stage-5)** — kit-internal, no public subpath, EXECUTOR LATITUDE (its factory shape is not fitness-pinned); only the public `find` + `Handle<State,Ast,Ops>` type are frozen.
- New author-testing surface → `src/testing/` published via `./testing` (stage-4b, ADR-0033).
- New shared schema logic → `src/core/schema/` (stage-4); in-memory model stays an ARRAY (FIT-07).
- New build-time / distribution tool → `bin/` OUTSIDE `src/` (stage-4, FIT-15).
- Author-facing DATA type (not kit MACHINERY) → may cross the ADR-0009 boundary into `./commons` via the two-step `import { X } … ; export { X };` form.
- A renderer/harness/dialect module that must stay isolated → its own top-level `src/{name}/` directory with a barrel (precedent: `src/dry-run/`, `src/testing/`, now `src/dialects/`).
- Naming: kebab-case filenames.
- Public API = `package.json#exports` + `#bin` + emitted `.d.ts` — every export is a semver contract (FIT-04 .d.ts gate; FIT-14 package-surface baseline `pkg-surface-baseline.json`).

## Data flow
- Author verb → `DirectiveFactory.{op}` → `Session.buffer(directive)` → (on `read()` or run-end) → `Session.flush()` → `EngineClient.emit(Batch)` → engine.
- Read path: handle `read()` → `Session.read(path)` → `Session.flush()` (read-your-own-writes) → `EngineClient.read(path): Promise<string | undefined>`.
- Run lifecycle (stage-5 amended): `defineFactory<O>(fn, options?)` builds `RunContext { session, factory, dialects: DialectRegistryImpl }` in an `AsyncLocalStorage`, runs `fn`, then **`ctx.dialects.drain()`** → `flush()` → `commit()` on success / `discard()` on throw. All-or-nothing; a drain rejection routes through the SAME catch a flush rejection already used.
- **Dialect flow (NEW stage-5, ADR-0037)**: `ts.find(path)` → `createDialectHandle(ast, ops, path)` returns a thenable `Handle`. Each op/`.raw`/write verb `#enqueue`s a step on `#tail` and self-`register`s once on `ctx.dialects`. The FIRST op `#ensureLive()` (`Session.read` → parse to ONE live AST) then `#ensureOpen()` (buffer ONE lazy-getter `modify` whose `content` = `print(liveAst)`, resolved once at flush). N edits coalesce to ONE `modify` (REQ-MC-01); a global mid-chain read/flush drops the open directive from `pendingSnapshot()`, so the next op re-registers a FRESH directive → exactly-two-modifies split (REQ-MC-02, FIT-19). At run end `dialects.drain()` awaits every handle's `settle()` (`Promise.allSettled`, re-throws first rejection) BEFORE flush — an unawaited chain still completes and commits; an unawaited THROWING chain rejects the run contained (frozen prefix `"dialect operation failed: "`, `.cause` always absent) instead of leaking `unhandledRejection` (FIT-20). Same-path concurrent unawaited handles are UNDEFINED BEHAVIOUR (documented, not prevented — REQ-MC-07); sequential awaited same-path handles are defined (cumulative split modifies).
- **Conformance flow (NEW stage-5, ADR-0012 amendment)**: `testDialect`/`testOpPack` seed a fresh `createRunVehicle(seed)` per exercise, drive a REAL `defineFactory` run of the dialect through it, and assert the collected `emitted` batches for byte-exact round-trip / single-op fidelity / coalescing content / seam-serializability / read-boundary-split.
- Run-boundary validation (stage-4), Codegen flow (stage-4), Error attribution (stage-2), Dry-run (stage-3) — unchanged from prior baselines.

## Testing
Four-layer pyramid (`CONTRIBUTING.md`, enforced by `test/pyramid/pyramid-codification.test.ts`). Every layer runs against `ContractFake` (or the conformance run-vehicle); a real engine is never required. Suite: **765 green (95 test files)**.
- unit: `test/golden-ir/`, `test/dry-run/`, `test/skeleton/schema-*.test.ts`, `test/bin/emit-type.test.ts`.
- fitness: `test/fitness/fit-01..20-*.test.ts`. Stage-5 ADDED **FIT-19 (coalescing orphan guard — a mid-chain global flush leaves the open directive out of `pendingSnapshot()`, forcing a fresh re-registered directive → the exactly-two-modifies split, no edit lost)** and **FIT-20 (unawaited-join guard — an unawaited dialect chain still completes/commits via the run-boundary drain; an unawaited throwing chain rejects contained, never `unhandledRejection`)**. Stage-5 WIDENED FIT-01 (transitive graph-walk proving ts-morph unreachable from `src/commons/**` at any depth, with a permanent two-file transitive red fixture), FIT-02 (dialect leaf-rule now has a real `src/dialects/typescript/` to scan), FIT-03 (commons bundle budget with `--packages=external`), FIT-04 (.d.ts semver gate now covers `./typescript`), FIT-08 (no-kit-bleed spans the dialect tree + `run-vehicle`), FIT-09 (pkg-exports-resolution resolves `./typescript`), FIT-10 (port-symbol guard scans the dialect tree + `run-vehicle` for the forbidden `EngineClient`/`EmitRejection` literals), FIT-14 (package-surface baseline pins the `./typescript` export + tarball entries).
- integration: `test/fake/*`; `test/skeleton/*`; `test/core/dialect-handle.test.ts` (NEW stage-5); `test/dialects/typescript/*` (dialect, coalescing, read-routing — NEW stage-5); `test/conformance/typescript-conformance.test.ts` + planted violations (NEW stage-5); `test/types/*` (incl. `define-dialect.test.ts`).
- e2e: `test/e2e/author-to-tree`, `dry-run`, `typed-factory`, `error-attribution`, `installed-consumer` (stage-4b), **`dialect-modify.e2e.test.ts` + `toy-dialect-skeleton.e2e.test.ts` (NEW stage-5)**.
- security: `test/security/canary-no-echo.test.ts`, `test/bin/codegen-static-scan.test.ts`, **`test/docs/security-authoring-guard.test.ts` (NEW stage-5 — pins the two-realms hazard prose in `docs/authoring-a-dialect.md` + `SECURITY.md`)**.
- red fixtures: `test/fixtures/red/**` (incl. `fit-01-transitive/`, `dialect-typescript/direct-engine-read.ts`) — EXCLUDED from `tsconfig.json`. `test/fixtures/toy-dialect/` is a permanent golden-toy dialect.
- type-level: `expect-type` @ `test/types/*`; negative proofs via `tsconfig.permissive-proof.json`.
- coverage: `bun test --coverage` (threshold not yet enforced).

## Notes
- **Branch-scope note (READ FIRST)**: this refresh was performed on the stage-5 build worktree — branch `feat/stage-5-first-dialect`, base = `main @ 2fc9249` (post stage-4b merge). Stages 1–4b are ALL on `main`. Stage-5 adds the first dialect (`src/dialects/typescript/`), the coalescing seam (`src/core/dialect-handle.ts` + `RunContext.dialects`), REAL `defineDialect`/`withOps` generics, real conformance-kit bodies (`run-vehicle.ts`), the `./typescript` published subpath, ts-morph as the first runtime dependency, and FIT-19/FIT-20. Stage-5 is COMPLETE (verify-final `pass-with-followups`) but NOT yet merged.
- **ADRs (stage-5)**: **0037** (coalescing seam handle-owned + run-boundary join — drafted as "ADR-0034", renumbered mechanically after stage-4b claimed 0033–0036 in parallel) and **0038** (ts-morph as first runtime dependency, plain exact-pinned — drafted as "ADR-0033", renumbered to next free slot). **0012 (conformance kit) AMENDED in place** — throwing stubs → real bodies driving `defineFactory` + `run-vehicle`. **0014 (single-package subpath shape) AMENDED in place** — the `./typescript` dialect subpath wired (was "documented, not wired").
- **Invariant #5 (ONE engine-boundary abstraction) — stage-5 posture**: the dialect handle buffers ordinary `modify`/`rename`/etc. `Directive`s onto the SAME `Session`; it introduces NO second engine port. `ContractFake` remains the single normative `implements EngineClient`. `run-vehicle.ts` and the handle's internals both satisfy the port SHAPE via LOCAL structural interfaces that deliberately never name `EngineClient`/`EmitRejection` (FIT-10 literal scan). The run-boundary `DialectRegistry` is an ADDITIVE `RunContext` field; `Session`/`DirectiveFactory`/`EngineClient` stay diff-free.
- **Invariant "SDK never touches the target tree" — stage-5 posture**: ts-morph parses/prints in an in-memory virtual FS (`useInMemoryFileSystem: true`, `VIRTUAL_PATH`); reads route through `Session.read` only (never fs); only the printed `[]byte` crosses the seam. The live AST never leaves the handle.
- **First runtime dependency**: `ts-morph@28.0.0`, exact-pinned, committed `bun.lock`, published with provenance (REQ-TSD-06). LEAF-ISOLATED — FIT-01's transitive walk proves it unreachable from commons. The two-realms hazard (a different ts-morph loaded by the author) is DOCUMENTED, not solved (`docs/authoring-a-dialect.md` + `SECURITY.md`, guarded by `test/docs/security-authoring-guard.test.ts`).
- **ts-morph@28.0.0 BOM gotcha (empirical)**: `SourceFile#getFullText()` does NOT round-trip a leading UTF-8 BOM (the design's "preserved by ts-morph independently" assumption does not hold for this version). `ast.ts` owns byte-exact BOM preservation via a per-`SourceFile` WeakMap flag re-prepended at `print` — implementation-internal, invisible to the frozen `Ast = SourceFile` type.
- The `EngineClient` port surface is `emit` / `read` / `commit` / `discard`. NO production implementation in `src/`; the sole normative implementation is `src/testing/contract-fake.ts`. Real JSON-RPC transport unbuilt (ROADMAP §6).
- `BATCH_CAP_BYTES = 4 * 1024 * 1024` (4 MiB) exported from `src/core/wire.ts`, enforced ONLY at the fake/engine `emit` boundary (ADR-0019).
- `package.json#files: ["dist"]` ships the WHOLE `dist/` tree; the subpath `exports` map exposes `.`, `./commons`, `./conformance`, `./testing`, `./typescript`; `./core`, `./dry-run`, `./schema` remain unmapped but present.
- **Impact record — stage-5**: `architecture_impact: modifying`, validated by verify-final. Modifies an existing convention (the conformance kit graduates from stubs to real bodies; ADR-0014's dialect subpath moves from "documented" to "wired"), adds the first runtime dependency and the first dialect leaf, and grows the published surface from 4 to 5 subpaths — all additive-or-modifying, the IR-seam pattern and invariant #5 intact → not `breaking`.
- **Sensitive areas — stage-5 promotions to `medium`**: `src/dialects/typescript/**` + `src/core/dialect-handle.ts` (code-execution: the `.raw(ast => …)` escape hatch runs arbitrary author code against a live AST; ts-morph realm); `package.json#dependencies` (third-party trust: `ts-morph`, the FIRST first-party runtime dependency — supply-chain surface). Recorded in `openspec/sensitive-areas.md`.
