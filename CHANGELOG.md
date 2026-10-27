# Changelog

All notable changes to `@pbuilder/sdk` are documented here. The package publishes to npm
(plus `0.0.0-dev.<sha>` prereleases from `main`) — and it is NOT
zero-consumer: the engine repo and the conformance corpus consume this contract today even
beyond any npm consumer, so the breaking/behaviour entries below carry migration text
for them, not a summary claiming no migration is needed.

## 0.5.0

### JSON and YAML dialects

- **Added**: `@pbuilder/sdk/json` edits `.json` and `.jsonc` files by path through fifteen
  named ops: `setValue`, `addKey`, `removeKey`, `renameKey`, `insertItem`, `appendItem`,
  `removeItem`, `removeValue`, `replaceItem`, `moveItem`, `merge`, `updateValue`,
  `moveValue`, `copyValue`, and `sortKeys`, with `before`/`after` placement for new keys.
  Edits touch only the bytes they change: comments, indentation, key order, line endings,
  and the BOM survive, and a line comment travels with its member. `astLibrary` is
  `jsonc-parser`. Guide: `docs/json-dialect.md`.
- **Added**: `@pbuilder/sdk/yaml` edits `.yaml` and `.yml` files with the same structural ops
  plus `setComment`, `removeComment`, `setAnchor`, `removeAnchor`, `setAlias`,
  `addMergeKey`, `setStyle`, `setTag`, `addDocument`, and `removeDocument`; every op takes a
  `{ document }` option for multi-document files. A document no op touched prints
  byte-identical; a touched document is re-serialized by the `yaml` library, whose known
  normalizations are listed in `docs/yaml-dialect.md`. `astLibrary` is `yaml`.
- Values passed to either dialect are typed `JsonValue`/`YamlValue` and validated at
  runtime; `undefined`, functions, non-finite numbers, class instances, and cycles reject
  before the file changes.
- **Dependencies**: `jsonc-parser@3.3.1` and `yaml@2.9.1` join `ts-morph` as exact-pinned
  runtime dependencies. Neither has transitive dependencies or install scripts.

### Dialect extensions (breaking)

- **Breaking**: every dialect's `find` now rejects a path whose basename does not end in an
  extension the dialect declares, throwing synchronously with
  `dialect operation failed: find("<path>") — the file's extension is not one this dialect declares (<extensions>).`
  The check lives in `defineDialect` and `withOps`, so it applies to every dialect built with
  the kit. `@pbuilder/sdk/typescript` therefore rejects `a.js` and `a.tsx`; the React
  dialect keeps its own messages. Several dialects may still declare the same extension.
  **Migration**: open `.tsx` files with `@pbuilder/sdk/react`, and edit files of other types
  through `@pbuilder/sdk/commons` (`find` + `replaceContent`). A contributor dialect must
  declare every extension it intends to open.
- **Breaking**: `testDialect` fails a dialect whose published `find` accepts an undeclared
  extension.

### Conformance fixture (breaking)

- **Breaking**: the mandatory adversarial samples that `testDialect` and `testOpPack` inject
  are now format-neutral. Instead of six fixed TypeScript sources, the kit derives four from a
  source the dialect declares valid (`libraryExercise.seed` for `testDialect`,
  `exercises[0].seed` for `testOpPack`): the empty file, and CRLF, UTF-8 BOM, and 4 MiB
  variants of that seed. Non-TypeScript dialects can now pass the fixture.
  **Migration**: a TypeScript-family dialect that relied on the removed samples
  (comment-only file, two imports from one module, 4 MiB block comment) should add them to
  its own `samples`. A dialect must also round-trip the empty file.
- **Breaking**: the shared parse-failure message is now `could not parse "<path>"`, without
  `as TypeScript`. **Migration**: update assertions that matched the old text.

### Package

- **Added**: the package ships `schemas/project-builder.schema.json`, the path
  `builder init` writes into `project-builder.json`'s `$schema`, so editors validate and
  autocomplete the file once `@pbuilder/sdk` is installed.

### Fixed

- `create(path, { template | templateFile })` called without `options` (plain JavaScript, or
  TypeScript run without a typecheck) sends `{}` instead of `undefined`. The batch was
  previously rejected with `reason: "unrepresentable-content"`. Typed callers are unaffected.
- The error text an operator sees when a factory throws a plain `Error` scrubs paths by
  anchoring on the project root and the SDK package root (each also under its realpath),
  shown as `<project-root>` and `<sdk>`. A path glued to the previous word no longer leaks,
  non-`file:` URLs pass through unchanged, `file://` URLs keep their scheme, and a lone `\\`
  in prose is left alone. Other POSIX paths keep the `../` form; Windows and UNC paths still
  become `<outside-project>`.

