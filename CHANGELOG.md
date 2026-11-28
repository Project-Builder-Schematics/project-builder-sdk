# Changelog

All notable changes to `@pbuilder/sdk` are documented here. The package publishes to npm
(plus `0.0.0-dev.<sha>` prereleases from `main`) — and it is NOT
zero-consumer: the engine repo and the conformance corpus consume this contract today even
beyond any npm consumer, so the breaking/behaviour entries below carry migration text
for them, not a summary claiming no migration is needed.

## 0.20.0 (not yet released)

### Finding many files

- **Added**: `glob(pattern, { ignore })` on commons (A-130, A-131). It resolves a `FoundHandle`
  for every file the pattern matches and no `ignore` pattern does, ordered by path, and `[]`
  when none matches. It sees the run: a file created earlier is listed, one removed earlier is
  not. `*`, `?`, `**` and `{a,b}` match; every other character is literal.
- **Added**: `glob` on every Dialect, the SDK's ten and author-defined ones (A-132, A-133).
  `defineDialect` and `byExtension` implement it once: it keeps the files whose extension the
  dialect declares and opens each through the dialect's `find`, so a routed dialect hands each
  file to the route of its longest extension. `find` still rejects a literal path of another
  extension.
- **Added**: a handle a `byExtension` dialect returns, from `find` or `glob`, carries its
  routing key as `extension`, typed as the literal key, so the routes' handles form a
  discriminated union (A-134). `glob`'s handle type is the route's for a pattern that ends in a
  routed extension and the union otherwise (A-135). `byExtension` throws at composition when a
  routed dialect has an op named `extension`, which the routing key would replace.
- **Added**: the `tree.list` reverse callback, `{pattern, ignore?}` answered `{paths}` (engine
  ADR-0070, engine v0.3.17). It is additive: `WIRE_PROTOCOL_VERSION` does not change, and an
  engine without it fails only a factory that calls `glob`.
- **Breaking**: `EngineClient` has a required `list(pattern, ignore?)` member, and the
  `Dialect` interface a required `glob`. **Migration**: an `EngineClient` written outside the SDK
  must implement `list` (an in-memory one can answer `[]`), and a `Dialect` object written by
  hand, rather than built with `defineDialect`, must add `glob`. `ContractFake`,
  `runFactoryForTest` and the conformance kit's run vehicle answer `list` as the engine does.

## 0.19.0

### Local dialects and the base-file check

- **Breaking**: the conformance fixture checks fixture data against the dialect's base file
  (A-16). A published dialect's base file is the module its package exports at its root,
  `exports["."]`, picked as the engine's pointer dir picks it: a string, or the first of `bun`,
  `import` and `default`, recursively, with no fallback to `main`. The fixture data must test a
  Dialect that file exports, by reference, as a named or default export; otherwise the fixture
  fails with the new case `base_mismatch`. A base file that throws while it loads fails as
  `fixture_threw`. **Migration**: a 0.18.0 dialect package whose `./conformance` builds a
  Dialect of its own fails `builder sync`; import the Dialect from the package's root module
  instead.
- **Added**: local dialects (CA-18), declared in the workspace as `"ini": { "path", "conformance" }`
  and named by that key. `checkLocalDialect({ name, path, conformance })` from
  `@pbuilder/sdk/conformance` and `pbuilder-conformance --local <name> --conformance <file>
  --path <base file>` run the fixture on one, with the same JSON line and exit codes as
  `--dialect`, `dialect` set to the key and `version` to `""`. A `name` other than the key fails
  as `name_mismatch`, a missing conformance file as `fixture_missing`, and one outside the base
  file's folder, by path or by real path, as `fixture_invalid`. See "A local dialect" in
  `docs/guides/authoring-a-dialect.md`.
- **Added**: the runner's `--dialects` takes a local entry `{kind: "local", name, root, path}`:
  the declaration's key, the folder the engine hashed and the base file. Before the factory
  import the runner requires the base file's real path inside the folder; otherwise it exits 1
  with `the factory does not start because the dialect "<name>" resolves outside the folder of
  its base file`. Published entries keep `{name, version, root}`; an unknown `kind` is bad argv.
  **Migration**: an engine sends local entries with absolute real paths.

### Factory Result

