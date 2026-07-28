# Changelog

All notable changes to `@pbuilder/sdk` are documented here. The package is pre-release
(unpublished; only `0.0.0-dev.<sha>` prereleases publish from `main`) — but it is NOT
zero-consumer: the engine repo and the conformance corpus consume this contract today even
though no npm consumer does, so the breaking/behaviour entries below carry migration text
for them, not a summary claiming no migration is needed.

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
followed transparently, the walk enumerating whatever the link happened to point at.
**Migration**: replace the symlinked `from` with a real directory, or point `from` directly
at the symlink's target path (relative to `packageDir`) — a `scaffold({ from })` call whose
root resolves through a symlink no longer walks the target's content.

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
