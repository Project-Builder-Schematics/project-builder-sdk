# Runner hosting

Runner hosting is the SDK side of the runtime a factory runs in: the runner bootstrap the engine starts, and the runner manifest the engine checks before every spawn. It lives in `src/bounded-contexts/runner-hosting/`, holds only driving adapters, and reaches Authoring through Authoring's `run-factory` use case.

- **Strategic model:** [Runner hosting](https://github.com/Project-Builder-Schematics/project-builder-architecture/blob/v0.19.0/bounded-contexts/runner-hosting/README.md) in project-builder-architecture v0.19.0 (also at `third_party/project-builder-architecture/bounded-contexts/runner-hosting/README.md`).
- **Layout rules:** [CODE-LAYOUT](https://github.com/Project-Builder-Schematics/project-builder-architecture/blob/v0.19.0/CODE-LAYOUT.md) and [ADR-0083](../adr/0083-hexagonal-layout.md).
- **Runner manifest and integrity constraints:** [runner-integrity-invariants.md](../runner-integrity-invariants.md).
- **Drawing:** `docs/bounded-contexts/sdk.hexa`, a [domainrings](https://diagrams.pbuilder.dev/) map of both contexts. Open it with **Open…** in the app's toolbar, or make a link with `npx -y @pbuilder/domainrings link docs/bounded-contexts/sdk.hexa --open`.

## Responsibility

Runner hosting provisions the runtime that executes a factory. The engine and the CLI own most of it; the SDK owns the runner bootstrap and the runner manifest it ships. It is a generic subdomain, kept thin, and flat in the layout.

## Model

Not modelled in depth: there is no `domain/`, no `application/` and no port. Every file is a driving adapter in `infrastructure/in/`, because the engine starts every interaction and nothing in a core calls back into this code.

| File | Role |
|---|---|
| `runner.ts` | `runRunner`: the one validation chokepoint for both entries. It reads the greeting and the input, imports the factory through the single sanctioned dynamic `import()`, and runs it through `defineFactory` with a `StdioEngineClient` and `nodePackageFiles`. |
| `bootstrap-bridge.ts` | `enterBridge`: the versioned in-process entry the engine imports, gated by `BRIDGE_CONTRACT_VERSION`. It delegates to `runRunner` and never calls `process.exit`. |
| `factory-pointer.ts` | parses and validates the `<url>#<export>` factory pointer and resolves the export |
| `single-instance-probe.ts` | checks that the factory resolves the same `@pbuilder/sdk` as the runner, by resolution only |
| `exit-codes.ts` | maps a run's terminal error to the runner's exit code |

The process entry `src/bin/pbuilder-runner.ts` stays at its path, which the runner manifest names, and calls `runRunner`.

## How it reaches other code

| Target | Through | Why it is allowed |
|---|---|---|
| Authoring | `application/usecases/run-factory/context.ts` (`defineFactory`, `isDefineFactoryWrapped`) and `driving.ts` (`authoringOrigin`, `describeJsonSyntaxError`) | a context reaches another through its application layer |
| Authoring's `nodePackageFiles` | a direct import in `runner.ts` | the one `crossContext` exception the rule's own text names: the runner passes Authoring's package-files adapter to the run use case |
| Execution | `src/acl/irwire/` (`StdioEngineClient`, `FrameReader` and the transport errors) | infrastructure may import `acl/` |
| Shared kernel | `framing.ts`, `wire-protocol.ts` | shared with Authoring's engine client and changed in lockstep |
| Platform | `error-text.ts` | bounded, path-scrubbed messages on stderr and the wire |

There is no `composition.ts`: `runner.ts` does the little wiring it needs.

## Rules that guard it

| Guard | Keeps |
|---|---|
| fit-49 `crossContext` (`test/support/layering/rules.ts`) | Runner hosting reaching Authoring only through its application layer, with the one named exception |
| fit-49 `platformImporters`, `infrastructureImports` | the adapters' import surface |
| fit-42 (`test/fitness/fit-42-runner-closure-integrity.test.ts`) and its graph baseline `test/fitness/runner-closure-graph-baseline.json` | the runner closure: every file the runner reaches, shipped as `dist/runner-manifest.json` and checked by the engine. A change to a closure file's bytes changes the manifest. |

The five closure constraints and what the manifest does not cover are in [runner-integrity-invariants.md](../runner-integrity-invariants.md). How to read a fit-49 failure: [handbook/conventions.md](../../handbook/conventions.md).

## History

This page and [authoring.md](authoring.md) replace `openspec/architecture.md`, deleted with `openspec/`. Its [last version](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/0ea78c7a79e4c9f06d49d8d7e3e1051276aac71a/openspec/architecture.md) described 0.2.0; its line 65, "No `adapters/`/`ports/`/`usecases/`/`domain/` scaffold", no longer holds.
