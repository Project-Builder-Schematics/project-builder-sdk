# ADR-0083: Bounded Contexts in a Hexagonal Layout — Supersedes ADR-0002

**Status**: Accepted · **Date**: 2026-11-20 · **Change**: `hexagonal-layout`

## Context

ADR-0002 split the SDK into three layers: an internal `core` kit, the public `commons` verbs and one package per dialect. The layers named mechanisms, not the domain, and `src/core/` mixed the run use case, filesystem reads, the engine's wire types and the transport behind one folder.

project-builder-architecture's [CODE-LAYOUT](https://github.com/Project-Builder-Schematics/project-builder-architecture/blob/v0.19.0/CODE-LAYOUT.md) (Decision 19) asks every implementing repository to show its bounded contexts in its folders and to enforce one dependency rule with a test that fails the build. The SDK implements two contexts, Authoring and Runner hosting, and consumes Execution's IR wire.

## Decision

The code under `src/` follows CODE-LAYOUT, in the casing TypeScript allows:

| Folder | Holds |
|---|---|
| `bounded-contexts/authoring/` | `domain/{aggregates,entities,valueobjects,services,ports}`, `application/usecases/`, `infrastructure/{in,out}/`, `testing/` |
| `bounded-contexts/runner-hosting/` | `infrastructure/in/` only: the runner bootstrap |
| `acl/irwire/` | the engine client and frame reader, the only place Authoring's model meets the IR wire |
| `shared-kernel/` | `framing.ts`, `wire-protocol.ts`, `batch-cap.ts`, shared by both contexts and changed together |
| `platform/` | `deep-equal.ts`, `error-text.ts`, `fs-errors.ts`: technical code with no domain rules |
| `acceptance/` | the step definitions of the architecture repository's rules suite |

1. **Public entries keep their paths.** `src/index.ts`, `src/commons/index.ts`, `src/testing/index.ts`, `src/conformance/index.ts`, `src/dialects/<name>/index.ts`, `src/bin/pbuilder-runner.ts` and the repo-root `bin/pbuilder-codegen.ts` stay where they were, as thin barrels or process entries. `exports`, `main` and `bin` do not change.
2. **Dialects are driven adapters.** Each dialect pack lives in `authoring/infrastructure/out/dialects/<name>/` and implements the Dialect contract. Op rules that need no AST library stay domain services. Adding a dialect edits no domain or application file.
3. **A port only for real I/O or a real extension point.** Authoring has `EngineClient` and its `EmitRejection` shape, `PackageFiles` and the Dialect contract. Everything else is a plain function with no interface and no container.
4. **Tests mirror `src/` by folder.** Every test file's folder exists under `src/`, or is one of the test-only folders fit-49 lists (`fitness/`, `support/`, `e2e/` and the others).
5. **fit-49 enforces the dependency rule** (`test/fitness/fit-49-layering.test.ts`). It classifies every file in `src/` and `bin/` from its path, failing closed on an unknown context, layer or counterpart, and checks every import against CODE-LAYOUT's dependency rule plus the SDK's own rules. Its exceptions table can only shrink, and it is empty.

**Deferred:**

- **Composition roots.** No context has a `composition.ts`. Today it would only rebind `nodePackageFiles`, and routing the runner through it would change the engine-facing bridge. It comes when real assembly exists.
- **Splitting the Dialect contract.** Its types and the kit functions share `domain/services/define-dialect.ts`; moving the types to `domain/ports/` is a separate change.
- **The irwire file names.** `acl/irwire/` keeps `stdio-engine-client.ts` and `frame-reader.ts` instead of CODE-LAYOUT's `irwire.in.acl.ts` / `irwire.out.acl.ts`. The ACL does no model translation yet: Authoring is conformist to the wire's directive shape (it emits wire directives directly, ADR-0001), so the split waits until the wire changes version.

## Consequences

- The folders name the contexts, and [docs/bounded-contexts/](../bounded-contexts/authoring.md) has one page per context.
- A layering mistake fails fit-49 with the edge and the rule it breaks. It needs no build, so it runs in seconds.
- Moving a file in the runner closure changes the runner manifest the engine checks before every spawn, so such a move is also tested against the engine.
- The internal kit barrel `src/core/index.ts` is gone, so `dist/core/**` left the published tarball. Nothing reached it through `exports`.

## Related

- **ADR-0002**: Superseded by this decision.
- **ADR-0009**: the internal kit stays internal; its `@pbuilder/sdk-kit` extraction is out of scope.
