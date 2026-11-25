import { defineDialect, defineOpPack, withOps, type Handle } from "../../../../domain/services/define-dialect.ts";
import { parse, print, type MsbuildDocument } from "./ast.ts";
import { addProjectReference } from "./ops.ts";

export * as astLibrary from "saxes";
export type { MsbuildDocument };

type MsbuildOps = {
  addProjectReference: (ast: MsbuildDocument, path: string) => void;
};

const opsPack = defineOpPack<MsbuildDocument, MsbuildOps>({ addProjectReference });

const msbuildDialect = withOps(
  defineDialect({ extensions: [".csproj", ".props", ".targets", ".slnx"], ast: { parse, print }, ops: {} }),
  opsPack
);

/**
 * Opens a `.csproj`, `.props`, `.targets` or `.slnx` file to add project references. The
 * dialect edits the XML text and changes only the bytes it must: the XML declaration, comments,
 * attribute quotes, indentation, line endings, a BOM, and the final newline survive. The classic
 * `.sln` format and any other extension throw synchronously with the `dialect operation failed: `
 * prefix, and a file that is not well-formed XML fails the factory. `.modify(fn)` hands `fn` the
 * live `MsbuildDocument`; edit its `text`, reading offsets with `astLibrary` (`saxes`), for
 * anything the op does not cover.
 *
 * @example
 * import * as msbuild from "@pbuilder/sdk/msbuild";
 *
 * // Shop.Infrastructure.csproj before:
 * // <Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFramework>net10.0</TargetFramework>\n  </PropertyGroup>\n</Project>\n
 * export const run = async () => {
 *   await msbuild
 *     .find("src/Shop.Infrastructure/Shop.Infrastructure.csproj")
 *     .addProjectReference("../Shop.Application/Shop.Application.csproj");
 * };
 * // -> <Project Sdk="Microsoft.NET.Sdk">
 * // ->   <PropertyGroup>
 * // ->     <TargetFramework>net10.0</TargetFramework>
 * // ->   </PropertyGroup>
 * // ->
 * // ->   <ItemGroup>
 * // ->     <ProjectReference Include="../Shop.Application/Shop.Application.csproj" />
 * // ->   </ItemGroup>
 * // -> </Project>
 */
export function find(path: string): Handle<"found", MsbuildDocument, MsbuildOps> {
  return msbuildDialect.find(path);
}
