# JSON Dialect Specification

**Spec version**: V2
**Status**: draft (pending owner review)
**Change**: `json-yaml-dialects`

The JSON dialect teaches the SDK to parse, mutate, and print `.json` and `.jsonc` files. Its
op-pack is the full catalogue of structural mutations a schematic can apply to a JSON document.
Every named op addresses a value by a **path**, edits the document in place, and leaves every
byte it did not touch unchanged: comments, indentation, key order, line endings, and the
trailing newline.

## Vocabulary

- **Path**: a readonly array of segments, `readonly (string | number)[]`. A `string` segment
  names an object key; a `number` segment indexes an array. `[]` is the document root. Keys that
  contain dots or slashes need no escaping because a path is never a joined string.
- **JSON value**: `null`, a boolean, a finite number, a string, an array of JSON values, or a
  plain object whose values are JSON values. Exported as the type `JsonValue`.
- **Parent**: the container addressed by every segment of a path except the last.

## Requirements

### REQ-JSD-01: Subpath, extensions, and exact op-set

The dialect MUST be reachable at `@pbuilder/sdk/json`, exporting `find(path)`, the type
`JsonValue`, the type `JsonPath`, and `astLibrary` (the complete `jsonc-parser` module, native
forwarding). `find` MUST accept a path whose basename ends in `.json` or `.jsonc` with a
non-empty stem and MUST reject every other path synchronously with a `dialectError`.

The op-pack MUST expose exactly these named ops, besides the universal escape hatch
`.modify(fn)`:

| # | Op | Mutation |
|---|---|---|
| 1 | `setValue(path, value)` | Set the value at `path`, creating it or replacing it (upsert) |
| 2 | `addKey(path, value)` | Add an object key that does not exist yet (insert-only) |
| 3 | `removeKey(path)` | Remove an object key |
| 4 | `renameKey(path, newKey)` | Rename an object key in place, keeping its value and position |
| 5 | `insertItem(path, index, value)` | Insert an array item at `index` |
| 6 | `appendItem(path, value, options?)` | Append an array item; `{ unique: true }` skips a deep-equal duplicate |
| 7 | `removeItem(path, index)` | Remove the array item at `index` |
| 8 | `removeValue(path, value)` | Remove every array item deep-equal to `value` |
| 9 | `replaceItem(path, index, value)` | Replace the array item at `index` |
| 10 | `moveItem(path, from, to)` | Move an array item from index `from` to index `to` |
| 11 | `merge(path, value)` | Deep-merge a plain object into the object at `path` |
| 12 | `updateValue(path, fn)` | Replace the value at `path` with `fn(current)` |
| 13 | `moveValue(from, to)` | Move a value from one path to another (RFC 6902 `move`) |
| 14 | `copyValue(from, to)` | Copy a value from one path to another (RFC 6902 `copy`) |
| 15 | `sortKeys(path, options?)` | Sort an object's keys; `{ recursive: true }` sorts nested objects too |

`setValue` and `addKey` also take `options?: { before?: string; after?: string }` to place a
newly created key next to an existing sibling (REQ-JSD-09).

`rename`, `move`, `remove`, and `copy` are reserved handle verbs that act on the file, so the
key- and item-level ops carry the `Key`/`Item` suffix.

#### Scenario REQ-JSD-01.1: subpath resolves with the exact op-set

- GIVEN `import * as json from "@pbuilder/sdk/json"`
- WHEN a handle is opened with `json.find("package.json")`
- THEN the handle exposes exactly the fifteen named ops above plus the base handle verbs

#### Scenario REQ-JSD-01.2: non-JSON paths are rejected before any op

- GIVEN `json.find("config.yaml")`, `json.find(".json")`, or `json.find("README")`
- THEN `find` throws synchronously with the `dialect operation failed: ` prefix

### REQ-JSD-02: Key mutations

- `setValue(path, value)` MUST create every missing object along `path` and set the value.
  `setValue([], value)` replaces the whole document. Setting a value deep-equal to the current
  one MUST leave the bytes unchanged.
