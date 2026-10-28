# Authoring a dialect

A **dialect** is an AST-library adapter: it teaches the SDK how to parse, mutate, and print one
file type. A dialect bundles three things — file extensions, a parse/print pair, and an
**op-pack** (the mutation vocabulary an author calls on a handle).

This document covers exactly the dialect-authoring surface this SDK ships today: the generic
contract (`defineDialect`/`defineOpPack`/`withOps`), the universal `.modify()` escape hatch, and
the two dialects currently shipped — `@pbuilder/sdk/typescript`, whose op-pack has widened past
its original thin starter shape (`addImport`) to fifteen named ops: `addImport`,
`addDefaultImport`, `addNamespaceImport`, `addTypeImport`, `addSideEffectImport`, `addReExport`,
`addExportAll`, `addFunction`, `addVariable`, `addClass`, `removeImport`, `removeExport`,
`removeExportAll`, `addArrayElement`, `addClassProperty`; and `@pbuilder/sdk/react`, a deliberately minimal v1
pair for `.tsx`/JSX authoring: `setJsxProp` and `addImport`.

## Two audiences

Per [ADR-0009](../openspec/decisions/0009-two-audiences-contributor-kit.md), this SDK has two
distinct audiences:

- **Authors** consume a published dialect (e.g. `@pbuilder/sdk/typescript`) inside a schematic —
  they call `find(path)` and chain ops.
- **Contributors** build a NEW dialect by calling `defineDialect`/`defineOpPack`/`withOps`.

### For authors: using a dialect

```ts
import * as ts from "@pbuilder/sdk/typescript";

await ts.find("src/index.ts").addImport("readFileSync", "node:fs");
```

`find(path)` opens a coalescing, awaitable handle. Every op you chain on it — `addImport`, or the
universal `.modify()` — mutates the SAME live AST; the handle serializes to exactly one `modify`
directive at flush (see "Coalescing" below).

`addImport(name, from)` adds `import { name } from "from";` to the file's import list, merging
into an existing named-import clause from the same module if one is already present (calling it
twice with the same name and module is idempotent — no duplicate import line).

The other import forms each have their own op, all idempotent on their own output and all
rejecting a `name` already bound elsewhere in the file:

| Op | Emits | Notes |
|---|---|---|
| `addDefaultImport(name, from)` | `import name from "from";` | Merges into a declaration of `from` that has no default yet (`import name, { a } from "from"`). Rejects when `from` already has a default import under another name. |
| `addNamespaceImport(name, from)` | `import * as name from "from";` | Merges into a default-only declaration (`import Def, * as name from "from"`); beside named imports it opens its own declaration. Rejects when `from` already has a namespace import under another name. |
| `addTypeImport(name, from)` | `import type { name } from "from";` | Always its own declaration, never merged and never the inline `{ type name }` form. A no-op when `from` already imports `name`, by value or as a type, inline or not. |
| `addSideEffectImport(from)` | `import "from";` | Its own declaration; a no-op only when a bare `import "from"` already exists. |

```ts
await ts
  .find("src/main.ts")
  .addDefaultImport("express", "express")
  .addTypeImport("Request", "express")
  .addSideEffectImport("reflect-metadata");
// -> import express from "express";
// -> import type { Request } from "express";
// -> import "reflect-metadata";
```

Re-exports, for barrel files, follow the same rules. They reject a name the file already exports
by any route — another re-export, an `export * as`, or an exported declaration — because two
exports sharing a name are invalid TypeScript:

| Op | Does | Notes |
|---|---|---|
| `addReExport(name, from)` | Adds `export { name } from "from";` | Merges into a non-type-only `export { … } from "from"`. Matched by source name, so `export { name as Y }` already counts. |
| `addExportAll(from, { as? })` | Adds `export * from "from";`, or `export * as ns from "from";` with `{ as: "ns" }` | The two forms are different statements; each is a no-op only on its own output. |
| `removeExport(name, from)` | Removes `name` from `export { … } from "from"` | Deletes the statement when it was the last specifier. Matched by source name, never the alias. Never touches local `export { x }` or `export *`. |
| `removeExportAll(from, { as? })` | Removes `export * from "from"` (or the `as` form) | Each form only removes itself; absent is a no-op. |

