# Proposal: `@pbuilder/sdk` on the DDD + hexagonal layout

Feature doc: [hexagonal-layout.md](./hexagonal-layout.md). Status: proposal, awaiting the user's approval. No source changes yet.

Sources: project-builder-architecture origin/main 7ed257b — `CODE-LAYOUT.md` (cited `CL:<line>`), `bounded-contexts/*/README.md`, `GLOSSARY.md`, Decision 19 (Discussion #1, comment 19464384), the context map (Discussion #1 body). Method: engine `odd/tasks/hexagonal-layout.md` (origin/main 9b07d07), CLI `odd/tasks/layout-contexts.md`, `layout-guards.md`, `layout-launch.md` (origin/main 081510a). SDK: origin/main 2b12435, 0.14.0.

## 0. What the rules require, in short

- One folder per bounded context the repository implements, under a private root; in TypeScript that root is `src/` and the public surface is limited by `package.json` `exports` (CL:24, CL:29).
- Layers `domain/{aggregates,entities,valueobjects,services,ports}`, `application/usecases`, `infrastructure/{in,out}`, plus `composition` and `testing/` (CL:73-103). Ports belong to the core, never to `infrastructure/` (CL:91).
- `acl/<counterpart>/{in,out}`; in TypeScript, files `<counterpart>.in.acl.ts` / `<counterpart>.out.acl.ts` next to an `index.ts` (CL:56-68). A driven adapter that implements a port in terms of another context's model lives in `acl/<counterpart>/out` (CL:93).
- `composition` is the only file that knows use cases and concrete adapters; in TypeScript it exports `makeX(adapterA, adapterB)` (CL:102). Public entry points call each context's composition (CL:103).
- The dependency rule (CL:122-131), enforced by an architecture test that fails the build (CL:133).
- The public API does not change during the migration; renames are separate changes (CL:137-138).

## 1. Contexts the SDK implements

| Context | Implements? | Evidence |
|---|---|---|
| Authoring | **Yes** | `authoring/README.md:5` "Repository: SDK"; `:9` "the factory, its input schema, its metadata and its mutations … Dialects … translates every author verb into IR wire operations"; Discussion #1 row "Authoring … all of it" in the SDK column. |
| Execution | No (SDK holds a test copy) | `execution/README.md:5` "engine"; Discussion #1 row: SDK column "`ContractFake` (test copy)". The SDK only *consumes* Execution's Published Language (`authoring/README.md:23`). |
| Runner hosting | **Open — Q1** | `runner-hosting/README.md:5` names "engine (`adapter/bunipc`) and the CLI's SDK trust gate"; but Discussion #1 row puts "runner" in the SDK column, `:13` says "R-2 adds a guard in the SDK runner bootstrap", and `runner-guard.feature` has 32 `@sdk` scenarios. |
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
| `src/transport/runner.ts` | runner composition root; single sanctioned dynamic `import()`; calls `defineFactory` | In + composition | Runner hosting? (Q1) | `node:fs/path/url` |
| `src/transport/{factory-pointer,exit-codes,error-text,single-instance-probe}.ts` | runner bootstrap pieces | In / Out | Runner hosting? (Q1) | `node:fs/module/path/url`, `process.*` |
| `src/transport/bootstrap-bridge.ts` | in-process engine entry (the engine imports it) | In | Runner hosting? (Q1) | `process.exit` |
| `src/bin/pbuilder-runner.ts` | runner argv entry | In (process entry) | Runner hosting? (Q1) | `process.*` |
| `bin/{pbuilder-codegen,emit-type,project-codegen}.ts` (repo root) | codegen CLI (A-15) | In (CLI) + D | Authoring (Q5) | `node:fs` |

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
src/
├── index.ts                         public entry  (@pbuilder/sdk)                 — unchanged path, thin
├── commons/index.ts                 public entry  (@pbuilder/sdk/commons)         — becomes a thin barrel
├── testing/index.ts                 public entry  (@pbuilder/sdk/testing)         — thin barrel
├── conformance/index.ts             public entry  (@pbuilder/sdk/conformance)     — thin barrel
├── dialects/<name>/index.ts  ×7     public entries (@pbuilder/sdk/<name>)         — thin barrels
├── bin/pbuilder-runner.ts           process entry (dist/bin/pbuilder-runner.js)   — path kept (runner manifest)
├── boundedcontexts/
│   ├── authoring/
│   │   ├── domain/
│   │   │   ├── aggregates/session/          session.ts
│   │   │   ├── entities/                    dialect-handle.ts, base-handle.ts, handle-state.ts
│   │   │   ├── valueobjects/                directive.ts (Directive), json-value.ts, schema-model.ts, errors (authoring-error, dialect-error)
│   │   │   ├── services/                    directive-factory.ts, schema-{parse,validate,sufficiency,locate,digest}.ts,
│   │   │   │                                input-rejection.ts, filename-pipeline.ts, classify-content.ts, op rules (Q3)
│   │   │   └── ports/                       engine-client.ts, dialect-contract.ts (defineDialect/defineOpPack/withOps types),
│   │   │                                    source-folder.ts (new, S9), schema-source.ts (new, S9)
│   │   ├── application/usecases/            run-factory (defineFactory), verbs (create/modify/…), scaffold, pending-directives
│   │   ├── infrastructure/
│   │   │   ├── in/                          facade behind the public API (author verbs, find), codegen CLI (Q5)
│   │   │   └── out/                         fs/ (walk, path-guards, classify-transport, schema discovery),
│   │   │                                    dialects/<name>/ (AST library adapters, Q3), run-context (AsyncLocalStorage)
│   │   ├── composition.ts                   makeAuthoring(engineClient, fs, …) and the per-dialect makeX
│   │   └── testing/                         contract-fake.ts, run-for-test (runFactoryForTest), conformance fixture (Q4)
│   └── runnerhosting/                       only if Q1 = yes: runner bootstrap, R-2 guard, single-instance probe,
│                                            factory pointer, exit codes, error text, bootstrap bridge, composition.ts
├── acl/
│   └── irwire/                              Q6 for the name; mirrors the engine's acl/irwire
│       ├── index.ts
│       ├── irwire.out.acl.ts                Directive/Batch → wire frames; StdioEngineClient (implements EngineClient, CL:93)
│       └── irwire.in.acl.ts                 frames → results; engine rejections → Authoring errors (emit-rejection)
│       (framing.ts, frame-reader.ts, wire-protocol.ts sit beside them as the ACL's internals)
└── platform/                                only if needed: deep-equal.ts, fs-errors.ts (CL:34, imported only by
                                             infrastructure/, composition and public entries — CL:126)
```

No `sharedkernel/` and no `application/<name>/`: with one or two contexts nothing is shared "and agreed to change together" (CL:32), and no layer orchestrates several contexts (CL:38). This mirrors the engine's stance (engine doc :14, "Revisit if one appears").

### 3.1 Public API mapping — no change

| `exports` subpath | Today | Target |
|---|---|---|
| `.` | `dist/index.js` | same file; re-exports the Authoring facade |
| `./commons` | `dist/commons/index.js` | same file; thin barrel over `boundedcontexts/authoring/infrastructure/in` |
| `./testing` | `dist/testing/index.js` | same file; barrel over `boundedcontexts/authoring/testing` |
| `./conformance` | `dist/conformance/index.js` | same file; barrel over the conformance fixture (Q4) |
| `./typescript` … `./css` (7) | `dist/dialects/<name>/index.js` | same files; each calls `composition.ts` for its pack |
| `bin.pbuilder-codegen` | `dist/bin/pbuilder-codegen.js` | same (bundled from repo-root `bin/`, Q5) |
| runner (no `#bin`, ADR-0058) | `dist/bin/pbuilder-runner.js` | same path; the manifest's entry stays put |

Keeping every public entry file at its current path keeps `exports`, `main`, `bin`, fit-09 and fit-47 untouched. What does change is internal: dist paths of moved files appear in fit-14's tarball list, in fit-04's `.d.ts` baseline names and in their `import("…")` type references, and in the runner closure. Section 5 says how each slice proves those are internal-only. Where the entry files live is Q2.

## 4. The guard first

A TypeScript translation of the engine's FF-45 and the CLI's `internal/arch`, built on the repo's own tooling (bun test, `test/support/import-scan.ts`):

- **File:** `test/fitness/fit-49-layering.test.ts` (next free number) with `test/support/layering/{classify,rules,exceptions}.ts`.
- **Graph:** every `.ts` under `src/` and the repo-root `bin/`; edges from `import`/`export … from`, `import type`, dynamic `import("…")`, and `node:` specifiers. It reuses `stripComments` from `import-scan.ts` so JSDoc `@example` imports (e.g. `src/conformance/index.ts:51`) are not edges. A liveness check fails closed if the file count or edge count drops below a floor, or if a known edge (`transport/stdio-engine-client.ts → core/engine-client.ts`) goes missing — the engine's lesson that moves can silently hide code from a check (engine L33).
- **Classification:** fail-closed, derived from the path for the target tree (CLI style: `boundedcontexts/<ctx>/<layer>`, `acl/<counterpart>/{in,out}`, `platform`, public entries), plus an explicit **legacy table** for today's folders, each with a dominant role and a `mixed` list (engine style), so the table shrinks as files move. An unknown path, context, layer or counterpart is an error.
- **Rules:** one named rule per CL line 122-131 (e.g. `ruleApplicationImports = "application/ imports only domain/ and sharedkernel/"`), plus `ruleTargetNeverImportsLegacy` (CLI S12c: target-layout code never imports the legacy tree; legacy → target stays unchecked until the legacy tree is empty).
- **I/O rule (needs approval, Q10):** a `node:fs`, `node:child_process`, `node:net`, `process.stdin/stdout` import in `domain/` or `application/` is a violation. CODE-LAYOUT does not state it; it is the SDK's reading of CL:90 ("a filesystem adapter … lives in `infrastructure/out/` and implements a port").
- **Exceptions:** `{ from, to, rule, reason, removedBy: "S<n>" }`. A row whose edge no longer exists or no longer breaks its rule fails the test ("stale exception — delete the row"), so the table can only shrink; a row's `rule` must equal the rule the edge actually breaks. A `CEILING` constant equal to today's row count; the test fails if the table is longer. Planned interim growth (engine L34) needs a logged decision.
- **Red-proof:** planted synthetic modules, one per rule, prove each rule fires; plus an oracle matrix over representative classes (CLI `badpattern_test.go`), byte-identical before and after any change to the guard itself.

Starting exceptions — the legacy edges that break a rule once their targets are classified: V1, V2, V3, V5, V6 (table rows, each with its removing slice), V8 if Q5 makes codegen a driving adapter. V4 and V7 are `mixed` entries in the legacy table, not edge exceptions. Exact rows are produced by S0a's first run and recorded in the feature doc.

## 5. Slice plan

Every slice: about 400 authored changed lines (pure moves count rewritten import lines, not moved bytes; slices over the budget split, as the CLI's S17 and S20 did), its own commit, the **gate**, and its **proof**. Slices whose Risk line names an item get an independent verifier.

**Gate (every slice):** `bun run typecheck`; `bun run build` (the runner-manifest guard runs here); `bun test` (failures only the known, listed ones); fit-49 with the exception count; fit-04/fit-14 baselines either unchanged or regenerated with the path-independent proof below; the per-test differential (sorted `file › test name › status` from `bun test --reporter=junit`, moved tests mapped to their new path, identical before and after).

**Proofs available:**
- **P-API** public-surface snapshot (added in S0b): for every `exports` subpath, the exported names and their checker-printed types, independent of file paths. Byte-identical before/after.
- **P-PACK** `npm pack --dry-run` file list and `exports`/`bin`/`main` diff, base vs head; only declared internal paths may differ.
- **P-IR** batch goldens (added in S0c): the recorded batches of every conformance-corpus factory and every docs example, via `runFactoryForTest`, as JSON; byte-identical.
- **P-CG** codegen goldens (S0c): `pbuilder-codegen` output for the fixture schemas; byte-identical.
- **P-ENG** engine conformance against the candidate SDK: `PBE_CONFORMANCE_REQUIRED=1 go test -tags conformance ./internal/conformance/` in an engine worktree with the submodule detached at the candidate SHA (detached, per engine :97), base vs head.
- **P-E2E** `test/e2e/installed-consumer.e2e.test.ts` (tarball and bun-link legs), base vs head output.

| Slice | Scope | Risk | Proof |
|---|---|---|---|
| **S0a** | fit-49 layering guard: graph, classifier with the legacy table, rules, exceptions with shrink-only + ceiling, red-proofs, liveness. No `src/` change. | 6 (a guard that misses edges) | red-proof per rule; oracle matrix; current suite unchanged |
| **S0b** | P-API snapshot test and P-PACK script. No `src/` change. | — | snapshot passes on current code |
| **S0c** | P-IR batch goldens and P-CG codegen goldens. No `src/` change. | — | goldens pass on current code |
| **S1** | Pure move: dialect leaves → `authoring/infrastructure/out/dialects/<name>/` (ast, ops, packs, TS helpers); `src/dialects/<name>/index.ts` keep their paths as thin barrels. fit-02/37/38 retargeted. | 3 (`.d.ts` paths, tarball list) | P-API, P-PACK, P-IR, fit-04 regenerated with P-API identical |
| **S2** | Pure move: dialect kit → `authoring/domain` (`define-dialect` → `ports/dialect-contract`, handles → `entities/`, `dialect-error`, `json-value`, `classify-content`). fit-21 retargeted. | 3 | P-API, P-PACK, P-IR |
| **S3** | Pure move: `pending-directives` → `application/usecases`; `scaffold/filename-pipeline` → `domain/services`; scaffold orchestration → `application/usecases/scaffold`; scaffold fs files → `infrastructure/out/fs` (V3 stays an exception until S10). fit-22 retargeted. | 3 | P-API, P-IR, scaffold tests |
| **S4** | Pure move, runner closure: `session`, `directive-factory`, `authoring-error`, `input-rejection`, `schema/*` → `authoring/domain`; `wire.ts` split into the Directive VO (domain) and Batch/frame types (acl). Runner closure baseline and `derive-runner-closure.ts` updated. Split S4a/S4b if over budget. | **3** (runner manifest is a cross-repo contract), 5 | P-ENG, P-IR, P-API, closure diff limited to declared paths |
| **S5** | Pure move: `transport/{stdio-engine-client,framing,frame-reader,wire-protocol}` + `core/emit-rejection` → `acl/irwire` (Q6). Removes V5, V6. fit-10/30/31 retargeted. | **3**, 4 (stdio ordering) | P-ENG, P-IR, transport tests |
| **S6** | Pure move: runner bootstrap (`transport/runner`, factory-pointer, exit-codes, error-text, single-instance-probe, bootstrap-bridge) → `runnerhosting/` or `authoring/infrastructure/in/runner` per Q1. `src/bin/pbuilder-runner.ts` and the closure's entry keep their paths. fit-29 and `derive-runner-closure.ts` updated. | **3**, 2 (runner guard R-2 sits here), 5 | P-ENG, closure diff, fit-42 |
| **S7** | Pure move: `testing/` and `conformance/` internals → `authoring/testing/` (Q4); public entries stay. fit-17/18 retargeted. | 3 (`./testing` is public) | P-API, P-PACK, fit-17 marker check |
| **S8** | Split `commons/index.ts`: facade → `infrastructure/in`, verb logic → `application/usecases`. Removes V4. | 3 | P-API, P-IR |
| **S9** | Ports for filesystem reads: `source-folder` and `schema-source` ports in `domain/ports`, fs adapters in `infrastructure/out/fs`; `context.ts` and `schema-discovery` stop importing `node:fs`. Removes V1, V2. | 6 if a read path is untested → characterise first | P-IR, P-ENG, new port tests |
| **S10** | Scaffold use case talks to the source-folder port; removes V3. | 3 (scaffold errors are public text) | P-IR, scaffold message tests |
| **S11** | `boundedcontexts/authoring/composition.ts` (`makeX`) and, per Q1, `runnerhosting/composition.ts`; public entries and `bin/pbuilder-runner.ts` call composition (CL:102-103). | 3 | P-API, P-ENG |
| **S12** | ARCH-2: JSX grammar and no-echo tail out of the kit into the React dialect. Removes V7. | 3 (reject messages) | dialect tests, P-API |
| **S13** | Codegen per Q5 (driving adapter over Authoring's schema use cases); removes V8. | 3 (codegen output is public) | P-CG |
| **S14** | Fold the import-only fitness tests (fit-01, 02, 07, 10, 15, 21, 22, 37, 38) into fit-49 rules or make them thin wrappers; keep tests that check more than imports (fit-29 caller set, fit-39 encode site, fit-42). Legacy table and exceptions reach zero. | 6 | red-proofs carried over, oracle matrix |
| **S15** | Docs: rewrite `openspec/architecture.md` (stale at 0.2.0; line 65 "No `adapters/`/`ports/`/`usecases/`/`domain/` scaffold" becomes false), a layout ADR, `CONTRIBUTING.md` conventions, the hexagon drawing (domainrings, as engine D6). | — | structural readback |

Renames to ubiquitous language are not in this plan (CL:138). Where a move forces a name change, it is a separate commit (engine M9).

## 6. Open questions

| # | Question | Where the rules are silent or ambiguous | Recommendation |
|---|---|---|---|
| Q1 | Does the SDK implement Runner hosting? | `runner-hosting/README.md:5` names only the engine and the CLI; Discussion #1 lists "runner" in the SDK column; `runner-hosting/README.md:13` and `runner-guard.feature` (32 `@sdk`) put the R-2 guard in the SDK runner bootstrap; CL:29 "A repository has no folder for a context it does not implement". | Yes: `boundedcontexts/runnerhosting/` for the runner bootstrap and R-2, reaching Authoring only through its `run-factory` use case (CL:131). Needs an architecture PR to add the SDK to README:5. Folder casing `runnerhosting` follows CL:29's Go example; TS casing is not stated. |
| Q2 | Where do the TS public entry files live? | CL:8 puts `<public entry points>` beside the private root; CL:24 says code sits under `src/` behind `exports`. Neither covers a package with 11 subpaths whose entry files are already under `src/`. | Keep them at their current `src/` paths as thin barrels, so `exports`, fit-09/14/47 and consumers see no change. |
| Q3 | Where do dialect op rules go? | `authoring/README.md:17` "Op rules: domain service. AST library: infrastructure." Today's ops are written against the library's AST types (ts-morph, postcss, yaml, jsonc-parser), so they cannot be domain code without wrapping every library type. | Each dialect pack is an `infrastructure/out` adapter implementing the Dialect contract port; only library-free rules (name grammars, ordering policies) move to `domain/services`. Confirm with the architecture owner; an architecture note may be needed. |
| Q4 | Where do the shipped test kits live (`ContractFake`, `runFactoryForTest`, the conformance fixture)? | CL:99 `testing/` = "fakes and builders the context offers to whoever tests it"; CL:25 says conformance suites and test helpers live outside the contexts; CL:129 "`testing/` … not imported by production code"; `authoring/README.md:16` says the SDK *exports* the conformance fixture. | `boundedcontexts/authoring/testing/`; only the public entries `./testing` and `./conformance` import it, which CL:129 allows if a public entry is not "production code". Needs that reading confirmed. |
| Q5 | Codegen CLI and generated code | CODE-LAYOUT has no rule on codegen, generated code, or a CLI binary inside a library. Codegen exists only as A-15 (`invoke-boundary.feature:98`) and `authoring/README.md:24`. | Codegen is an Authoring driving adapter (`infrastructure/in/codegen`); `bin/pbuilder-codegen.ts` stays the process entry and calls composition. |
| Q6 | Name of the ACL to Execution's Published Language | CL:69 gives only the engine example (`acl/irwire/`); counterpart naming for the other side is not stated. | `acl/irwire/` to mirror the engine, with `irwire.in.acl.ts` / `irwire.out.acl.ts`. Alternative: `acl/execution/`. |
| Q7 | Is the Directive the domain value object or the Published Language? | `GLOSSARY.md:133` "An Instruction waiting to be sent (value object)"; ADR-0001 makes the SDK emit the engine's ADR-0028 directive shape. Whether Authoring is conformist to the wire for this VO is not stated. | Keep the Directive in `domain/valueobjects` with today's shape (no change); the ACL owns serialisation, framing and rejection decoding. |
| Q8 | `handbook/` and `docs/` | CL:7-22 put contributor guidance in `handbook/` and per-context technical pages and ADRs in `docs/`; the SDK's `docs/` is author-facing guides, and its ADRs live in `openspec/decisions/`. | Out of scope for the code migration; decide separately (S15 updates content, not folder names). |
| Q9 | Unit-test location | CODE-LAYOUT places `testing/`, `acceptance/` and `acl/<counterpart>/tests`, but says nothing about unit tests. The SDK keeps them in `test/` mirroring `src/`. | Keep `test/`; move test files with each slice to mirror the new paths. |
| Q10 | I/O imports in `domain/`/`application/` as a guard rule | CL:122-131 constrain imports between layers, not imports of runtime modules; CL:90 only says where filesystem adapters live. | Adopt it as an SDK-local rule derived from CL:90 (section 4), or raise it as an architecture PR so the engine and CLI share it. |

## 7. Out of scope

Behaviour changes, public renames (CL:138), sdk#157, the `@pbuilder/sdk-kit` extraction (`openspec/pending-changes.md:412`), and any change to the IR wire or the runner manifest format.