- `addKey(path, value)` MUST add the key when it is absent. When the key exists with a
  deep-equal value it MUST be a no-op; when it exists with a different value it MUST reject,
  naming the path.
- `removeKey(path)` MUST remove the member and its separator comma. Removing an absent key MUST
  be a no-op.
- `renameKey(path, newKey)` MUST keep the member's value, position, and comments. It MUST be a
  no-op when `path`'s key is absent and `newKey` already exists (already renamed). It MUST
  reject when both exist, or when neither exists.

#### Scenario REQ-JSD-02.1: setValue creates intermediate objects

- GIVEN `{\n  "name": "app"\n}\n`
- WHEN `setValue(["scripts", "build"], "tsc")`
- THEN the file is `{\n  "name": "app",\n  "scripts": {\n    "build": "tsc"\n  }\n}\n`

#### Scenario REQ-JSD-02.2: addKey is idempotent and rejects a conflict

- GIVEN `{ "a": 1 }`
- WHEN `addKey(["a"], 1)` THEN the bytes are unchanged
- WHEN `addKey(["a"], 2)` THEN the op rejects naming `["a"]`

#### Scenario REQ-JSD-02.3: renameKey keeps position and value

- GIVEN `{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}\n`
- WHEN `renameKey(["b"], "beta")`
- THEN the file is `{\n  "a": 1,\n  "beta": 2,\n  "c": 3\n}\n`

### REQ-JSD-03: Array mutations

- `insertItem(path, index, value)` MUST insert before the item currently at `index`;
  `index === length` appends. An index below 0 or above the length MUST reject.
- `appendItem(path, value, options?)` MUST append at the end. With `{ unique: true }` it MUST be
  a no-op when a deep-equal item already exists. When the array is absent it MUST create it.
- `removeItem(path, index)` MUST remove the item and its separator. An out-of-range index MUST
  reject.
- `removeValue(path, value)` MUST remove every deep-equal item; no match is a no-op.
- `replaceItem(path, index, value)` MUST replace the item in place; an out-of-range index MUST
  reject.
- `moveItem(path, from, to)` MUST yield the array where the item at `from` now sits at `to` and
  the other items keep their relative order. Out-of-range indices MUST reject.
- Every array op MUST reject when the value at `path` exists and is not an array.

#### Scenario REQ-JSD-03.1: appendItem unique skips a duplicate

- GIVEN `{ "plugins": ["a"] }`
- WHEN `appendItem(["plugins"], "a", { unique: true })` THEN the bytes are unchanged
- WHEN `appendItem(["plugins"], "b", { unique: true })` THEN `plugins` is `["a", "b"]`

#### Scenario REQ-JSD-03.2: moveItem reorders

- GIVEN `{ "x": [1, 2, 3] }`
- WHEN `moveItem(["x"], 0, 2)`
- THEN `x` is `[2, 3, 1]`

### REQ-JSD-04: Deep merge

`merge(path, value)` MUST deep-merge a plain object into the object at `path`, creating `path`
when absent. For each key: two plain objects merge recursively; any other pair (arrays
included) is replaced by the incoming value. Keys present only in the document are kept.
Merging an already-merged value MUST leave the bytes unchanged. When the target or `value` is
not a plain object, the op MUST reject.

#### Scenario REQ-JSD-04.1: merge recurses into objects and replaces arrays

- GIVEN `{ "a": { "x": 1, "y": [1] }, "b": true }`
- WHEN `merge([], { "a": { "y": [2], "z": 3 } })`
- THEN the value is `{ "a": { "x": 1, "y": [2], "z": 3 }, "b": true }`

### REQ-JSD-05: Type-safe value updates

- Every op that takes a value MUST be typed `JsonValue` so a non-JSON value fails typecheck.
- At runtime, every incoming value MUST be validated before the document changes: `undefined`,
  functions, symbols, `bigint`, non-finite numbers, non-plain objects (class instances, `Date`,
  `Map`), and cyclic structures MUST reject, naming the path inside the value.
