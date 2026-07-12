# Authoring a dialect

A **dialect** is an AST-library adapter: it teaches the SDK how to parse, mutate, and print one
file type. A dialect bundles three things — file extensions, a parse/print pair, and an
**op-pack** (the mutation vocabulary an author calls on a handle).

This document covers exactly the dialect-authoring surface this SDK ships today: the generic
contract (`defineDialect`/`defineOpPack`/`withOps`), the universal `.raw()` escape hatch, and the
first real dialect, `@pbuilder/sdk/typescript`, whose thin starter op-pack currently has one
structured op, `addImport`.

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
universal `.raw()` — mutates the SAME live AST; the handle serializes to exactly one `modify`
directive at flush (see "Coalescing" below).

`addImport(name, from)` adds `import { name } from "from";` to the file's import list, merging
into an existing named-import clause from the same module if one is already present (calling it
twice with the same name and module is idempotent — no duplicate import line).

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
  `src/core/define-dialect.ts`.

A contributor's worked proof anchors are the conformance kit — `testDialect`/`testOpPack`
(`@pbuilder/sdk/conformance`) — which asserts a dialect's parse/print round-trip, per-op
fidelity, and coalescing are honest, and the type-level composition proof: an `expectTypeOf` pin
on `withOps`'s intersection type (`test/types/define-dialect.test.ts`), which fails to compile if
op-pack composition regresses.

## The `.raw()` escape hatch

Every dialect handle carries one universal op alongside its named ops: `.raw(ast => { ... })`. It
hands your callback the SAME live AST instance the named ops mutate — anything a named op could
do, `.raw()` can do too, without waiting for a structured op to exist.

`.raw()` executes your callback with full process privilege — it is not a sandbox. Read
[SECURITY.md](../SECURITY.md) before importing any third-party dialect or op-pack that uses it.

### Two ts-morph realms

Two ts-morph realms: if your schematic already depends on ts-morph directly, that is a separate realm from the SDK's internal ts-morph used inside `.raw(ast => …)`. A `Node`/`SourceFile` from your realm is not interchangeable with the AST the SDK hands your `.raw()` callback — even when both realms resolve the identical ts-morph version. Never pass ts-morph objects across the boundary; operate only on the `ast` the callback receives.

## Coalescing: how edits become one `modify`

Every op you chain on a handle — named or `.raw()` — mutates the SAME live AST instance the
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

## Testing with the conformance kit

`@pbuilder/sdk/conformance` exports `testDialect(fixture)` and `testOpPack(fixture)`. Both are
`async` — they drive a real coalescing run and return a rejected promise on failure, never a
sync throw.

- `testDialect({ dialect, samples })` asserts your dialect's `parse`/`print` pair round-trips
  every sample byte-exact.
- `testOpPack({ opPack, baseDialect, exercises })` applies each `OpExercise` (a seed, an op
  chain, and the expected byte-exact output) against the real coalescing pipeline, asserting
  per-op fidelity, coalescing-to-one, and seam-serializability.

Passing the conformance kit (`@pbuilder/sdk/conformance`) is not a security attestation: it proves a dialect keeps the seam serializable and its ops faithful, not that the dialect's `.raw()` code is safe to execute.

## Publishing and trust

Read [SECURITY.md](../SECURITY.md) before publishing or importing a dialect or op-pack: importing
any dialect or op-pack runs its code with full process privilege, and there is no sandbox or
signing in v1.
