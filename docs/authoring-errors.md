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
  rejections that have no single offending call.
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
| `outside-run` | An authoring verb was called outside an active run. |
| `unknown` | The rejection could not be classified. |
| `invalid-input` | The SDK rejected a call's arguments before any engine round-trip. |
| `reserved-name` | The call used a name reserved by the SDK or engine. |
| `source-not-found` | A package-local source (`scaffold`/`copyIn`/`create({ templateFile })`) does not exist. |
| `source-outside-package` | A package-local source resolves outside the package boundary. |
| `source-not-regular-file` | A package-local source is not a regular file. |
| `source-unreadable` | A package-local source exists but could not be read. |

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
  case "outside-run":
  case "unknown":
  case "invalid-input":
  case "reserved-name":
  case "source-not-found":
  case "source-outside-package":
  case "source-not-regular-file":
  case "source-unreadable":
    console.error(err.message);
    break;
}
```

## Next steps

- [Authoring verbs](./authoring-verbs.md) — the seven authoring verbs and the read-trichotomy rule.
- [Dry-run](./dry-run.md) — preview a factory's planned changes before anything commits.
