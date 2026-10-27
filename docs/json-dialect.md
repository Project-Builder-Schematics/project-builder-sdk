# The JSON dialect

`@pbuilder/sdk/json` edits `.json` and `.jsonc` files structurally. Every named op addresses a
value by a **path** and changes only the bytes it must: comments, key order, blank lines,
indentation, line endings, a UTF-8 BOM, and the trailing newline all survive.

```ts
import * as json from "@pbuilder/sdk/json";

export const run = async () => {
  await json
    .find("package.json")
    .setValue(["scripts", "build"], "tsc")
    .appendItem(["files"], "dist", { unique: true });
};
```

Ops chained on one handle coalesce into one pending directive for the file.

## Paths and values

- A path is an array: a `string` segment names an object key, a `number` segment indexes an
  array, `[]` is the document root. `["scripts", "build"]`, `["files", 0]`. Keys with dots or
  slashes need no escaping.
- Values are typed `JsonValue`: `null`, booleans, finite numbers, strings, arrays, and plain
  objects. At runtime every value is validated before the document changes; `undefined`,
  functions, symbols, `bigint`, `NaN`/`Infinity`, class instances (`Date`, `Map`), and cycles
  reject, naming the path inside the value.
- `find(path)` accepts a basename ending in `.json` or `.jsonc` with a name before the
  extension. Any other path throws synchronously.
- An empty file is a document with no value; `setValue` creates its root.

## Rejections

Every rejection is an error whose message starts with `dialect operation failed: ` and names
the op and path, for example `addKey(["a"]) — the key already exists with a different value.`
A rejected op emits no directive. A file that is not valid JSON (comments and trailing commas
are allowed) fails with `dialect operation failed: could not parse "<path>"`.

Path errors: a segment that crosses a scalar, a `number` segment on an object, or a `string`
segment on an array rejects. Only `setValue`, `merge`, `appendItem`, `updateValue`, and the
destinations of `moveValue`/`copyValue` create missing parents, and only as objects.

## Named ops

### `setValue(path, value, options?)`

Upserts the value at `path`, creating missing parent objects. `setValue([], value)` replaces the
whole document. A deep-equal value leaves the bytes unchanged. `options` is `{ before?: string;
after?: string }` and places a newly created key next to an existing sibling (see
`addKey`).

```json
// before
{
  "name": "app"
}
// setValue(["scripts", "build"], "tsc")
{
  "name": "app",
  "scripts": {
    "build": "tsc"
  }
}
```

### `addKey(path, value, options?)`

Adds an object key that does not exist yet. A deep-equal existing value is a no-op; a different
existing value rejects. The parent object must exist. `{ before }` or `{ after }` places the new
key next to a sibling; an absent sibling, or both options, reject. The option has no effect when
the key already exists.

```json
// before
{
  "name": "app",
  "version": "1.0.0"
}
// addKey(["private"], true, { after: "name" })
{
  "name": "app",
  "private": true,
  "version": "1.0.0"
}
```

### `removeKey(path)`

Removes the member and its separator comma. An absent key is a no-op.

```json
{ "a": 1, "b": 2 }   // removeKey(["b"]) -> { "a": 1 }
```

### `renameKey(path, newKey)`

Renames a key in place, keeping its value, position, and comments. A no-op when the key is
absent and `newKey` exists (already renamed). Rejects when both or neither exist.

```json
{ "a": 1, "b": 2, "c": 3 }   // renameKey(["b"], "beta") -> { "a": 1, "beta": 2, "c": 3 }
```

### `insertItem(path, index, value)`

Inserts before the item at `index`; `index === length` appends. An index outside `0..length`
rejects.

```json
{ "x": [1, 3] }   // insertItem(["x"], 1, 2) -> { "x": [1, 2, 3] }
```

### `appendItem(path, value, options?)`

Appends at the end, creating the array when absent. `{ unique: true }` skips the append when a
deep-equal item exists, which makes it safe to re-run.

