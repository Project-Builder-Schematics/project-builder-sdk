# Error contract

An authoring verb that gets rejected — by the engine, or by the SDK itself before any
round-trip — throws `AuthoringError`. It carries everything you need to recover, in author
vocabulary: no engine-internal terminology.

```ts
import { runFactoryForTest } from "@pbuilder/sdk/testing";
import { AuthoringError } from "@pbuilder/sdk/commons";

const result = await runFactoryForTest(run, input);
if (result.error instanceof AuthoringError) {
  switch (result.error.reason) {
    case "path-collision":
      console.error(`${result.error.verb} collided at ${result.error.path}`);
      break;
    default:
      console.error(result.error.message);
  }
}
```

Calling the runner directly throws; `runFactoryForTest` captures the same `AuthoringError` on
`result.error`.

## Fields

- **`verb`** — the author-facing verb whose call was rejected: `"create"`, `"modify"`,
  `"remove"`, `"rename"`, `"move"`, `"copy"`, or `"copyIn"`. `undefined` for batch-level
  rejections that have no single offending call. `"modify"` labels the underlying WIRE
  mutation, and is shared by BOTH `.replaceContent()` calls (the commons/dialect wholesale
  replace) and a dialect handle's `.modify(fn)` AST escape hatch — the two calls lower to the
  same wire directive, so a rejection on either surfaces as `verb: "modify"`. This is
  deliberate, not a stale name left over from a rename.
- **`path`** — the author-declared, source-side path for the failing call. `undefined` when
  `verb` is `undefined`.
- **`reason`** — the closed cause of the rejection (see below).
- **`origin`** — derived from `reason`: `"write-rejected"` (the engine refused a write) or
  `"authoring-rejected"` (the SDK caught a misuse before any engine round-trip).
- **`appliedCount`** — how many directives applied within the failing run before the
  offender. A diagnostic only — a rejected run discards everything, so this is never a
  partial-persistence promise.

## `reason` values

`reason` is a closed union — exhaustive `switch` blocks are expected and get a compile
error if a value is missed:

| `reason` | Meaning |
|---|---|
| `path-collision` | The target path already exists and `{ force: true }` was not passed. |
| `path-not-found` | The target path does not exist. |
| `unrepresentable-content` | The content could not be represented in the engine's format. |
| `changes-too-large` | The run's total change size exceeds the engine's cap. |
| `outside-session` | An authoring verb was called outside an active Session. |
| `unknown` | The rejection could not be classified. |
| `invalid-input` | The SDK rejected a call's arguments before any engine round-trip. |
| `reserved-name` | The call used a name reserved by the SDK or engine. |
| `source-not-found` | A package-local source (`scaffold`/`copyIn`/`create({ templateFile })`) does not exist. |
| `source-not-regular-file` | A package-local source is not a regular file. |
| `source-unreadable` | A package-local source exists but could not be read. |
| `invalid-result` | The factory's Result does not match the `result` its `schema.json` declares, is not JSON, is larger than 1 MiB of JSON, or was returned by a factory that declares none. Nothing is written. |

`source-outside-package` was removed in `@pbuilder/sdk` `0.2.0` — the SDK no longer
re-derives a containment ceiling for package-local sources (see [Authoring
verbs](./authoring-verbs.md#package-local-reads-the-boundary) and
[SECURITY.md](../../SECURITY.md)). Migration: drop the `case "source-outside-package":`
arm from any exhaustive `switch (err.reason)` — TypeScript will point at it.

### Option values `create` cannot encode

`create` (and every file `scaffold` renders) rejects an `options` value the engine cannot
render with `reason: "invalid-input"`, `verb: "create"` and `path` set to the file's path. The
message names the top-level option key and where the value sits:

```
option "d" is not a plain-JSON value the engine can render (BigInt at d.size). Options must be strings, numbers, booleans, null, arrays, or plain objects.
```

Rejected values: `undefined`, a function, a symbol, a BigInt, a circular reference, a `Date`,
a `Map`, a class instance, and an object with a `toJSON` method. Options are plain data, so
a `toJSON` is not called; convert the value yourself before passing it. A getter or proxy that
throws, or a value nested too deeply to walk, rejects the same way, and the message never
repeats what was thrown.

## Catching and recovering

Same shape as above, now exhaustive — every `reason` value gets a case:

```ts
switch (err.reason) {
  case "path-collision":
    console.error(`${err.verb} collided at ${err.path}`);
    break;
  case "path-not-found":
  case "unrepresentable-content":
  case "changes-too-large":
  case "outside-session":
  case "unknown":
  case "invalid-input":
  case "reserved-name":
  case "source-not-found":
  case "source-not-regular-file":
  case "source-unreadable":
  case "invalid-result":
    console.error(err.message);
    break;
}
```

## Next steps

- [Authoring verbs](./authoring-verbs.md) — the seven authoring verbs and the read-trichotomy rule.
- [Pending Directives](./pending-directives.md) — preview a factory's pending changes before anything is staged.
