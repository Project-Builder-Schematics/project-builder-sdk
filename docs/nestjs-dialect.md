# The NestJS dialect

`@pbuilder/sdk/nestjs` edits the `.ts` files of a NestJS project. Its handle carries every
op of [`@pbuilder/sdk/typescript`](./authoring-a-dialect.md) (`addImport`, `addDefaultImport`,
`addNamespaceImport`, `addTypeImport`, `addSideEffectImport`, `addReExport`, `addExportAll`,
`addFunction`, `addVariable`, `addClass`, `removeImport`, `removeExport`, `removeExportAll`, and
any op the TypeScript dialect gains later)
plus four ops that register a class in a `@Module` decorator. All ops chain on one handle and
the file is written once.

```ts
import * as nestjs from "@pbuilder/sdk/nestjs";

export const run = async () => {
  await nestjs
    .find("src/app.module.ts")
    .addModuleImport("UsersModule", "./users/users.module")
    .addProvider("UsersService", "./users/users.service");
};
```

```ts
// before
@Module({ providers: [AppService] })
export class AppModule {}

// after
import { UsersModule } from "./users/users.module";
import { UsersService } from "./users/users.service";

@Module({ providers: [AppService, UsersService], imports: [UsersModule] })
export class AppModule {}
```

## `@Module` ops

Each op takes `(name, from)` and does two things:

1. Adds `import { name } from "from"` with the same rules as the TypeScript `addImport`: an
   existing import of `name` from `from` is reused, and a `name` already bound some other way
   in the file rejects.
2. Appends `name` to one array of the file's `@Module` metadata. If `@Module()` has no
   argument, or the metadata has no such array, it is created. If the array already has an
   entry named `name`, it is left as it is.

### `addProvider(name, from)`

Appends to `providers`.

### `addController(name, from)`

Appends to `controllers`.

### `addModuleImport(name, from)`

Appends to `imports`, the other Nest modules this module imports. It is not called
`addImport` because that name belongs to the inherited TypeScript op, which adds an `import`
statement.

### `addExport(name, from)`

Appends to `exports`.

## Format preservation

A new entry follows the layout of the list it joins: a one-line list stays on one line, a
multi-line list gets a new line at the indentation of its last entry, and a trailing comma
stays trailing. Everything outside the inserted text is byte-identical.

## Rejections

An op rejects, and the file is left unchanged, when:

- the file has no class decorated with `@Module`, or more than one;
- the `@Module` argument is not an object literal (for example `@Module(METADATA)`);
- the target property is not an array literal (for example `providers: PROVIDERS`);
- `name` is not a valid identifier, or is already bound in the file some other way.

`find(path)` accepts any `.ts` path, like the TypeScript dialect; a file without `@Module`
only fails when one of these ops runs.

## The escape hatch

Entries that are not a plain class name, such as `ConfigModule.forRoot()` or
`{ provide: TOKEN, useValue: 1 }`, and the files these ops reject, are edited with
`.modify(fn)`. The callback receives the live ts-morph `SourceFile`, and the module's
`astLibrary` export is ts-morph itself:

```ts
import * as nestjs from "@pbuilder/sdk/nestjs";

await nestjs
  .find("src/app.module.ts")
  .addImport("ConfigModule", "@nestjs/config")
  .modify((ast) => {
    const imports = ast
      .getClassOrThrow("AppModule")
      .getDecoratorOrThrow("Module")
      .getArguments()[0]!
      .asKindOrThrow(nestjs.astLibrary.SyntaxKind.ObjectLiteralExpression)
      .getPropertyOrThrow("imports")
      .asKindOrThrow(nestjs.astLibrary.SyntaxKind.PropertyAssignment)
      .getInitializerIfKindOrThrow(nestjs.astLibrary.SyntaxKind.ArrayLiteralExpression);
    imports.addElement("ConfigModule.forRoot()");
  });
```