## 0.4.0

### Ubiquitous language (breaking)

The author surface now uses the Authoring vocabulary: a Dry Run and a Plan belong to the
engine's execution, and the per-factory-invocation aggregate is the Session, not a run.

- **Breaking**: `dryRun()` is renamed `pendingDirectives()`, with no alias. Its entry type
  `DryRunEntry` is renamed `PendingDirective`, and `DryRunVerb` is removed in favour of the
  identical `AuthoringVerb`. All three were exported from `.` and `./commons`.
  **Migration**: `import { pendingDirectives, type PendingDirective, type AuthoringVerb } from "@pbuilder/sdk/commons";`
  and replace each call to `dryRun()` with `pendingDirectives()`. The returned entries keep
  the same `{ verb, path, kind? }` shape.
- **Breaking**: the `AuthoringReason` value `"outside-run"` is now `"outside-session"`.
  **Migration**: rename the `case "outside-run":` arm of an exhaustive `switch` over
  `error.reason`; the message and `origin` are unchanged.
- **Breaking**: the cross-realm registry key that pins the single ambient context changed
  from `@pbuilder/sdk:core/context#run-als` to `@pbuilder/sdk:core/context#session-als`.
  **Migration**: every copy of the SDK loaded into one process must be on 0.4.0; a 0.3.x
  copy beside it no longer shares the ambient context.
- Docs: `docs/dry-run.md` is now `docs/pending-directives.md`.

## 0.3.1

### Package resolution

- **Fixed**: `package.json` declares `main` alongside the existing `exports` map. Bun's
  `NODE_PATH` resolution leg does not consult `exports`, so a factory located outside the
  workspace could not resolve `@pbuilder/sdk` on either leg the runner depends on — neither
  its own ESM bare-specifier `import`, nor the `createRequire(anchorUrl).resolve()` that
  `probeSingleInstance` performs before it. This blocked engine ADR-0064
  (`external-factory-node-path`) and schematic collections living outside the workspace.
  **Migration**: none. `exports` still takes precedence wherever it is honoured, and `main`
  points at the same umbrella entry as `exports["."]`; only the legacy `NODE_PATH` leg,
  which ignores `exports` today, newly resolves.
- Consumers who saw the split-module-graph diagnostic *"split module graph breaks the
  single-instance ALS pin"* from an external factory were most likely hitting this: with no
  resolution through `NODE_PATH`, Bun's auto-install silently supplied a second copy from
  its global cache and the probe correctly failed closed on the wrong symptom.

## 0.3.0

### Dialect AST libraries

- **Added**: `@pbuilder/sdk/typescript` and `@pbuilder/sdk/react` export their complete
  AST library as `astLibrary` at the existing dialect entrypoints, including runtime
  helpers and upstream types. Use each namespace with its own dialect's AST; no
  cross-dialect or cross-installation identity is guaranteed. Application `.modify()`
  callbacks still receive only the AST; `find`, named ops, and inference are unchanged.