```ts
await ts.find("src/index.ts").addReExport("UserService", "./user.service").addExportAll("./dto");
// -> export { UserService } from "./user.service";
// -> export * from "./dto";
```

`addArrayElement(locator, element)` appends to an array literal nested inside the file, such as
a `providers` list. The `locator` starts at one of three roots and then follows a `path`:

| Root | Starts at |
|---|---|
| `{ variable: "appConfig", path }` | The initializer of the top-level variable |
| `{ call: "bootstrapApplication", argument: 1, path }` | That argument of the only call to `bootstrapApplication` |
| `{ decorator: "NgModule", path }` | The argument of the only `@NgModule(...)` decorator |

Each `path` segment is either an object key (`"providers"`) or a match, `{ path: "admin" }`, that
selects the only array element whose `path` property is that string. There are no numeric
indices: an index silently points at the wrong element once the array is reordered. At every
step the op looks through `as`, `satisfies`, `<T>` assertions, non-null `!`, and parentheses.

```ts
await ts
  .find("src/app/app.config.ts")
  .addArrayElement({ variable: "appConfig", path: ["providers"] }, { expression: "provideHttpClient()" });
// export const appConfig = { providers: [provideRouter(routes)] };
// -> export const appConfig = { providers: [provideRouter(routes), provideHttpClient()] };

await ts
  .find("src/app/app.routes.ts")
  .addArrayElement({ variable: "routes", path: [{ path: "admin" }, "providers"] }, "AdminGuard");
```

- The new element follows the list's layout: a one-line list stays on one line, a multi-line
  list gets a new line at the last entry's indentation, and a trailing comma stays trailing.
- Missing keys are created (`{}` becomes `{ providers: [X] }`), and so is the next missing call
  or decorator argument (`bootstrapApplication(App)` becomes
  `bootstrapApplication(App, { providers: [X] })`). A missing root, an argument past the next
  one, or a match that selects nothing rejects: the op never invents them. A missing key in an
  object with a spread (`{ ...base }`) or a computed key also rejects, because a created key could
  silently shadow one the object already gets; so does a key defined by a getter or setter.
- The root and every match must select exactly one node; zero or several reject.
- An element already in the array is a no-op. Elements are compared token by token, so spacing,
  line breaks, comments, and trailing commas do not count.
- A plain string `element` must be a valid identifier. Code goes in `{ expression: "..." }`, which
  must parse as exactly one expression, so it cannot close the array or add statements. Its
  content is otherwise inserted verbatim and is author-trusted, like `addFunction`'s `source`:
  never build it from consumer input.
- The op adds no import. Pair it with `addImport` for the element's binding.

`addClassProperty(className, name, initializer, options?)` adds a property to an existing class:
`{scope }{readonly }name = initializer;`, where `options` is
`{ scope?: "public" | "protected" | "private"; readonly?: boolean }` and nothing is written for
an omitted option.

```ts
await ts.find("src/app/user.service.ts").addClassProperty("UserService", "http", "inject(HttpClient)", {
  scope: "private",
  readonly: true,
});
// export class UserService {
//   private readonly cache = new Map<string, User>();
// -> private readonly http = inject(HttpClient);
//
//   load(id: string) { … }
// }
```

- The class is the only one in the file named `className`; zero or several reject.
- The property goes after the class's last property, so properties stay above the constructor
  and the methods. A class with no property gets it as its first member, above that member's
  JSDoc; an empty class gets a new line at its own indentation plus two spaces. A one-line class
  stays on one line, and a comment after the last property stays on that property's line.
- A property with the same declaration, compared token by token and ignoring a trailing `;`, is
  a no-op. Any other member named `name`, a method included, rejects.
- `initializer` must parse as exactly one expression and is otherwise author-trusted, like
  `addArrayElement`'s `{ expression }`. The op adds no import.

