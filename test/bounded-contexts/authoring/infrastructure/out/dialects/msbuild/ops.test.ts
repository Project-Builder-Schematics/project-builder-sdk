import { describe, it, expect } from "bun:test";
import * as msbuild from "../../../../../../../src/dialects/msbuild/index.ts";
import { apply, expectFile, expectReject } from "./harness.ts";

const APP = "../Shop.Application/Shop.Application.csproj";
const add = (path: string) => (h: ReturnType<typeof msbuild.find>) => h.addProjectReference(path);

describe("find — A-117 accepted and rejected paths", () => {
  it.each(["A.csproj", "Directory.Build.props", "Directory.Build.targets", "Shop.slnx", "src/B.csproj"])("accepts %s", (path) => {
    expect(() => msbuild.find(path)).not.toThrow();
  });

  it.each(["Shop.sln", ".csproj", "A.fsproj", "A.xml", "A"])("rejects %s before any op runs, naming the extensions", (path) => {
    expect(() => msbuild.find(path)).toThrow("dialect operation failed: ");
  });

  it("rejects a classic .sln file and leaves it as it is", async () => {
    const sln = "Microsoft Visual Studio Solution File, Format Version 12.00";
    const outcome = await apply(sln, add(APP), "Shop.sln");
    expect(outcome.error?.message).toStartWith("dialect operation failed: ");
    expect(outcome.error?.message).toContain("extension");
    expect(outcome.modifies).toBe(0);
    expect(outcome.after).toBe(sln);
  });

  it("fails the factory on a file that is not well-formed XML and leaves it as it is", async () => {
    await expectReject('<Project Sdk="Microsoft.NET.Sdk">', add("../B/B.csproj"), 'could not parse "A.csproj"', "A.csproj");
  });
});

describe("addProjectReference — A-118 scenario outline", () => {
  it("adds a new ItemGroup after the last child of Project, after a blank line", async () => {
    await expectFile(
      '<Project Sdk="Microsoft.NET.Sdk">\n\n  <PropertyGroup>\n    <TargetFramework>net10.0</TargetFramework>\n  </PropertyGroup>\n\n</Project>',
      add(APP),
      '<Project Sdk="Microsoft.NET.Sdk">\n\n  <PropertyGroup>\n    <TargetFramework>net10.0</TargetFramework>\n  </PropertyGroup>\n\n  <ItemGroup>\n    <ProjectReference Include="../Shop.Application/Shop.Application.csproj" />\n  </ItemGroup>\n\n</Project>'
    );
  });

  it("appends after the last ProjectReference of the ItemGroup that holds one", async () => {
    await expectFile(
      '<Project Sdk="Microsoft.NET.Sdk">\n  <ItemGroup>\n    <ProjectReference Include="..\\Shop.Domain\\Shop.Domain.csproj" />\n  </ItemGroup>\n</Project>',
      add(APP),
      '<Project Sdk="Microsoft.NET.Sdk">\n  <ItemGroup>\n    <ProjectReference Include="..\\Shop.Domain\\Shop.Domain.csproj" />\n    <ProjectReference Include="../Shop.Application/Shop.Application.csproj" />\n  </ItemGroup>\n</Project>'
    );
  });

  it("leaves the file as it is when the same path is referenced with the other separator", async () => {
    const source =
      '<Project Sdk="Microsoft.NET.Sdk">\n  <ItemGroup>\n    <ProjectReference Include="..\\Shop.Application\\Shop.Application.csproj" />\n  </ItemGroup>\n</Project>';
    await expectFile(source, add(APP), source);
  });
});

