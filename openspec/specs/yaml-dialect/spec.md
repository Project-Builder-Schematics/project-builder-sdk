# YAML Dialect Specification

**Spec version**: V2
**Status**: draft (pending owner review)
**Change**: `json-yaml-dialects`

The YAML dialect teaches the SDK to parse, mutate, and print `.yaml` and `.yml` files. It
carries the same structural op catalogue as the JSON dialect (`openspec/specs/json-dialect`)
and adds the mutations only YAML has: comments, anchors and aliases, merge keys, collection and
scalar style, and multi-document files. Documents and nodes an op did not touch MUST print with
their original bytes.

## Vocabulary

- **Path**, **parent**: as in the JSON dialect, `readonly (string | number)[]`. Exported as
  `YamlPath`.
- **YAML value**: a JSON value (exported as `YamlValue`). Values beyond JSON (dates, binary,
  custom tags) are reachable through the escape hatch only.
- **Document index**: every op accepts an optional last argument `{ document?: number }`
  selecting a document in a multi-document file. It defaults to `0`.

## Requirements

### REQ-YMD-01: Subpath, extensions, and exact op-set

The dialect MUST be reachable at `@pbuilder/sdk/yaml`, exporting `find(path)`, the types
`YamlValue`, `YamlPath`, and `YamlStream`, and `astLibrary` (the complete `yaml` module, native
forwarding). `find` MUST accept a basename ending in `.yaml` or `.yml` with a non-empty stem and
MUST reject every other path synchronously with a `dialectError`.

The op-pack MUST expose exactly these named ops, besides the universal escape hatch
`.modify(fn)`:

| # | Op | Mutation |
|---|---|---|
| 1 | `setValue(path, value, options?)` | Set the value at `path` (upsert) |
| 2 | `addKey(path, value, options?)` | Add a mapping key that does not exist yet |
| 3 | `removeKey(path, options?)` | Remove a mapping key |
| 4 | `renameKey(path, newKey, options?)` | Rename a mapping key, keeping value, position, and comments |
| 5 | `insertItem(path, index, value, options?)` | Insert a sequence item at `index` |
| 6 | `appendItem(path, value, options?)` | Append a sequence item; `{ unique: true }` skips a duplicate |
| 7 | `removeItem(path, index, options?)` | Remove the sequence item at `index` |
| 8 | `removeValue(path, value, options?)` | Remove every sequence item deep-equal to `value` |
| 9 | `replaceItem(path, index, value, options?)` | Replace the sequence item at `index` |
| 10 | `moveItem(path, from, to, options?)` | Move a sequence item |
| 11 | `merge(path, value, options?)` | Deep-merge a plain object into the mapping at `path` |
| 12 | `updateValue(path, fn, options?)` | Replace the value at `path` with `fn(current)` |
| 13 | `setComment(path, comment, options?)` | Set the comment before a node (`position: "before"`, default) or after it on the same line (`position: "inline"`) |
| 14 | `removeComment(path, options?)` | Remove the comment at that position |
| 15 | `setAnchor(path, name, options?)` | Put anchor `&name` on the node at `path` |
| 16 | `removeAnchor(path, options?)` | Remove the anchor, resolving its aliases to copies of the value |
| 17 | `setAlias(path, anchor, options?)` | Set the value at `path` to the alias `*anchor` |
| 18 | `addMergeKey(path, anchor, options?)` | Add `<<: *anchor` to the mapping at `path` |
| 19 | `setStyle(path, style, options?)` | Set a collection to `"block"` or `"flow"`, or a scalar to `"plain"`, `"single"`, `"double"`, `"literal"`, or `"folded"` |
| 20 | `addDocument(value, options?)` | Add a document at `options.index` (default: end) |
| 21 | `removeDocument(index)` | Remove a document |
| 22 | `moveValue(from, to, options?)` | Move a value from one path to another |
| 23 | `copyValue(from, to, options?)` | Copy a value from one path to another |
| 24 | `sortKeys(path, options?)` | Sort a mapping's keys; `{ recursive: true }` sorts nested mappings too |
| 25 | `setTag(path, tag, options?)` | Set a node's tag (e.g. `!Ref`), or remove it with `null` |

`setValue` and `addKey` also take `before`/`after` in their options, as in REQ-JSD-09.

#### Scenario REQ-YMD-01.1: subpath resolves with the exact op-set

- GIVEN `import * as yaml from "@pbuilder/sdk/yaml"`
- WHEN a handle is opened with `yaml.find("config.yml")`
- THEN the handle exposes exactly the twenty-five named ops above plus the base handle verbs

### REQ-YMD-02: Structural mutations

Ops 1 to 12 MUST behave exactly as REQ-JSD-02 to REQ-JSD-06 define for their JSON namesakes:
same upsert, insert-only, idempotency, rejection, deep-merge, array, path-resolution, and
value-validation rules, with "object" read as mapping and "array" as sequence. Path resolution
MUST follow aliases when reading and MUST reject an edit that would write through an alias,
naming the alias.

