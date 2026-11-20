# Authoring

Authoring is where a schematic is written: the factory, its input schema and the edits it makes. It lives in `src/bounded-contexts/authoring/`, reaches the engine only through the `acl/irwire` anti-corruption layer, and is guarded by fit-49. This page maps the code as it is today.

- **Strategic model:** [Authoring](https://github.com/Project-Builder-Schematics/project-builder-architecture/blob/v0.19.0/bounded-contexts/authoring/README.md) in project-builder-architecture v0.19.0 (also at `third_party/project-builder-architecture/bounded-contexts/authoring/README.md`).
- **Layout rules:** [CODE-LAYOUT](https://github.com/Project-Builder-Schematics/project-builder-architecture/blob/v0.19.0/CODE-LAYOUT.md) and [ADR-0083](../adr/0083-hexagonal-layout.md).
- **Drawing:** `docs/bounded-contexts/sdk.hexa`, a [domainrings](https://diagrams.pbuilder.dev/) map of both contexts. Open it with **Open…** in the app's toolbar, or make a link with `npx -y @pbuilder/domainrings link docs/bounded-contexts/sdk.hexa --open`.

## Responsibility

Authoring gives authors file-type-aware edits through Dialects and turns every author verb into IR wire directives before they cross into Execution. The Dialect system is the core subdomain; the generic verbs and the translation to IR are supporting. The context is flat: it has one subdomain, so its layers sit directly in its folder.

## Model

| Kind | Where | What |
|---|---|---|
| Aggregate | `domain/aggregates/session/session.ts` | `Session`: the pending-directive buffer and the flush policy. It holds the `EngineClient`, and flush-before-read lives only here. |
| Entities | `domain/entities/` | `dialect-handle.ts` (the Dialect handle: identity is the normalized path, its AST is a cache), `base-handle.ts`, `handle-state.ts` |
| Value objects | `domain/valueobjects/` | `wire.ts` (`Directive`, `Batch`), `authoring-error.ts`, `dialect-error.ts`, `json-value.ts`, `schema-model.ts` |
| Domain services | `domain/services/` | `directive-factory.ts` (verb to `Directive`), `define-dialect.ts` (the Dialect contract and its kit), `schema/*` (parse, validate, sufficiency, locate, digest, input rejection), `filename-pipeline.ts`, `identifier-names.ts`, `reject-tail.ts`, `classify-content.ts`, `run-context.ts` |
| Driven ports | `domain/ports/` | `engine-client.ts`, `emit-rejection.ts`, `package-files.ts` |
| Use cases | `application/usecases/` | `run-factory/` (`defineFactory`, plus `driving.ts` for callers in another context), `authoring-verbs/`, `scaffold/`, `pending-directives/` |

The `Directive` keeps the IR wire's shape: Authoring is conformist to it (ADR-0001), so the ACL serialises it without translating it.

## Ports

The SDK adds a port only for real I/O or a real extension point. Everything else is a plain function with no interface in front.

| Port | File | Why it is a port | Implemented by |
|---|---|---|---|
| `EngineClient` | `domain/ports/engine-client.ts` | the stdio transport to the engine | `acl/irwire/stdio-engine-client.ts`, and `testing/contract-fake.ts` in tests |
| `EmitRejection` | `domain/ports/emit-rejection.ts` | the closed rejection shape every `EngineClient` rejects with (ADR-0022) | thrown by the two clients above |
| `PackageFiles` | `domain/ports/package-files.ts` | filesystem reads under the factory package folder | `infrastructure/out/fs/package-files.ts` (`nodePackageFiles`) |
| Dialect contract | `domain/services/define-dialect.ts` | the extension point every dialect implements, authors' own included | the seven packs under `infrastructure/out/dialects/` |

The Dialect contract has not moved to `domain/ports/` yet. Its types (`Op`, `Query`, `OpPack`, `DialectDescriptor`, `Dialect`, `Handle`) still share a file with the kit functions (`defineDialect`, `defineOpPack`, `withOps` and the rest).

## Adapters

| Side | Folder | Adapter |
|---|---|---|
| Driving | `infrastructure/in/commons/` | the facade behind `@pbuilder/sdk` and `@pbuilder/sdk/commons`: the author verbs, `scaffold`, `copyIn` |
| Driving | `infrastructure/in/codegen/` | the `pbuilder-codegen` CLI (`cli.ts`, `emit-type.ts`, `project-codegen.ts`). It calls the schema domain services directly. |
| Driven | `infrastructure/out/fs/` | `nodePackageFiles`, the `node:fs` adapter of `PackageFiles` |
| Driven | `infrastructure/out/dialects/<name>/` | one pack per dialect: typescript, react, angular, nestjs, json, yaml, css. `ast.ts` is the only file that imports the parser; `index.ts` assembles the pack. angular, nestjs and react reuse the typescript pack's helpers. |
| Driven, across contexts | `src/acl/irwire/` | `StdioEngineClient`, see below |

There is no `composition.ts`. Each entry assembles what it needs: a dialect's `index.ts` builds its own pack, and the runner hands `defineFactory` its engine client and package-files adapter. Composition roots wait until there is real assembly to do.

## The ACL to Execution

`src/acl/irwire/` is the only place where Authoring's model meets Execution's IR wire, the Published Language Execution offers as its Open Host Service.

- `stdio-engine-client.ts`: `StdioEngineClient` implements `EngineClient` as JSON-RPC over stdio, one request in flight at a time. It decodes a wire error into an `EmitRejection` and defines the transport errors (`TransportFault`, `IntentRejectedError`, `OverlappingRunError`).
- `frame-reader.ts`: reassembles raw stdin chunks into frames.

The files keep these names for now; CODE-LAYOUT's `irwire.in.acl.ts` / `irwire.out.acl.ts` split is deferred.

## Shared kernel and platform

| Folder | Holds | Used by |
|---|---|---|
| `src/shared-kernel/` | `framing.ts` (the frame codec and the only fd-1 writer), `wire-protocol.ts` (protocol version, frame types), `batch-cap.ts` (the batch byte cap) | Authoring's engine client and the runner, which change them in lockstep. It imports no context. |
| `src/platform/` | `deep-equal.ts`, `error-text.ts` (bounded, path-scrubbed messages), `fs-errors.ts` | infrastructure, a context's `testing/` and the entries. It carries no domain rules. |

## Test kit

`testing/` holds what Authoring offers to whoever tests it: `harness/` (`runFactoryForTest`, behind `@pbuilder/sdk/testing`), `conformance/` (`testDialect`, `testOpPack`, behind `@pbuilder/sdk/conformance`), `contract-fake.ts`, `run-vehicle.ts` and `rejection-messages.ts`. Only test code, the two public test-kit entries and `testing/` itself import it.

## Public entries

The public files keep their paths and are thin barrels: `src/index.ts`, `src/commons/index.ts`, `src/testing/index.ts`, `src/conformance/index.ts` and `src/dialects/<name>/index.ts`. `bin/pbuilder-codegen.ts` only runs `runCli` from the codegen adapter.

## Rules that guard it

fit-49 (`test/fitness/fit-49-layering.test.ts`, rules in `test/support/layering/rules.ts`) checks every import in `src/` and `bin/`. The rules that matter most here:

| Rule | Keeps |
|---|---|
| `domainImports`, `applicationImports`, `infrastructureImports` | the dependency rule between layers |
| `noRuntimeIo` | `domain/` and `application/` free of `node:fs`, processes, the network, stdio, `process.env` and `process.cwd()` |
| `dialectIsolation` | a dialect pack importing only the core, shared-kernel, platform, itself and its allowed siblings |
| `noClosedDialectSet` | the core never naming a dialect, so a new dialect edits no core file |
| `scaffoldLeaf` | the scaffold use case's narrow import surface |
| `handleDirection` | the run-factory use case never importing the dialect handle (ADR-0037) |
| `testingImporters` | the test kit out of production code |
| `aclImports`, `crossContext` | contexts meeting only through `acl/` or an application layer |

How to read a failure and where new code goes: [handbook/conventions.md](../../handbook/conventions.md).

## History

This page replaces `openspec/architecture.md`, deleted with `openspec/`. Its [last version](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/0ea78c7a79e4c9f06d49d8d7e3e1051276aac71a/openspec/architecture.md) described 0.2.0; its line 65, "No `adapters/`/`ports/`/`usecases/`/`domain/` scaffold", no longer holds.
