# Authoring verbs

Every author verb lives on `@pbuilder/sdk/commons` — the same entry every schematic imports
from. Each verb schedules a directive; nothing touches disk until the run flushes (on the
next `read()`, or at run end).

## The seven verbs

The SDK ships seven author verbs — `create`, `modify`, `remove`, `rename`, `move`, `copy`,
and `copyIn` — the last a by-reference sibling of `copy` that copies straight from the
package rather than rendering a template.

- **`create(path, { template, options })`** — schedules a file-creation directive. Rejected
  on an existing path unless `{ force: true }` is passed (fail-closed on overwrite). A third
  overload, `create(path, { templateFile, options })`, reads a package-local file at emission
  time instead of an inline `template` string.

  ```ts
  import { create } from "@pbuilder/sdk/commons";

  create("src/index.ts", {
    template: "export const version = '{{version}}';",
    options: { version: "1.0.0" },
  });
  ```

- **`modify(path, content)`** — schedules an in-place content replacement for an existing
  file. A rejected run (e.g. the target does not exist) throws `AuthoringError`.

  ```ts
  import { modify } from "@pbuilder/sdk/commons";

  modify("src/config.json", '{ "version": "2.0.0" }');
  ```

- **`remove(path)`** — schedules a file deletion. Idempotent: removing an absent file is not
  an error.

  ```ts
  import { remove } from "@pbuilder/sdk/commons";

  remove("src/legacy.ts");
  ```

- **`rename(path, newName, opts?)`** — schedules a basename-only rename, returning a handle
  for the new path. Renaming onto an existing path is rejected unless `{ force: true }`.

  ```ts
  import { rename } from "@pbuilder/sdk/commons";

  rename("src/foo.ts", "bar.ts");
  ```

- **`move(path, toDir, opts?)`** — schedules a move to a different directory. Moving onto an
  existing destination is rejected unless `{ force: true }`; a move whose destination equals
  its source is a no-op, never a collision.

  ```ts
  import { move } from "@pbuilder/sdk/commons";

  move("src/utils/helper.ts", "src/shared");
  ```

- **`copy(from, to, opts?)`** — schedules a tree-to-tree copy, returning a handle you can
  chain further edits onto (the fake test harness stages its content, so a chained `.read()`
  sees it). Copying onto an existing destination is rejected unless `{ force: true }`.

  ```ts
  import { copy } from "@pbuilder/sdk/commons";

  copy("src/template.ts", "src/generated/output.ts");
  ```

- **`copyIn(from, to, opts?)`** — copies ONE package-local file (`from`, resolved against the
  run's `packageDir`) into the tree, always by-reference — never classified or rendered, even
  when the source is plain text. This is `copy`'s sibling for package-local sources; contrast
  with `create({ templateFile })`, which explicitly RENDERS a package-local source instead.
  Only usable inside a run whose `packageDir` option was provided.

  ```ts
  import { copyIn } from "@pbuilder/sdk/commons";

  copyIn("assets/logo.svg", "src/generated/logo.svg");
  ```

## The read-trichotomy: `find(path).read()`

`find(path)` locates an existing file and returns a handle for reading or removing it.
`read()` resolves to exactly one of three states — never a truthiness check:

- **`absent`** — the path does not exist. `read()` resolves `undefined`.
- **`empty`** — the file exists but its content is the exact empty string `""`.
- **`present`** — any other string, including falsy-looking ones like `"0"` or `"false"`.

```ts
import { find, create, modify } from "@pbuilder/sdk/commons";

const content = await find("src/config.ts").read();
if (content === undefined) {
  create("src/config.ts", { template, options });
} else if (content === "") {
  modify("src/config.ts", seedContent);
} else {
  modify("src/config.ts", patch(content));
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
