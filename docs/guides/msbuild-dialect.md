# The MSBuild dialect

`@pbuilder/sdk/msbuild` edits the XML files of a .NET build. It is built for schematics that
scaffold several projects and wire them together, such as the layers of a hexagonal solution:
the op adds a project reference and leaves every other byte of the file alone. It edits the
XML text itself and never runs the `dotnet` CLI.

```ts
import * as msbuild from "@pbuilder/sdk/msbuild";

// src/Shop.Infrastructure/Shop.Infrastructure.csproj:
// <Project Sdk="Microsoft.NET.Sdk">
//   <PropertyGroup>
//     <TargetFramework>net10.0</TargetFramework>
//   </PropertyGroup>
// </Project>
export const run = async () => {
  await msbuild
    .find("src/Shop.Infrastructure/Shop.Infrastructure.csproj")
    .addProjectReference("../Shop.Application/Shop.Application.csproj")
    .addProjectReference("../Shop.Domain/Shop.Domain.csproj");
};
```

Ops chained on one handle coalesce into one pending directive for the file.

## Files

`find` accepts a path whose file name ends in `.csproj`, `.props`, `.targets` or `.slnx` and has
a stem before that extension (`Directory.Build.props`, `Shop.slnx`). Every other path throws
synchronously with the `dialect operation failed: ` prefix, before any op runs. That includes the
classic `.sln` solution format, which is not XML; use `.slnx`.

A file that is not well-formed XML fails the factory with `could not parse "<path>"` and is left
as it is.

## Placement

- A reference goes after the last `ProjectReference` of the first `ItemGroup` without a
  `Condition` that holds one.
- When there is none, a new `ItemGroup` holding it goes after the last child element of
  `Project`, after a blank line. An empty `Project` gets it as its first child, and a
  self-closing `<Project />` is opened to hold it.
- A new element takes the indentation of its siblings, or one unit deeper than its parent when
  it has none. The unit is the first indentation step the file shows between an element and its
  parent, two spaces when the file shows none. The dialect never reads `.editorconfig`.
- A new line uses the file's line ending (`\r\n` when the file has one, else `\n`).

## Named ops

### `addProjectReference(path)`

Adds `<ProjectReference Include="path" />` to a file whose root element is `Project`. `path` is
a relative path whose file name ends in `proj` (`.csproj`, `.fsproj`, `.vbproj`, `.proj`),
written with the separators you give. A reference to the same path anywhere in the file,
comparing `/` and `\` as one separator, leaves the file as it is, so a second run changes
nothing.

```ts
msbuild.find("src/Shop.Api/Shop.Api.csproj").addProjectReference("../Shop.Infrastructure/Shop.Infrastructure.csproj");
// <ItemGroup>
//   <ProjectReference Include="..\Shop.Application\Shop.Application.csproj" />
//   <ProjectReference Include="../Shop.Infrastructure/Shop.Infrastructure.csproj" />
// </ItemGroup>
```

## Rejections

Every rejection throws before the file changes, with the `dialect operation failed: ` prefix and
the op's name:

- a `path` that is not a string, is absolute (`/src/A.csproj`, `C:\A.csproj`), or whose file
  name does not end in `proj`;
- a file whose root element is not `Project`, such as a `.slnx` `<Solution>`, or an empty file.

## Format preservation

A file no op touched prints byte-identical. An edited file changes only the inserted range: the
XML declaration, comments, attribute quotes, blank lines, whitespace, a UTF-8 BOM and the final
newline stay as they are. The value written into `Include` is escaped (`&`, `<`, `>`, `"`), so
it can never become markup.

## The escape hatch: `.modify(fn)`

`.modify(fn)` hands `fn` the live `MsbuildDocument`, whose `text` is the file without its BOM.
Replace `text` for anything the op does not cover. `astLibrary` is the
[`saxes`](https://github.com/lddubeau/saxes) package the dialect parses with; with
`{ position: true }`, its `position` after an `opentag` or `closetag` event is the offset just
past the tag's `>`:

```ts
import * as msbuild from "@pbuilder/sdk/msbuild";

await msbuild.find("Shop.Api.csproj").modify((doc) => {
  const parser = new msbuild.astLibrary.SaxesParser({ position: true });
  let start: number | undefined;
  parser.on("opentag", (node) => {
    if (node.name === "Nullable") start = parser.position;
  });
  parser.on("closetag", (node) => {
    if (node.name === "Nullable" && start !== undefined) {
      const end = doc.text.lastIndexOf("<", parser.position - 1);
      doc.text = `${doc.text.slice(0, start)}enable${doc.text.slice(end)}`;
    }
  });
  parser.write(doc.text).close();
});
```
