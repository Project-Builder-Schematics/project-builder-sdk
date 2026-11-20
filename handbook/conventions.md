# Code conventions

Code under `src/` follows project-builder-architecture's [CODE-LAYOUT](https://github.com/Project-Builder-Schematics/project-builder-architecture/blob/v0.19.0/CODE-LAYOUT.md), as [ADR-0083](../docs/adr/0083-hexagonal-layout.md) records. fit-49 checks every import against it, and tests mirror `src/` by folder. The context pages, [Authoring](../docs/bounded-contexts/authoring.md) and [Runner hosting](../docs/bounded-contexts/runner-hosting.md), say what each folder holds today.

## Where new code goes

| You are adding | Put it in |
|---|---|
| A domain rule with no I/O (a name grammar, a lowering, a schema check) | `src/bounded-contexts/authoring/domain/services/` |
| A domain type: aggregate, entity, value object | `domain/aggregates/`, `domain/entities/`, `domain/valueobjects/` |
| Something the core needs from outside (real I/O or an extension point only) | a port in `domain/ports/`, with its adapter in `infrastructure/out/` |
| A use case, or a new step of one | `application/usecases/<name>/` |
| A driving adapter: an entry point that calls into the application | `infrastructure/in/<name>/` (Authoring: `commons/`, `codegen/`; Runner hosting: every file) |
| A driven adapter: filesystem, a parser library | `infrastructure/out/` (`fs/`, `dialects/<name>/`) |
| An op for a dialect, or a new dialect | `infrastructure/out/dialects/<name>/`; see [authoring-a-dialect.md](../docs/guides/authoring-a-dialect.md) |
| Code that talks the engine's IR wire | `src/acl/irwire/` |
| Code both contexts use and change together | `src/shared-kernel/` |
| A technical helper with no domain rules | `src/platform/` |
| A fake or builder for tests of a context | `src/bounded-contexts/<context>/testing/` |
| A new public subpath | a thin barrel at `src/<name>/index.ts`, plus its `exports` entry |

Public entry files keep their paths: `exports`, `main` and `bin` must not change when code moves.

## The layering rule

fit-49 (`test/fitness/fit-49-layering.test.ts`) classifies every `.ts` file in `src/` and `bin/` from its path and checks every import. The rules live in `test/support/layering/rules.ts`, each with a one-line reason. In short:

| From | May import |
|---|---|
| `domain/` | `domain/` and `shared-kernel/` |
| `application/` | `domain/`, `application/` and `shared-kernel/` |
| `infrastructure/` | `application/`, `domain/`, its own `infrastructure/`, `acl/`, `shared-kernel/` and `platform/` |
| `acl/irwire/` | the `domain/` and `application/` it translates, `shared-kernel/`, `platform/` and itself |
| `shared-kernel/` | no bounded context, `acl/` or `platform/` |
| `platform/` | no bounded context, `acl/` or application layer |

On top of that:

- `domain/` and `application/` never import runtime I/O: `node:fs`, `node:child_process`, the network modules, `process.stdin`, `process.stdout`, `process.env` or `process.cwd()` (`noRuntimeIo`). `node:path`, `node:url`, `node:crypto` hashing and `node:async_hooks` are fine.
- A context reaches another only through `acl/` or that context's `application/` (`crossContext`). The rule names one exception: the runner passes Authoring's package-files adapter to the run use case.
- `domain/` and `application/` never name a dialect, not even as a string literal (`noClosedDialectSet`), and a dialect pack imports only the core, `shared-kernel/`, `platform/`, itself and its allowed siblings (`dialectIsolation`).
- A context's `testing/` is imported only by tests, the `./testing` and `./conformance` entries and its own `testing/` (`testingImporters`).

## Reading a fit-49 failure

| Failing test | What it prints | What to do |
|---|---|---|
| every file is classified | `<path>: unknown bounded context "…"`, or `not a CODE-LAYOUT slot` | Move the file into a slot the table above lists. |
| every violating edge has an EXCEPTIONS row | `<from> -> <to> breaks <rule>: <reason>` | Change the import so the edge follows the rule: depend on a port or a use case instead of the adapter, or move the code to the layer it belongs to. For `noClosedDialectSet`, `<to>` is `literal "<name>"`. |
| every EXCEPTIONS row still matches | `stale exception … — delete the row` | Delete the row. |
| test/ mirrors src/ by folder | `<file>: test/<dir>/ mirrors no src/<dir>/` | Move the test to the folder that mirrors its source. |

Do not add an exception. `EXCEPTIONS` in `test/support/layering/exceptions.ts` held the legacy edges while code moved; the table can only shrink, it is now empty, and its `CEILING` is 0, so any new row fails.

## Tests mirror `src/`

A unit test lives at the path of the folder it tests, under `test/` instead of `src/`: tests for `src/bounded-contexts/authoring/domain/services/` go in `test/bounded-contexts/authoring/domain/services/`. The check is per folder, not per file; test files are named after the behaviour they pin.

Tests that cover no single folder go in a test-only folder: `fitness/`, `fixtures/`, `support/`, `skeleton/`, `e2e/`, `types/`, `docs/`, `golden-ir/`, `security/`, `pyramid/` or `build/`, or a `planted/` or `fixtures/` sub-folder.

## Running the checks

- fit-49 alone needs no build: `bun test ./test/fitness/fit-49-layering.test.ts`.
- The full commands are in [Running tests](README.md#running-tests); which layer a test belongs to is in [testing.md](testing.md).