`addFunction(name, source, options?)` inserts a new top-level function declaration at the end of
the file, in call order: `options?.export` prepends `export `. `source` INCLUDES the function's
`{ … }` braces — the full signature-and-body text, e.g. `"(): void {}"` for
`function hi(): void {}` — a deliberate contrast with `addClass`'s `source`, which EXCLUDES its
braces (that op supplies them itself). `addFunction` REJECTS when a value declaration
(`function`/`const`/`let`/`var`/`class`) or an import binding already exists under `name` —
imports MERGE (safe, multiple modules can share a name), but two value declarations sharing a
name produce invalid TypeScript, so this op fails loud instead of silently colliding. A
`type`/`interface` under the same name does NOT collide (TypeScript legally permits a value and a
type to share an identifier).

```ts
// source includes braces:
await ts.find("src/index.ts").addFunction("hi", "(): void {}", { export: true });
// -> export function hi(): void {}
// contrast addClass, whose source EXCLUDES braces (the op adds them itself).
```

`addVariable(name, initializer, options?)` inserts a new top-level variable declaration at the end
of the file, in call order: `{export }{kind} {name} = {initializer};`. `options?.kind` defaults to
`"const"` (also accepts `"let"`/`"var"`); `options?.export` prepends `export `. Rejects under the
SAME collision rule as `addFunction` — a value declaration or import binding already existing
under `name` fails loud; `type`/`interface` do not collide.

```ts
await ts.find("src/index.ts").addVariable("counter", "0", { export: true, kind: "let" });
// -> export let counter = 0;
```

`addClass(name, source, options?)` inserts a new top-level class declaration at the end of the
file, in call order: `{export }class {name} {\n{source}\n}`. `source` EXCLUDES the class's
`{ … }` braces — the op supplies them itself, a deliberate contrast with `addFunction`'s `source`,
which INCLUDES its braces. Rejects under the SAME collision rule as `addFunction`.

```ts
// source excludes braces:
await ts.find("src/index.ts").addClass("Point", "  x = 0;");
// -> class Point {\n  x = 0;\n}
// contrast addFunction, whose source INCLUDES braces (the op does NOT add them itself).
```

"An import binding" covers every import form — named, default (`import X from "m"`), and
namespace (`import * as X from "m"`) — type-only ones included.

Every op validates its `name` before it touches the file: it must be a plain ASCII JavaScript
identifier (`^[A-Za-z_$][A-Za-z0-9_$]*$`), not a reserved or strict-mode-restricted word
(`class`, `await`, `eval`, `arguments`, …), and not `__proto__`, `constructor`, or `prototype`.
A rejected name leaves the file unchanged, and `removeImport` rejects it even when there was
nothing to remove. `addVariable`'s `kind` rejects anything other than `"const"`, `"let"`, or
`"var"`.

`addFunction`'s/`addVariable`'s/`addClass`'s `source`/`initializer` strings are inserted
VERBATIM — never validated or sanitized. The author owns their own syntax, the same trust
contract `.modify()` carries.

`removeImport(name, from)` removes the named binding from `from`'s import clause. Idempotent:
removing an ABSENT binding is a no-op (zero directives emitted) — mirrors `addImport`'s own
idempotency. Removing the LAST remaining named binding in an import clause deletes the entire
import statement — no dangling `import {} from "from"`. An aliased specifier
(`{ readFileSync as rf }`) is matched by the module-EXPORTED name (`readFileSync`), not the local
alias `rf`. Scope: NAMED-binding imports only — default and namespace imports are out of scope
for this op.

A dialect handle's `.replaceContent(content)` REJECTS when an AST-op directive (any named op, or
`.modify()`) is still OPEN — buffered, not yet drained by a read or flush — on the SAME handle:
the pending AST edit would otherwise be silently lost to `.replaceContent()`'s own wholesale
overwrite. This is asymmetric and narrowly scoped: `.replaceContent()` with no AST op pending is
unaffected; an AST op enqueued AFTER `.replaceContent()` is unaffected (the restriction is
directional); and `.read()` is the documented escape — it drains the pending AST op first, so
`.replaceContent()` called AFTER a `.read()` is a legitimate sequential edit, not a collision:

