# The Angular dialect

`@pbuilder/sdk/angular` edits the `.ts` files of an Angular project. Its handle carries every
op of [`@pbuilder/sdk/typescript`](./authoring-a-dialect.md) (`addImport`, `addDefaultImport`,
`addNamespaceImport`, `addTypeImport`, `addSideEffectImport`, `addReExport`, `addExportAll`,
`addFunction`, `addVariable`, `addClass`, `removeImport`, `removeExport`, `removeExportAll`,
`addArrayElement`, `addClassProperty`, `sortImports`, and any op the TypeScript dialect gains later) plus ops for standalone
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
annotation or `satisfies`. In an NgModule routing file without one, they add to the routes of the
only `RouterModule.forRoot(...)` or `RouterModule.forChild(...)` call: its inline array, or a
variable in the same file that it names. `RouterModule` is matched by that name, so an aliased
import (`RouterModule as RM`) is not found and the op rejects. Angular uses the first route that matches, so a new route
goes before a top-level `{ path: "**" }` route when there is one, and at the end otherwise.

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

## NgModule

Angular recommends standalone components for new code. These ops maintain applications still
built with `@NgModule`. Each takes `(element, imports?)`, like the component ops, and appends
to one array of the file's only `@NgModule`, creating the metadata object or the array when
missing.

| Op | Appends to |
|---|---|
| `addNgModuleImport(element, imports?)` | `imports`, such as other NgModules or `StoreModule.forRoot({})` |
| `addDeclaration(element, imports?)` | `declarations`. Angular requires those components, directives and pipes to be `standalone: false`. |
| `addNgModuleProvider(element, imports?)` | `providers` |
| `addNgModuleExport(element, imports?)` | `exports` |
| `addBootstrap(element, imports?)` | `bootstrap` |

They are not named `addImport`, `addProvider` or `addExport`, because `addImport` is the inherited
TypeScript op that adds an `import` statement.

```ts
await angular
  .find("src/app/app.module.ts")
  .addDeclaration("UserCard", [{ name: "UserCard", from: "./user-card" }]);
// @NgModule({ declarations: [App], bootstrap: [App] })
// -> @NgModule({ declarations: [App, UserCard], bootstrap: [App] })
```

## Signals and injection

These ops add a class property, through the TypeScript `addClassProperty`, and import the Angular
function it calls from `@angular/core`. The property goes after the class's last property, so
inputs, outputs and injected dependencies stay above the constructor and the methods, as the
Angular style guide asks. The class is found by its decorator, so the ops need no class name. The
same property already there is a no-op. Another member with the same name rejects.

Following the style guide, `input`, `model` and `output` properties are `readonly`. In
`options`, `type` is the generic argument and must parse as exactly one type, `initial` is the
value and must parse as exactly one expression, and `imports` lists the `{ name, from }` imports
those need, as in [Code and its imports](#code-and-its-imports).

### `addInjection(name, token, options?)`

Adds `private readonly name = inject(token);` to the file's only class decorated with
`@Component`, `@Directive`, `@Pipe`, `@Injectable` or `@Service`. `token` is an identifier or
`{ expression }`. `options` is `{ scope?, imports? }`, where `scope` replaces `private`.

```ts
await angular
  .find("src/app/users.ts")
  .addInjection("http", "HttpClient", { imports: [{ name: "HttpClient", from: "@angular/common/http" }] });
// -> import { inject } from "@angular/core";
// -> import { HttpClient } from "@angular/common/http";
// -> private readonly http = inject(HttpClient);
```

### `addInput(name, options?)`

Adds `readonly name = input<type>(initial);`, or `readonly name = input.required<type>();` with
`required: true`, to the file's only `@Component` or `@Directive` class. `options` is
`{ type?, initial?, required?, imports? }`; `required` and `initial` cannot be combined.

```ts
await angular
  .find("src/app/user-card.ts")
  .addInput("user", { type: "User", required: true, imports: [{ name: "User", from: "./user" }] })
  .addInput("size", { type: '"sm" | "lg"', initial: '"sm"' });
// -> readonly user = input.required<User>();
// -> readonly size = input<"sm" | "lg">("sm");
```

### `addModel(name, options?)`

Same as `addInput`, with `model()` for a property the component writes back through a two-way
binding.

### `addOutput(name, options?)`

Adds `readonly name = output<type>();` to the file's only `@Component` or `@Directive` class.
`options` is `{ type?, imports? }`.

### `addSignal(name, initial, options?)`

Adds `protected readonly name = signal<type>(initial);` to the file's only `@Component` or
`@Directive` class. `protected` follows the style guide for members the template reads.
`options` is `{ type?, scope?, imports? }`, where `scope` replaces `protected`.

### `addComputed(name, expression, options?)`

Adds `protected readonly name = computed<type>(() => expression);`, with the same class, options
and scope as `addSignal`. An object literal expression is wrapped in parentheses, so the arrow
function returns it and does not read it as a block.

```ts
await angular
  .find("src/app/counter.ts")
  .addSignal("count", "0")
  .addComputed("double", "this.count() * 2");
// -> protected readonly count = signal(0);
// -> protected readonly double = computed(() => this.count() * 2);
```

## Format preservation

A new entry follows the layout of the list it joins: a one-line list stays on one line, a
multi-line list gets a new line at the indentation of its last entry, and a trailing comma
stays trailing. Everything outside the inserted text is byte-identical.

## Rejections

An op rejects, and the file is left unchanged, when:

- the file has no `@Component`, `@NgModule`, decorated class, `ApplicationConfig` variable,
  `bootstrapApplication` call, or routes for the op, or more than one;
- the class already has a different member with the property's name;
- the metadata, config, or route list is not a literal (for example `providers: PROVIDERS`);
- `bootstrapApplication` receives its config by name;
- a route `path` starts with `/`, or a different route already uses the `path`;
- an `element`, an import `name`, a `component`, an `export`, a `type`, or an `initial` is not
  valid, or `required` comes with `initial`.

`find(path)` accepts any `.ts` path, like the TypeScript dialect; a file without the target only
fails when one of these ops runs.

## The escape hatch

Edits these ops do not cover, such as a child route or `viewProviders`, and the files these ops
reject, are made with `.modify(fn)`. The callback receives the live ts-morph `SourceFile`, and
the module's `astLibrary` export is ts-morph itself:

```ts
import * as angular from "@pbuilder/sdk/angular";

await angular.find("src/app/user-card.ts").modify((ast) => {
  const viewProviders = ast
    .getClassOrThrow("UserCard")
    .getDecoratorOrThrow("Component")
    .getArguments()[0]!
    .asKindOrThrow(angular.astLibrary.SyntaxKind.ObjectLiteralExpression)
    .getPropertyOrThrow("viewProviders")
    .asKindOrThrow(angular.astLibrary.SyntaxKind.PropertyAssignment)
    .getInitializerIfKindOrThrow(angular.astLibrary.SyntaxKind.ArrayLiteralExpression);
  viewProviders.addElement("CardState");
});
```
