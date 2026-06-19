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

## Development

```sh
bun install
bun test
bun run typecheck
```

## License

[MIT](./LICENSE)