```json
{ "plugins": ["a"] }   // appendItem(["plugins"], "b", { unique: true }) -> { "plugins": ["a", "b"] }
```

### `removeItem(path, index)`

Removes the item and its separator. An out-of-range index rejects.

```json
{ "x": [1, 2] }   // removeItem(["x"], 0) -> { "x": [2] }
```

### `removeValue(path, value)`

Removes every item deep-equal to `value`. No match, or no array, is a no-op.

```json
{ "x": ["a", "b", "a"] }   // removeValue(["x"], "a") -> { "x": ["b"] }
```

### `replaceItem(path, index, value)`

Replaces the item in place. An out-of-range index rejects; a deep-equal value is a no-op.

```json
{ "x": [1, 2] }   // replaceItem(["x"], 1, 9) -> { "x": [1, 9] }
```

### `moveItem(path, from, to)`

Moves the item at `from` so it sits at `to`; the other items keep their relative order.
Out-of-range indices reject.

```json
{ "x": [1, 2, 3] }   // moveItem(["x"], 0, 2) -> { "x": [2, 3, 1] }
```

### `merge(path, value)`

Deep-merges a plain object into the object at `path`, creating it when absent. Two plain objects
merge recursively; any other pair, arrays included, is replaced by the incoming value. Keys only
in the document are kept, and untouched members keep their bytes. Re-merging is a no-op. A
non-object target or value rejects.

```json
{ "a": { "x": 1, "y": [1] }, "b": true }
// merge([], { "a": { "y": [2], "z": 3 } })
{ "a": { "x": 1, "y": [2], "z": 3 }, "b": true }
```

### `updateValue(path, fn)`

Calls `fn` with the current value (`undefined` when absent) and sets what it returns, validated
like any other value.

```ts
.updateValue(["version"], (v) => (typeof v === "number" ? v + 1 : 1))   // { "version": 1 } -> { "version": 2 }
```

### `moveValue(from, to)`

Moves a value, as RFC 6902 `move`: removes it at `from` and writes it at `to`, replacing any
value there. A `number` last segment in `to` inserts into that array; in `from` it removes that
item. A no-op when `from` is absent and `to` exists (already moved). Rejects when both are
absent or when `to` lies inside `from`.

```json
{ "a": { "x": 1 }, "b": {} }   // moveValue(["a", "x"], ["b", "x"]) -> { "a": {}, "b": { "x": 1 } }
```

### `copyValue(from, to)`

Copies a value with `setValue`'s rules (RFC 6902 `copy`). A deep-equal value at `to` is a no-op;
an absent `from` rejects.

```json
{ "a": [1] }   // copyValue(["a"], ["b"]) -> { "a": [1], "b": [1] }
```

### `sortKeys(path, options?)`

Orders the object's members by key in code-point order. Each member keeps the comments and
indentation that precede it; separators stay in place. `{ recursive: true }` also sorts every
nested object, including objects inside arrays. An already sorted object is a no-op; a
non-object rejects.

```json
{ "b": 1, "a": 2 }   // sortKeys([]) -> { "a": 2, "b": 1 }
```

## Formatting

New content uses the indentation detected from the document (tabs, or the width of the first
indented line, falling back to two spaces) and the document's own line ending. Inside a
one-line container, edits stay on that line (`{ "a": 1 }` gains `, "b": 2`) instead of
reformatting it.

## The escape hatch: `.modify(fn)`

Comments have no named op. For comments, or any edit the ops do not cover, `.modify(fn)` hands
`fn` the live `JsonDocument`. Its `text` is the current source (without the BOM, which is
re-added on print); compute edits with `astLibrary`, which is the full `jsonc-parser` module,
and assign the result back. Named ops chained after `.modify` see the new text.

```ts
import * as json from "@pbuilder/sdk/json";

export const run = async () => {
  await json.find("tsconfig.json").modify((doc) => {
    const edits = json.astLibrary.modify(doc.text, ["compilerOptions", "strict"], true, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    doc.text = json.astLibrary.applyEdits(doc.text, edits);
  });
};
```
