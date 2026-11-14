# Proposal: `@pbuilder/sdk` on the DDD + hexagonal layout

Feature doc: [hexagonal-layout.md](./hexagonal-layout.md). Status: proposal with all ten questions answered (section 6), awaiting the user's final approval before S0a. No source changes yet.

Sources: project-builder-architecture origin/main 7ed257b — `CODE-LAYOUT.md` (cited `CL:<line>`), `bounded-contexts/*/README.md`, `GLOSSARY.md`, Decision 19 (Discussion #1, comment 19464384), the context map (Discussion #1 body). Method: engine `odd/tasks/hexagonal-layout.md` (origin/main 9b07d07), CLI `odd/tasks/layout-contexts.md`, `layout-guards.md`, `layout-launch.md` (origin/main 081510a). SDK: origin/main 2b12435, 0.14.0.

## 0. What the rules require, in short

- One folder per bounded context the repository implements, under a private root; in TypeScript that root is `src/` and the public surface is limited by `package.json` `exports` (CL:24, CL:29).
- Layers `domain/{aggregates,entities,valueobjects,services,ports}`, `application/usecases`, `infrastructure/{in,out}`, plus `composition` and `testing/` (CL:73-103). Ports belong to the core, never to `infrastructure/` (CL:91).
- `acl/<counterpart>/{in,out}`; in TypeScript, files `<counterpart>.in.acl.ts` / `<counterpart>.out.acl.ts` next to an `index.ts` (CL:56-68). A driven adapter that implements a port in terms of another context's model lives in `acl/<counterpart>/out` (CL:93).
- `composition` is the only file that knows use cases and concrete adapters; in TypeScript it exports `makeX(adapterA, adapterB)` (CL:102). Public entry points call each context's composition (CL:103).
- The dependency rule (CL:122-131), enforced by an architecture test that fails the build (CL:133).
- The public API does not change during the migration; renames are separate changes (CL:137-138).
- **SDK port rule** (user-approved, feature doc S6): a port exists only where there is real I/O (filesystem, the stdio/IR transport, child processes) or a real extension point (the Dialect contract). Everything else is plain domain functions and types with no interface in front. No runtime DI container or class-heavy wiring: composition is plain function assembly, so tree-shaking and bundle size do not regress. The layout itself stays CODE-LAYOUT: onion layers with hexagonal in/out edges. Audit in 3.3.
- The user's layout requirement (feature doc S5): `docs`, `bounded-context` folders that are flat when the context has one subdomain and split by subdomain name otherwise, and `shared-kernel` — CL:7-33. Folder names use kebab-case, the casing TypeScript allows (CL:29): `bounded-contexts/`, `shared-kernel/`, `runner-hosting/`.

## 1. Contexts the SDK implements

| Context | Implements? | Evidence |
|---|---|---|
| Authoring | **Yes** | `authoring/README.md:5` "Repository: SDK"; `:9` "the factory, its input schema, its metadata and its mutations … Dialects … translates every author verb into IR wire operations"; Discussion #1 row "Authoring … all of it" in the SDK column. |
| Execution | No (SDK holds a test copy) | `execution/README.md:5` "engine"; Discussion #1 row: SDK column "`ContractFake` (test copy)". The SDK only *consumes* Execution's Published Language (`authoring/README.md:23`). |
| Runner hosting | **Yes — Q1 resolved (user, 2026-11-12)**; architecture branch `docs/runner-hosting-names-sdk` adds the SDK to README:5 | `runner-hosting/README.md:5` names "engine (`adapter/bunipc`) and the CLI's SDK trust gate"; but Discussion #1 row puts "runner" in the SDK column, `:13` says "R-2 adds a guard in the SDK runner bootstrap", and `runner-guard.feature` has 32 `@sdk` scenarios. |
| Catalog | No | `catalog/README.md:6` "The SDK resolves nothing; codegen only reads what the Manifest declares." |
| Selection | No | `selection/README.md:5` "no implementation yet". |

Authoring is flat: "Today every context has a single subdomain, so every context is flat. Authoring is one subdomain of mixed type (Dialects are core …)" (CL:31).

Authoring's model, which drives the domain placement below (`authoring/README.md:13-17`): **Session** aggregate root; **Dialect handle** entity; **Directive** value object; **Dialect contract** and conformance fixture = port plus contract test, exported; **Op rules** = domain service; **AST library** = infrastructure.

## 2. Current-state map

### 2.1 Modules (79 files under `src/`, plus the repo-root `bin/` codegen)

Role key: D domain, A application/use case, In driving adapter, Out driven adapter, ACL wire translation, P platform, Pub public entry, T test kit. "I/O" lists `node:` modules or `process.*` used.

| Path | What it does | Role | Context | I/O |
|---|---|---|---|---|
| `src/index.ts` | re-exports `commons` | Pub | Authoring | — |
| `src/commons/index.ts` (409 l.) | author verbs: create, find, modify, remove, rename, move, copy, scaffold, copyIn, pendingDirectives | In (facade) + A | Authoring | `node:path` |
| `src/commons/classify-content.ts` | content-state helper | D | Authoring | — |
| `src/core/session.ts` | directive buffer, flush policy | D (Session aggregate) | Authoring | — |
| `src/core/directive-factory.ts` | verb → Directive lowering (ADR-0013), option validation | D | Authoring | — |
| `src/core/wire.ts` | Directive/Batch wire shapes, batch cap | ACL (Published Language types) + D (Directive) | Authoring ↔ Execution | — |
| `src/core/engine-client.ts` | `EngineClient` port | D port | Authoring | — |
| `src/core/context.ts` (389 l.) | `defineFactory`, AsyncLocalStorage run context, run-boundary schema checks | A + Out mixed | Authoring | `node:fs`, `node:async_hooks`, `node:url`, `process.cwd` |
| `src/core/dialect-handle.ts` | coalescing AST handle seam | D (Dialect handle entity) | Authoring | — |
| `src/core/define-dialect.ts` | `defineDialect`, `defineOpPack`, `withOps` | D port (Dialect contract) + registration | Authoring | `node:path` |
| `src/core/base-handle.ts`, `handle-state.ts` | handle types | D | Authoring | — |
| `src/core/authoring-error.ts`, `dialect-error.ts` | author-facing error model | D | Authoring | — |
| `src/core/emit-rejection.ts` | engine rejection → error | ACL in | Authoring ↔ Execution | — |
| `src/core/deep-equal.ts`, `json-value.ts`, `fs-errors.ts` | generic helpers / JSON value type / fs error codes | P / D valueobject / P | — | — |
| `src/core/jsx-name-validator.ts`, `reject-tail.ts` | JSX grammar, no-echo tail (ARCH-2 debt) | D service (React-specific) | Authoring | — |
| `src/core/index.ts` | internal kit barrel (ADR-0009) | Pub (internal) | Authoring | — |
| `src/core/schema/schema-model.ts` | input-schema model | D | Authoring | — |
| `src/core/schema/schema-{parse,validate,sufficiency,locate}.ts`, `input-rejection.ts` | parse/validate inputs | D services | Authoring | — |
| `src/core/schema/schema-discovery.ts` | finds `schema.json` | Out (fs) | Authoring | `node:fs` |
| `src/core/schema/schema-digest.ts` | schema digest | D service | Authoring | `node:crypto` |
| `src/dialects/<name>/index.ts` ×7 | `find(path)` + pack composition | Pub + composition | Authoring | `react/index.ts`: `node:path` |
| `src/dialects/<name>/ast.ts` (typescript, react, json, yaml, css) | the only importer of the parser library (fit-38) | Out (AST library) | Authoring | — |
| `src/dialects/<name>/ops.ts` (+ yaml `paths/structural/presentation/documents.ts`) | op rules over the AST | D service written against library ASTs (Q3) | Authoring | — |
| `src/dialects/typescript/{pack,array-element,class-property,import-order}.ts` | TS op pack + helpers shared by angular/nestjs/react | D service, shared within Authoring | Authoring | — |
| `src/pending-directives/{index,render}.ts` | renders pending directives in author terms | A (read side) | Authoring | — |
| `src/scaffold/index.ts`, `expander.ts` | scaffold orchestration, fan-out | A | Authoring | `node:path` |
| `src/scaffold/filename-pipeline.ts` | rename → tokens → `.template`, A-17 check | D service | Authoring | `node:path` |
| `src/scaffold/{walk,path-guards,classify-transport}.ts` | read the source folder | Out (fs) | Authoring | `node:fs` |
| `src/testing/index.ts` | `runFactoryForTest` | Pub + T | Authoring | — |
| `src/testing/contract-fake.ts` | in-memory `EngineClient` (Execution test copy) | T (fake of the port) | Authoring (tests Execution's contract) | `node:path` |
| `src/testing/rejection-messages.ts` | message constants | T | Authoring | — |
| `src/conformance/index.ts` | `testDialect` / `testOpPack` (the shipped conformance fixture) | Pub + T | Authoring | `node:fs` |
| `src/conformance/run-vehicle.ts` | in-memory run harness | T | Authoring | — |
| `src/transport/stdio-engine-client.ts` | real `EngineClient`, JSON-RPC over stdio | Out implementing a port in Execution's model → ACL out (CL:93) | Authoring ↔ Execution | stdio |
| `src/transport/{framing,frame-reader,wire-protocol}.ts` | frame codec (only fd-1 writer), reader, protocol | ACL | Authoring ↔ Execution | `process.stdout/stderr` |
| `src/transport/runner.ts` | runner composition root; single sanctioned dynamic `import()`; calls `defineFactory` | In + composition | Runner hosting | `node:fs/path/url` |
| `src/transport/{factory-pointer,exit-codes,error-text,single-instance-probe}.ts` | runner bootstrap pieces | In / Out | Runner hosting | `node:fs/module/path/url`, `process.*` |
| `src/transport/bootstrap-bridge.ts` | in-process engine entry (the engine imports it) | In | Runner hosting | `process.exit` |
| `src/bin/pbuilder-runner.ts` | runner argv entry | In (process entry) | Runner hosting | `process.*` |
| `bin/{pbuilder-codegen,emit-type,project-codegen}.ts` (repo root) | codegen CLI (A-15) | In (CLI) + D | Authoring (Q5, resolved) | `node:fs` |

### 2.2 Import graph today (folder level, import statements)

`bin→transport 5`, `commons→core 6`, `commons→pending-directives 2`, `commons→scaffold 2`, `conformance→core 6`, `core→core/schema 4`, `core/schema→core 2`, `dialects/*→core 41`, `dialects/{angular 7, nestjs 4, react 2}→dialects/typescript`, `index.ts→commons 1`, `pending-directives→core 2`, `scaffold→core 18`, `testing→core 8`, `transport→core 9`, `transport→core/schema 2`; repo-root `bin/pbuilder-codegen.ts → src/core/schema/*, src/core/fs-errors.ts`.

The direction is already hexagonal at its one seam: nothing in `core` imports `transport`, `testing`, `scaffold` or `dialects`; `transport` implements `core/engine-client.ts` (openspec/architecture.md:65-66). Measured against CODE-LAYOUT, these edges would break the rules once classified:

| # | Edge | Rule it would break |
|---|---|---|
| V1 | `core/context.ts` reads the filesystem (`node:fs`, `process.cwd`) inside the run use case | CL:90 — a filesystem adapter "lives in `infrastructure/out/` and implements a port" (no port today) |
| V2 | `core/schema/schema-discovery.ts` reads `schema.json` from inside the schema model | CL:90, as V1 |
| V3 | `scaffold/index.ts`/`expander.ts` (use case) import `walk`/`path-guards`/`classify-transport` (fs adapters) directly | CL:124 "`application/` imports only `domain/` and `sharedkernel/`" |
| V4 | `commons/index.ts` mixes the public facade (In) with verb logic (A) in one file | CL:89 vs CL:124 — a mixed module the guard classifies by dominant role |
| V5 | `core/wire.ts` and `core/emit-rejection.ts` hold Execution's Published Language inside Authoring's core | CL:131 "`acl/` is the only place where two contexts' models meet" |
| V6 | `transport/stdio-engine-client.ts` implements an Authoring port in Execution's model outside `acl/` | CL:93 |
| V7 | `core/jsx-name-validator.ts`, `reject-tail.ts`: React rules in the shared kit (ARCH-2, `openspec/pending-changes.md:489`) | not a CL rule; a cohesion debt the migration can retire |
| V8 | repo-root `bin/pbuilder-codegen.ts` reaches into `src/core/schema/*` internals | CL:118-style "through public entry points or a context's driving ports" (applies to acceptance; for codegen see Q5) |
| V9 | `src/dialects/{angular,nestjs,react}` import `src/dialects/typescript` internals (allowed by fit-02) | inside one context, so allowed by CL; noted because the target must keep it inside Authoring |

No cycle exists at file level; `core ↔ core/schema` is two-way only at folder level.

### 2.3 Existing guards the migration must carry

- Import rules already enforced by fitness tests: fit-01, 02, 07, 10, 15, 21, 22, 29, 37, 38, 39, 42 (runner closure). Several name `src/` paths directly (fit-07, 10, 21, 22, 29, 30, 32, 38, 39, 42), so each move updates them in the same commit.
- Public-surface pins: fit-04 (`.d.ts` baselines keyed by dist path), fit-09 (subpaths resolve), fit-14 (exports, deps, files, bin, shebang, **tarball file list**), fit-46/47/48, `test/e2e/installed-consumer.e2e.test.ts`.
- Cross-repo contract: the runner closure (23 emitted files under `dist/bin`, `dist/core`, `dist/core/schema`, `dist/transport`) is pinned by `test/fitness/runner-closure-graph-baseline.json` and shipped as `dist/runner-manifest.json`, which the engine checks before every spawn. `scripts/derive-runner-closure.ts` hard-codes `bin/pbuilder-runner.js`, `transport/runner.js` and `transport/single-instance-probe.js`.

## 3. Target layout

```
handbook/                            contributor guide (CL:21; Q8): workflow, running the suites, conventions, layering rule
docs/                                technical explanations (CL:22): one page per bounded context, ADRs, contracts — see 3.1
src/
├── index.ts                         public entry  (@pbuilder/sdk)                 — unchanged path, thin
├── commons/index.ts                 public entry  (@pbuilder/sdk/commons)         — becomes a thin barrel
├── testing/index.ts                 public entry  (@pbuilder/sdk/testing)         — thin barrel
├── conformance/index.ts             public entry  (@pbuilder/sdk/conformance)     — thin barrel
├── dialects/<name>/index.ts  ×7     public entries (@pbuilder/sdk/<name>)         — thin barrels
├── bin/pbuilder-runner.ts           process entry (dist/bin/pbuilder-runner.js)   — path kept (runner manifest)
├── bounded-contexts/
│   ├── authoring/                   flat: one subdomain (CL:30-31)
│   │   ├── domain/
│   │   │   ├── aggregates/session/          session.ts
│   │   │   ├── entities/                    dialect-handle.ts, base-handle.ts, handle-state.ts
│   │   │   ├── valueobjects/                directive.ts (Directive), json-value.ts, schema-model.ts, errors (authoring-error, dialect-error)
│   │   │   ├── services/                    directive-factory.ts, schema-{parse,validate,sufficiency,locate,digest}.ts,
│   │   │   │                                input-rejection.ts, filename-pipeline.ts, classify-content.ts, op rules (Q3)
│   │   │   └── ports/                       engine-client.ts, dialect-contract.ts (defineDialect/defineOpPack/withOps types),
│   │   │                                    package-files.ts (new, S9: the one filesystem port, see 3.4)
│   │   ├── application/usecases/            run-factory (defineFactory), verbs (create/modify/…), scaffold, pending-directives
│   │   ├── infrastructure/
│   │   │   ├── in/                          facade behind the public API (author verbs, find); codegen/ (Q5: the codegen
│   │   │                                    driving adapter — today's bin/{emit-type,project-codegen}.ts logic)
│   │   │   └── out/                         fs/ (walk, path-guards, classify-transport, schema discovery),
│   │   │                                    dialects/<name>/ (AST library adapters, Q3)
│   │   ├── composition.ts                   plain functions: makeAuthoring(engineClient, packageFiles) and the per-dialect makeX
│   │   └── testing/                         contract-fake.ts, run-for-test (runFactoryForTest), conformance fixture (Q4, resolved)
│   └── runner-hosting/                      flat: runner bootstrap, R-2 guard, single-instance probe,
│                                            factory pointer, exit codes, bootstrap bridge, composition.ts
├── shared-kernel/                           framing.ts, wire-protocol.ts, batch-cap.ts (CL:32) — see below
├── acl/
│   └── irwire/                              Q6, resolved: mirrors the engine's acl/irwire
│       ├── index.ts
│       ├── irwire.out.acl.ts                Directive/Batch → wire frames; StdioEngineClient (implements EngineClient, CL:93)
│       └── irwire.in.acl.ts                 frames → results; engine rejections → Authoring errors (emit-rejection)
│       (frame-reader.ts sits beside them as the ACL's internals)
└── platform/                                only if needed: deep-equal.ts, fs-errors.ts, error-text.ts (path scrubbing)
                                             (CL:34, imported only by infrastructure/, composition and public entries — CL:126)
```

Each context is flat because each has a single subdomain (CL:30-31); a subdomain folder appears only if the architecture repository splits a context. No `application/<name>/`: no layer orchestrates several contexts (CL:38).

**`shared-kernel/`** holds only code that several contexts share and agree to change together, and it imports no bounded context (CL:32). With Runner hosting in the SDK (Q1), it holds the two pieces both contexts use and must change in lockstep:

- `src/shared-kernel/framing.ts` ← `transport/framing.ts` — the frame codec and the only fd-1 writer (fit-31). The runner bootstrap writes frames with it (`src/bin/pbuilder-runner.ts`, `transport/bootstrap-bridge.ts`), and Authoring's engine client in `acl/irwire` reads and writes the same frames.
- `src/shared-kernel/wire-protocol.ts` ← `transport/wire-protocol.ts` — the protocol version and frame types, imported by the runner (`transport/runner.ts`, `bootstrap-bridge.ts`) and by the engine client.

- `src/shared-kernel/batch-cap.ts` ← the byte-count part of `core/wire.ts`: `BATCH_CAP_BYTES`, `EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES`, `EMIT_BATCH_BUDGET_BYTES` and `exceedsBatchCap(bytes: number)`. `framing.ts` imports `exceedsBatchCap` from `core/wire.ts` today (`src/transport/framing.ts:6`, number form at `:53`), so without this piece the kernel would import a context (CL:130). The cap is also used by Authoring (`scaffold/classify-transport.ts`, `scaffold/expander.ts`, `testing/contract-fake.ts`) and the runner (`transport/runner.ts`, `error-text.ts`). The `Batch`-typed helpers (`serializedBatchBytes`, `serializedBatchSize`, `exceedsBatchCap(batch)`, `exceedsEmitBatchBudget`) stay with the `Batch` type (Q7) and call the kernel, so fit-32's single `>` comparison stays in one place.

All three are in the runner closure, so their move is part of S5 and carries its proof (P-ENG). S0a's first run confirms none of them imports a bounded context (CL:130). What the runner takes from Authoring today (`core/context.ts` `defineFactory`, `core/authoring-error.ts`, `core/schema/schema-{locate,parse}.ts`) is not shared-kernel material: Runner hosting reaches Authoring through its `run-factory` use case and the types it exposes (CL:127, CL:131). `error-text.ts` carries no domain rules, so it goes to `platform/`.

**`acl/irwire/` scope (Q7, resolved).** The Directive stays in `authoring/domain/valueobjects/` with today's shape, unchanged: Authoring is conformist to the wire's directive shape (ADR-0001, engine ADR-0028). `acl/irwire` owns serialisation, framing and rejection decoding only; it has no translation layer and no parallel model. Trigger to revisit: when the IR wire changes version (`protocolVersion` in `Batch`, `wire-protocol.ts`), the ACL starts translating between the domain Directive and the new wire shape. Until then the wire bytes stay identical, proven by P-IR in every slice that touches the Directive or the ACL (S4, S5).

### 3.1 `docs/` at the repository root

CL:21-22: "`handbook/` is the guide for contributing …"; "`docs/` holds technical explanations: one page per bounded context, ADRs and contracts." Proposed landing for what the SDK has today (moves happen in S16, separately from code):

| Today | Lands in |
|---|---|
| — (new) | `docs/bounded-contexts/authoring.md` and `runner-hosting.md`: one page per context — model, layers, ports, adapters, ACL |
| `openspec/decisions/*.md` (84 ADRs) | `docs/adr/`, numbers kept — **done by retire-sdd** (SDK PR #161, 2026-11-13), not by this migration. |
| `docs/engine-sdk-wire-spec.md`, `docs/engine-sdk-wire-design.md`, `ENGINE-RUNNER-MANIFEST-CONTRACT.md`, `SDK-RUNNER-MANIFEST-REPLY.md`, `ENGINE-REPLY-TO-MANIFEST-REPLY.md`, `SDK-EXIT-CODE-CONFIRMATION.md`, `CONFORMANCE-CORPUS-HANDOFF.md` | `docs/contracts/` (the IR wire, the runner manifest, exit codes, the conformance corpus) |
| `docs/runner-integrity-invariants.md` | `docs/bounded-contexts/runner-hosting.md` (the runner manifest and guard are Runner hosting's) |
| Author-facing guides: `docs/{quickstart,authoring-verbs,create-templates,pending-directives,authoring-errors,authoring-a-dialect,*-dialect}.md`, `docs/README.md` | `docs/guides/` (Q8, resolved). They explain how to use the public API; CL:22 does not name author guides, and the user approved this sub-folder. The public site links to three of them (see S16). |
| `openspec/{architecture-audit,lessons-learned,pending-changes,objectives-plan,problem-statement,sensitive-areas}.md` | **deleted by retire-sdd** (Q8 revised, user 2026-11-13), archived by a pinned permalink (https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/0ea78c7a79e4c9f06d49d8d7e3e1051276aac71a/openspec/), with no `docs/history/`. Process records land nowhere in the target tree. `openspec/architecture.md` goes with them; S15 cites its permalink (https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/0ea78c7a79e4c9f06d49d8d7e3e1051276aac71a/openspec/architecture.md). |
| `CONTRIBUTING.md` (workflow, conventions) | `handbook/` (CL:21; Q8, resolved): contributor workflow, how to run the suites (`bun test`, fitness, conformance, the engine conformance run), conventions, and the layering rule with fit-49. `CONTRIBUTING.md` stays at the root as a short pointer to `handbook/`. |

Moving docs touches `test/docs/*` (seven tests read `docs/` paths), README links and the docs site, so S16 updates them in the same commit.

### 3.2 Dialects (Q3, resolved)

Each dialect pack is an `infrastructure/out` adapter that implements the Dialect contract port. Binding condition from the user: "tiene que ser facil extender los dialectos y/o agregar nuevos" — extending a dialect and adding one must stay easy. Architecture note: project-builder-architecture branch `docs/authoring-op-rules-in-dialect-adapters` (README:17).

**Where the pieces live**

| Piece | Today | Target | Why it is allowed |
|---|---|---|---|
| Dialect contract (types: `Op`, `Query`, `OpPack`, `DialectDescriptor`, `Dialect`, `Handle`, `ExtensionRouter`) | `core/define-dialect.ts` | `authoring/domain/ports/dialect-contract.ts` | ports belong to the core (CL:91) |
| Kit functions (`defineDialect`, `defineOpPack`, `withOps`, `withoutOps`, `overrideOps`, `byExtension`, `query`, `RESERVED_HANDLE_NAMES`) | `core/define-dialect.ts`, `core/dialect-handle.ts` | `authoring/domain/services/dialect-kit.ts` beside `entities/dialect-handle.ts` | they hold the handle rules (coalescing, reserved names, one dirty AST per path) — domain behaviour, no AST library |
| Handle state, base handle, dialect errors | `core/{base-handle,handle-state,dialect-error}.ts` | `authoring/domain/{entities,valueobjects}/` | Dialect handle is an entity (`authoring/README.md:14`) |
| One dialect: parser binding, ops, its pack | `src/dialects/<name>/{ast,ops,…}.ts` | `authoring/infrastructure/out/dialects/<name>/{ast,ops,…}.ts` + `adapter.ts` (the `defineDialect`/`withOps` assembly now in `index.ts`) | AST library is infrastructure (`authoring/README.md:17`); infrastructure may import domain (CL:125) |
| TS helpers shared by angular, nestjs, react (`array-element`, `class-property`, `import-order`, the TS pack) | `src/dialects/typescript/` | stay in `infrastructure/out/dialects/typescript/` | they are ts-morph code, so infrastructure; an adapter importing a sibling adapter of the same context breaks no CL rule; fit-02's `{nestjs, angular, react} → typescript` allowlist carries over unchanged |
| Library-free rules (identifier and JSX name grammars, no-echo tail) | `core/jsx-name-validator.ts`, `core/reject-tail.ts` | `authoring/domain/services/` (S12 moves the React-only grammar into the React adapter, ARCH-2) | no AST library, so domain service per README:17 |
| Assembled dialects | each `src/dialects/<name>/index.ts` builds its own | `authoring/composition.ts`: one `make<Name>Dialect()` line per dialect | CL:102 |
| Public entry | `src/dialects/<name>/index.ts` (logic + exports) | same path, a thin barrel: `export * from` the adapter's public module and `find` from composition | Q2 |

So the kit stays reachable from every adapter through `domain/ports` and `domain/services` — the inward direction CL:125 allows — and no `infrastructure/out/shared` folder is needed. The kit is internal today (ADR-0009; not in `exports`) and stays internal; the `@pbuilder/sdk-kit` extraction is out of scope.

**Adding a new public dialect `<name>`: 4 edits, none in domain or application**

1. New folder `authoring/infrastructure/out/dialects/<name>/` with `ast.ts` (the only file that imports the parser; fit-38), `ops.ts`, `adapter.ts` (implements the Dialect contract with `defineDialect`/`defineOpPack`/`withOps`).
2. One line in `authoring/composition.ts`: `export const make<Name>Dialect = () => …`.
3. New public barrel `src/dialects/<name>/index.ts` (2-3 lines).
4. One `exports` entry in `package.json` — plus regenerating fit-14's `pkg-surface-baseline.json`, which is the intended record of a public-surface change.

A private dialect (used through `byExtension` by another dialect) needs only 1 and 2. A new parser library adds its dependency to `package.json` (and fit-14's dependency list, as today). Tests for the new dialect: one entry in `test/support/dialect-modules.ts` and its conformance test.

Today the same change edits the three dialect files plus `package.json`, fit-09's hard-coded subpath list (`fit-09-pkg-exports-resolution.test.ts:82,91`), fit-14 and its baseline, and `test/support/dialect-modules.ts`. S1 makes fit-09 derive its list from `package.json` so it stops needing an edit.

**Extending a dialect with a new op**

- The op is a function in that dialect's adapter folder (`ops.ts`, or a new file there, as yaml splits its ops) and one key in its `defineOpPack({...})` call in `adapter.ts`. Nothing else changes: the public barrel re-exports with `export *`, and composition already assembles the pack. fit-04's `.d.ts` baseline for that subpath is regenerated as a declared public addition.
- Only when the op needs something the contract cannot express today (a new handle capability, a new op kind beside `Op`/`Query`, a new composition helper like `byExtension`/`overrideOps` were) does `authoring/domain/ports/dialect-contract.ts` change, with `domain/services/dialect-kit.ts` and `entities/dialect-handle.ts` if the handle rules change. That is a contract change, risk item 3, in its own commit.

**Guard that keeps it easy (part of fit-49, added in S1)**

- `ruleDialectIsolation`: a file under `infrastructure/out/dialects/<name>/` imports only `domain/`, `shared-kernel/`, `platform/`, its own folder, its parser library, and the siblings fit-02 allows, and no runtime I/O. Nothing imports a dialect adapter except `composition.ts`, its public barrel, and the allowed siblings. `platform/` was added in S1a: the json and yaml adapters use `deep-equal`, a library-free helper that CODE-LAYOUT:125 lets infrastructure import. Which parser a dialect imports stays with fit-37 and fit-38, so the rule needs no per-dialect parser list.
- `ruleNoClosedDialectSet`: no file in `domain/` or `application/` names a dialect — no import of `infrastructure/out/dialects/*` (already a layer violation) and no string literal equal to a dialect folder name or a dialect file extension. That forbids a switch or registry in the core that a new dialect would have to edit. The dialect list is read from the folder at test time, so the guard needs no edit when a dialect is added.
- Red-proofs: a planted `application/` import of a dialect, a planted `"css"` literal in `domain/services`, and a planted sibling import outside fit-02's allowlist each fail the test.
- Proof in S1, not standing: in a scratch copy, add a dialect by copying `css` to `cssx` with exactly the 4 edits above, then run the suite and the conformance fixture on it. A standing version would build and pack on every run; the static rules above give the same guarantee at test speed.

### 3.3 Ports — the SDK rule and the audit

Rule (section 0): a port only for real I/O or a real extension point; everything else is a direct function. Every port or interface this proposal would introduce or keep:

| Port / interface | Verdict | Why |
|---|---|---|
| `EngineClient` (`domain/ports/engine-client.ts`, exists today) | **keep** | real I/O: the stdio/IR transport to the engine. Two implementations already exist: `acl/irwire` (`StdioEngineClient`) and the shipped `ContractFake`. |
| Dialect contract (`domain/ports/dialect-contract.ts`; today's `DialectDescriptor`, `Dialect`, `Handle`, `Op`, `Query`, `OpPack`) | **keep** | real extension point: seven dialects implement it, and authors can implement their own (`authoring/README.md:16`, A-16). |
| `source-folder` port (proposed S9, scaffold reads) | **drop as a separate port; merge** | real I/O, but it reads the same thing as `schema-source`: files under the package directory. Two ports for one kind of I/O is ceremony (CLI L29/L30 made the same call). |
| `schema-source` port (proposed S9, `schema.json` discovery) | **drop as a separate port; merge** | as above |
| → `package-files` port (`domain/ports/package-files.ts`, replaces both) | **keep** | real I/O: `node:fs` reads under the package directory (`readFile`, `readDir`, `stat`, `realpath`) plus `process.cwd()` for locating it, used by `core/context.ts`, `core/schema/schema-discovery.ts`, `scaffold/{walk,path-guards,classify-transport}.ts`. One adapter in `infrastructure/out/fs/`. |
| Run context (`AsyncLocalStorage`, proposed as an `infrastructure/out` adapter) | **drop** | not I/O and not an extension point: one implementation of in-process call-scoped state. `node:async_hooks` stays a direct import of the `run-factory` use case; `ruleNoRuntimeIo` (section 4) lists filesystem, processes, network, stdio and environment, not `async_hooks`. |
| `run-factory` "application port" between Runner hosting and Authoring | **no interface** | CL:131 lets a context reach another through "that context's application ports"; here that is the exported `runFactory` function and the types it exposes, called directly. |
| Codegen (Q5) | **no port** | a driving adapter that calls Authoring's schema functions directly. |
| Runner bootstrap I/O (`process.stdin/stdout/exit`, `createRequire`, the single-instance probe) | **no port** | driving-side code in `runner-hosting/infrastructure/in`; nothing in a domain or application layer calls it, so there is nothing to invert. |
| `shared-kernel/` (framing, wire protocol, batch cap) | **no port** | plain functions and constants. |
| Composition (`makeAuthoring`, `make<Name>Dialect`, runner composition) | **no interface, no container** | plain functions that take adapters and return assembled functions, no classes and no registry. |
| Domain types (Session, Directive, handles, schema model, errors) | **no interface** | plain types and functions, as today. |

Result: three ports, against one today (`EngineClient`): `EngineClient`, the Dialect contract (made explicit, not new) and `package-files`. Nothing else gets an interface.

**Tree-shaking check (P-SIZE, added in S0b):** for every public `exports` entry, `bun build --minify --target=node --packages=external` (the mechanism fit-03 already uses) records the output bytes in `test/fitness/bundle-size-baseline.json`. Two more probes catch wiring that defeats tree-shaking: a stub importing only `create` from `@pbuilder/sdk/commons`, and one importing only `find` from `@pbuilder/sdk/css`. The gate fails when a measurement grows by more than **max(256 bytes, 1 %)** over its baseline. The build is deterministic, so the tolerance only absorbs renamed identifiers and module-boundary changes from moves. A drop below the baseline lowers it in the same commit.

### 3.4 Public API mapping — no change

| `exports` subpath | Today | Target |
|---|---|---|
| `.` | `dist/index.js` | same file; re-exports the Authoring facade |
| `./commons` | `dist/commons/index.js` | same file; thin barrel over `bounded-contexts/authoring/infrastructure/in` |
| `./testing` | `dist/testing/index.js` | same file; barrel over `bounded-contexts/authoring/testing` |
| `./conformance` | `dist/conformance/index.js` | same file; barrel over the conformance fixture (Q4) |
| `./typescript` … `./css` (7) | `dist/dialects/<name>/index.js` | same files; each calls `composition.ts` for its pack |
| `bin.pbuilder-codegen` | `dist/bin/pbuilder-codegen.js` | same path and same `bin` entry (Q2); `bin/pbuilder-codegen.ts` stays the process entry and only calls composition (Q5) |
| runner (no `#bin`, ADR-0058) | `dist/bin/pbuilder-runner.js` | same path; the manifest's entry stays put |

Keeping every public entry file at its current path keeps `exports`, `main`, `bin`, fit-09 and fit-47 untouched (Q2, resolved). Binding condition from the user: "the result is the same" — `exports`, `main` and `bin` stay byte-identical, and every slice's gate includes P-API and P-PACK showing the published surface unchanged. What does change is internal: dist paths of moved files appear in fit-14's tarball list, in fit-04's `.d.ts` baseline names and in their `import("…")` type references, and in the runner closure. Section 5 says how each slice proves those are internal-only. 

## 4. The guard first

A TypeScript translation of the engine's FF-45 and the CLI's `internal/arch`, built on the repo's own tooling (bun test, `test/support/import-scan.ts`):

- **File:** `test/fitness/fit-49-layering.test.ts` (next free number) with `test/support/layering/{classify,rules,exceptions}.ts`.
- **Graph:** every `.ts` under `src/` and the repo-root `bin/`; edges from `import`/`export … from`, `import type`, dynamic `import("…")`, and `node:` specifiers. It reuses `stripComments` from `import-scan.ts` so JSDoc `@example` imports (e.g. `src/conformance/index.ts:51`) are not edges. A liveness check fails closed if the file count or edge count drops below a floor, or if a known edge (`transport/stdio-engine-client.ts → core/engine-client.ts`) goes missing — the engine's lesson that moves can silently hide code from a check (engine L33).
- **Classification:** fail-closed, derived from the path for the target tree (CLI style: `bounded-contexts/<ctx>/<layer>`, `acl/<counterpart>/{in,out}`, `platform`, public entries), plus an explicit **legacy table** for today's folders, each with a dominant role and a `mixed` list (engine style), so the table shrinks as files move. An unknown path, context, layer or counterpart is an error.
- **Rules:** one named rule per CL line 122-131 (e.g. `ruleApplicationImports = "application/ imports only domain/ and sharedkernel/"`), plus `ruleTargetNeverImportsLegacy` (CLI S12c: target-layout code never imports the legacy tree; legacy → target stays unchecked until the legacy tree is empty).
- **`ruleNoRuntimeIo`** (Q10, resolved; enforced from S0a): `domain/` and `application/` never import runtime I/O — `node:fs` (and `node:fs/promises`), `node:child_process`, `node:net` (and `http`, `https`, `dgram`, `tls`), `process.stdin`, `process.stdout`, `process.env`, `process.cwd()`. I/O-free modules (`node:path`, `node:crypto` hashing, `node:url`, encoding, errors) stay allowed. The banned list is explicit, so anything not on it is allowed. This is the CODE-LAYOUT rule on architecture branch `docs/code-layout-no-io-in-core` (00ee3a8), shared by the engine, CLI and SDK. In the legacy table, `scaffold/{walk,path-guards,classify-transport}.ts` are classified per file as `infrastructure/out`, so only the real core reads become rows. Red-proof: a planted `node:fs` import in `domain/services` and a planted `process.env` read in `application/usecases` each fail.
- **Exceptions:** `{ from, to, rule, reason, removedBy: "S<n>" }`. A row whose edge no longer exists or no longer breaks its rule fails the test ("stale exception — delete the row"), so the table can only shrink; a row's `rule` must equal the rule the edge actually breaks. A `CEILING` constant equal to today's row count; the test fails if the table is longer. Planned interim growth (engine L34) needs a logged decision.
- **`ruleTestingImportedOnlyByTestEntries`** (Q4, resolved): a file under `bounded-contexts/<ctx>/testing/` may be imported only by test code (`test/**`) and by the public test entries — the `src/` files behind the `./testing` and `./conformance` subpaths of `package.json` `exports`, read from `package.json` at test time — and by files inside the same `testing/` folder. Any other production file importing it fails. This is the SDK's reading of CL:129 with the clarification proposed on architecture branch `docs/code-layout-public-test-kit-entry`. Red-proof: a planted `application/usecases` file importing `authoring/testing/contract-fake.ts` fails; the real `src/testing/index.ts` importing it passes; a planted public entry that is not a test subpath (e.g. `src/commons/index.ts`) importing it fails.
- **`ruleTestMirrorsSrc`** (Q9, resolved; a sibling check in the same fit-49 file): unit tests stay under `test/`, mirroring `src/`, checked at **folder** level: every test file's directory, relative to `test/`, must exist relative to `src/`, or sit under an allowlisted test-only folder. Today's allowlist, measured on 2b12435 (373 test files, 260 outside a mirrored folder, all in these): `fitness/`, `fixtures/`, `support/`, `skeleton/`, `e2e/`, `types/`, `docs/`, `golden-ir/`, `security/`, `pyramid/`, `build/`, and any `planted/` or `fixtures/` sub-folder (e.g. `conformance/planted/`). `test/fake/` (26 files) tests `src/testing/`; S7 moves it to `test/bounded-contexts/authoring/testing/` with the kit, and until then it is one mapping row (`fake` → `testing`). File-level mirroring (one test file per source file) is not cheap: 357 of the 373 test files are named after the behaviour they pin, not a source file, and renaming them would lose that meaning; the check stays at folder level. Red-proof: a planted `test/core/x.test.ts` after `src/core/` is gone fails; a file under `test/fitness/` passes.
- **Red-proof:** planted synthetic modules, one per rule, prove each rule fires; plus an oracle matrix over representative classes (CLI `badpattern_test.go`), byte-identical before and after any change to the guard itself.

Starting exceptions — the legacy edges that break a rule once their targets are classified, each a row with `removedBy`: V1 (`core/context.ts` → `node:fs`, `process.cwd()`; `ruleNoRuntimeIo`; removed by S9), V2 (`core/schema/schema-discovery.ts` → `node:fs`; `ruleNoRuntimeIo`; removed by S9), V3 (scaffold use case → fs adapters; removed by S10), V5 and V6 (wire types and engine client outside `acl/`; removed by S5), V8 (codegen → schema internals; removed by S13). V4 and V7 are `mixed` entries in the legacy table, not edge exceptions. Exact rows are produced by S0a's first run and recorded in the feature doc.

## 5. Slice plan

Every slice: about 400 authored changed lines (pure moves count rewritten import lines, not moved bytes; slices over the budget split, as the CLI's S17 and S20 did), its own commit, the **gate**, and its **proof**. Slices whose Risk line names an item get an independent verifier.

**Gate (every slice):** `bun run typecheck`; `bun run build` (the runner-manifest guard runs here); `bun test` (failures only the known, listed ones); fit-49 with the exception count; fit-04/fit-14 baselines either unchanged or regenerated with the path-independent proof below; the per-test differential (sorted `file › test name › status` from `bun test --reporter=junit`, moved tests mapped to their new path, identical before and after); every test file moved with the source it tests, in the same commit (Q9), and `ruleTestMirrorsSrc` green; from S0b on, P-API identical, P-PACK showing `exports`, `main` and `bin` byte-identical (Q2's binding condition), and P-SIZE within tolerance (the port rule).

**Proofs available:**
- **P-API** public-surface snapshot (added in S0b): for every `exports` subpath, the exported names and their checker-printed types, independent of file paths. Byte-identical before/after.
- **P-PACK** `npm pack --dry-run` file list and `exports`/`bin`/`main` diff, base vs head; only declared internal paths may differ.
- **P-IR** batch goldens (added in S0c): the recorded batches of every conformance-corpus factory and every docs example, via `runFactoryForTest`, as JSON; byte-identical.
- **P-CG** codegen goldens (S0c): `pbuilder-codegen` output for the fixture schemas; byte-identical.
- **P-ENG** engine conformance against the candidate SDK: `PBE_CONFORMANCE_REQUIRED=1 go test -tags conformance ./internal/conformance/` in an engine worktree with the submodule detached at the candidate SHA (detached, per engine :97), base vs head.
- **P-E2E** `test/e2e/installed-consumer.e2e.test.ts` (tarball and bun-link legs), base vs head output.
- **P-SIZE** minified bundle bytes per public entry plus the single-symbol probes, against `bundle-size-baseline.json`, tolerance max(256 B, 1 %) (3.3).

| Slice | Scope | Risk | Proof |
|---|---|---|---|
| **S0a** | fit-49 layering guard: graph, classifier with the legacy table, rules, exceptions with shrink-only + ceiling, red-proofs, liveness. No `src/` change. | 6 (a guard that misses edges) | red-proof per rule; oracle matrix; current suite unchanged |
| **S0b** | P-API snapshot test, P-PACK script and P-SIZE bundle-size baseline. No `src/` change. | — | snapshot and baseline pass on current code |
| **S0c** | P-IR batch goldens and P-CG codegen goldens (the generated output of `pbuilder-codegen` for every fixture schema, byte for byte — Q5's binding condition). No `src/` change. | — | goldens pass on current code |
| **S1a** | Guard only, no `src/` change (split from S1, 2026-11-13: the kit imports `context`, `directive-factory`, `session` and `wire`, so dialects cannot move into the target tree before the kit without importing legacy code). fit-49 gains `dialectIsolation` and `noClosedDialectSet` (3.2), with the dialect names and extensions read from the dialect folders at test time and fit-02's sibling allowlist shared from `test/support/layering/dialects.ts`; both rules hold on today's tree with no new EXCEPTIONS row. fit-09 derives its dialect subpaths from `package.json` and matches them against the `src/dialects/` barrel folders. The scratch-copy "add a dialect" proof (copy `css` to `cssx`) runs on today's layout. | 6 (guard) | red-proofs per rule, oracle diff additions only, the cssx proof |
| **S1b** | Move: the kit (S2's scope, folded in) and the dialect leaves together. Kit → `authoring/domain` (contract types → `ports/dialect-contract.ts`, kit functions → `services/dialect-kit.ts`, handles → `entities/`, `dialect-error`, `json-value`, `classify-content`); `deep-equal` → `src/platform/`; dialect leaves → `authoring/infrastructure/out/dialects/<name>/` (ast, ops, packs, TS helpers, `adapter.ts`); `src/dialects/<name>/index.ts` keep their paths as thin barrels (3.2). fit-02/21/37/38 retargeted. Three interim EXCEPTIONS rows, kit → `session`, `directive-factory` and `wire` (legacy until S4), removed by S4; CEILING goes up by 3 for this slice only, with that reason recorded beside it. **Not a pure move (S0a finding):** the Dialect handle entity reads `currentContext()` itself (`core/dialect-handle.ts → core/context.ts`); passing the session in is its own commit, with P-IR, the dialect suites and the conformance fixture as behavior proofs, and P-API, P-PACK and P-SIZE byte-identical. Split by dialect group if over about 600 authored lines. **As done (L20, L21):** basenames are kept so P-API stays byte-identical: `define-dialect.ts` moves whole to `domain/services/` (the split into `ports/dialect-contract.ts` and `services/dialect-kit.ts` waits for a slice whose P-API diff is only those renames), and each adapter keeps `index.ts` rather than `adapter.ts`. The inversion moves the run-store registry into `domain/services/run-context.ts`, so the fourth interim row is run-context → `authoring-error`. Moving `deep-equal` does not settle the S7 question (CODE-LAYOUT:127 does not list `testing/` among `platform/` importers); that row stays. Composition lines land in S11. **Align with the dialect business rules (2026-11-13):** the architecture dialect session is writing op rules per dialect (json A-20..A-38 and yaml A-39..A-53, merged as architecture #64 and #65; typescript, react, generics, css, angular and nestjs later) and a generic CATALOG step `the author applies the op "{op}" through the Dialect handle "{handle}" with the arguments:` (argument | value table of JSON text), plus docstring file-content steps and dialect failure outcomes. The step definitions for them land in the architecture rules suite (`odd/tasks/architecture-rules-suite.md`, R1 onward), not in this migration; this slice cites the merged rules. | 3 (`.d.ts` paths, tarball list), 6 | P-API, P-PACK, P-SIZE, P-IR, fit-04 regenerated with P-API identical |
| **S2** | Folded into S1b (2026-11-13). | — | — |
| **S3** | **Runs after S4** (2026-11-14: every S3 file imports `core/` modules that S4 moves; S3 first would add 18 interim rows, after S4 it adds none, L24/L25). fit-22 folds into fit-49 as a layer rule. Pure move: `pending-directives` → `application/usecases`; `scaffold/filename-pipeline` → `domain/services`; scaffold orchestration → `application/usecases/scaffold`; scaffold fs files → `infrastructure/out/fs` (V3 stays an exception until S10). fit-22 retargeted. | 3 | P-API, P-IR, scaffold tests |
| **S4** | **Runs before S3 (2026-11-14, L25).** Pure move, runner closure: `session` → `domain/aggregates/session/`, `directive-factory`, `input-rejection` and `schema/*` → `domain/services/schema/` (except `schema-discovery` → `infrastructure/out/fs/`), `schema-model`, `authoring-error` and `wire` → `domain/valueobjects/`, `engine-client` → `domain/ports/`, `context.ts` → `application/usecases/run-factory/` (it moves here, so S3 adds no rows), `fs-errors` → `src/platform/`. Basenames kept, so `wire.ts` moves whole: its split into the Directive VO (domain) and Batch/frame types (acl) goes to S5, which already moves the byte-count cap and the frame types. Runner closure baseline and `derive-runner-closure.ts` updated. Split S4a/S4b if over budget. | **3** (runner manifest is a cross-repo contract), 5 | P-ENG, P-IR, P-API, closure diff limited to declared paths |
| **S5** | Move plus one dependency inversion. **Also splits `wire.ts`** (moved whole into `domain/valueobjects/` by S4, 2026-11-14): the Directive VO stays in the domain, the Batch/frame types go to `acl/irwire`, with the byte-count cap and the frame types below. `transport/{stdio-engine-client,framing,frame-reader,wire-protocol}` + `core/emit-rejection` → `acl/irwire` (Q6, resolved); `framing`, `wire-protocol` and the byte-count cap from `core/wire.ts` → `shared-kernel/`. fit-32 retargeted. Removes V5, V6. fit-10/30/31 retargeted. **Not a pure move (S0a finding):** the domain error model decodes engine rejections (`core/authoring-error.ts → core/emit-rejection.ts`); S5 moves the decoding into `acl/irwire` and maps it onto `AuthoringError`, which changes behavior-bearing code, so it carries P-IR, P-ENG and the rejection-message tests as behavior proofs. | **3**, 4 (stdio ordering) | P-ENG, P-IR, transport tests |
| **S6** | Pure move: runner bootstrap (`transport/runner`, factory-pointer, exit-codes, error-text, single-instance-probe, bootstrap-bridge) → `bounded-contexts/runner-hosting/` (Q1). Runner hosting calls Authoring's `run-factory` use case. `src/bin/pbuilder-runner.ts` and the closure's entry keep their paths. fit-29 and `derive-runner-closure.ts` updated. | **3**, 2 (runner guard R-2 sits here), 5 | P-ENG, closure diff, fit-42 |
| **S7** | Pure move: `testing/` and `conformance/` internals → `authoring/testing/` (Q4, resolved); public entries `src/testing/index.ts` and `src/conformance/index.ts` stay as thin barrels and are the only production importers (`ruleTestingImportedOnlyByTestEntries`). fit-17/18 retargeted. | 3 (`./testing` is public) | P-API, P-PACK, fit-17 marker check |
| **S8** | Split `commons/index.ts`: facade → `infrastructure/in`, verb logic → `application/usecases`. Removes V4. | 3 | P-API, P-IR |
| **S9** | The `package-files` port (3.3) in `domain/ports`, its `node:fs` adapter in `infrastructure/out/fs/`; `context.ts` and `schema-discovery` stop importing `node:fs`. Removes V1, V2. | 6 if a read path is untested → characterise first | P-IR, P-ENG, P-SIZE, port tests |
| **S10** | Scaffold use case reads through the `package-files` port; removes V3. | 3 (scaffold errors are public text) | P-IR, scaffold message tests |
| **S11** | `bounded-contexts/authoring/composition.ts` (`makeX`) and `bounded-contexts/runner-hosting/composition.ts`; public entries and `bin/pbuilder-runner.ts` call composition (CL:102-103). | 3 | P-API, P-ENG |
| **S12** | ARCH-2: JSX grammar and no-echo tail out of the kit into the React dialect. Removes V7. | 3 (reject messages) | dialect tests, P-API |
| **S13** | Codegen (Q5, resolved): `bin/{emit-type,project-codegen}.ts` and the codegen logic in `bin/pbuilder-codegen.ts` → `bounded-contexts/authoring/infrastructure/in/codegen/`, calling Authoring's schema functions; `bin/pbuilder-codegen.ts` stays the process entry and only calls composition; `package.json` `bin` and `build:codegen` keep their paths. Removes V8. | 3 (generated code and the CLI are public) | P-CG byte-identical, P-PACK (`bin` unchanged), fit-15 |
| **S14** | Fold the import-only fitness tests (fit-01, 02, 07, 10, 15, 21, 22, 37, 38) into fit-49 rules or make them thin wrappers; keep tests that check more than imports (fit-29 caller set, fit-39 encode site, fit-42). Legacy table and exceptions reach zero. | 6 | red-proofs carried over, oracle matrix |
| **S15** | Docs content: `docs/bounded-contexts/authoring.md` and `runner-hosting.md` replacing `openspec/architecture.md`, which retire-sdd deletes, so the pages cite its pinned permalink (https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/0ea78c7a79e4c9f06d49d8d7e3e1051276aac71a/openspec/architecture.md) (stale at 0.2.0; line 65 "No `adapters/`/`ports/`/`usecases/`/`domain/` scaffold" becomes false), a layout ADR, `CONTRIBUTING.md` conventions, the hexagon drawing (domainrings, as engine D6). | — | structural readback |
| **S16** | Docs moves per 3.1 (Q8, resolved; the ADRs already moved in retire-sdd PR #161): contracts → `docs/contracts/`, author guides → `docs/guides/`, contributor content → `handbook/` with `CONTRIBUTING.md` left as a pointer; update `test/docs/*`, README and cross-links. **Cross-repo step:** project-builder-docs links to three moved guides on `blob/main` (`docs/css-dialect.md`, `docs/yaml-dialect.md`, `docs/authoring-a-dialect.md#mandatory-module-export-and-fixture-migration`; 8 links in `src/content/docs/{guides,reference}` and their `es/` copies), and they break as soon as the SDK move reaches `main`. The SDK session doing S16 prepares a project-builder-docs PR that rewrites those 8 links, opened together with the SDK PR; the user merges it right after the SDK PR. Any prose in that PR (link text, PR and commit bodies) goes through the humanizer skill before commit, as project-builder-docs requires, the same rule as the architecture repo. | 3 (links the docs site and engine docs consume) | `test/docs/*`, a link check over moved files, the docs-site link list rechecked against the new paths |

Renames to ubiquitous language are not in this plan (CL:138). Where a move forces a name change, it is a separate commit (engine M9).

## 6. Questions (all resolved 2026-11-12)

| # | Question | Where the rules are silent or ambiguous | Recommendation |
|---|---|---|---|
| Q1 | **Resolved 2026-11-12 — yes** (user: "si vamos con eso"): `src/bounded-contexts/runner-hosting/`, plus architecture branch `docs/runner-hosting-names-sdk` (bc0cc99) naming the SDK in README:5. Was: does the SDK implement Runner hosting? | `runner-hosting/README.md:5` names only the engine and the CLI; Discussion #1 lists "runner" in the SDK column; `runner-hosting/README.md:13` and `runner-guard.feature` (32 `@sdk`) put the R-2 guard in the SDK runner bootstrap; CL:29 "A repository has no folder for a context it does not implement". | Yes: `boundedcontexts/runnerhosting/` for the runner bootstrap and R-2, reaching Authoring only through its `run-factory` use case (CL:131). Needs an architecture PR to add the SDK to README:5. Folder casing `runnerhosting` follows CL:29's Go example; TS casing is not stated. |
| Q2 | **Resolved 2026-11-12 — keep current paths** (user: "Si me parece, con el resultado sea el mismo todo bien"): binding condition, `exports`, `main` and `bin` byte-identical, proven in every slice by P-API and P-PACK. Was: where do the TS public entry files live? | CL:8 puts `<public entry points>` beside the private root; CL:24 says code sits under `src/` behind `exports`. Neither covers a package with 11 subpaths whose entry files are already under `src/`. | Keep them at their current `src/` paths as thin barrels, so `exports`, fit-09/14/47 and consumers see no change. |
| Q3 | **Resolved 2026-11-12 — dialect packs are `infrastructure/out` adapters of the Dialect contract port** (user: "Me parece, el unico tema es que tiene que ser facil extender los dialectos y/o agregar nuevos"); binding condition and guard in 3.2; architecture note on branch `docs/authoring-op-rules-in-dialect-adapters`. Was: where do dialect op rules go? | `authoring/README.md:17` "Op rules: domain service. AST library: infrastructure." Today's ops are written against the library's AST types (ts-morph, postcss, yaml, jsonc-parser), so they cannot be domain code without wrapping every library type. | Each dialect pack is an `infrastructure/out` adapter implementing the Dialect contract port; only library-free rules (name grammars, ordering policies) move to `domain/services`. Confirm with the architecture owner; an architecture note may be needed. |
| Q4 | **Resolved 2026-11-12 — `src/bounded-contexts/authoring/testing/`, imported only by the `./testing` and `./conformance` entries and test code** (user: "si me parece, vamos con eso"); enforced by `ruleTestingImportedOnlyByTestEntries` (section 4); CODE-LAYOUT:129 clarification on architecture branch `docs/code-layout-public-test-kit-entry` (f3256c4). Was: where do the shipped test kits live (`ContractFake`, `runFactoryForTest`, the conformance fixture)? | CL:99 `testing/` = "fakes and builders the context offers to whoever tests it"; CL:25 says conformance suites and test helpers live outside the contexts; CL:129 "`testing/` … not imported by production code"; `authoring/README.md:16` says the SDK *exports* the conformance fixture. | `boundedcontexts/authoring/testing/`; only the public entries `./testing` and `./conformance` import it, which CL:129 allows if a public entry is not "production code". Needs that reading confirmed. |
| Q5 | **Resolved 2026-11-12 — codegen is an Authoring driving adapter at `bounded-contexts/authoring/infrastructure/in/codegen/`** (user: "Si me parece"); `bin/pbuilder-codegen.ts` stays the process entry and only calls composition; `bin` path unchanged (Q2); generated output byte-identical, proven by P-CG (S0c). Was: codegen CLI and generated code | CODE-LAYOUT has no rule on codegen, generated code, or a CLI binary inside a library. Codegen exists only as A-15 (`invoke-boundary.feature:98`) and `authoring/README.md:24`. | Codegen is an Authoring driving adapter (`infrastructure/in/codegen`); `bin/pbuilder-codegen.ts` stays the process entry and calls composition. |
| Q6 | **Resolved 2026-11-12 — `src/acl/irwire/` with `irwire.in.acl.ts`, `irwire.out.acl.ts` and `index.ts`, mirroring the engine** (user: "si dale, vamos con irwire"). Was: name of the ACL to Execution's Published Language | CL:69 gives only the engine example (`acl/irwire/`); counterpart naming for the other side is not stated. | `acl/irwire/` to mirror the engine, with `irwire.in.acl.ts` / `irwire.out.acl.ts`. Alternative: `acl/execution/`. |
| Q7 | **Resolved 2026-11-12 — the Directive stays a domain value object with today's shape; Authoring is conformist to the wire for now** (user: "si me parece"); `acl/irwire` does serialisation, framing and rejection decoding only, with no translation layer or parallel model; revisit when the wire changes version (section 3, `acl/irwire/` scope); P-IR keeps the wire bytes identical. Was: is the Directive the domain value object or the Published Language? | `GLOSSARY.md:133` "An Instruction waiting to be sent (value object)"; ADR-0001 makes the SDK emit the engine's ADR-0028 directive shape. Whether Authoring is conformist to the wire for this VO is not stated. | Keep the Directive in `domain/valueobjects` with today's shape (no change); the ACL owns serialisation, framing and rejection decoding. |
| Q8 | **Resolved 2026-11-12 — adopt `handbook/` (contributor workflow, suites, conventions, layering rule) with `CONTRIBUTING.md` as a root pointer; author guides → `docs/guides/`; process records stay in `openspec/`** — **revised 2026-11-13:** retire-sdd deletes `openspec/`, the process records are archived by a pinned permalink, with no `docs/history/`, and the ADRs moved to `docs/adr/` in PR #161** (user: "me parece"); section 3.1, S16. Was: `handbook/` and `docs/` | CL:7-22 put contributor guidance in `handbook/` and per-context technical pages and ADRs in `docs/`; the SDK's `docs/` is author-facing guides, and its ADRs live in `openspec/decisions/`. | Out of scope for the code migration; decide separately (S15 updates content, not folder names). |
| Q9 | **Resolved 2026-11-12 — unit tests stay in `test/`, mirroring `src/`** (user: "si me parece, vamos con test/ en espejo"); each slice moves a source file's tests to the mirrored path in the same commit; `ruleTestMirrorsSrc` checks it at folder level (section 4). Was: unit-test location | CODE-LAYOUT places `testing/`, `acceptance/` and `acl/<counterpart>/tests`, but says nothing about unit tests. The SDK keeps them in `test/` mirroring `src/`. | Keep `test/`; move test files with each slice to mirror the new paths. |
| Q10 | **Resolved 2026-11-12 — a CODE-LAYOUT rule all three repos share** (user: "si dale, vamos con el PR a arquitectura"): architecture branch `docs/code-layout-no-io-in-core` (00ee3a8); fit-49 `ruleNoRuntimeIo` from S0a, with V1 and V2 as starting exception rows removed by S9. Was: I/O imports in `domain/`/`application/` as a guard rule |

## 7. Out of scope

Behaviour changes, public renames (CL:138), sdk#157, the `@pbuilder/sdk-kit` extraction (`openspec/pending-changes.md:412`), and any change to the IR wire or the runner manifest format.