describe("addProjectReference — placement", () => {
  it("skips an ItemGroup with a Condition and one without a ProjectReference", async () => {
    await expectFile(
      '<Project>\n  <ItemGroup Condition="\'$(X)\' == \'1\'">\n    <ProjectReference Include="X/X.csproj" />\n  </ItemGroup>\n  <ItemGroup>\n    <PackageReference Include="P" />\n  </ItemGroup>\n  <ItemGroup>\n    <ProjectReference Include="A/A.csproj" />\n    <ProjectReference Include="B/B.csproj" />\n  </ItemGroup>\n</Project>\n',
      add("C/C.csproj"),
      '<Project>\n  <ItemGroup Condition="\'$(X)\' == \'1\'">\n    <ProjectReference Include="X/X.csproj" />\n  </ItemGroup>\n  <ItemGroup>\n    <PackageReference Include="P" />\n  </ItemGroup>\n  <ItemGroup>\n    <ProjectReference Include="A/A.csproj" />\n    <ProjectReference Include="B/B.csproj" />\n    <ProjectReference Include="C/C.csproj" />\n  </ItemGroup>\n</Project>\n'
    );
  });

  it("treats a reference in a conditioned ItemGroup as the same path", async () => {
    const source = '<Project>\n  <ItemGroup Condition="true">\n    <ProjectReference Include="A/A.csproj" />\n  </ItemGroup>\n</Project>\n';
    await expectFile(source, add("A\\A.csproj"), source);
  });

  it("opens an empty Project, one unit deeper than it", async () => {
    await expectFile(
      "<Project>\n</Project>\n",
      add("A/A.csproj"),
      '<Project>\n  <ItemGroup>\n    <ProjectReference Include="A/A.csproj" />\n  </ItemGroup>\n</Project>\n'
    );
  });

  it("expands a self-closing Project", async () => {
    await expectFile(
      '<Project Sdk="Microsoft.NET.Sdk" />\n',
      add("A/A.csproj"),
      '<Project Sdk="Microsoft.NET.Sdk">\n  <ItemGroup>\n    <ProjectReference Include="A/A.csproj" />\n  </ItemGroup>\n</Project>\n'
    );
  });

  it("takes tab indentation from the file", async () => {
    await expectFile(
      "<Project>\n\t<PropertyGroup>\n\t\t<A>1</A>\n\t</PropertyGroup>\n</Project>\n",
      add("A/A.csproj"),
      '<Project>\n\t<PropertyGroup>\n\t\t<A>1</A>\n\t</PropertyGroup>\n\n\t<ItemGroup>\n\t\t<ProjectReference Include="A/A.csproj" />\n\t</ItemGroup>\n</Project>\n'
    );
  });

  it("coalesces two references into one modify", async () => {
    await expectFile(
      "<Project>\n  <ItemGroup>\n    <ProjectReference Include=\"A/A.csproj\" />\n  </ItemGroup>\n</Project>\n",
      (h) => h.addProjectReference("B/B.csproj").addProjectReference("C/C.fsproj"),
      '<Project>\n  <ItemGroup>\n    <ProjectReference Include="A/A.csproj" />\n    <ProjectReference Include="B/B.csproj" />\n    <ProjectReference Include="C/C.fsproj" />\n  </ItemGroup>\n</Project>\n'
    );
  });
});

describe("addProjectReference — byte fidelity (A-117)", () => {
  it("keeps the BOM, CRLF, the XML declaration, comments, and attribute quotes", async () => {
    await expectFile(
      "\uFEFF<?xml version='1.0' encoding='utf-8'?>\r\n<!-- build -->\r\n<Project Sdk='Microsoft.NET.Sdk'>\r\n  <ItemGroup>\r\n    <ProjectReference Include='A/A.csproj'/>\r\n  </ItemGroup>\r\n</Project>\r\n",
      add("B/B.csproj"),
      "\uFEFF<?xml version='1.0' encoding='utf-8'?>\r\n<!-- build -->\r\n<Project Sdk='Microsoft.NET.Sdk'>\r\n  <ItemGroup>\r\n    <ProjectReference Include='A/A.csproj'/>\r\n    <ProjectReference Include=\"B/B.csproj\" />\r\n  </ItemGroup>\r\n</Project>\r\n"
    );
  });

  it("escapes the attribute value so it never becomes markup", async () => {
    await expectFile(
      "<Project>\n</Project>",
      add('a&b/<x>"y".csproj'),
      '<Project>\n  <ItemGroup>\n    <ProjectReference Include="a&amp;b/&lt;x&gt;&quot;y&quot;.csproj" />\n  </ItemGroup>\n</Project>'
    );
  });

  it("matches an escaped existing reference by its value", async () => {
    const source = '<Project>\n  <ItemGroup>\n    <ProjectReference Include="a&amp;b/A.csproj" />\n  </ItemGroup>\n</Project>\n';
    await expectFile(source, add("a&b\\A.csproj"), source);
  });

  it.each(["Directory.Build.props", "Directory.Build.targets"])("edits a %s file", async (path) => {
    await expectFile(
      "<Project>\n</Project>\n",
      add("A/A.csproj"),
      '<Project>\n  <ItemGroup>\n    <ProjectReference Include="A/A.csproj" />\n  </ItemGroup>\n</Project>\n',
      path
    );
  });
});

describe("addProjectReference — rejections", () => {
  it("rejects a root that is not Project, naming the op", async () => {
    await expectReject("<Solution>\n</Solution>", add("B/B.csproj"), "addProjectReference", "Shop.slnx");
  });

  it("rejects an empty file, which has no Project root", async () => {
    await expectReject("", add("B/B.csproj"), "addProjectReference");
  });

  it.each([
    ["/abs/A.csproj", '`path` "/abs/A.csproj" is '],
    ["C:\\A\\A.csproj", '`path` "C:\\\\A\\\\A.csproj" is '],
    ["A/A.cs", '`path` "A/A.cs" is '],
    ["A/", '`path` "A/" is '],
    ["", '`path` "" is '],
  ])("rejects the path %p", async (path, fragment) => {
    await expectReject("<Project>\n</Project>\n", add(path), fragment);
  });

  it("rejects a path that is not a string", async () => {
    await expectReject("<Project>\n</Project>\n", (h) => h.addProjectReference(42 as unknown as string), "`path` must ");
  });

  it("names the op in an argument rejection", async () => {
    await expectReject("<Project>\n</Project>\n", add("A.cs"), "addProjectReference");
  });
});
