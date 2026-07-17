# Authoring a dialect

A **dialect** is an AST-library adapter: it teaches the SDK how to parse, mutate, and print one
file type. A dialect bundles three things — file extensions, a parse/print pair, and an
**op-pack** (the mutation vocabulary an author calls on a handle).

This document covers exactly the dialect-authoring surface this SDK ships today: the generic
contract (`defineDialect`/`defineOpPack`/`withOps`), the universal `.modify()` escape hatch, and
the two dialects currently shipped — `@pbuilder/sdk/typescript`, whose op-pack has widened past
its original thin starter shape (`addImport`) to five structured ops: `addImport`, `addFunction`,
`addVariable`, `addClass`, `removeImport`; and `@pbuilder/sdk/react`, a deliberately minimal v1
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
(see the explicit-extension note below). Its v1 op-pack is deliberately minimal — exactly two
structured ops, `setJsxProp` and `addImport` — proving JSX-structural mutation end to end
without committing to a full React mutation catalog; further ops are tracked as the React
op-catalog follow-up. Until those land, `.modify(fn)` is the escape hatch for anything the two
shipped ops don't cover — the same universal verb the TypeScript dialect's authors already reach
for.

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

`addImport(name, from)` merges `name` into an EXISTING named-import clause from the SAME module
if one already exists, or inserts a fresh `import { name } from "from";` otherwise — idempotent,
same contract as the TypeScript dialect's own `addImport`. It is NAMED-BINDING-ONLY, pinned as
contract: `addImport("React", "react")` always prints `import { React } from "react"`, never
`import React from "react"` — default and namespace imports are NOT supported in v1, tracked as
catalog-follow-up scope, not an oversight.

`setJsxProp(elementName, propName, value?)` targets the ONE element whose tag name matches
`elementName` — zero matches or more than one match both reject loudly (never a silent
first-match). `value` accepts three forms: a quoted string (`'"hi"'` → `hi="hi"`), an expression
container (`'{count}'` → `hi={count}`), or an omitted value (boolean shorthand, `hi`, no `=`).

#### The `value` trust boundary

`setJsxProp`'s `value` is emitted verbatim as the prop's expression/string initializer. The SDK performs no validation, escaping, or sanitisation on `value` — it becomes executable code in the generated file.
You are solely responsible for ensuring `value` is not derived from untrusted input (schema `options`, CLI answers, network data) without your own sanitisation. By contrast, `elementName` and `propName` ARE validated name arguments and are NOT a trusted-code channel.

#### Spread-precedence warning

An inserted prop lands after the element's last existing prop — including after a trailing `{...spread}`. An inserted explicit prop lands AFTER a trailing `{...spread}` and therefore WINS at React runtime (later-position precedence).
For example, `<Button {...rest} />` plus `setJsxProp("Button", "onClick", "{safe}")` prints `<Button {...rest} onClick={safe} />`, and `safe` wins even if `rest` also supplies an `onClick`.

### For contributors: building a dialect

A dialect is assembled from three kit verbs:

- **`defineDialect(descriptor)`** — assembles a `Dialect` from a frozen descriptor: `extensions`
  (file-extension matchers), `ast: { parse, print }` (the AST parse/print pair), and `ops` (the
  dialect's own op-pack, `{}` if none). A 5th descriptor field is a compile error — the shape is
  frozen. See its JSDoc `@example` in `src/core/define-dialect.ts` for a runnable snippet.
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
could do, `.modify()` can do too, without waiting for a structured op to exist.

`.modify()` executes your callback with full process privilege — it is not a sandbox. Read
[SECURITY.md](../SECURITY.md) before importing any third-party dialect or op-pack that uses it.

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

- `testDialect({ dialect, samples })` asserts your dialect's `parse`/`print` pair round-trips
  every sample byte-exact. `testDialect` also injects six mandatory adversarial samples on
  every run — empty, comment-only, a 4 MiB file, CRLF line endings, a UTF-8 BOM, and two
  imports sharing one module — that your dialect's `parse`/`print` must round-trip byte-exact.
  There is no opt-out: the fixture type carries no field to disable them. Before each
  round-trip it rejects a stub/identity `parse` (one that returns nothing or hands back the
  input string), so an identity dialect cannot pass vacuously.
- `testOpPack({ opPack, baseDialect, exercises })` applies each `OpExercise` (a seed, an op
  chain, and the expected byte-exact output) against the real coalescing pipeline, asserting
  per-op fidelity, coalescing-to-one, and seam-serializability. It runs those same six
  mandatory samples against your `baseDialect` too, after your exercises pass.

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
