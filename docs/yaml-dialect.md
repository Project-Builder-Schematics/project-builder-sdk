# The YAML dialect

`@pbuilder/sdk/yaml` parses, edits, and prints `.yaml` and `.yml` files. It has the same
structural named ops as `@pbuilder/sdk/json`, plus the edits only YAML has: comments, anchors and
aliases, merge keys, styles, tags, and multi-document files.

```ts
import * as yaml from "@pbuilder/sdk/yaml";

export const run = async () => {
  await yaml
    .find("compose.yaml")
    .setValue(["services", "web", "ports"], ["3000:3000"])
    .setComment(["services", "web"], "Frontend");
};
```

`find(path)` accepts a basename ending in `.yaml` or `.yml` after a non-empty name and throws
synchronously for anything else. Every named op you chain on the handle edits the same live AST,
and the Session emits one `modify` directive for the file.

## Paths, values, and the `{ document }` option

- A **path** is an array: a `string` names a mapping key, a `number` indexes a sequence, and `[]`
  is the document root. Keys with dots or slashes need no escaping. Type: `YamlPath`.
- A **value** is JSON data: `null`, booleans, finite numbers, strings, arrays, and plain objects.
  Type: `YamlValue`. Anything else (`undefined`, `Date`, class instances, cycles) rejects before
  the file changes, naming the path inside the value. Dates, binary, and custom-tagged values
  are reachable through the escape hatch.
- Every op except `addDocument` and `removeDocument` takes an optional last argument
  `{ document?: number }` that selects a document in a multi-document file (default `0`). An
  out-of-range index rejects. On an empty file, the ops that create missing parents (`setValue`,
  `merge`, `appendItem`, `updateValue`) create document `0`.
- Reading follows aliases. An edit that would write *through* an alias rejects and names it:
  edit the anchored node instead.
- Every rejection throws an error starting `dialect operation failed: ` and the Session emits no
  directive for the file.

## Format preservation

- A document no op touched prints byte-identical to its source, including spacing such as
  `a:   1`.
- A touched document is re-serialized by the `yaml` library. It keeps comments, key order,
  anchors, aliases, tags, and scalar and collection styles. New content uses the document's
  detected indentation (fallback two spaces), sequence indentation, and flow-collection padding.
  The library normalizes some spelling in a touched document: long folded (`>`) scalars are
  joined onto one line, number spellings such as `0x1F` print as `0x1f`, explicit `? key`
  entries become `key: value`, and a trailing document comment gains a blank line before it.
- A UTF-8 BOM, CRLF line endings, and a missing trailing newline round-trip.
- A file with a YAML syntax error, or an alias to an undefined anchor, fails to parse.

## Key ops

### `setValue(path, value, options?)`

Sets the value at `path`, creating missing parent mappings (never sequences). `[]` replaces the
document. A deep-equal value leaves the bytes unchanged. A replaced node keeps its comments and
anchor; a scalar of the same type keeps its quoting. A sequence index must be in range.
`options.before` / `options.after` place a newly created key next to an existing sibling.

```yaml
# before                     # after setValue(["port"], 8080)
name: app # the name         name: app # the name
port: 80                     port: 8080
```

### `addKey(path, value, options?)`

Adds a key that does not exist. An existing deep-equal value is a no-op; a different value
rejects. The parent mapping must exist. Takes `before` / `after` like `setValue`; giving both,
or naming an absent sibling, rejects.

```yaml
# before          # after addKey(["private"], true, { after: "name" })
name: app         name: app
version: 1.0.0    private: true
                  version: 1.0.0
```

### `removeKey(path, options?)`

Removes a key with its leading comment. An absent key is a no-op.

```yaml
# before      # after removeKey(["b"])
a: 1          a: 1
b: 2          c: 3
c: 3
```

### `renameKey(path, newKey, options?)`

Renames a key in place, keeping value, position, and comments. A no-op when `path` is absent and
`newKey` exists; rejects when both exist or neither does.

```yaml
# before       # after renameKey(["b"], "beta")
a: 1           a: 1
# about b      # about b
b: 2           beta: 2
```

## Sequence ops

Every sequence op rejects when the value at `path` exists and is not a sequence, and every index
must be an integer in range.

### `insertItem(path, index, value, options?)`

Inserts before the item at `index`; `index` equal to the length appends.
`x: [a, c]` with `insertItem(["x"], 1, "b")` gives `x: [a, b, c]`.

### `appendItem(path, value, options?)`

Appends, creating the sequence (and parents) when absent. `{ unique: true }` skips a deep-equal
duplicate. `plugins: [a]` with `appendItem(["plugins"], "b", { unique: true })` gives
`plugins: [a, b]`.

### `removeItem(path, index, options?)`

Removes the item at `index`. `x: [a, b]` with `removeItem(["x"], 0)` gives `x: [b]`.

### `removeValue(path, value, options?)`

Removes every deep-equal item; no match (or no sequence) is a no-op.
`x: [a, b, a]` with `removeValue(["x"], "a")` gives `x: [b]`.

### `replaceItem(path, index, value, options?)`

Replaces the item in place, keeping its comment. `- a # first` with
`replaceItem(["x"], 0, "z")` gives `- z # first`.

### `moveItem(path, from, to, options?)`

Moves the item at `from` to `to`; the others keep their order.
`x: [1, 2, 3]` with `moveItem(["x"], 0, 2)` gives `x: [2, 3, 1]`.

## Merge and update

### `merge(path, value, options?)`

Deep-merges a plain object into the mapping at `path`, creating it when absent. Two mappings
merge recursively; anything else (sequences included) is replaced. Untouched keys keep their
comments. Merging an already-merged value is a no-op. A non-mapping target or non-object value
rejects.