```ts
const handle = ts.find("src/index.ts").addImport("readFileSync", "node:fs");
await handle.read(); // drains the pending addImport edit
handle.replaceContent("new content"); // succeeds — the documented escape
```

### `@pbuilder/sdk/react` — a second dialect

`@pbuilder/sdk/react` mutates `.tsx` files — TypeScript source containing JSX syntax. `.jsx`
files are NOT supported in v1: `find()` REJECTS a `.jsx` path, it does not silently accept it
(see the explicit-extension note below). The handle carries every `@pbuilder/sdk/typescript`
op (`addImport`, `addDefaultImport`, `addFunction`, and the rest) plus one JSX op,
`setJsxProp`; further JSX ops are tracked as the React op-catalog follow-up. Until those land,
`.modify(fn)` is the escape hatch for anything the shipped ops don't cover — the same
universal verb the TypeScript dialect's authors already reach for.

`find(path)` requires an explicit `.tsx` extension — extensionless paths are rejected, never normalized.
This is deliberate: a future `.jsx` dialect addition would otherwise leave an assumed extension ambiguous between `Button.tsx` and `Button.jsx`, and baking in a `.tsx` default today would make that a breaking change to unwind later.

The worked example below is the COALESCED author journey — `addImport` and `setJsxProp` on ONE
handle:

```ts
import * as react from "@pbuilder/sdk/react";

// src/Button.tsx before: const el = <Button />;
await react
  .find("src/Button.tsx")
  .addImport("handleClick", "./handlers")
  .setJsxProp("Button", "onClick", "{handleClick}");
// -> import { handleClick } from "./handlers";
// ->
// -> const el = <Button onClick={handleClick} />;
```

`addImport(name, from)` is the TypeScript dialect's own op: it merges `name` into an EXISTING
named-import clause from the SAME module, or inserts a fresh `import { name } from "from";`
otherwise — idempotent. `addImport("React", "react")` always prints `import { React } from
"react"`; use `addDefaultImport("React", "react")` for `import React from "react"`.

`setJsxProp(target, propName, value?)` targets the ONE element `target` names — zero matches or
more than one match both reject loudly (never a silent first-match). `value` accepts three forms:
a quoted string (`'"hi"'` → `hi="hi"`), an expression container (`'{count}'` → `hi={count}`), or
an omitted value (boolean shorthand, `hi`, no `=`).

#### Picking one of several same-tag elements

`target` is a tag name (`"Button"`) or an object that adds props to narrow the match. A string
prop value must equal the attribute's initializer text as written in the source; `true` matches
the prop with any value, shorthand included:

```ts
// src/App.tsx before:
// <Routes>
//   <Route path="/" element={<Home />} />
//   <Route path="/users" element={<Users />} />
// </Routes>
await react
  .find("src/App.tsx")
  .setJsxProp({ tag: "Route", props: { path: '"/users"' } }, "caseSensitive");
// -> <Route path="/users" element={<Users />} caseSensitive />
```

The reject message names the tag and the prop names, never the prop values.

#### The `value` trust boundary

`setJsxProp`'s `value` is emitted verbatim as the prop's expression/string initializer. The SDK performs no validation, escaping, or sanitisation on `value` — it becomes executable code in the generated file.
You are solely responsible for ensuring `value` is not derived from untrusted input (schema `options`, CLI answers, network data) without your own sanitisation. By contrast, `elementName` and `propName` ARE validated name arguments and are NOT a trusted-code channel.

#### Spread-precedence warning

An inserted prop lands after the element's last existing prop — including after a trailing `{...spread}`. An inserted explicit prop lands AFTER a trailing `{...spread}` and therefore WINS at React runtime (later-position precedence).
For example, `<Button {...rest} />` plus `setJsxProp("Button", "onClick", "{safe}")` prints `<Button {...rest} onClick={safe} />`, and `safe` wins even if `rest` also supplies an `onClick`.

