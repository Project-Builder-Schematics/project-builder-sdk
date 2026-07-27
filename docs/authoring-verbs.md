# Authoring verbs

Every author verb lives on `@pbuilder/sdk/commons` — the same entry every schematic imports
from. Each verb schedules a directive; nothing touches disk until the run flushes (on the
next `read()`, or at run end).

## The seven verbs

The SDK ships seven author verbs whose rejections share one closed `AuthoringVerb` label
union — `create`, `replaceContent`, `remove`, `rename`, `move`, `copy`, and `copyIn` — the
last a by-reference sibling of `copy` that copies straight from the package rather than
rendering a template. `scaffold` (below) is an eighth, separately shipped mutation: it fans
out into `create`/`copyIn` directives per entry rather than carrying its own label.

### `create`

```ts
function create<S>(
  path: string,
  opts: { template: string; options: { [K in keyof S]: S[K] }; force?: boolean }
): WritableHandle;
function create(path: string, opts: { template: string; options: JsonValue; force?: boolean }): WritableHandle;
function create(
  path: string,
  opts: { templateFile: string; options: JsonValue; force?: boolean }
): WritableHandle;
```

Schedules a file-creation directive and returns a `WritableHandle` for chaining — nothing
touches disk until the run flushes (on the next `read()`, or at run end). `path` and
`template` are both **template strings**, rendered independently against the same `options`;
the full template mini-language (delimiters, the 7 pipes, loops, conditionals) lives in
[Authoring `create` templates](./create-templates.md) — this page only covers the call
itself. The generic `S` overload narrows `options` to a schema's keys at the type level only;
the runtime behavior is identical to the plain `CreateOptions` overload.