#### Scenario REQ-YMD-02.1: setValue keeps neighbour comments

- GIVEN `# app\nname: app # the name\nport: 80\n`
- WHEN `setValue(["port"], 8080)`
- THEN the file is `# app\nname: app # the name\nport: 8080\n`

#### Scenario REQ-YMD-02.2: renameKey keeps the comment

- GIVEN `a: 1\n# about b\nb: 2\n`
- WHEN `renameKey(["b"], "beta")`
- THEN the file is `a: 1\n# about b\nbeta: 2\n`

### REQ-YMD-03: Comments

- `setComment(path, comment, { position })` MUST replace any existing comment at that position.
  A multi-line `comment` becomes one `#` line per line. Setting an identical comment MUST leave
  the bytes unchanged.
- `removeComment(path, { position })` MUST remove it; no comment is a no-op.
- `[]` addresses the document: `before` is the document's leading comment.

#### Scenario REQ-YMD-03.1: setComment adds a leading comment

- GIVEN `port: 80\n`
- WHEN `setComment(["port"], "HTTP port")`
- THEN the file is `# HTTP port\nport: 80\n`

### REQ-YMD-04: Anchors, aliases, and merge keys

- `setAnchor(path, name)` MUST reject a name that is not a valid YAML anchor or that another node
  in the same document already carries. Re-setting the same anchor is a no-op.
- `setAlias(path, anchor)` MUST reject when no node in the document carries `anchor`, and when
  the alias would precede its anchor in document order.
- `removeAnchor(path)` MUST replace every alias to that anchor with a copy of the anchored value,
  so the document's data is unchanged.
- `addMergeKey(path, anchor)` MUST reject when the anchored node is not a mapping. Adding a merge
  key that is already present is a no-op.

#### Scenario REQ-YMD-04.1: setAnchor and setAlias share a value

- GIVEN `base:\n  image: node\nweb: {}\n`
- WHEN `setAnchor(["base"], "base")` then `setAlias(["web"], "base")`
- THEN the file is `base: &base\n  image: node\nweb: *base\n`

#### Scenario REQ-YMD-04.2: addMergeKey extends a mapping

- GIVEN `base: &base\n  image: node\nweb:\n  port: 80\n`
- WHEN `addMergeKey(["web"], "base")`
- THEN `web` is `<<: *base` followed by `port: 80`

### REQ-YMD-05: Style

`setStyle(path, style)` MUST reject a collection style on a scalar and a scalar style on a
collection, and MUST reject `"plain"` when the scalar cannot be written plain without changing
its value. It changes presentation only; the parsed data stays equal.

### REQ-YMD-06: Multi-document files

- A file with several `---`-separated documents MUST parse into a `YamlStream` whose documents
  print in order with their separators, directives, and comments.
- `addDocument(value, { index })` MUST insert a document; `removeDocument(index)` MUST remove it.
  An out-of-range index MUST reject, and so MUST an op's `{ document }` option.
- An empty file is a stream with zero documents; `setValue` on it creates document `0`.

#### Scenario REQ-YMD-06.1: an op on document 1 leaves document 0 untouched

- GIVEN `a:   1 # keep spacing\n---\nb: 2\n`
- WHEN `setValue(["b"], 3, { document: 1 })`
- THEN the file is `a:   1 # keep spacing\n---\nb: 3\n`

### REQ-YMD-07: Format preservation

- A document no op touched MUST print byte-identical to its source.
- A touched document keeps its comments, key order, blank lines, anchors, aliases, tags, and
  scalar and collection styles; new content uses the indentation detected from the document,
  falling back to two spaces.
- A UTF-8 BOM, CRLF line endings, and the trailing newline MUST round-trip.
- A source with a YAML syntax error MUST fail parse, contained by the dialect handle.

### REQ-YMD-09: Relocation, copy, key position, key order, and tags

- `moveValue`, `copyValue`, `sortKeys`, and the `before`/`after` option MUST behave as REQ-JSD-09
  defines, within the selected document. Comments, anchors, and tags travel with a moved or
  sorted node. `copyValue` MUST copy the resolved data and MUST NOT duplicate an anchor.
- `setTag(path, tag)` MUST set the node's tag, keeping its value and style; `null` removes it.
  A tag that is not a valid YAML tag MUST reject. Setting the current tag is a no-op.
- Document directives (`%YAML`, `%TAG`) and blank-line spacing have no op; edit them through the
  escape hatch.

#### Scenario REQ-YMD-09.1: setTag adds a custom tag

- GIVEN `bucket: my-bucket\n`
- WHEN `setTag(["bucket"], "!Ref")`
- THEN the file is `bucket: !Ref my-bucket\n`

### REQ-YMD-08: Escape hatch and conformance

`.modify(fn)` MUST hand `fn` the live `YamlStream` (its `documents` are `yaml` `Document`
instances). The dialect MUST pass `testDialect` and `testOpPack` from
`@pbuilder/sdk/conformance` and keep the dialect leaf rule.
