# Pending Directives

`pendingDirectives()` previews the Directives your factory's Session will still send — before
any of them is staged. It is a plain
function on `@pbuilder/sdk/commons`, imported the same way as every other author verb —
never its own subpath.

```ts
import { pendingDirectives } from "@pbuilder/sdk/commons";
```

## What it returns

`pendingDirectives()` returns `PendingDirective[]`: the Directives still pending in the active Session's
buffer, rendered in author vocabulary. Each entry carries a `verb` and a `path`, plus an
optional `kind` (`"rendered" | "copied"`) present only on the package-local-read verbs whose
transport is classified — `create` (`kind: "rendered"`) and `copyIn` (`kind: "copied"`).

`verb` reuses the WIRE mutation label `"modify"` for both `.replaceContent()` and a dialect's
`.modify(fn)` calls — the two calls lower to the same directive, so `pendingDirectives()` cannot (and
does not need to) distinguish them; this is deliberate, not a naming mismatch.

```ts
import { runFactoryForTest } from "@pbuilder/sdk/testing";
import { create, find, pendingDirectives } from "@pbuilder/sdk/commons";

const run = () => {
  create("src/index.ts", { template: "export const version = '1.0.0';", options: {} });
  find("src/legacy.ts").remove();

  for (const entry of pendingDirectives()) {
    console.log(entry.verb, entry.path); // "create src/index.ts", then "remove src/legacy.ts"
  }
};

await runFactoryForTest(run, undefined, { seed: { "src/legacy.ts": "" } });
```

## Call it before any read

The result holds only what is still **pending** — the honest answer to "what will this Session
still send," not "what has this Session sent in total." A `read()` (or any flush) drains the
pending buffer, so Directives already sent no longer appear in `pendingDirectives()`'s result. Call
it before any `read()` or dialect `find()` opens, if you want it to see everything the Session
has scheduled so far.

`pendingDirectives()` can only be called inside an active Session (a running factory) — calling it outside one throws the same
"authoring verbs can only be used while a schematic is running" error every other
`./commons` verb throws.

## Next steps

- [Authoring verbs](./authoring-verbs.md) — the seven authoring verbs and the read-trichotomy rule.
- [Error contract](./authoring-errors.md) — what `AuthoringError` looks like and how to
  assert against it.
