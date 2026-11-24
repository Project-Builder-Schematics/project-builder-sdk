/**
 * The MSBuild dialect passes the conformance kit. The fixture re-assembles the same real building
 * blocks `src/bounded-contexts/authoring/infrastructure/out/dialects/msbuild/index.ts` composes (its parse/print pair and its named op), never a
 * mock, plus an MSBuild sample corpus.
 */
import { describe, it, expect, setDefaultTimeout } from "bun:test";
import * as expectedAstLibrary from "saxes";
import * as msbuild from "../../src/dialects/msbuild/index.ts";
import { defineDialect, defineOpPack, withOps } from "../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";
import { parse, print, type MsbuildDocument } from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/msbuild/ast.ts";
import { addProjectReference } from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/msbuild/ops.ts";
import { testDialect, testOpPack, type DialectFixture, type OpPackFixture } from "../../src/conformance/index.ts";

setDefaultTimeout(20000);

const opsPack = defineOpPack<MsbuildDocument, { addProjectReference: typeof addProjectReference }>({ addProjectReference });
const baseDialect = defineDialect({ extensions: [".csproj", ".props", ".targets", ".slnx"], ast: { parse, print }, ops: {} });
const realMsbuildDialect = withOps(baseDialect, opsPack);

const LARGE_UNIT = '    <Compile Include="Generated/File.cs" /> <!-- generated -->\n';
const LARGE_SAMPLE = `<Project>\n  <ItemGroup>\n${LARGE_UNIT.repeat(Math.ceil((4 * 1024 * 1024) / LARGE_UNIT.length))}  </ItemGroup>\n</Project>\n`;

const CORPUS = [
  '<Project Sdk="Microsoft.NET.Sdk">\n\n  <PropertyGroup>\n    <TargetFramework>net10.0</TargetFramework>\n  </PropertyGroup>\n\n</Project>\n',
  "<?xml version='1.0' encoding='utf-8'?>\r\n<Project ToolsVersion=\"15.0\" xmlns=\"http://schemas.microsoft.com/developer/msbuild/2003\">\r\n</Project>\r\n",
  "﻿<Project>\n  <!-- a comment with <markup> -->\n</Project>",
  '<Solution>\n  <Project Path="src/A/A.csproj" />\n</Solution>\n',
  "<Project><Target Name=\"B\"><Exec Command=\"echo &quot;&lt;x&gt;&quot;\" /><![CDATA[ <raw> ]]></Target></Project>",
  "",
  LARGE_SAMPLE,
];

describe("conformance kit", () => {
  it("testDialect: the MSBuild corpus plus the kit's samples round-trip byte-exact; astLibrary is saxes", async () => {
    const fixture: DialectFixture<typeof expectedAstLibrary> = {
      dialect: baseDialect,
      samples: CORPUS,
      module: msbuild,
      expectedAstLibrary,
      libraryExercise: {
        path: "library.csproj",
        seed: "<Project>\n  <PropertyGroup>\n    <Nullable>disable</Nullable>\n  </PropertyGroup>\n</Project>\n",
        expect: "<Project>\n  <PropertyGroup>\n    <Nullable>enable</Nullable>\n  </PropertyGroup>\n</Project>\n",
        modify(ast, library) {
          const doc = ast as MsbuildDocument;
          const parser = new library.SaxesParser({ position: true });
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
        },
      },
    };
    await expect(testDialect(fixture)).resolves.toBeUndefined();
  });

  it("XML that is not well-formed fails parse", () => {
    expect(() => parse('<Project Sdk="Microsoft.NET.Sdk">')).toThrow("invalid XML");
    expect(() => parse("<Project></Item>")).toThrow("invalid XML");
    expect(() => parse("<A/><B/>")).toThrow("invalid XML");
    expect(() => parse('<Project A="1" A="2" />')).toThrow("invalid XML");
  });

  it("testOpPack: the named op is byte-exact, coalesces, splits at a read boundary, and is idempotent", async () => {
    const fixture: OpPackFixture = {
      opPack: opsPack,
      baseDialect: realMsbuildDialect,
      exercises: [
        {
          seed: '<Project Sdk="Microsoft.NET.Sdk">\n  <ItemGroup>\n    <ProjectReference Include="..\\A\\A.csproj" />\n  </ItemGroup>\n</Project>\n',
          chain: [
            { op: "addProjectReference", args: ["../B/B.csproj"] },
            { op: "addProjectReference", args: ["../A/A.csproj"] },
            { op: "addProjectReference", args: ["../C/C.csproj"] },
          ],
          expect:
            '<Project Sdk="Microsoft.NET.Sdk">\n  <ItemGroup>\n    <ProjectReference Include="..\\A\\A.csproj" />\n    <ProjectReference Include="../B/B.csproj" />\n    <ProjectReference Include="../C/C.csproj" />\n  </ItemGroup>\n</Project>\n',
        },
        {
          seed: "﻿<Project>\r\n  <PropertyGroup />\r\n</Project>\r\n",
          chain: [{ op: "addProjectReference", args: ["../B/B.csproj"] }],
          expect: '﻿<Project>\r\n  <PropertyGroup />\r\n\r\n  <ItemGroup>\r\n    <ProjectReference Include="../B/B.csproj" />\r\n  </ItemGroup>\r\n</Project>\r\n',
        },
      ],
    };
    await expect(testOpPack(fixture)).resolves.toBeUndefined();
  });
});