#### The `addImport` collision-reject limitation

`addImport` REJECTS when `name` is already bound elsewhere in the file under a different binding — whether from a different module, or the same module under an alias or a type-only specifier — and resolving the naming conflict is your responsibility, since `addImport` takes no alias argument to route around it.
For example, `import { useState } from "react";` plus `addImport("useState", "./local")` rejects rather than emitting a second, invalid `import { useState } from "./local";` declaration; renaming the existing import or choosing a different `name` is on you. The same applies to a same-module alias (`import { Foo as x } from "./a"` + `addImport("x", "./a")`) and a same-module type-only import (`import type { Icon } from "./icons"` + `addImport("Icon", "./icons")`).
The rejection also covers a TOP-LEVEL VALUE-NAMESPACE declaration sharing the name — `function`/`const`/`let`/`var`/`class`/`enum`/`namespace` — since it is the same duplicate-binding problem under a different syntax: a component file declaring `function Icon() { return null; }` plus `addImport("Icon", "./icons")` rejects rather than emitting `import { Icon } from "./icons";` alongside the existing declaration; a `type`/`interface` declaration sharing the name does NOT collide (TypeScript legally permits a value and a type to share an identifier).

### For contributors: building a dialect

A dialect is assembled from three kit verbs:

- **`defineDialect(descriptor)`** — assembles a `Dialect` from a frozen descriptor: `extensions`
  (file-extension matchers), `ast: { parse, print }` (the AST parse/print pair), and `ops` (the
  dialect's own op-pack, `{}` if none). A 5th descriptor field is a compile error — the shape is
  frozen. The resulting `find` (and every `withOps` composition of it) throws synchronously on
  a path whose basename does not end in a declared extension, naming the file and the
  declared extensions; a bare extension (`.ts`) or a stem ending in a dot (`a..ts`) is
  rejected too. Several dialects may declare the same extension: the author picks one by
  importing its `find`. See its JSDoc `@example` in `src/core/define-dialect.ts` for a runnable snippet.
- **`defineOpPack(ops)`** — declares a named record of ops over one AST type, usable standalone
  (shareable across dialects targeting the same AST type) before any `withOps` composition. See
  its JSDoc `@example` in `src/core/define-dialect.ts`.
- **`withOps(base, ...packs)`** — composes additional op-packs onto a base dialect; the resulting
  handle type is the INTERSECTION of the base's ops and every attached pack's ops. An op from an
  unattached pack, or a typo, is a compile error. See its JSDoc `@example` in
  `src/core/define-dialect.ts`. At composition time, `withOps` also runs an eager, synchronous,
  fail-closed check: an op name declared by two or more of the passed packs (or colliding with
  the base dialect's own ops) throws immediately, naming the colliding op — composition never
  silently resolves to whichever pack happened to be spread last. An op name that shadows the
  base handle's own vocabulary (`then`, `read`, `raw`, `modify`, `replaceContent`, `rename`,
  `move`, `copy`, `remove`) throws the same way — an op-pack op named `then` in particular would
  break the handle's `PromiseLike` join.

A contributor's worked proof anchors are the conformance kit — `testDialect`/`testOpPack`
(`@pbuilder/sdk/conformance`) — which asserts a dialect's parse/print round-trip, per-op
fidelity, and coalescing are honest, and the type-level composition proof: an `expectTypeOf` pin
on `withOps`'s intersection type (`test/types/define-dialect.test.ts`), which fails to compile if
op-pack composition regresses.

#### Queries: ops that return a value

An op returns `void` and its handle method chains. To let authors read something back, wrap
the function in **`query(fn)`** inside the same op-pack, next to the ops: with
`count: query((ast: string[]) => ast.length)` in the pack, `await dialect.find(path).push("x").count()`
resolves to the line count, `"x"` included. See its JSDoc `@example` in
`src/core/dialect-handle.ts`.

- On the handle, a query returns `Promise<R>` and ends the chain. It does not return the
  handle, so call it last, or `await` it and keep chaining on the handle you already hold.
- It runs in chain order on the live AST, so it sees every op chained before it. It emits no
  directive, and the ops before it still coalesce into one `modify`. Like the first op, the
  first step of a fresh handle reads the file, and that read drains pending directives.
- It is contained like an op: its own `dialectError` passes through verbatim, any other throw
  becomes `<name>() on "<path>" threw`, and a failure fails the run closed.
- It must not change the AST. A query whose run changes the printed file rejects with
  `<name>() is a query and must not change "<path>"`.
- `query` only brands the function, so `withOps` checks a query's name for duplicates and
  reserved verbs like any other op.

#### Validating name/identifier arguments: the `validatedOp` pattern

If your op takes a name or identifier-shaped argument that gets SPLICED into generated source —
an attribute name, an import binding, anything your AST library writes as raw text — validate
that argument BEFORE any mutation runs, not after. `@pbuilder/sdk/react`'s
`src/core/jsx-name-validator.ts` is the reference implementation: `validatedOp(validators, body)`
is the single validate-before-mutate CHOKEPOINT — it wraps an op so `body` (the actual AST
mutation) is structurally unreachable until `validators` has run and thrown on every invalid
argument. Register a per-argument grammar for each such
argument — a shared regex across argument shapes that don't share a grammar is wrong, the same
way a JSX attribute name and an import binding don't share one — plus a denylist where a
prototype-pollution-shaped risk applies (e.g. `__proto__`).

This closes a real vulnerability class, not a hypothetical one: ts-morph writes structured-API arguments like `JsxAttributeStructure.name` and import specifiers as RAW TEXT with no escaping of its own — an op that skips validation splices whatever string it is given straight into the printed file. The shipped `@pbuilder/sdk/typescript` dialect's ops do not yet validate their name arguments (a confirmed instance of this class, retrofit pending); `@pbuilder/sdk/react`'s ops are the pattern to FOLLOW going forward, not the exception — wrap any new op that takes a splice-bound name/identifier argument in `validatedOp`.

## The `.modify()` escape hatch

Every dialect handle carries one universal op alongside its named ops: `.modify(ast => { ... })`.
It hands your callback the SAME live AST instance the named ops mutate — anything a named op
could do, `.modify()` can do too, without waiting for a named op to exist.

`.modify()` executes your callback with full process privilege — it is not a sandbox. Read
[SECURITY.md](../SECURITY.md) before importing any third-party dialect or op-pack that uses it.

### Use the dialect's own AST library

The full `astLibrary` namespace supplies runtime helpers, classes, constants, and upstream
types without a separate AST-library dependency in your schematic:

```ts
import { find, astLibrary } from "@pbuilder/sdk/typescript";
import type { astLibrary as ReactAst } from "@pbuilder/sdk/react";

// Inside your existing factory:
await find("src/config.ts").modify((ast) => {
  const statement: astLibrary.VariableStatementStructure = {
    kind: astLibrary.StructureKind.VariableStatement,
    declarationKind: astLibrary.VariableDeclarationKind.Const,
    declarations: [{ name: "answer", initializer: "42" }],
  };
  ast.addVariableStatement(statement);
});

type ReactFile = ReactAst.SourceFile;
```

Runtime `astLibrary` is also available from `@pbuilder/sdk/react`; use each library with its
own dialect's callback AST. Each dialect owns its library origin and version independently.
Equal package names or versions do not guarantee identity across installations or realms.
There is no singleton, cross-dialect identity, or universal cross-realm guarantee. The callback
still receives **only the AST**; existing `find`, named ops, and inference do not migrate.
Using this namespace avoids choosing a separate dependency subject to the warning below.

### Two ts-morph realms

Two ts-morph realms: if your schematic already depends on ts-morph directly, that is a separate realm from the SDK's internal ts-morph used inside `.modify(ast => …)`. A `Node`/`SourceFile` from your realm is not interchangeable with the AST the SDK hands your `.modify()` callback — even when both realms resolve the identical ts-morph version. Never pass ts-morph objects across the boundary; operate only on the `ast` the callback receives.

## Coalescing: how edits become one `modify`

Every op you chain on a handle — named or `.modify()` — mutates the SAME live AST instance the
handle's first op parsed. The handle's buffered `modify` directive holds a lazy, memoized
`content` getter that prints the AST exactly once, at the flush that drains it: N chained edits
with no read between them collapse into exactly ONE `modify` directive.

A read (`.read()`, or any `Session.read` on ANY path — the flush is global) drains the open
directive before returning: the handle detects this by identity and re-registers a FRESH
directive for any further edits. A chain with one mid-chain read therefore produces exactly TWO
`modify` directives, cumulative — no edit is lost.

## Async usage

The handle returned by a dialect's `find(path)` is the first **thenable** object on the author
surface — an ergonomic departure from the SDK's other, synchronous author verbs, inherent to an
async read-through-parse.

**Awaited-chain form** — the normal way to use a dialect:

```ts
await ts.find("src/index.ts").addImport("readFileSync", "node:fs");
```

`await` is not required for correctness, though: the run boundary drains every outstanding
handle before the run flushes, so a forgotten `await` still completes and commits its edit at run
end. `await` on the author side only sequences reads for read-your-own-writes — it does not
gate whether the edit lands.

A **forgotten-await** chain that throws still surfaces its error, contained, at the run boundary
— never as an unhandled rejection. If you need to observe or handle a dialect failure locally,
`await` the chain (or a promise derived from it) inside your own `try`/`catch`.

This containment is not `.modify()`-specific: a NAMED op (`addImport`, `addFunction`, `addVariable`,
`addClass`, `removeImport`, or a third-party dialect's own op) that throws synchronously, or whose
implementation is itself `async` and rejects, is contained exactly the same way — never an
unhandled rejection, always the pinned error shape.

The contained error intentionally carries no cause or stack from inside your `.modify()` body or a
named op's own implementation — `.cause` is always absent. To debug what went wrong, log from
inside the op or callback itself.

## Testing with the conformance kit

`@pbuilder/sdk/conformance` exports `testDialect(fixture)` and `testOpPack(fixture)`. Both are
`async` — they drive a real coalescing run and return a rejected promise on failure, never a
sync throw.

- `testDialect({ dialect, samples, module, expectedAstLibrary, libraryExercise })` asserts your dialect's `parse`/`print` pair round-trips
  every sample byte-exact. `testDialect` and `testOpPack` also inject four mandatory
  adversarial samples on every run — an empty file, and CRLF, UTF-8 BOM, and 4 MiB variants
  of a source your dialect already declares valid (the `libraryExercise` seed for
  `testDialect`, the first exercise's seed for `testOpPack`) — that your dialect's
  `parse`/`print` must round-trip byte-exact. They are format-neutral; put samples specific to
  your language's syntax in `samples`. There is no opt-out: the fixture type carries no field
  to disable them. Before each
  round-trip it rejects a stub/identity `parse` (one that returns nothing or hands back the
  input string), so an identity dialect cannot pass vacuously. It also fails a dialect whose
  published `find` accepts a path with an extension the dialect does not declare.
- `testOpPack({ opPack, baseDialect, exercises })` applies each `OpExercise` (a seed, an op
  chain, and the expected byte-exact output) against the real coalescing pipeline, asserting
  per-op fidelity, coalescing-to-one, and seam-serializability. It runs those same six
  mandatory samples against your `baseDialect` too, after your exercises pass.

### Mandatory module export and fixture migration

Every existing and future dialect must export its **complete own library** at its existing
dialect entrypoint. For a ts-morph adapter, use native forwarding:

```ts
export * as astLibrary from "ts-morph";
```

Use your adapter's actual library specifier, not a centralized SDK library. A curated object,
plain wildcard barrel, renamed namespace, or type-only export does not satisfy this obligation.
`DialectModule<Library>` is exported from `@pbuilder/sdk/conformance`; it describes the runtime
module without adding descriptor/instance fields or a new public subpath. Native forwarding
and consumer type tests additionally prove erased upstream types remain available.

Contributors must migrate old `{ dialect, samples }` fixtures to **actual imported entrypoints**.
For example, a test in this repository's `test/conformance/` directory can use its existing adapter:

```ts
import * as module from "../../src/dialects/typescript/index.ts";
import * as expectedAstLibrary from "ts-morph";
import { parse, print } from "../../src/dialects/typescript/ast.ts";
import { defineDialect } from "../../src/core/define-dialect.ts";
import { testDialect, type DialectFixture } from "../../src/conformance/index.ts";

const exerciseLibrary: DialectFixture<typeof expectedAstLibrary>["libraryExercise"]["modify"] = (ast, library) => {
  if (!(ast instanceof library.SourceFile) || !library.Node.isSourceFile(ast)) {
    throw new Error("incompatible adapter library");
  }
  ast.getVariableStatements()[0]!.setDeclarationKind(library.VariableDeclarationKind.Const);
};

await testDialect({
  dialect: defineDialect({ extensions: [".ts"], ast: { parse, print }, ops: {} }),
  samples: ["const x = 1;\n"],
  module,
  expectedAstLibrary,
  libraryExercise: {
    path: "example.ts", seed: "let answer = 1;\n", expect: "const answer = 1;\n",
    modify: exerciseLibrary,
  },
});
```

`exerciseLibrary` is the conformance fixture's two-argument compatibility probe, not a public
handle callback. Application `.modify()` callbacks still receive only the AST.

Resolve expected evidence from the adapter's own dependency location, independently of the
tested export. Comparing `module.astLibrary` against itself proves nothing. The kit compares
runtime export names/member identities, not namespace-object identity, and drives the actual
`module.find().modify()` through a seeded run. The exercise must emit exactly the expected
modified bytes. Each library is checked against its own adapter, never another dialect's library.
This is declared compatibility evidence, not a universal provenance or dishonest-fixture detector.

This required fixture migration is **source-breaking** for conformance callers; `testOpPack`
and application callbacks are unchanged. Full native exposure makes incompatible upstream API
changes SDK breaking changes too. Before 1.0, ship this migration in the next minor release,
not a patch; each dialect continues to own its dependency version. No release is implied here.

Passing the conformance kit (`@pbuilder/sdk/conformance`) is not a security attestation: it proves a dialect keeps the seam serializable and its ops faithful, not that the dialect's `.modify()` code is safe to execute.

## The leaf rule: dialect isolation

A dialect's `parse`/`print` pair and its ops MUST NOT import another dialect's package, and
`@pbuilder/sdk/commons` MUST NOT import any AST library (ts-morph or otherwise) — dialects and
op-packs are leaves in the dependency graph, never depending on one another.

**Documented limit**: the conformance kit's in-memory run vehicle cannot perform a full static
import-graph analysis the way a source-tree fitness function can, so it does not ship a
runtime or static scanner for this rule. `testDialect`/`testOpPack` do not check it. Third-party
dialect authors are expected to self-run their OWN static check (e.g. an import-graph lint over
their package's source) to enforce leaf-isolation locally — this is a real, documented gap for
third-party dialects, not a silently-skipped guarantee.

The SDK's own shipped `@pbuilder/sdk/typescript` dialect IS proven leaf-isolated today — by the
PRE-EXISTING `FIT-01` transitive import-graph walk in this repo's own test suite
(`test/fitness/fit-01-commons-no-ast.test.ts`), which asserts `src/commons/**` reaches no bare
AST-library import at any transitive depth. That proof lives in the fitness-function suite, not
inside `@pbuilder/sdk/conformance` — nothing under `src/conformance/**` re-implements or
duplicates it.

## Publishing and trust

Read [SECURITY.md](../SECURITY.md) before publishing or importing a dialect or op-pack: importing
any dialect or op-pack runs its code with full process privilege, and there is no sandbox or
signing in v1.