```yaml
# before            # after merge([], { a: { y: [2], z: 3 } })
a:                  a:
  x: 1 # keep x       x: 1 # keep x
  y:                  y:
    - 1                 - 2
b: true               z: 3
                    b: true
```

### `updateValue(path, fn, options?)`

Calls `fn` with the current value (`undefined` when absent, aliases resolved) and sets the
result with `setValue`'s rules. The result is validated like any value.
`version: 1` with `updateValue(["version"], (v) => (typeof v === "number" ? v + 1 : 1))` gives
`version: 2`.

## Relocation and order

### `moveValue(from, to, options?)`

Removes the value at `from` and writes it at `to`, replacing what is there (RFC 6902 `move`). A
`number` last segment in `to` inserts into that sequence. A no-op when `from` is absent and `to`
exists; rejects when both are absent or `to` lies inside `from`. Comments, anchors, and tags move
with the node; a move that would leave an alias before its anchor rejects.
`a: {x: 1}` and `b: {}` with `moveValue(["a", "x"], ["b", "x"])` gives `a: {}` and `b: {x: 1}`.

### `copyValue(from, to, options?)`

Writes a copy of the resolved data at `from` to `to` with `setValue`'s rules (RFC 6902 `copy`).
Anchors are not copied. An absent `from` rejects.
`a: &x {k: 1}` with `copyValue(["a"], ["b"])` adds `b: {k: 1}`, without `&x`.

### `sortKeys(path, options?)`

Orders a mapping's keys by code point; each key's comments travel with it. `{ recursive: true }`
also sorts nested mappings, including those inside sequences. An already sorted mapping is
unchanged. A non-mapping rejects.

```yaml
# before        # after sortKeys([])
b: 1 # bee      # about a
# about a       a: 2
a: 2            b: 1 # bee
```

## Comments

### `setComment(path, comment, options?)`

`options.position` is `"before"` (default, `#` lines above the node) or `"inline"` (after it on
the same line). It replaces any existing comment there; a multi-line `comment` writes one `#`
line per line; an identical comment changes nothing. `[]` addresses the document: `"before"` is
its leading comment, and it has no inline position.

```yaml
# before      # after setComment(["port"], "HTTP port")
port: 80      # HTTP port
              port: 80
```

### `removeComment(path, options?)`

Removes the comment at that position; no comment is a no-op.
`port: 80 # http` with `removeComment(["port"], { position: "inline" })` gives `port: 80`.

## Anchors, aliases, and merge keys

### `setAnchor(path, name, options?)`

Puts `&name` on the node. Rejects a name with spaces or flow indicators (`,[]{}`) and a name
another node already carries. The same anchor is a no-op; a different one renames the anchor and
re-points its aliases.

### `setAlias(path, anchor, options?)`

Sets the value at `path` to `*anchor`, creating missing parents like `setValue`. Rejects when no
node carries `anchor`, and when the alias would come before its anchor in document order.

```yaml
# before          # after setAnchor(["base"], "base").setAlias(["web"], "base")
base:             base: &base
  image: node       image: node
web: {}           web: *base
```

### `removeAnchor(path, options?)`

Removes the anchor and replaces every alias to it with a copy of the value, so the data does not
change. No anchor is a no-op.

### `addMergeKey(path, anchor, options?)`

Adds `<<: *anchor` as the first entry of the mapping at `path`. Rejects when the anchored node is
not a mapping; a merge key already present is a no-op. A second, different merge source turns
the entry into `<<: [*a, *b]`.

```yaml
# before          # after addMergeKey(["web"], "base")
base: &base       base: &base
  image: node       image: node
web:              web:
  port: 80          <<: *base
                    port: 80
```

## Style and tags

### `setStyle(path, style, options?)`

Collections take `"block"` or `"flow"`; string scalars take `"plain"`, `"single"`, `"double"`,
`"literal"`, or `"folded"`. A collection style on a scalar, a scalar style on a collection, a
quoted or block style on a non-string, and `"plain"` on a string that cannot be written plain
(such as `'123'` or `'x: y'`) reject. Only the presentation changes.
`x: [1, 2]` with `setStyle(["x"], "block")` gives `x:` followed by `- 1` and `- 2`.

### `setTag(path, tag, options?)`

Sets the node's tag and keeps its value and style; `null` removes it. Accepts local tags
(`!Ref`), core tags (`!!str`), verbatim tags (`!<tag:example.com,2026:x>`), and named handles
declared by a `%TAG` directive. Anything else rejects. The current tag is a no-op.

```yaml
# before             # after setTag(["bucket"], "!Ref")
bucket: my-bucket    bucket: !Ref my-bucket
```

## Documents

### `addDocument(value, options?)`

Inserts a document holding `value` at `options.index` (default: the end). The index must be in
`0..length`. `a: 1` with `addDocument({ b: 2 })` gives `a: 1`, `---`, `b: 2`.

### `removeDocument(index)`

Removes the document at `index`; an out-of-range index rejects. Documents not removed keep their
bytes. `%YAML`/`%TAG` directives and blank-line spacing have no named op; use the escape hatch.

## The escape hatch

`.modify(fn)` hands `fn` the live `YamlStream`. Its `documents` are `yaml` `Document` instances,
and the module re-exports the library as `astLibrary`:

```ts
import * as yaml from "@pbuilder/sdk/yaml";

export const run = async () => {
  await yaml.find("config.yaml").modify((stream) => {
    const document = stream.documents[0]!;
    document.set("updated", new yaml.astLibrary.Scalar("2026-10-27"));
    document.directives!.yaml.explicit = true;
  });
};
```

An edit made through `.modify()` counts as touching its document, which is then re-serialized.