- `updateValue(path, fn)` MUST call `fn` with the current value (`undefined` when absent) and set
  the returned value; the return value is validated the same way. Its signature is generic:
  `updateValue<T extends JsonValue>(path, fn: (current: JsonValue | undefined) => T)`.

#### Scenario REQ-JSD-05.1: updateValue bumps a number

- GIVEN `{ "version": 1 }`
- WHEN `updateValue(["version"], (v) => (typeof v === "number" ? v + 1 : 1))`
- THEN `version` is `2`

#### Scenario REQ-JSD-05.2: a non-JSON value rejects without mutation

- GIVEN `{}`
- WHEN `setValue(["when"], new Date() as never)`
- THEN the op rejects and no directive is emitted

### REQ-JSD-06: Path resolution errors

An op MUST reject, naming the path, when a segment crosses a scalar, when a `number` segment
addresses an object, or when a `string` segment addresses an array. Only `setValue`, `merge`,
`appendItem`, and `updateValue` create missing parents, and only as objects.

### REQ-JSD-07: Format preservation

- Untouched bytes MUST survive: comments (`//` and `/* */`), key order, blank lines, and
  whitespace outside the edited range.
- New content MUST use the indentation detected from the document (spaces or tabs and their
  width), falling back to two spaces, and the document's own line ending (LF or CRLF).
- A UTF-8 BOM and the presence or absence of a trailing newline MUST round-trip.
- A source that is not valid JSON (with comments and trailing commas allowed) MUST fail parse,
  contained by the dialect handle.

#### Scenario REQ-JSD-07.1: comments survive an edit

- GIVEN `{\n  // build tool\n  "tool": "tsc"\n}\n`
- WHEN `setValue(["tool"], "esbuild")`
- THEN the file is `{\n  // build tool\n  "tool": "esbuild"\n}\n`

### REQ-JSD-09: Relocation, copy, key position, and key order

- `moveValue(from, to)` MUST remove the value at `from` and write it at `to`, replacing any value
  already there, as RFC 6902 `move` does. A `number` last segment in `to` inserts into that array
  at that index; in `from` it removes that item. It MUST be a no-op when `from` is absent and
  `to` exists (already moved), and MUST reject when both are absent or when `to` lies inside
  `from`.
- `copyValue(from, to)` MUST write a copy of the value at `from` to `to` with `setValue`'s rules
  (RFC 6902 `copy`); a deep-equal value at `to` leaves the bytes unchanged. An absent `from` MUST
  reject.
- The `before`/`after` option of `setValue` and `addKey` MUST place a newly created key directly
  before or after the named sibling. It has no effect when the key already exists. It MUST
  reject when the sibling is absent or when both options are given.
- `sortKeys(path, options?)` MUST order the object's members by key in code-point order; each
  member's comments travel with it. Sorting an already sorted object MUST leave the bytes
  unchanged. A non-object at `path` MUST reject.
- Comments in JSONC files are preserved but have no op; edit them through the escape hatch.

#### Scenario REQ-JSD-09.1: moveValue relocates across parents

- GIVEN `{ "a": { "x": 1 }, "b": {} }`
- WHEN `moveValue(["a", "x"], ["b", "x"])`
- THEN the value is `{ "a": {}, "b": { "x": 1 } }`

#### Scenario REQ-JSD-09.2: addKey after a sibling

- GIVEN `{\n  "name": "app",\n  "version": "1.0.0"\n}\n`
- WHEN `addKey(["private"], true, { after: "name" })`
- THEN the file is `{\n  "name": "app",\n  "private": true,\n  "version": "1.0.0"\n}\n`

#### Scenario REQ-JSD-09.3: sortKeys orders members

- GIVEN `{ "b": 1, "a": 2 }`
- WHEN `sortKeys([])`
- THEN the keys are in the order `a`, `b`

### REQ-JSD-08: Escape hatch and conformance

`.modify(fn)` MUST hand `fn` the live `JsonDocument` (its `text` is the current source), so an
author can apply any `jsonc-parser` edit. The dialect MUST pass `testDialect` and `testOpPack`
from `@pbuilder/sdk/conformance` and keep the dialect leaf rule.