- **Changed (breaking)**: Every dialect must expose its complete own library as
  `astLibrary`. `DialectFixture` / `testDialect` now require `module`,
  `expectedAstLibrary`, and `libraryExercise` in addition to `dialect` and `samples`.
  **Migration**: pass the actual imported dialect entrypoint, independently resolved
  adapter-library evidence, and a byte-exact editing exercise. Export the library with
  native namespace forwarding, not a curated object or type-only export. See
  [fixture migration](./docs/authoring-a-dialect.md#mandatory-module-export-and-fixture-migration)
  for a complete example. `testOpPack` and application callbacks need no migration.

### Project-wide type generation

- **Added**: `pbuilder-codegen` with no arguments discovers the nearest
  `project-builder.json` upward from the current directory. `--project <directory>`
  selects that directory explicitly. Both process all registered collections; the
  existing positional single-directory mode remains available.
- Direct schematic directories and collection manifests are supported without importing
  or executing factories. Canonical directory aliases are deduplicated. Destinations
  outside the selected project root and symbolic-link outputs are refused.
- Independent entries continue after failures, with warnings on stderr and a
  generated/failed/duplicates summary on stdout. Any failure yields exit status `1`;
  successful writes remain in place. See
  [project-wide type generation](./README.md#project-wide-type-generation) for registration
  formats, discovery rules, and write-boundary limitations.

### File handling

- **Fixed**: On Linux and macOS, codegen refuses symbolic-link and nonregular outputs
  and checks the opened file before truncating or writing. Ordinary creation and
  overwrite behavior are preserved. This is not a universal filesystem sandbox or
  equivalent Windows writer hardening.
- **Fixed**: `pbuilder-runner --input-file` rejects nonregular inputs before reading.
  Regular files, including symlinks to regular files, retain their existing behavior.

### Dependencies and tooling

- Updated the locked `brace-expansion` dependency from `5.0.7` to `5.0.9`.
- Pinned local Verdaccio to `6.10.3` and switched `registry:up` to the installed binary.
  CI and publish-workflow Bun versions are pinned to `1.3.14`.

## 0.2.4

### Diagnostics

- **Changed**: `pbuilder-runner` now reports plain `Error` messages on stderr instead of
  the generic `run failed`, with best-effort absolute-path scrubbing and the existing
  message-length limit. Exit codes and the fallback for non-`Error` thrown values are
  unchanged. Scrubbing is not a security boundary; authors must keep secrets out of error
  messages.

## 0.2.3

### Documentation

- **Fixed**: JSDoc examples on `CreateOptions`, `create`, the `Directive` wire type,
  `defineFactory`, and the testing harness showed `{{name}}`-style template placeholders,
  but the engine's template language uses `{= .name =}` delimiters. These examples ship in
  the published type declarations, so editor hover docs taught a syntax that never renders.
- README rewritten as a zero-to-schematic onboarding guide: deterministic-codegen
  positioning, CLI/SDK/engine execution-flow diagram (commit and apply phases), verified
  install paths (Homebrew tap, Linux tarball fallback, Windows not-yet-supported note), a
  live-tested walkthrough, the seven mutation verbs, the template language, scaffold with
  dynamic filename tokens, testing, and both shipped dialects including `.modify()`.
- `docs/quickstart.md` aligned with the published package: npm-first install, the
  default-export rule for CLI-executed factories.
- Package description named a verb that no longer exists (`modify` → `replaceContent`).

## 0.2.0

### Behaviour Changes — package-local read containment removed (ADR-0077)

**Fixed**: A schematic package no longer needs a `collection.json` ancestor to run.
Previously `defineFactory({ packageDir })` walked upward for a `collection.json` marker
and failed the run before the factory body executed when none was found — which is every
inline-collection project, where the collection lives inside `project-builder.json` and
no `collection.json` ever exists on disk. `packageDir` is now the sole run anchor.

**Changed (breaking)**: `AuthoringReason` narrows from twelve members to eleven:
`source-outside-package` is removed. **Migration**: delete the `case
"source-outside-package":` arm from any exhaustive `switch (err.reason)` — TypeScript will
point at it. A source path with a literal `..` segment or an absolute path now rejects
`invalid-input` (it rejected `source-outside-package` before, but was always rejected —
this is a reason change, not a new rejection). A source that resolves outside the package
through an in-package symlink is **no longer rejected by the SDK at all**.

**Changed**: The SDK no longer resolves package-local source paths through a disk-canonicalization pass, so an in-package symlink pointing outside `packageDir` is no
longer rejected by the SDK. Whether such a source is rejected at all now depends on the
engine's own apply-time ceiling re-derivation — the SDK makes no claim either way. See
[SECURITY.md](./SECURITY.md) for the v1 trust model.

**Changed (breaking, ruling 16 follow-through, 2026-07-29)**: A `from` root that is itself a symlinked directory now rejects `invalid-input` — previously it was
followed transparently, the walk enumerating whatever the link happened to point at. This
check inspects only `from`'s FINAL path component — a symlink at a MID-path segment (e.g.
`from: "link/sub"`) is not detected and remains the documented SECURITY.md residual.
**Migration**: replace the symlinked `from` with a real directory, or point `from` directly
at the symlink's target path (relative to `packageDir`) — a `scaffold({ from })` call whose
root's FINAL component resolves through a symlink no longer walks the target's content;
a symlink earlier in the path is unaffected by this change.

**Changed (breaking, ruling 17, 2026-07-29)**: A `from` value that refers to the
package directory itself — the literal `""`, `"."`, or `"./"` forms — previously
resolved to `packageDir` and walked the ENTIRE package silently; all three now reject
`invalid-input` (`folder-scaffold` REQ-FSC-11). **Migration**: name the intended
subfolder explicitly — there is no shorthand for "mirror the whole package."

**Fixed (round-3 error-handling hardening, 2026-07-29)**: five `scaffold` gaps closed
in one batch:

1. A `rename` value containing a literal `..` segment now rejects BEFORE the join
   against `to` — previously, when `to`'s own depth happened to normalize the `..`
   away, the file silently relocated OUTSIDE `to` instead of rejecting
   (`folder-scaffold` REQ-FSC-02).
2. `include`/`exclude` must now be arrays of strings — a non-array value used to throw
   a raw, unbranded `TypeError`, and a non-string element silently compiled into an
   always-empty-matching pattern; both now reject `invalid-input` at entry.
3. A `scaffold` call made outside any run now reports `outside-run` (previously
   `invalid-input`), matching `copyIn`'s existing behaviour on the same failure.
4. Intra-scaffold destination-collision detection now keys on the NORMALIZED
   destination path, catching renames that collide only after `.`/`..` normalization —
   previously undetected here.
5. The walk's documented 10,000-entry bound now counts every enumerated directory
   entry, not only files — a directory-only tree was previously unbounded regardless of
   depth or breadth.

### Behaviour Changes — `@pbuilder/sdk/typescript` `addImport`

`addImport`'s naive first-match, unconditional-merge implementation is replaced by the same
CLAIMED four-branch algorithm already shipped and judgment-day-approved for
`@pbuilder/sdk/react` (`REQ-RXD-05`), adapted with one deliberate posture deviation (self-alias)
and TS-specific handling for multi-declaration modules, empty-clause merge targets, side-effect
import coexistence, and directive-prologue placement. `REQ-TSD-01.1`–`.4`'s outcomes are
unchanged, and `addImport`'s call signature (`addImport(name: string, from: string): void`) is
frozen.

**Fixes** — the following inputs previously produced silently broken output; they now reject
with a loud, branded error, or insert correctly, before this change:

1. **Type-only merge** — merging a value-bound name into a type-only import declaration
   (`import type { A } from "m"`) silently produced a type-contaminated clause
   (`import type { A, B }`, making `B` type-only). Now rejected (or routed to a fresh, separate
   declaration when no collision applies).
2. **Cross-module and value-namespace collisions** — a name already bound by a different
   module's import, or already claimed by a top-level `function`/`const`/`let`/`var`/`class`/
   `enum`/`namespace` declaration, was not checked at all; `addImport` would happily create a
   second, colliding binding. Now rejected, file-wide, before any AST mutation.
3. **Aliased-to-a-different-name collisions** — `import { Foo as x } from "m"` followed by
   `addImport("x", "m")` merged a second, unaliased `x` into the same clause, producing an
   invalid duplicate local-name binding. Now rejected.
4. **Same-local-name idempotency against default, namespace, and mixed-declaration shapes** —
   only the named-import clause was checked for an already-bound name; `addImport("Def", "m")`
   against `import Def from "m"` grafted a duplicate `Def` binding
   (`import Def, { Def } from "m"`) instead of no-op'ing. Now a clean no-op, matching the
   already-correct behaviour for plain named imports.
5. **Directive-prologue placement** — inserting a fresh import into a file starting with a
   directive (e.g. `"use client";`) placed the import ABOVE the directive, silently voiding it
   (a directive only takes effect as the file's first-in-scope statement) while leaving the file
   syntactically valid. The import is now inserted AFTER the leading directive prologue.

**Restructured (not a fix)** — one case changes shape without becoming more or less correct:

- **Side-effect import coexistence** (`import "polyfill";`) — `addImport("X", "polyfill")`
  previously converted the side-effect statement into a combined form
  (`import X, { ... } from "polyfill"`). It is now left byte-unchanged, and a separate
  `import { X } from "polyfill";` declaration is added instead. Both shapes are valid
  TypeScript with the same net import surface; use `.modify()` if the combined-form output is
  specifically needed.

**Injection-safety** — `addImport`'s `name` argument now runs through the same validation gate
already shipped for `@pbuilder/sdk/react` (`assertValidImportBinding`): a hostile or
grammatically-invalid `name` is rejected before it can reach the AST, closing a confirmed
`name`-splice injection on this op specifically. This closes the injection for `addImport`
only — the sibling ops' (`addFunction`/`addVariable`/`addClass`) `name`/`source`/`initializer`
arguments remain raw-spliced, author-trusted input; tracked separately in
`openspec/pending-changes.md`, out of scope for this change.

**No change** — a shebang file (`#!/usr/bin/env node`) still rejects `addImport` calls with a
contained, fail-closed error (zero directives, target file byte-unchanged) **on the
fresh-create path with no directive prologue** — the only path that inserts at the very top
of the file; this existing behaviour is pinned as a regression guard rather than upgraded to
successful insertion. A shebang file whose import lands via another branch succeeds normally
(merging into an existing import, or creating below a directive prologue — the shebang stays
on line 1 in both). Shebang-aware top-of-file insertion is deferred and tracked as a followup
in `openspec/pending-changes.md` ("ADR-03 shebang-aware insertion, registered at S-004").