- **Added**: a schematic can declare a Result (A-14, A-15, E-39, E-40, #276). `schema.json` takes
  an optional top-level `result`, a subset of JSON Schema (`type`, `properties`, `required`,
  `items`), and codegen emits `export type Result`. `defineFactory<O, R = void>` returns
  `Promise<R>`; on success it drains the factory, checks the Result, flushes, then sends it. The
  Result must be JSON, at most 1 MiB encoded, and what is sent is a copy parsed from the checked
  encoding; the error never repeats the value. `runFactoryForTest` returns the sent `result`.
- **Changed**: `ir.commit` carries `{result}` only when a Result is declared; a declared `null` is
  sent as `"result": null`, and an undeclared Result sends `{}`. `WIRE_PROTOCOL_VERSION` is
  unchanged.
- **Breaking**: a factory that returns a value without declaring a Result fails with the reason
  `invalid-result`, and nothing is written, a bare `defineFactory(fn)` included. The case you
  will hit is a one-expression arrow that returns by accident:
  `defineFactory(async () => create(...))` returns the handle `create` gives back. A factory that
  returns nothing is still fine when no Result is declared. **Migration**: give the arrow a block
  body, `async () => { create(...); }`, or declare `result` in `schema.json`.
- **Compatibility**: the Result reaches Launch only with engine v0.3.16 or later (CLI v0.15.1 or
  later). An older engine ignores the params of `ir.commit`, so the commit succeeds and the
  Result is dropped.

## 0.18.0

### Author-defined dialects

- **Added**: `@pbuilder/sdk/dialect`, the kit for shipping a dialect of your own (A-16):
  `defineDialect` (with `name` required), `defineOpPack`, `withOps`, `withoutOps`,
  `overrideOps`, `byExtension`, `query` and the Dialect contract's types. The exports map grows
  from 14 entries to 15. See "Shipping your own dialect" in `docs/guides/authoring-a-dialect.md`.
- **Added**: `defineDialect({ name })`. An author-defined dialect is named by the package that
  ships it; compositions keep the name, and the SDK's dialects carry none. A factory may open a
  handle of a named dialect only when the run declares it; otherwise the factory fails when it
  ends, naming the dialect, and nothing is written. `runFactoryForTest` takes
  `declaredDialects`.
- **Added**: the `pbuilder-conformance` bin (CA-13). `pbuilder-conformance --dialect <dir>` runs,
  under Bun, the fixture a dialect package exports as `./conformance`, and prints one JSON line,
  `{"passed","dialect","version","failures":[{"case","reason"}]}`. Exit 0: it passed. Exit 1:
  it ran and failed, a missing fixture (`fixture_missing`) and a `name` that is not the
  package's (`name_mismatch`) included. Exit 2: it could not run. The report never repeats the
  author's code or values. `checkDialectPackage(dir)` from `@pbuilder/sdk/conformance` runs the
  same check.
- **Added**: the runner flag `--dialects <json>`, the Frame's `[{name, version, root}]`, and the
  matching `BridgeParams.dialects`. Before the factory import the runner resolves each declared
  name from the factory's location and requires its real path inside `root`; otherwise it exits
  1 with `the factory does not start because the dialect "<name>" resolves outside the package
  the Lock pins`. **Migration**: an engine that checks the runner's accepted flags must accept
  `--dialects`; without the flag no author-defined dialect is declared.

### Dialect handles

- **Added**: `.inspect(ast => value)` on every Dialect handle, the read escape hatch: it returns
  what its callback returns and must not change the AST (#273). **Breaking**: an op or a query
  named `inspect` now fails at composition with `op-pack composition failed: op "inspect"
  collides with a reserved handle verb`.
- **Changed**: `defineDialect` checks a base dialect's own ops against the reserved handle verbs,
  as `withOps` already did for packs (#268). **Breaking**: a base op named after a handle verb,
  such as `read`, now throws when the dialect is built instead of replacing the verb silently.
- **Fixed**: several handles on one file keep every edit (A-7, #264, #266). A handle re-reads and
  re-parses when another writer changed its file; a write that lands while an async op or
  `.modify()` runs rejects, naming the file.
- **Added**: `DialectAst.retire(ast)` and the conformance fixture's `staleNode` (A-8, #265). A node
  kept from before a re-parse fails when used instead of editing a tree no file reflects.

### .NET dialects

- **Added**: msbuild `addProject(path, { folder? })` adds a project to a `.slnx` solution (#263).
- **Changed**: aspnet `addService` takes `implementation` as optional and writes the single-type
  `Add<L><S>()` when it is left out or equals `service` (#263). **Behaviour change**:
  `Add<L><S>()` and `Add<L><S, S>()` count as the same registration, so the op no longer adds a
  duplicate of either.

## 0.17.0

### C#, ASP.NET and MSBuild dialects

- **Added**: `@pbuilder/sdk/csharp` edits `.cs` files (architecture rules A-106 to A-114):
  - `addUsing(namespace, { static?, global?, alias? })`
  - `addBaseType(typeName, base, { from? })`
  - `addMember(typeName, source)`
  - `addConstructorParameter(typeName, name, type, { from? })`

  `from` names the namespace that declares a type, and the op adds its `using` unless the file
  already sees it. `addConstructorParameter` edits primary constructors only; a type with an
  explicit constructor rejects. The parser is tree-sitter-c-sharp 0.24.0 compiled to
  WebAssembly, so the SDK ships no native binary. Importing the entry loads the grammar with a
  top-level `await`. See `docs/guides/csharp-dialect.md`.
- **Added**: `@pbuilder/sdk/aspnet` extends the C# dialect with
  `addService(lifetime, service, implementation, { serviceFrom?, implementationFrom?, method? })`
  (A-115, A-116). It registers a service in the top-level statements of `Program.cs`, or in the
  named `this IServiceCollection` extension method. See `docs/guides/aspnet-dialect.md`.
- **Added**: `@pbuilder/sdk/msbuild` edits `.csproj`, `.props`, `.targets` and `.slnx` files
  with `addProjectReference(path)` (A-117, A-118). It edits the XML text and never calls the
  `dotnet` CLI. A classic `.sln` file is rejected; use `.slnx`. See
  `docs/guides/msbuild-dialect.md`.
- **Added**: the runtime dependencies `web-tree-sitter` 0.27.2 and `saxes` 6.0.0.
- **Changed**: the package ships the C# grammar,
  `dist/bounded-contexts/authoring/infrastructure/out/dialects/csharp/tree-sitter-c_sharp.wasm`
  (7.2 MB, MIT, with its license file next to it), so the unpacked package grows by about that
  much.

### Runner manifest

- **Changed**: `dist/runner-manifest.json` lists the C# grammar, so it holds 30 records instead
  of 29. This is the first record that is not runner startup code: the C# entry loads the grammar
  at import, so a run that uses the dialect reads that file (rules R-3 and R-7).
  **Migration**: an engine that checks the manifest against its own list of expected files, or
  that expects every record to be a `.js` file, must accept the `.wasm` record. An engine that
  verifies each listed digest needs no change.

## 0.16.0

### Conformance kit checks idempotency (breaking)

- **Changed**: `testOpPack` applies each exercise's chain a second time, to the exercise's own
  `expect`, as architecture rule A-11 requires. It rejects the dialect when that second run
  changes the file:
  - `testOpPack: A-11 idempotency — applying the chain [<ops>] again to its own result changed the file; an op whose effect depends on how many times it is applied must be declared with repeatable()`
  - `testOpPack: A-11 idempotency — re-applying the chain [<ops>] to its own result threw: <error>`

  A chain that holds a `.modify()` step or a repeatable op is not checked.
  **Migration**: a dialect op whose effect depends on how many times it is applied (it adds
  again, or it acts on a position) must be declared with `repeatable()`. Any other op must
  leave a file that already has its effect unchanged. `repeatable` and `defineDialect` are not
  in any `package.json` `exports` entry, so only in-repo dialect contributors are affected.
- **Added**: `repeatable(op)` marks an op as exempt from the idempotency check. The JSON and
  YAML `insertItem`, `appendItem`, `removeItem` and `moveItem`, and YAML `addDocument` and
  `removeDocument`, are declared repeatable. Their behaviour is unchanged.

### Release

- **Added**: the release pipeline also checks rule R-8 and the dependency half of R-3 on the
  packed tarball: `bin.pbuilder-codegen` is `dist/bin/pbuilder-codegen.js` and the file
  exists, `engines.node` is set, and every declared dependency resolves from an ancestor
  `node_modules` of the installed root.

## 0.15.1

### Runner

- **Changed**: the runner now waits at most `GREETING_TIMEOUT_MS` (30 000 ms) for the host's
  `ready` greeting, and exits 3 when it expires. A host can change the bound with
  `RunnerIo.greetingTimeoutMs`. It used to wait forever.
- **Changed**: when stdin closes before the greeting arrives, the runner exits 3 (transport
  fault) instead of 1 (author fault). A frame that arrives but is not a valid greeting still
  exits 1. Both notes go to plain stderr without the `pbuilder-runner: ` sentinel, so the exit
  code decides the classification.
  **Migration**: a host that classifies runner exits must treat these two cases as transport
  faults. The engine agreed to both changes and to the 30 s default.
- **Fixed**: a read left parked when a run ended could swallow the next run's greeting in the
  same process. The runner closes its reader at run end, and the parked read hands its chunk
  to the next run.

### Scaffold

- **Changed**: `scaffold()` checks the `to` prefix and every `rename` value against the
  portable file-name rule (A-17), as it already did for source paths under `from`. Names such
  as `con.ts`, `out/AUX` or `src/a|b.ts` now reject with `invalid-input`:
  - `invalid input: scaffold rename value "<value>": the name "<n>" breaks the rule "<rule>"`
  - `invalid input: scaffold "to" "<value>": the name "<n>" breaks the rule "<rule>"`

  `.` and empty components are skipped, so `to: "."` and `to: "./out"` still work.
  **Migration**: a schematic that wrote such a name must choose a portable one. The engine
  would not have created it on every platform anyway.

### Dialects

- **Fixed**: a new array or object inserted by a JSON op is laid out like the other array or
  object values in the same container. When they all sit on one line, the new value is written
  on one line too, for example `{"z": 3, "w": "v"}`. Otherwise it is written across lines, as
  before.

### Release

- **Added**: the release pipeline fails when the packed tarball breaks architecture rule R-3:
  `dist/runner-manifest.json`'s `entry` and every path it lists must exist in the `npm pack`
  output. That manifest is the SDK's whole distribution contract; no other `dist/` path is part
  of it. builder v0.12.1 and later check the same rule, so they accept 0.15.x roots. builder
  v0.12.0 refuses them because it requires `dist/transport`.

## 0.15.0

### `scaffold` copies only the files you declare in `binary` (breaking)

- **Breaking**: `scaffold()` no longer decides by itself which files to copy byte for byte. It
  used to copy a file that was not valid text, or that did not fit one emit frame once
  rendered, so a large text file could reach the workspace with its template tokens
  unrendered, and the options' size could change the outcome. Now a file is copied
  (`copyIn`) only when it matches one of the new `binary` globs, matched like
  `include`/`exclude` against the original path inside `from`. Every other file renders, and a
  file that cannot render rejects with `invalid-input`, naming it:
  - a file that is not valid UTF-8 text: `invalid input: source "<path>" is not valid text, so
    it cannot be rendered`, with a `binary: ["<pattern>"]` suggestion;
  - a file whose `create`, options included, does not fit one emit frame: the message gives its
    size in bytes and the limit;
  - a file both marked `.template` and declared `binary`.
  A `binary` glob that matches nothing is allowed.
  **Migration**: list the files a `scaffold` call should copy in `binary`, for example
  `scaffold({ from: "files", to: "src", binary: ["**/*.png"] })`. A text file over the frame
  limit must be made smaller, or declared `binary` if it needs no rendering.

### Authoring errors

- **Changed**: an option value `create()` or `scaffold()` cannot encode now rejects with an
  `AuthoringError` (`reason: "invalid-input"`, `verb: "create"`, `path` set to the file's path)
  instead of a plain `Error`. The message is unchanged. Code that tells the two apart with
  `instanceof AuthoringError` must handle the new case.
- **Changed**: an object with a `toJSON` method is rejected as such
  (`an object with a toJSON method at <path>`), since options are plain data. Convert the value
  before passing it.
- **Fixed**: a getter or proxy that throws, or a value nested too deeply to walk, rejects with
  the option's message instead of surfacing its own error or a stack overflow.
- **Fixed**: a factory that throws `undefined` or `null` now fails the run with an `Error` that
  says what was thrown. `runFactoryForTest` used to report it as success.

### Dialects

- **Changed**: `addFunction`, `addVariable` and `addClass` leave the file as it is when it already
  has the declaration they would write, compared token by token. Running a schematic twice no
  longer fails. Any other declaration of that name still rejects.
- **Changed**: React's `addArrayElement` and `addClassProperty` parse the author's code as the
  file's own language. JSX now works in `.tsx` and `.jsx`, and type syntax such as `x as T` is
  rejected in a `.jsx` file, which cannot hold it.
- **Changed**: when a NestJS module op, an Angular `imports` list, Angular `addRoute` or an
  Angular member op adds an import whose name is taken, the rejection names the op you called,
  such as `addProvider("C")`, instead of `addImport("C")`.
- **Fixed**: TypeScript's `addReExport`, `addExportAll`, `addVariable` and `addClassProperty`
  follow the file's semicolon style, as the import ops already did.
- **Fixed**: a new import in a file that starts with a shebang goes below the shebang line.
  The op used to throw, or drop the shebang when nothing followed it.
- **Fixed**: `addClassProperty` accepts reserved words such as `default` as property names.
- **Fixed**: `addExportAll` and `removeExportAll` reject a `null` or non-string `as` instead of
  adding a duplicate `export *`, and report a bad `as` under `as`. `removeImport`,
  `removeExport` and `removeExportAll` accept reserved words in the name they look up, so
  `removeImport("default", "m")` removes `{ default as x }`.
- **Fixed**: JSON's `sortKeys` keeps the spacing of an object written on one line.
- **Fixed**: JSON content merged or set into an empty object written on one line (`"jest": {}`)
  is expanded with the file's indentation in a multi-line file.

### Testing, codegen and runner

- **Added**: `RunResult.reads` from `runFactoryForTest` counts the reads the engine served for
  each path, so a test can check that a factory reads a file once.
- **Fixed**: `pbuilder-codegen` rejects an `enum` whose `choices` hold anything but strings,
  naming the property, instead of generating a type no input can satisfy.
- **Fixed**: the runner reports a too-deeply-nested `--input-file` as invalid JSON and exits 1,
  instead of crashing with exit code 4.
- **Docs**: the README notes that until engine#227 lands, `builder execute` rejects a second write
  to the same path in one run with `path-collision`, which `runFactoryForTest` does not model.

## 0.14.0

### `scaffold` rejects names that are not portable (breaking)

- **Breaking**: `scaffold()` checks every file and folder name under `from` as written on disk,
  including names `include`/`exclude` would drop, and rejects the call with `invalid-input` when a
  name holds `{=` or `=}`, holds `|`, `"`, `<`, `>`, `:`, `?`, `*`, `\` or a control character, is a
  Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM0`–`COM9`, `LPT0`–`LPT9`, `COM`/`LPT` followed
  by `¹`, `²` or `³`, in any letter case, with or without an extension), or ends in a dot or a
  space. The error reads `invalid input: scaffold file name "<path>": the name "<name>" breaks the
  rule "<rule>"`, plus ` (<character>)` for a forbidden character; with several bad names, the
  first in byte-wise order is reported. Nothing is scheduled for the call.
  **Migration**: rename such files; write a `{= .name =}` path with the `__name__` token form.
- **Changed**: a file-name token's key starts with a letter, so `___name__.ts` becomes
  `_{= .name =}.ts` (was `{= ._name =}.ts`). This applies to `to` and `rename` values too.

## 0.13.0

### `create` options cross the wire as native JSON (breaking)

- **Breaking**: array and object `create` options now reach the engine as native JSON, not as
  JSON strings, for `create()`, `create({ templateFile })` and `scaffold()` by-value files.
  Recorded batches from `@pbuilder/sdk/testing` show the native value you passed:
  `options.methods` is `[{ name: "load" }]`, no longer `'[{"name":"load"}]'`. Strings, numbers,
  booleans and `null` pass through unchanged, and non-JSON values still reject when `create` is
  called. A `NaN` or `Infinity` nested in an array or object option now fails the batch as
  unrepresentable content in `@pbuilder/sdk/testing` instead of becoming `null`.
  **Migration**: tests that assert on a composite option as a JSON string must assert on the
  native value. Pass arrays and objects natively instead of calling `JSON.stringify` on them:
  once the engine drops its string-to-JSON promotion (engine#286), a stringified option renders
  as the string it is. The engine can drop that promotion only after it pins this release.

## 0.12.0

### `.jsx` files and per-extension dialects

- **Added**: `react.find()` accepts `.jsx` files, parsed as JavaScript with JSX, with the same
  handle as `.tsx`. On `.jsx`, `addTypeImport`, `addComponentProp` and `addClassProperty`'s
  `scope`/`readonly` reject, leaving the file unchanged.
- **Added**: dialect kit — `byExtension` routes one `find` to a dialect per file extension, each
  with its own AST and ops (longest extension first); `withoutOps` keeps named ops on the
  handle but rejects them at call time; `overrideOps` swaps named ops for same-signature
  implementations. See "One `find` for several extensions" in `docs/authoring-a-dialect.md`.
- **Changed**: React's extension rejects name both extensions. `.tsx is the only extension the
  React dialect supports` now reads `.tsx and .jsx are the only extensions the React dialect
  supports`, and the extensionless reject asks for `an explicit .tsx or .jsx extension`.
  Callers matching that message text must update it.

## 0.11.0

### The React dialect extends TypeScript

- **Added**: `react.find()` now carries every `@pbuilder/sdk/typescript` op next to
  `setJsxProp`, the same way `nestjs` and `angular` do. `.tsx` files gain `addDefaultImport`,
  `addNamespaceImport`, `addTypeImport`, `addFunction`, `addClass`, the remove ops and the rest,
  so `import React from "react"` no longer needs `.modify()`.

  ```ts
  // src/App.tsx: const el = <div />;
  await react.find("src/App.tsx").addDefaultImport("React", "react").setJsxProp("div", "hidden");
  // import React from "react";
  //
  // const el = <div hidden />;
  ```

- **Added**: React JSX ops take a target that can pick one of several same-tag elements:
  `setJsxProp({ tag: "Route", props: { path: '"/users"' } }, "caseSensitive")`. A string prop
  value must equal the attribute's initializer text; `true` matches the prop with any value. A
  tag string still works as before. The type is exported as `JsxTarget`.
- **Added**: `removeJsxProp(target, prop)` removes a prop from the one element `target` names;
  an absent prop is a no-op and a `{...spread}` is never touched.
- **Added**: `addJsxChild(target, jsx)` appends one JSX element or fragment as the last child of
  the one element `target` names, at the siblings' indentation; a self-closing target becomes an
  open/close pair, and a child with the same text already present is a no-op.
- **Added**: `wrapJsxElement(target, wrapper)` wraps the one element `target` names in a
  self-closing JSX element, keeping its props (`'<QueryProvider client={qc} />'`); a target
  already directly inside that tag is a no-op.
- **Added**: `addHookCall(component, statement)` inserts one statement into a component's
  body after its leading hook calls; the component is a top-level `function` or a `const`
  arrow/function expression, and an identical statement already there is a no-op.
- **Added**: `addComponentProp(component, name, type, options?)` adds a prop to a component's
  props type (inline, or an `interface`/`type` literal in the same file) and to its destructured
  parameter; the same name and type is a no-op, a different type rejects.
- **Added**: `renameJsxElement(target, tag)` renames one element's opening and closing tag
  together.
- **Changed**: `react.find().addImport` is now the TypeScript dialect's `addImport`. Merge,
  create, idempotency and collision outcomes are the same, with two differences: a
  self-aliased specifier (`import { X as X } from "m"` + `addImport("X", "m")`) is now a no-op
  instead of a rejection, and the collision error reads like the TypeScript one
  (`a value or import binding named "X" already exists`) instead of naming `` `name` ``.
  Callers matching that message text must update it.

### Sorted imports

- **Added**: `addImport(name, from, { position: "sorted" })` puts the name into its
  alphabetical place inside the braces, and puts a new declaration next to its folder siblings,
  before the first of them that sorts after it. Order is case-insensitive, with package
  specifiers ahead of relative ones. Existing imports never move. Without the option,
  `addImport` behaves exactly as before; any other `position` value is rejected.

  ```ts
  // import { BookOpen, Users } from "lucide-react";
  // import { authorHandlers } from "./domains/authors.mock";
  // import { config } from "./config";
  await ts.find("src/mocks/handlers.ts")
    .addImport("LayoutDashboard", "lucide-react", { position: "sorted" })
    .addImport("bookHandlers", "./domains/books.mock", { position: "sorted" });
  // import { BookOpen, LayoutDashboard, Users } from "lucide-react";
  // import { authorHandlers } from "./domains/authors.mock";
  // import { bookHandlers } from "./domains/books.mock";
  // import { config } from "./config";
  ```

- **Added**: `sortImports()` sorts a file's import declarations with the same order, and the
  names inside each one's braces, keeping a multi-line layout. It only reorders: it never
  combines, removes or reformats an import. Nothing moves across a blank line, a comment, a
  side-effect import or a declaration with an attached comment, and braces that contain a
  comment keep their order. On a sorted file it writes nothing. The op is available on
  `typescript`, `react`, `nestjs` and `angular`.

## 0.10.2

### Filename tokens

- **Fixed**: filename token translation (`__name__`, `__name@pipe__` in scaffold paths and
  `to`) now runs in linear time. The previous regex backtracked from every start position
  and went quadratic on long runs of near-tokens such as `__A@A@__A@A@…` (CodeQL
  `js/polynomial-redos`).
- **Changed**: a token now ends at the first `__` after it opens, so a field name can no longer
  contain `__` or end with `_`. `__a__b__` translates to `{= .a =}b__` (was `{= .a__b =}`) and
  `__name___` to `{= .name =}_` (was `{= .name_ =}`). Tokens made of plain identifiers, with
  or without pipes, translate exactly as before.

## 0.10.1

### Inserted imports follow the file's style

- **Fixed**: an import inserted by a dialect (`addImport`, `addTypeImport`, `addDefaultImport`,
  `addNamespaceImport`, `addSideEffectImport` on `@pbuilder/sdk/typescript`, and the imports
  the `angular`, `nestjs` and `react` ops add) now uses the edited file's own quote kind and
  statement-terminating semicolons, the way the newline kind already did. Before, every
  inserted import was printed as `import { x } from "m";`, so a file written with single
  quotes and no semicolons ended up with two styles. Quotes follow the file's module
  specifiers; the semicolon is dropped when most top-level statements omit it. A file that
  shows no preference (no imports, or a tie) keeps the old `"..."` and `;` output, so files
  already in that style are unchanged. Existing statements are never reformatted.

  ```ts
  // src/smoke.ts: import { a } from './a'
  await ts.find("src/smoke.ts").addTypeImport("B", "./b").addImport("c", "./c");
  // import { a } from './a'
  // import type { B } from './b'
  // import { c } from './c'
  ```

## 0.10.0

### Dialect queries

- **Added**: queries, a second kind of dialect operation. An op-pack entry wrapped in `query(fn)`
  becomes a handle method that ends the chain and resolves to `fn`'s result (`Promise<R>`)
  instead of returning the handle. It runs in chain order on the live AST, so it sees every op
  chained before it; it writes nothing, and those ops still coalesce into one `modify`. A query
  is contained like an op, and one that changes the file rejects with `<name>() is a query and
  must not change "<path>"` and fails the run. Existing ops, op-packs, `withOps` and every
  shipped dialect are unchanged. Guide: `docs/authoring-a-dialect.md`.
- **Added**: `getDeclaration(target, property)` on `@pbuilder/sdk/css` handles, the first query.
  It resolves to `{ value, important }` or `undefined`. The plain
  `getDeclaration(root, target, property)` export stays for use inside `.modify(fn)`.

  ```ts
  const primary = await css
    .find("tokens.css")
    .setDeclaration({ atRule: "theme" }, "--color-primary", "#1974f9")
    .getDeclaration({ atRule: "theme" }, "--color-primary"); // { value: "#1974f9", important: false }
  ```

## 0.9.0

### New subpath: `@pbuilder/sdk/css`

- **Added**: the CSS dialect, built on PostCSS. It edits `.css` files declaration by declaration,
  for example to sync design tokens from a JSON export into a file that also holds hand-written
  `@import` and `@custom-variant` lines, and leaves every other byte alone. A target names one
  top-level block: `{ selector }`, `{ atRule, params? }` (such as `@theme`), or a selector inside
  an at-rule. Guide: `docs/css-dialect.md`.
  - `setDeclaration(target, property, value, options?)` updates a declaration in place or adds
    it, last in its block or next to a `before` / `after` anchor; a missing block is created at
    the end of the file, after any `@import`. `important: true` writes `!important`. Setting the
    current value writes nothing.
  - `removeDeclaration(target, property)` removes a declaration; a missing one is a no-op.
  - `getDeclaration(root, target, property)` is an exported function, not an op, that reads
    `{ value, important }` from a parsed `Root`, such as the one `.modify(fn)` receives.

  ```ts
  await css
    .find("tokens.css")
    .setDeclaration({ atRule: "theme" }, "--color-primary", "#1974f9")
    .setDeclaration({ selector: "html[data-theme='nylon']" }, "--color-primary", "#0b254d");
  ```

- **Added**: `postcss` 8.5.30 as an exact-pinned runtime dependency, with its own dependencies
  `nanoid`, `picocolors` and `source-map-js`.

## 0.8.0

### Angular dialect: `@NgModule`

- **Added**: `addNgModuleImport`, `addDeclaration`, `addNgModuleProvider`, `addNgModuleExport` and
  `addBootstrap` on `@pbuilder/sdk/angular`. Each takes `(element, imports?)`, like the component
  ops, and appends to `imports`, `declarations`, `providers`, `exports` or `bootstrap` of the file's
  only `@NgModule`, creating the metadata object or the array when missing. An element already
  listed is a no-op. Guide: `docs/angular-dialect.md`.

  ```ts
  await angular.find("src/app/app.module.ts").addDeclaration("UserCard", [{ name: "UserCard", from: "./user-card" }]);
  ```

- **Changed**: `addRoute` and `addLazyRoute` also find the routes of an NgModule routing file.
  When the file has no top-level variable typed `Routes` or `Route[]`, they use the routes of the
  only `RouterModule.forRoot(...)` or `RouterModule.forChild(...)` call: its inline array, or a
  variable in the same file that it names. A typed variable still takes precedence, and every
  file the ops edited before is edited byte-identically. Migration: a file with a `RouterModule`
  call and no typed variable used to reject and is now edited. The reject for a file with neither
  shape now reads `no top-level variable typed Routes or Route[] and no RouterModule.forRoot or
  forChild call was found`, replacing `no top-level variable typed Routes or Route[] was found`.
  Update any assertion that matches the old text.

## 0.7.0

### New subpath: `@pbuilder/sdk/angular`

- **Added**: the Angular dialect. It edits the `.ts` files of an Angular project, extends
  `@pbuilder/sdk/typescript` the same way `@pbuilder/sdk/nestjs` does, and finds its targets by
  shape, never by file name, so it works with both the `app.ts` and `app.component.ts` naming
  styles. Every op that inserts code takes the imports that code needs as `{ name, from }`, adds
  them with `addImport`'s rules, and is a no-op when the same code is already there. Guide:
  `docs/angular-dialect.md`.
  - **Components**: `addComponentImport(element, imports?)` and
    `addComponentProvider(element, imports?)` append to `imports` / `providers` of the file's
    only `@Component`, creating the metadata or the array when missing.
  - **Root providers**: `addRootProvider(element, imports?)` appends to the `providers` of the
    file's only variable typed `ApplicationConfig`, whatever its name, or else of the
    `bootstrapApplication(...)` config object, which is created when missing. A config passed by
    name rejects and names the module to edit.

    ```ts
    await angular.find("src/app/app.config.ts").addRootProvider({ expression: "provideHttpClient(withFetch())" }, [
      { name: "provideHttpClient", from: "@angular/common/http" },
      { name: "withFetch", from: "@angular/common/http" },
    ]);
    ```

  - **Routes**: `addRoute({ path, component, from })` adds an eager route, and
    `addLazyRoute({ path, loadComponent | loadChildren, export? })` adds a lazy one. Both target
    the file's only variable typed `Routes` or `Route[]`. A new route goes before a `**` route,
    because Angular uses the first route that matches. A different route with the same `path`
    rejects, and so does a `path` starting with `/`. Routes are compared token by token, so a
    single-quoted route is not equal to the double-quoted one the ops write.
  - **Class members**: `addInjection(name, token, options?)` adds
    `private readonly name = inject(token)` to the only `@Component`, `@Directive`, `@Pipe`,
    `@Injectable` or `@Service` class. `addInput`, `addModel` and `addOutput` add
    `readonly name = input<T>(initial)` / `input.required<T>()`, `model(...)` and `output<T>()`.
    `addSignal` and `addComputed` add `protected readonly name = signal<T>(initial)` and
    `computed(() => expression)`. These five need a `@Component` or `@Directive` class. Modifiers
    follow the Angular style guide, and each op imports its function from `@angular/core`.

    ```ts
    await angular
      .find("src/app/user-card.ts")
      .addInput("user", { type: "User", required: true, imports: [{ name: "User", from: "./user" }] })
      .addInjection("http", "HttpClient", { imports: [{ name: "HttpClient", from: "@angular/common/http" }] });
    ```

### TypeScript dialect: `addClassProperty`

- **Added**: `addClassProperty(className, name, initializer, options?)` on
  `@pbuilder/sdk/typescript`, inherited by `@pbuilder/sdk/nestjs` and `@pbuilder/sdk/angular`,
  adds `{scope }{readonly }name = initializer;` to the only class named `className`. `options` is
  `{ scope?: "public" | "protected" | "private"; readonly?: boolean }`. The property goes after the
  class's last property, keeping the members' indentation, so properties stay above the
  constructor and the methods. A property with the same declaration is a no-op, and any other
  member with that name rejects. `initializer` must parse as exactly one expression and is
  otherwise author-trusted. Guide: `docs/authoring-a-dialect.md`.

## 0.6.0

### TypeScript dialect: `addArrayElement`

- **Added**: `addArrayElement(locator, element)` on `@pbuilder/sdk/typescript`, inherited by
  `@pbuilder/sdk/nestjs`, appends an element to an array literal nested inside the file — a
  `providers` list in an Angular `appConfig`, the second argument of `bootstrapApplication`, a
  route's `providers`, or `@NgModule` metadata. The `locator` is a root plus a `path`:
  - the root is `{ variable }` (the initializer of that top-level variable),
    `{ call, argument }` (that argument of the only call to the callee), or `{ decorator }` (the
    argument of the only decorator with that name);
  - each `path` segment is an object key, or a `{ key: "value" }` match that selects the only
    array element whose `key` property is that string. There are no numeric indices. Every step
    looks through `as`, `satisfies`, `<T>`, `!`, and parentheses.

  ```ts
  await ts
    .find("src/app/app.config.ts")
    .addArrayElement({ variable: "appConfig", path: ["providers"] }, { expression: "provideHttpClient()" });
  ```

  The root and every match must select exactly one node. Missing keys are created, and so is the
  next missing call or decorator argument; a missing root, a match that selects nothing, an
  argument past the next one, and a missing key that a spread, a computed key, or an accessor may
  already supply all reject, leaving the file unchanged. The new element follows the list's
  layout. An element already listed is a no-op, compared token by token so spacing, comments, and
  trailing commas do not count. `element` is an identifier, validated like every op's `name`, or
  `{ expression }` for code, which must parse as exactly one expression and is otherwise
  author-trusted, like `addFunction`'s `source`. The op adds no import; pair it with `addImport`.
  Guide: `docs/authoring-a-dialect.md`.

### Fixed

- The NestJS `@Module` ops (`addProvider`, `addController`, `addModuleImport`, `addExport`) no
  longer misplace the new entry when the last entry is followed by a comment containing a comma:
  `[A /* x, y */]` put the entry inside the comment, and `A // a, b` on the last line produced
  invalid TypeScript. Lists without such a comment are edited exactly as before.

## 0.5.1

### NestJS dialect

- **Added**: `@pbuilder/sdk/nestjs` returns a handle with every `@pbuilder/sdk/typescript` op
  plus four `@Module` ops: `addProvider`, `addController`, `addModuleImport`, and `addExport`,
  each taking `(name, from)`. Each op adds `import { name } from "from"` with the `addImport`
  rules, then appends `name` to the matching array of the file's only `@Module` class,
  creating the metadata object or the array when missing; an entry already listed is a no-op.
  The new entry follows the list's layout: one-line lists stay on one line, multi-line lists
  get a new line at the last entry's indentation, and a trailing comma stays trailing. An op
  rejects, leaving the file unchanged, when the file has no `@Module` class or more than one,
  or when the metadata or the target property is not a literal. Guide:
  `docs/nestjs-dialect.md`.

### TypeScript dialect: import and export ops

- **Added**: four import ops on `@pbuilder/sdk/typescript`, inherited by
  `@pbuilder/sdk/nestjs`:
  - `addDefaultImport(name, from)` emits `import name from "from";`, merging into a value
    declaration of `from` that has no default yet (`import name, { a }`,
    `import name, * as ns`). It rejects a second default under another name, a type-only
    `import type name`, and a name bound anywhere else.
  - `addNamespaceImport(name, from)` emits `import * as name from "from";`, merging into a
    default-only declaration (`import Def, * as name`). Beside named imports it opens its own
    declaration. It rejects a second namespace under another name.
  - `addTypeImport(name, from)` always emits its own `import type { name } from "from";`. It
    is a no-op when the module already imports `name`, by value or as a type, inline or not,
    and rejects a local `type`/`interface` of the same name and a name bound anywhere else.
  - `addSideEffectImport(from)` emits `import "from";`, a no-op only when that bare import
    exists.
- **Added**: four export ops for barrel files:
  - `addReExport(name, from)` emits `export { name } from "from";`, merging into a
    non-type-only `export { … } from "from"`. It is a no-op when `from` already re-exports
    `name`, matched by source name, and rejects a name the file already exports any other
    way.
  - `addExportAll(from, { as? })` emits `export * from "from";` or
    `export * as ns from "from";`; each form is a no-op only on its own output, and `as`
    rejects when already exported.
  - `removeExport(name, from)` removes a named re-export, deleting the statement when it was
    the last specifier; absent is a no-op.
  - `removeExportAll(from, { as? })` removes `export *` or its `as` form; absent is a no-op.
- Every new op validates `name` and `as` before the idempotency check, then checks for
  collisions, then edits the file.

### TypeScript dialect: stricter names and collisions

- **Behaviour change**: `removeImport`, `addFunction`, `addVariable`, and `addClass` now
  validate `name` the way `addImport` already did: it must be a plain ASCII JavaScript
  identifier, not a reserved or strict-mode-restricted word, and not `__proto__`,
  `constructor`, or `prototype`. An invalid name rejects before the file changes, and
  `removeImport` rejects it even when nothing would have been removed.
  **Migration**: a schematic that passed such a name produced broken or injected TypeScript;
  pass a valid identifier, or make the edit with `.modify()`. Non-ASCII names such as `café`
  now reject too. `removeImport("default", "m")` can no longer remove
  `import { default as x } from "m"`; use `.modify()` for that edit.
- **Behaviour change**: `addVariable`'s `kind` option rejects any value other than `"const"`,
  `"let"`, or `"var"`, including one forced past the type with a cast.
- **Behaviour change**: `addFunction`, `addVariable`, and `addClass` now reject a name already
  bound by a default import (`import X from "m"`) or a namespace import
  (`import * as X from "m"`), as they already did for named imports. Before, they emitted a
  duplicate binding TypeScript rejects.
- `source` and `initializer` arguments are code bodies and stay unvalidated, author-trusted
  input.

### Fixed

- Conformance corpus: the `m2-create-composition` fixture's `create-composite` case now
  declares `writtenPaths: ["create-composite.txt", "generated.txt"]` and ships both files in
  `expected-composite/`, because the fixture-level `lowering` stages `generated.txt` for every
  case. The rendered bytes of `create-composite.txt` are unchanged.

## 0.5.0

### JSON and YAML dialects

- **Added**: `@pbuilder/sdk/json` edits `.json` and `.jsonc` files by path through fifteen
  named ops: `setValue`, `addKey`, `removeKey`, `renameKey`, `insertItem`, `appendItem`,
  `removeItem`, `removeValue`, `replaceItem`, `moveItem`, `merge`, `updateValue`,
  `moveValue`, `copyValue`, and `sortKeys`, with `before`/`after` placement for new keys.
  Edits touch only the bytes they change: comments, indentation, key order, line endings,
  and the BOM survive, and a line comment travels with its member. `astLibrary` is
  `jsonc-parser`. Guide: `docs/json-dialect.md`.
- **Added**: `@pbuilder/sdk/yaml` edits `.yaml` and `.yml` files with the same structural ops
  plus `setComment`, `removeComment`, `setAnchor`, `removeAnchor`, `setAlias`,
  `addMergeKey`, `setStyle`, `setTag`, `addDocument`, and `removeDocument`; every op takes a
  `{ document }` option for multi-document files. A document no op touched prints
  byte-identical; a touched document is re-serialized by the `yaml` library, whose known
  normalizations are listed in `docs/yaml-dialect.md`. `astLibrary` is `yaml`.
- Values passed to either dialect are typed `JsonValue`/`YamlValue` and validated at
  runtime; `undefined`, functions, non-finite numbers, class instances, and cycles reject
  before the file changes.
- **Dependencies**: `jsonc-parser@3.3.1` and `yaml@2.9.1` join `ts-morph` as exact-pinned
  runtime dependencies. Neither has transitive dependencies or install scripts.

### Dialect extensions (breaking)

- **Breaking**: every dialect's `find` now rejects a path whose basename does not end in an
  extension the dialect declares, throwing synchronously with
  `dialect operation failed: find("<path>") — the file's extension is not one this dialect declares (<extensions>).`
  The check lives in `defineDialect` and `withOps`, so it applies to every dialect built with
  the kit. `@pbuilder/sdk/typescript` therefore rejects `a.js` and `a.tsx`; the React
  dialect keeps its own messages. Several dialects may still declare the same extension.
  **Migration**: open `.tsx` files with `@pbuilder/sdk/react`, and edit files of other types
  through `@pbuilder/sdk/commons` (`find` + `replaceContent`). A contributor dialect must
  declare every extension it intends to open.
- **Breaking**: `testDialect` fails a dialect whose published `find` accepts an undeclared
  extension.

### Conformance fixture (breaking)

- **Breaking**: the mandatory adversarial samples that `testDialect` and `testOpPack` inject
  are now format-neutral. Instead of six fixed TypeScript sources, the kit derives four from a
  source the dialect declares valid (`libraryExercise.seed` for `testDialect`,
  `exercises[0].seed` for `testOpPack`): the empty file, and CRLF, UTF-8 BOM, and 4 MiB
  variants of that seed. Non-TypeScript dialects can now pass the fixture.
  **Migration**: a TypeScript-family dialect that relied on the removed samples
  (comment-only file, two imports from one module, 4 MiB block comment) should add them to
  its own `samples`. A dialect must also round-trip the empty file.
- **Breaking**: the shared parse-failure message is now `could not parse "<path>"`, without
  `as TypeScript`. **Migration**: update assertions that matched the old text.

### Package

- **Added**: the package ships `schemas/project-builder.schema.json`, the path
  `builder init` writes into `project-builder.json`'s `$schema`, so editors validate and
  autocomplete the file once `@pbuilder/sdk` is installed.

### Fixed

- `create(path, { template | templateFile })` called without `options` (plain JavaScript, or
  TypeScript run without a typecheck) sends `{}` instead of `undefined`. The batch was
  previously rejected with `reason: "unrepresentable-content"`. Typed callers are unaffected.
- The error text an operator sees when a factory throws a plain `Error` scrubs paths by
  anchoring on the project root and the SDK package root (each also under its realpath),
  shown as `<project-root>` and `<sdk>`. A path glued to the previous word no longer leaks,
  non-`file:` URLs pass through unchanged, `file://` URLs keep their scheme, and a lone `\\`
  in prose is left alone. Other POSIX paths keep the `../` form; Windows and UNC paths still
  become `<outside-project>`.

## 0.4.0

### Ubiquitous language (breaking)

The author surface now uses the Authoring vocabulary: a Dry Run and a Plan belong to the
engine's execution, and the per-factory-invocation aggregate is the Session, not a run.

- **Breaking**: `dryRun()` is renamed `pendingDirectives()`, with no alias. Its entry type
  `DryRunEntry` is renamed `PendingDirective`, and `DryRunVerb` is removed in favour of the
  identical `AuthoringVerb`. All three were exported from `.` and `./commons`.
  **Migration**: `import { pendingDirectives, type PendingDirective, type AuthoringVerb } from "@pbuilder/sdk/commons";`
  and replace each call to `dryRun()` with `pendingDirectives()`. The returned entries keep
  the same `{ verb, path, kind? }` shape.
- **Breaking**: the `AuthoringReason` value `"outside-run"` is now `"outside-session"`.
  **Migration**: rename the `case "outside-run":` arm of an exhaustive `switch` over
  `error.reason`; the message and `origin` are unchanged.
- **Breaking**: the cross-realm registry key that pins the single ambient context changed
  from `@pbuilder/sdk:core/context#run-als` to `@pbuilder/sdk:core/context#session-als`.
  **Migration**: every copy of the SDK loaded into one process must be on 0.4.0; a 0.3.x
  copy beside it no longer shares the ambient context.
- Docs: `docs/dry-run.md` is now `docs/pending-directives.md`.

## 0.3.1

### Package resolution

- **Fixed**: `package.json` declares `main` alongside the existing `exports` map. Bun's
  `NODE_PATH` resolution leg does not consult `exports`, so a factory located outside the
  workspace could not resolve `@pbuilder/sdk` on either leg the runner depends on — neither
  its own ESM bare-specifier `import`, nor the `createRequire(anchorUrl).resolve()` that
  `probeSingleInstance` performs before it. This blocked engine ADR-0064
  (`external-factory-node-path`) and schematic collections living outside the workspace.
  **Migration**: none. `exports` still takes precedence wherever it is honoured, and `main`
  points at the same umbrella entry as `exports["."]`; only the legacy `NODE_PATH` leg,
  which ignores `exports` today, newly resolves.
- Consumers who saw the split-module-graph diagnostic *"split module graph breaks the
  single-instance ALS pin"* from an external factory were most likely hitting this: with no
  resolution through `NODE_PATH`, Bun's auto-install silently supplied a second copy from
  its global cache and the probe correctly failed closed on the wrong symptom.

## 0.3.0

### Dialect AST libraries

- **Added**: `@pbuilder/sdk/typescript` and `@pbuilder/sdk/react` export their complete
  AST library as `astLibrary` at the existing dialect entrypoints, including runtime
  helpers and upstream types. Use each namespace with its own dialect's AST; no
  cross-dialect or cross-installation identity is guaranteed. Application `.modify()`
  callbacks still receive only the AST; `find`, named ops, and inference are unchanged.
- **Changed (breaking)**: Every dialect must expose its complete own library as
  `astLibrary`. `DialectFixture` / `testDialect` now require `module`,
  `expectedAstLibrary`, and `libraryExercise` in addition to `dialect` and `samples`.
  **Migration**: pass the actual imported dialect entrypoint, independently resolved
  adapter-library evidence, and a byte-exact editing exercise. Export the library with
  native namespace forwarding, not a curated object or type-only export. See
  [fixture migration](./docs/guides/authoring-a-dialect.md#mandatory-module-export-and-fixture-migration)
  for a complete example. `testOpPack` and application callbacks need no migration.

### Project-wide type generation

- **Added**: `pbuilder-codegen` with no arguments discovers the nearest
  `project-builder.json` upward from the current directory. `--project <directory>`
  selects that directory explicitly. Both process all registered collections; the
  existing positional single-directory mode remains available.
- Direct schematic directories and collection manifests are supported without importing
  or executing factories. Canonical directory aliases are deduplicated. Destinations
  outside the selected project root and symbolic-link outputs are refused.
- Independent entries continue after failures, with warnings on stderr and a
  generated/failed/duplicates summary on stdout. Any failure yields exit status `1`;
  successful writes remain in place. See
  [project-wide type generation](./README.md#project-wide-type-generation) for registration
  formats, discovery rules, and write-boundary limitations.

### File handling

- **Fixed**: On Linux and macOS, codegen refuses symbolic-link and nonregular outputs
  and checks the opened file before truncating or writing. Ordinary creation and
  overwrite behavior are preserved. This is not a universal filesystem sandbox or
  equivalent Windows writer hardening.
- **Fixed**: `pbuilder-runner --input-file` rejects nonregular inputs before reading.
  Regular files, including symlinks to regular files, retain their existing behavior.

### Dependencies and tooling

- Updated the locked `brace-expansion` dependency from `5.0.7` to `5.0.9`.
- Pinned local Verdaccio to `6.10.3` and switched `registry:up` to the installed binary.
  CI and publish-workflow Bun versions are pinned to `1.3.14`.

## 0.2.4

### Diagnostics

- **Changed**: `pbuilder-runner` now reports plain `Error` messages on stderr instead of
  the generic `run failed`, with best-effort absolute-path scrubbing and the existing
  message-length limit. Exit codes and the fallback for non-`Error` thrown values are
  unchanged. Scrubbing is not a security boundary; authors must keep secrets out of error
  messages.

## 0.2.3

### Documentation

- **Fixed**: JSDoc examples on `CreateOptions`, `create`, the `Directive` wire type,
  `defineFactory`, and the testing harness showed `{{name}}`-style template placeholders,
  but the engine's template language uses `{= .name =}` delimiters. These examples ship in
  the published type declarations, so editor hover docs taught a syntax that never renders.
- README rewritten as a zero-to-schematic onboarding guide: deterministic-codegen
  positioning, CLI/SDK/engine execution-flow diagram (commit and apply phases), verified
  install paths (Homebrew tap, Linux tarball fallback, Windows not-yet-supported note), a
  live-tested walkthrough, the seven mutation verbs, the template language, scaffold with
  dynamic filename tokens, testing, and both shipped dialects including `.modify()`.
- `docs/quickstart.md` aligned with the published package: npm-first install, the
  default-export rule for CLI-executed factories.
- Package description named a verb that no longer exists (`modify` → `replaceContent`).

## 0.2.0

### Behaviour Changes — package-local read containment removed (ADR-0077)

**Fixed**: A schematic package no longer needs a `collection.json` ancestor to run.
Previously `defineFactory({ packageDir })` walked upward for a `collection.json` marker
and failed the run before the factory body executed when none was found — which is every
inline-collection project, where the collection lives inside `project-builder.json` and
no `collection.json` ever exists on disk. `packageDir` is now the sole run anchor.

**Changed (breaking)**: `AuthoringReason` narrows from twelve members to eleven:
`source-outside-package` is removed. **Migration**: delete the `case
"source-outside-package":` arm from any exhaustive `switch (err.reason)` — TypeScript will
point at it. A source path with a literal `..` segment or an absolute path now rejects
`invalid-input` (it rejected `source-outside-package` before, but was always rejected —
this is a reason change, not a new rejection). A source that resolves outside the package
through an in-package symlink is **no longer rejected by the SDK at all**.

**Changed**: The SDK no longer resolves package-local source paths through a disk-canonicalization pass, so an in-package symlink pointing outside `packageDir` is no
longer rejected by the SDK. Whether such a source is rejected at all now depends on the
engine's own apply-time ceiling re-derivation — the SDK makes no claim either way. See
[SECURITY.md](./SECURITY.md) for the v1 trust model.

**Changed (breaking, ruling 16 follow-through, 2026-07-29)**: A `from` root that is itself a symlinked directory now rejects `invalid-input` — previously it was
followed transparently, the walk enumerating whatever the link happened to point at. This
check inspects only `from`'s FINAL path component — a symlink at a MID-path segment (e.g.
`from: "link/sub"`) is not detected and remains the documented SECURITY.md residual.
**Migration**: replace the symlinked `from` with a real directory, or point `from` directly
at the symlink's target path (relative to `packageDir`) — a `scaffold({ from })` call whose
root's FINAL component resolves through a symlink no longer walks the target's content;
a symlink earlier in the path is unaffected by this change.

**Changed (breaking, ruling 17, 2026-07-29)**: A `from` value that refers to the
package directory itself — the literal `""`, `"."`, or `"./"` forms — previously
resolved to `packageDir` and walked the ENTIRE package silently; all three now reject
`invalid-input` (`folder-scaffold` REQ-FSC-11). **Migration**: name the intended
subfolder explicitly — there is no shorthand for "mirror the whole package."

**Fixed (round-3 error-handling hardening, 2026-07-29)**: five `scaffold` gaps closed
in one batch:

1. A `rename` value containing a literal `..` segment now rejects BEFORE the join
   against `to` — previously, when `to`'s own depth happened to normalize the `..`
   away, the file silently relocated OUTSIDE `to` instead of rejecting
   (`folder-scaffold` REQ-FSC-02).
2. `include`/`exclude` must now be arrays of strings — a non-array value used to throw
   a raw, unbranded `TypeError`, and a non-string element silently compiled into an
   always-empty-matching pattern; both now reject `invalid-input` at entry.
3. A `scaffold` call made outside any run now reports `outside-run` (previously
   `invalid-input`), matching `copyIn`'s existing behaviour on the same failure.
4. Intra-scaffold destination-collision detection now keys on the NORMALIZED
   destination path, catching renames that collide only after `.`/`..` normalization —
   previously undetected here.
5. The walk's documented 10,000-entry bound now counts every enumerated directory
   entry, not only files — a directory-only tree was previously unbounded regardless of
   depth or breadth.

### Behaviour Changes — `@pbuilder/sdk/typescript` `addImport`

`addImport`'s naive first-match, unconditional-merge implementation is replaced by the same
CLAIMED four-branch algorithm already shipped and judgment-day-approved for
`@pbuilder/sdk/react` (`REQ-RXD-05`), adapted with one deliberate posture deviation (self-alias)
and TS-specific handling for multi-declaration modules, empty-clause merge targets, side-effect
import coexistence, and directive-prologue placement. `REQ-TSD-01.1`–`.4`'s outcomes are
unchanged, and `addImport`'s call signature (`addImport(name: string, from: string): void`) is
frozen.

**Fixes** — the following inputs previously produced silently broken output; they now reject
with a loud, branded error, or insert correctly, before this change:

1. **Type-only merge** — merging a value-bound name into a type-only import declaration
   (`import type { A } from "m"`) silently produced a type-contaminated clause
   (`import type { A, B }`, making `B` type-only). Now rejected (or routed to a fresh, separate
   declaration when no collision applies).
2. **Cross-module and value-namespace collisions** — a name already bound by a different
   module's import, or already claimed by a top-level `function`/`const`/`let`/`var`/`class`/
   `enum`/`namespace` declaration, was not checked at all; `addImport` would happily create a
   second, colliding binding. Now rejected, file-wide, before any AST mutation.
3. **Aliased-to-a-different-name collisions** — `import { Foo as x } from "m"` followed by
   `addImport("x", "m")` merged a second, unaliased `x` into the same clause, producing an
   invalid duplicate local-name binding. Now rejected.
4. **Same-local-name idempotency against default, namespace, and mixed-declaration shapes** —
   only the named-import clause was checked for an already-bound name; `addImport("Def", "m")`
   against `import Def from "m"` grafted a duplicate `Def` binding
   (`import Def, { Def } from "m"`) instead of no-op'ing. Now a clean no-op, matching the
   already-correct behaviour for plain named imports.
5. **Directive-prologue placement** — inserting a fresh import into a file starting with a
   directive (e.g. `"use client";`) placed the import ABOVE the directive, silently voiding it
   (a directive only takes effect as the file's first-in-scope statement) while leaving the file
   syntactically valid. The import is now inserted AFTER the leading directive prologue.

**Restructured (not a fix)** — one case changes shape without becoming more or less correct:

- **Side-effect import coexistence** (`import "polyfill";`) — `addImport("X", "polyfill")`
  previously converted the side-effect statement into a combined form
  (`import X, { ... } from "polyfill"`). It is now left byte-unchanged, and a separate
  `import { X } from "polyfill";` declaration is added instead. Both shapes are valid
  TypeScript with the same net import surface; use `.modify()` if the combined-form output is
  specifically needed.

**Injection-safety** — `addImport`'s `name` argument now runs through the same validation gate
already shipped for `@pbuilder/sdk/react` (`assertValidImportBinding`): a hostile or
grammatically-invalid `name` is rejected before it can reach the AST, closing a confirmed
`name`-splice injection on this op specifically. This closes the injection for `addImport`
only — the sibling ops' (`addFunction`/`addVariable`/`addClass`) `name`/`source`/`initializer`
arguments remain raw-spliced, author-trusted input; tracked separately in
`openspec/pending-changes.md`, out of scope for this change.

**No change** — a shebang file (`#!/usr/bin/env node`) still rejects `addImport` calls with a
contained, fail-closed error (zero directives, target file byte-unchanged) **on the
fresh-create path with no directive prologue** — the only path that inserts at the very top
of the file; this existing behaviour is pinned as a regression guard rather than upgraded to
successful insertion. A shebang file whose import lands via another branch succeeds normally
(merging into an existing import, or creating below a directive prologue — the shebang stays
on line 1 in both). Shebang-aware top-of-file insertion is deferred and tracked as a followup
in `openspec/pending-changes.md` ("ADR-03 shebang-aware insertion, registered at S-004").
