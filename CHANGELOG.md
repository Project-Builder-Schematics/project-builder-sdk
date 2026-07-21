# Changelog

All notable changes to `@pbuilder/sdk` are documented here. The package is pre-release
(`0.0.0`, unpublished, zero live consumers) — entries below record behaviour changes for
awareness, not for a public release process. No migration guide is included: nothing here
requires one.

## Unreleased

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
contained, fail-closed error (zero directives, target file byte-unchanged); this existing
behaviour is now pinned as a regression guard rather than upgraded to successful insertion.
Shebang-aware insertion is deferred and tracked as a followup in
`openspec/pending-changes.md` ("ADR-03 shebang-aware insertion, registered at S-004").
