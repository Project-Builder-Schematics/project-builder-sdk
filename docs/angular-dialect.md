# The Angular dialect

`@pbuilder/sdk/angular` edits the `.ts` files of an Angular project. Its handle carries every
op of [`@pbuilder/sdk/typescript`](./authoring-a-dialect.md) (`addImport`, `addDefaultImport`,
`addNamespaceImport`, `addTypeImport`, `addSideEffectImport`, `addReExport`, `addExportAll`,
`addFunction`, `addVariable`, `addClass`, `removeImport`, `removeExport`, `removeExportAll`,
`addArrayElement`, `addClassProperty`, and any op the TypeScript dialect gains later) plus ops for standalone
components, the application's root providers, and routes. All ops chain on one handle and the
file is written once.

The ops find their target by its shape, never by file name, so they work with both the
`app.ts` and the `app.component.ts` naming styles.

```ts
import * as angular from "@pbuilder/sdk/angular";

export const run = async () => {
  await angular
    .find("src/app/app.config.ts")
    .addRootProvider({ expression: "provideHttpClient(withFetch())" }, [
      { name: "provideHttpClient", from: "@angular/common/http" },
      { name: "withFetch", from: "@angular/common/http" },
    ]);
};
```

```ts
// before
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)],
};

// after
import { provideHttpClient, withFetch } from "@angular/common/http";

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient(withFetch())],
};
```

## Code and its imports

The component and root-provider ops take `(element, imports?)`:

- `element` is an identifier such as `"RouterOutlet"`, or `{ expression }` for code such as
  `{ expression: "provideHttpClient(withFetch())" }`. An expression must parse as exactly one
  expression; beyond that it is trusted as written.
- `imports` lists the `{ name, from }` named imports the element needs. Each one is added with
  the same rules as the TypeScript `addImport`: an existing import of `name` from `from` is
  reused, and a `name` already bound some other way in the file rejects.

An element already in the list, compared token by token so spacing and comments do not count,
is left as it is.

## Component ops

### `addComponentImport(element, imports?)`

Appends to `imports` of the file's only `@Component`, creating the metadata object or the array
when missing.

```ts
await angular
  .find("src/app/app.ts")
  .addComponentImport("RouterOutlet", [{ name: "RouterOutlet", from: "@angular/router" }]);
```

### `addComponentProvider(element, imports?)`

Same as `addComponentImport`, for the component's `providers`.

## Root providers

### `addRootProvider(element, imports?)`

Appends to the application's root `providers`:

1. the `providers` of the file's only top-level variable typed `ApplicationConfig`, by
   annotation (`const appConfig: ApplicationConfig = …`) or `satisfies`, whatever its name;
2. otherwise, the `providers` of the config object passed to the file's only
   `bootstrapApplication(...)` call, created when the call has no config yet.

When `bootstrapApplication` receives a config by name, such as an `appConfig` imported from
`./app/app.config`, the op rejects and names that module: run the op on that file instead.

## Routes

Both route ops add to the file's only top-level variable typed `Routes` or `Route[]`, by
annotation or `satisfies`. Angular uses the first route that matches, so a new route goes
before a top-level `{ path: "**" }` route when there is one, and at the end otherwise.

An equal route is left as it is. A different route with the same `path` rejects, so a
schematic run twice with other inputs never adds a second one. Routes are compared token by
token, and the ops write double quotes: a route written as `{ path: 'about', component: About }`
is not equal to the one `addRoute` writes, so adding it again rejects instead of doing nothing.

### `addRoute({ path, component, from })`

Imports `component` from `from` and adds an eager route.

```ts
await angular.find("src/app/app.routes.ts").addRoute({ path: "about", component: "About", from: "./about/about" });
// -> import { About } from "./about/about";
// -> { path: "about", component: About },
```

### `addLazyRoute({ path, loadComponent | loadChildren, export? })`

Adds a lazy route that loads the module named by `loadComponent` or `loadChildren` (exactly one
of them). With `export`, the route reads that named export; without it, the module's default
export. No import is added.

```ts
await angular
  .find("src/app/app.routes.ts")
  .addLazyRoute({ path: "settings", loadComponent: "./settings/settings", export: "Settings" })
  .addLazyRoute({ path: "admin", loadChildren: "./admin/admin.routes" });
// -> { path: "settings", loadComponent: () => import("./settings/settings").then((m) => m.Settings) },
// -> { path: "admin", loadChildren: () => import("./admin/admin.routes") },
```

## Format preservation

A new entry follows the layout of the list it joins: a one-line list stays on one line, a
multi-line list gets a new line at the indentation of its last entry, and a trailing comma
stays trailing. Everything outside the inserted text is byte-identical.

## Rejections

An op rejects, and the file is left unchanged, when:

- the file has no `@Component`, `ApplicationConfig` variable, `bootstrapApplication` call, or
  `Routes` variable for the op, or more than one;
- the metadata, config, or route list is not a literal (for example `providers: PROVIDERS`);
- `bootstrapApplication` receives its config by name;
- a route `path` starts with `/`, or a different route already uses the `path`;
- an `element`, an import `name`, a `component`, or an `export` is not valid.

`find(path)` accepts any `.ts` path, like the TypeScript dialect; a file without the target only
fails when one of these ops runs.

## The escape hatch

Edits these ops do not cover, such as a child route or an NgModule, and the files these ops
reject, are made with `.modify(fn)`. The callback receives the live ts-morph `SourceFile`, and
the module's `astLibrary` export is ts-morph itself:

```ts
import * as angular from "@pbuilder/sdk/angular";

await angular.find("src/app/app.module.ts").modify((ast) => {
  const declarations = ast
    .getClassOrThrow("AppModule")
    .getDecoratorOrThrow("NgModule")
    .getArguments()[0]!
    .asKindOrThrow(angular.astLibrary.SyntaxKind.ObjectLiteralExpression)
    .getPropertyOrThrow("declarations")
    .asKindOrThrow(angular.astLibrary.SyntaxKind.PropertyAssignment)
    .getInitializerIfKindOrThrow(angular.astLibrary.SyntaxKind.ArrayLiteralExpression);
  declarations.addElement("LegacyWidget");
});
```