The third overload swaps the inline `template` string for `templateFile` — a package-local
path (resolved against the run's `packageDir`), read at emission time; its content becomes
the same `template` field the engine renders. `templateFile`'s own VALUE is read verbatim by
content — it does **not** go through `scaffold`'s rename → token-translation → `.template`-strip
filename pipeline (below); this is an explicit request to render one named file, not a
per-entry folder walk.

```ts
import { create } from "@pbuilder/sdk/commons";

create("src/index.ts", {
  template: "export const version = '{= .version =}';",
  options: { version: "1.0.0" },
});
```

```ts
// templateFile overload — reads the template from disk instead of inlining it
create("src/index.ts", {
  templateFile: "index.ts.template",
  options: { version: "1.0.0" },
});
```

**Edge and error semantics:**

- An existing target path rejects unless `{ force: true }` is passed (fail-closed on
  overwrite) — `AuthoringError` with `verb: "create"`, `reason: "path-collision"`.
- `templateFile` is only usable inside a run started with `packageDir` — there is no
  resolution anchor otherwise (`reason: "invalid-input"`, never a silent cwd fallback).
- A `templateFile` that is binary (a null byte or invalid UTF-8 anywhere in the file) or
  larger than the 4 MiB inline-render limit fails loud with `reason: "invalid-input"` — it
  never silently falls back to a by-reference copy.
- A `templateFile` that is missing, resolves outside the package boundary, is not a regular
  file, or can't be read surfaces `reason: "source-not-found" | "source-outside-package" |
  "source-not-regular-file" | "source-unreadable"` — the same four reasons `copyIn` and
  `scaffold` share for their own package-local reads (see [Error contract](./authoring-errors.md)).

### `replaceContent`

```ts
function replaceContent(path: string, content: string): WritableHandle;
```

Schedules an in-place, wholesale content replacement for an **existing** file — `content` is
a raw string, not a template. A rejected run (the target does not exist, `reason:
"path-not-found"`) throws `AuthoringError`. Distinct from a dialect handle's `.modify(fn)`
escape hatch (see [Authoring a dialect](./authoring-a-dialect.md)), which mutates a live AST
in place rather than replacing text wholesale — but both lower to the **same** wire mutation,
so a rejected `.replaceContent()` reports `verb: "modify"` on its `AuthoringError`, not
`"replaceContent"`. This is deliberate, not a stale rename (see
[Error contract](./authoring-errors.md)).

```ts
import { replaceContent } from "@pbuilder/sdk/commons";

replaceContent("src/config.json", '{ "version": "2.0.0" }');
```

### `remove`

```ts
function remove(path: string): void;
```

Schedules a file deletion. Idempotent: removing an absent file is not an error — in practice
`remove` never rejects.

```ts
import { remove } from "@pbuilder/sdk/commons";

remove("src/legacy.ts");
```

### `rename`

```ts
function rename(path: string, newName: string, opts?: { force?: boolean }): WritableHandle;
```

Schedules a basename-only rename, returning a handle for the new path (the directory is
unchanged — only the last path segment is replaced). Renaming onto an existing path is
rejected unless `{ force: true }` is passed — `reason: "path-collision"`.

```ts
import { rename } from "@pbuilder/sdk/commons";

rename("src/foo.ts", "bar.ts");
```

### `move`

```ts
function move(path: string, toDir: string, opts?: { force?: boolean }): WritableHandle;
```

Schedules a move to a different directory, returning a handle for the new location. Moving
onto an existing destination is rejected unless `{ force: true }` (`reason:
"path-collision"`); a move whose destination equals its source is a no-op, never a collision.

```ts
import { move } from "@pbuilder/sdk/commons";

move("src/utils/helper.ts", "src/shared");
```

### `copy`

```ts
function copy(from: string, to: string, opts?: { force?: boolean }): WritableHandle;
```

Schedules a tree-to-tree copy, returning a handle you can chain further edits onto — the
fake test harness stages its content, so a chained `.read()` on the returned handle sees it.
Copying onto an existing destination is rejected unless `{ force: true }` (`reason:
"path-collision"`).

```ts
import { copy } from "@pbuilder/sdk/commons";

copy("src/template.ts", "src/generated/output.ts");
```

### `copyIn`

```ts
function copyIn(from: string, to: string, opts?: { force?: boolean }): void;
```

Copies ONE package-local file (`from`, resolved against the run's `packageDir`) into the
tree, always by-reference — never classified or rendered, even when the source is plain
text containing template-like sequences. This is `copy`'s sibling for package-local sources;
contrast with `create({ templateFile })`, which explicitly RENDERS a package-local source
instead.

Unlike `copy`, `copyIn` returns `void`, not a `WritableHandle`: a by-reference destination's
bytes exist only after the engine applies the directive — the fake test harness never
materializes them, so a handle chaining over tree content would lie about content that was
never staged. This asymmetry with `copy` (which *does* stage tree-to-tree content the fake
can chain over) is deliberate.

```ts
import { copyIn } from "@pbuilder/sdk/commons";

copyIn("assets/logo.svg", "src/generated/logo.svg");
```

**Edge and error semantics:**

- `from`/`to` are mandatory — a missing one rejects `reason: "invalid-input"` before any
  emission.
- Only usable inside a run started with `packageDir` — otherwise `reason: "invalid-input"`,
  never a cwd fallback.
- The source is validated for existence, package containment, and regular-file-ness before
  emission, surfacing `reason: "source-not-found" | "source-outside-package" |
  "source-not-regular-file" | "source-unreadable"` — the same four reasons `create({
  templateFile })` and `scaffold` share.
- A destination collision without `{ force: true }` rejects `reason: "path-collision"`,
  `verb: "copyIn"` — the author never called `copy`, but the label still names the actual
  offending call.

## `scaffold`

```ts
interface ScaffoldOptions {
  from: string;
  to: string;
  options?: JsonValue;
  include?: string[];
  exclude?: string[];
  rename?: Record<string, string>;
  force?: boolean;
}

function scaffold(args: ScaffoldOptions): void;
```

Walks a package-local folder (`from`, resolved against the run's `packageDir`) and mirrors
every entry into `to`, emitting one `create` or `copyIn` directive per entry — `scaffold` is
not itself in the `AuthoringVerb` label union above; a rejection it triggers surfaces under
whichever underlying verb (`create`/`copyIn`) or `invalid-input` reason applies. `from`/`to`
are mandatory; `options` defaults to `{}`, `include` defaults to matching everything,
`exclude` defaults to matching nothing (`exclude` wins on overlap), `rename` defaults to no
remap, and `force` defaults to `false`.

Each source-relative path runs through a pinned three-step pipeline before it becomes a
destination:

1. **`rename`** — a static remap table (`Record<originalSourceRelativePath,
   newDestinationRelativePath>`) matched against the *original*, pre-translation source path.
   This is distinct from the `rename()` verb above, which renames one already-targeted file's
   basename at emit time rather than remapping a folder-walk's per-entry destination.
2. **Filename token translation** — `__name__` becomes `{= name =}`; `__name@pipe__` becomes
   `{= name | pipe =}`. These are rendered later by the same engine described in
   [Authoring `create` templates](./create-templates.md) — `scaffold` only rewrites the
   marker syntax, it never renders anything itself. `to` is translated the same way, so one
   `scaffold` call can fan out into a per-option destination directory (e.g.
   `to: "src/services/__name@dasherize__"`).
3. **`.template` suffix strip** — applied last, so the marker must survive step 2 to be
   recognized.

`include`/`exclude` filtering runs against the *original* source-relative path, using a
hand-rolled minimal glob dialect: `*` matches within one path segment, `**` matches across
segments. Each surviving entry is then classified by-value (rendered, emits `create`) or
by-reference (emits `copyIn`) — sniffed entirely from content, never author-declared.

```ts
import { scaffold } from "@pbuilder/sdk/commons";

scaffold({
  from: "templates/service",
  to: "src/services",
  options: { name: "billing" },
  exclude: ["*.spec.ts"],
});
```

**Edge and error semantics:**

- A `from` folder with zero entries no-ops silently.
- `include`/`exclude` eliminating every entry rejects fail-loud (`reason: "invalid-input"`),
  naming the filters — a distinct outcome from the empty-folder no-op above, never collapsed
  into it.
- Two or more sources collapsing to the same destination (after the pipeline) reject
  fail-loud (`reason: "invalid-input"`), naming every offending source.
- The walk never descends into a symlinked directory, even when its target resolves inside
  the package boundary — skipped silently, no error.
- The walk is capped at 10,000 enumerated entries per call; exceeding it rejects fail-loud,
  naming the bound.
- Only usable inside a run started with `packageDir` — otherwise `reason: "invalid-input"`,
  never a cwd fallback.
- A per-entry package-local read failure surfaces `reason: "source-not-found" |
  "source-outside-package" | "source-not-regular-file" | "source-unreadable"` — the same four
  reasons `copyIn` and `create({ templateFile })` share.
- Once past the filters, a downstream `create`/`copyIn` collision without `force` still
  rejects `reason: "path-collision"` like any other write; `force` (default `false`) passes
  through unchanged to every emitted directive, with no per-file override.

`scaffold` returns `void` — fire-and-forget, no chainable handle, unlike `create`/`copy`.

**Packaging caveat.** The empty-folder no-op above depends on `from` existing on disk at run
time — npm tarball packaging commonly drops empty directories, so an empty `from` folder that
relies on the no-op may not survive `npm publish` at all. Ship at least a placeholder file if
the folder's presence matters.

## The read-trichotomy: `find(path).read()`

`find(path)` locates an existing file and returns a handle for reading or removing it.
`read()` resolves to exactly one of three states — never a truthiness check:

- **`absent`** — the path does not exist. `read()` resolves `undefined`.
- **`empty`** — the file exists but its content is the exact empty string `""`.
- **`present`** — any other string, including falsy-looking ones like `"0"` or `"false"`.

```ts
import { find, create, replaceContent } from "@pbuilder/sdk/commons";

const content = await find("src/config.ts").read();
if (content === undefined) {
  create("src/config.ts", { template, options });
} else if (content === "") {
  replaceContent("src/config.ts", seedContent);
} else {
  replaceContent("src/config.ts", patch(content));
}
```

Branch on the three outcomes with strict `=== undefined` / `=== ""` comparisons — never
`if (!content)`, which silently merges `undefined`, `""`, `"0"`, and `"false"`.
`classifyContent()` (also exported from `@pbuilder/sdk/commons`) names the trichotomy
directly, for an exhaustive `switch` instead of manual comparisons:

```ts
import { classifyContent } from "@pbuilder/sdk/commons";

switch (classifyContent(content)) {
  case "absent":
    // ...
    break;
  case "empty":
    // ...
    break;
  case "present":
    // ...
    break;
}
```

## Next steps

- [Error contract](./authoring-errors.md) — what `AuthoringError` looks like and how to
  assert against it.
- [Dry-run](./dry-run.md) — preview a factory's planned changes before anything commits.
- [Authoring a dialect](./authoring-a-dialect.md) — structured, AST-aware mutation for one
  file type (e.g. `@pbuilder/sdk/typescript`), built on top of these same verbs.
