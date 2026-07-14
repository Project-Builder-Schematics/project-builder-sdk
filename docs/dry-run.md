# Dry-run

`dryRun()` previews what a run will still emit — before any of it commits. It is a plain
function on `@pbuilder/sdk/commons`, imported the same way as every other author verb —
never its own subpath.

```ts
import { dryRun } from "@pbuilder/sdk/commons";
```

## What it returns

`dryRun()` returns `DryRunEntry[]`: the plan of directives still pending in the active run's
buffer, rendered in author vocabulary. Each entry carries a `verb` and a `path`, plus an
optional `kind` (`"rendered" | "copied"`) present only on the package-local-read verbs whose
transport is classified — `create` (`kind: "rendered"`) and `copyIn` (`kind: "copied"`).

`verb` reuses the WIRE mutation label `"modify"` for both `.replaceContent()` and a dialect's
`.modify(fn)` calls — the two calls lower to the same directive, so `dryRun()` cannot (and
does not need to) distinguish them; this is deliberate, not a naming mismatch.

```ts
import { defineFactory } from "@pbuilder/sdk/testing";
import { create, find, dryRun } from "@pbuilder/sdk/commons";

const run = defineFactory(() => {
  create("src/index.ts", { template: "export const version = '1.0.0';", options: {} });
  find("src/legacy.ts").remove();

  for (const entry of dryRun()) {
    console.log(entry.verb, entry.path); // "create src/index.ts", then "remove src/legacy.ts"
  }
});
```

## Call it before any read

The plan reflects only what is still **pending** — the honest answer to "what will this run
still emit," not "what has this run emitted in total." A `read()` (or any flush) empties the
pending buffer, so directives already flushed no longer appear in `dryRun()`'s result. Call
it before any `read()` or dialect `find()` opens, if you want it to see everything the run
has scheduled so far.

`dryRun()` can only be called inside an active `defineFactory` run — calling it outside one
throws the same "authoring verbs can only be used while a schematic is running" error every
other `./commons` verb throws.

## Next steps

- [Authoring verbs](./authoring-verbs.md) — the seven authoring verbs and the read-trichotomy rule.
- [Error contract](./authoring-errors.md) — what `AuthoringError` looks like and how to
  assert against it.
