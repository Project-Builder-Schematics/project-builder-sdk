# @pbuilder/sdk

> The public TypeScript/Bun authoring layer for [Project Builder](https://github.com/Project-Builder-Schematics) schematics.

**Status: early development.** Not yet published to a registry — see the
[quickstart](./docs/quickstart.md) for the local-install path (`bun link` or a packed
tarball). APIs are unstable and will change.

Start with the [quickstart](./docs/quickstart.md), or the [full doc index](./docs/README.md)
for the reference set — verbs, error contract, dry-run, and
[authoring a dialect](./docs/authoring-a-dialect.md) (structured, AST-aware mutation for one
file type, e.g. `@pbuilder/sdk/typescript`).

## What it is

`@pbuilder/sdk` is the developer-facing library for authoring Project Builder **schematics** —
programmable file mutations (create, remove, move, rename, copy, modify) plus package-local
reads (`scaffold`, `copyIn`, `create({ templateFile })`). The SDK never touches the disk:
it translates what you author into an **IR** (instruction record) and hands it to the Project Builder
engine, which owns execution and is the only component that writes to disk.

It's a conversation, not a one-shot: while a schematic runs, the SDK queries the engine for file
contents and emits mutations; the engine applies them to a staging tree and answers back. The SDK
proposes; the engine disposes.

## Anatomy of a schematic

```
collection
  ├── schema.json    # typed inputs (the contract with the user)
  └── factory.ts     # the authoring logic (written against @pbuilder/sdk)
```

## Scaffolding a folder

A schematic's own `collection` folder can hold static/templated files alongside
`schema.json`/`factory.ts` — `scaffold` walks one of those folders and mirrors it into the
target tree, without you writing a `create()` call per file:

```ts
import { defineFactory } from "@pbuilder/sdk/testing";
import { scaffold } from "@pbuilder/sdk/commons";

const run = defineFactory<{ name: string }>((input) => {
  scaffold({ from: "files", to: "src/generated", options: { name: input.name } });
}, { packageDir: import.meta.dir });
```

Each source file is classified automatically — never author-declared: valid, in-budget text
renders by-value (through the same IR `create()` uses, `{= =}` tokens included); anything
else (binary content, or a file over the size budget) travels by-reference instead, verbatim.

Two escape hatches handle the single-file cases `scaffold` doesn't:

- **`create(path, { templateFile })`** — an explicit RENDER request for one package-local
  file; a binary or over-budget file rejects fail-loud (never silently falls back to a copy).
- **`copyIn(from, to, { force? })`** — an explicit NEVER-RENDER copy of one package-local
  file, verbatim — the escape for a text asset that would otherwise be classified by-value
  (e.g. one containing `{= =}`-like sequences that must survive untouched).

Two things worth knowing before you rely on `scaffold`:

- **Packaging caveat**: an empty `from` folder scaffolds as a silent no-op — but npm tarball
  packaging commonly drops empty directories, so an empty folder may not even survive
  `npm publish`. Ship a placeholder file if the folder's presence matters.
- **Symlinked directories are never traversed** (even when their target resolves inside the
  package), and a single `scaffold` call is capped at 10,000 enumerated entries.

## Design at a glance

- **Surface ≠ contract** — the SDK gives you rich authoring verbs; they lower to a small, stable IR.
- **AST-agnostic engine** — AST tooling (ts-morph, postcss, cheerio) lives in SDK dialect modules,
  never in the engine. New file types are new packages, not engine releases.
- **Bun-native** — TypeScript runs directly, no transpile step.
- **`dist/core/**` ships, documented, not stripped** — the published tarball intentionally
  includes `dist/core/**`, because `./testing`'s runtime code imports `../core/context.ts`
  at runtime and needs it physically present on disk. `@pbuilder/sdk/core` still stays
  unreachable via `package.json#exports` regardless — the boundary is advisory-by-convention
  (no import path resolves it), not enforced by tarball exclusion.

## Testing your factory

`@pbuilder/sdk/testing` is the third audience surface — `author-testing` (ADR-0033) — the
supported way to test a factory you're authoring, in-memory, without a running engine. It
ships `0.x`, semver-exempt (mirroring the kit) until real use validates the result shape.

This is distinct from `./conformance`: `./testing` tests **your own factory's** behaviour;
`./conformance` conformance-tests a **dialect or op-pack** implementation (parse/print
fidelity), not a factory.

Import `defineFactory` and `runFactoryForTest` from `@pbuilder/sdk/testing`, run your factory
against an in-memory fake, and assert on the result. Templates are stored **verbatim** —
`{{...}}` interpolation is the engine's job, not the harness's:

```ts
import { defineFactory, runFactoryForTest } from "@pbuilder/sdk/testing";
import { create } from "@pbuilder/sdk/commons";
import { expect, test } from "bun:test";

test("factory writes a greeting file", async () => {
  const run = defineFactory<{ name: string }>((input) => {
    create("src/greeting.ts", {
      template: `export const greeting = '${input.name}';`,
      options: {},
    });
  });

  const result = await runFactoryForTest(run, { name: "world" });

  expect(result.error).toBeUndefined();
  expect(result.tree.get("src/greeting.ts")).toEqual("export const greeting = 'world';");
});
```

`runFactoryForTest`'s third parameter, `seed`, pre-populates the in-memory tree so your
factory can read existing files back before writing new ones:

```ts
import { defineFactory, runFactoryForTest } from "@pbuilder/sdk/testing";
import { find, create } from "@pbuilder/sdk/commons";
import { expect, test } from "bun:test";

test("factory derives a file from a seeded config", async () => {
  const run = defineFactory(async () => {
    const raw = await find("config.json").read();
    const { name } = JSON.parse(raw ?? "{}") as { name: string };
    create("src/greeting.ts", { template: `export const greeting = '${name}';`, options: {} });
  });

  const seed = { "config.json": JSON.stringify({ name: "seeded" }) };
  const result = await runFactoryForTest(run, undefined, seed);

  expect(result.error).toBeUndefined();
  expect(result.tree.get("src/greeting.ts")).toEqual("export const greeting = 'seeded';");
  // the seed itself is readable but never appears in the committed tree
  expect(result.tree.has("config.json")).toBe(false);
});
```

## Development

```sh
bun install
bun test
bun run typecheck
```

## License

[MIT](./LICENSE)
