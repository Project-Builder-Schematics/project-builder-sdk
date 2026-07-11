# @pbuilder/sdk

> The public TypeScript/Bun authoring layer for [Project Builder](https://github.com/Project-Builder-Schematics) schematics.

**Status: early development.** Not yet published. APIs are unstable and will change.

## What it is

`@pbuilder/sdk` is the developer-facing library for authoring Project Builder **schematics** —
programmable file mutations (create, delete, move, rename, modify). The SDK never touches the disk:
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

## Design at a glance

- **Surface ≠ contract** — the SDK gives you rich authoring verbs; they lower to a small, stable IR.
- **AST-agnostic engine** — AST tooling (ts-morph, postcss, cheerio) lives in SDK dialect modules,
  never in the engine. New file types are new packages, not engine releases.
- **Bun-native** — TypeScript runs directly, no transpile step.

## Testing your factory

`@pbuilder/sdk/testing` is the third audience surface — `author-testing` (ADR-0033) — the
supported way to test a factory you're authoring, in-memory, without a running engine. It
ships `0.x`, semver-exempt (mirroring the kit) until real use validates the result shape.

This is distinct from `./conformance`: `./testing` tests **your own factory's** behaviour;
`./conformance` conformance-tests an **engine implementation** against the wire contract.

Import `defineFactory` and `runFactoryForTest` from `@pbuilder/sdk/testing`, run your factory
against an in-memory fake, and assert on the result:

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
