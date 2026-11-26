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

describe("addProject — A-119", () => {
  const SLNX = "Shop.slnx";
  const API = "src/Shop.Api/Shop.Api.csproj";
  const project = (path: string, options?: unknown) => (h: ReturnType<typeof msbuild.find>) => (h as any).addProject(path, options);
  const TESTS = '  <Folder Name="/tests/">\n    <Project Path="tests/Shop.Tests/Shop.Tests.csproj" />\n  </Folder>\n';
  const WEB = '  <Project Path="Shop.Web/Shop.Web.csproj" />\n';

  it.each([
    ["an empty solution", "<Solution>\n</Solution>", `<Solution>\n  <Project Path="${API}" />\n</Solution>`],
    ["a self-closing solution", "<Solution />\n", `<Solution>\n  <Project Path="${API}" />\n</Solution>\n`],
    ["one with root projects", `<Solution>\n${TESTS}${WEB}</Solution>`, `<Solution>\n${TESTS}${WEB}  <Project Path="${API}" />\n</Solution>`],
    ["one with only folders", `<Solution>\n${TESTS}</Solution>`, `<Solution>\n${TESTS}  <Project Path="${API}" />\n</Solution>`],
  ])("adds the project at the root of %s", async (_name, before, after) => {
    await expectFile(before, project(API), after, SLNX);
  });

  it.each([
    ["a folder with projects", '<Solution>\n  <Folder Name="/src/">\n    <Project Path="src/Shop.Domain/Shop.Domain.csproj" />\n  </Folder>\n</Solution>', '<Solution>\n  <Folder Name="/src/">\n    <Project Path="src/Shop.Domain/Shop.Domain.csproj" />\n    <Project Path="src/Shop.Api/Shop.Api.csproj" />\n  </Folder>\n</Solution>'],
    ["a folder with only a file", '<Solution>\n  <Folder Name="/src/">\n    <File Path="README.md" />\n  </Folder>\n</Solution>', '<Solution>\n  <Folder Name="/src/">\n    <File Path="README.md" />\n    <Project Path="src/Shop.Api/Shop.Api.csproj" />\n  </Folder>\n</Solution>'],
    ["an empty folder", '<Solution>\n  <Folder Name="/src/" />\n</Solution>', '<Solution>\n  <Folder Name="/src/">\n    <Project Path="src/Shop.Api/Shop.Api.csproj" />\n  </Folder>\n</Solution>'],
    ["a missing folder after the last folder", `<Solution>\n${TESTS}${WEB}</Solution>`, `<Solution>\n${TESTS}  <Folder Name="/src/">\n    <Project Path="${API}" />\n  </Folder>\n${WEB}</Solution>`],
    ["a missing folder as the first child", `<Solution>\n${WEB}</Solution>`, `<Solution>\n  <Folder Name="/src/">\n    <Project Path="${API}" />\n  </Folder>\n${WEB}</Solution>`],
    ["a missing folder in an empty solution", "<Solution>\n</Solution>", `<Solution>\n  <Folder Name="/src/">\n    <Project Path="${API}" />\n  </Folder>\n</Solution>`],
  ])("adds the project to %s", async (_name, before, after) => {
    await expectFile(before, project(API, { folder: "/src/" }), after, SLNX);
  });

  it("creates only the folder it names, never its parents", async () => {
    await expectFile(
      `<Solution>\n${WEB}</Solution>`,
      project("src/Core/Shop.Domain/Shop.Domain.csproj", { folder: "/src/Core/" }),
      `<Solution>\n  <Folder Name="/src/Core/">\n    <Project Path="src/Core/Shop.Domain/Shop.Domain.csproj" />\n  </Folder>\n${WEB}</Solution>`,
      SLNX
    );
  });

  it("keeps tabs, CRLF and the separators the author gives", async () => {
    await expectFile(
      '<Solution>\r\n\t<Folder Name="/src/">\r\n\t\t<Project Path="src\\A\\A.csproj" />\r\n\t</Folder>\r\n</Solution>\r\n',
      project("src\\B\\B.csproj", { folder: "/src/" }),
      '<Solution>\r\n\t<Folder Name="/src/">\r\n\t\t<Project Path="src\\A\\A.csproj" />\r\n\t\t<Project Path="src\\B\\B.csproj" />\r\n\t</Folder>\r\n</Solution>\r\n',
      SLNX
    );
  });

  it.each([
    ["at the root", '<Solution>\n  <Project Path="src\\Shop.Api\\Shop.Api.csproj" />\n</Solution>', undefined],
    ["in the folder", '<Solution>\n  <Folder Name="/src/">\n    <Project Path="src/Shop.Api/Shop.Api.csproj" />\n  </Folder>\n</Solution>', { folder: "/src/" }],
  ])("leaves the file as it is when the project already sits %s", async (_name, source, options) => {
    await expectFile(source, project(API, options), source, SLNX);
  });

  it.each([
    ["root, asked for a folder", `<Solution>\n  <Project Path="${API}" />\n</Solution>`, { folder: "/src/" }],
    ["folder, asked for the root", `<Solution>\n  <Folder Name="/src/">\n    <Project Path="${API}" />\n  </Folder>\n</Solution>`, undefined],
    ["folder, asked for another", `<Solution>\n  <Folder Name="/src/">\n    <Project Path="${API}" />\n  </Folder>\n</Solution>`, { folder: "/tests/" }],
  ])("rejects a project already in the %s", async (_name, source, options) => {
    await expectReject(source, project(API, options), "another place", SLNX);
  });

  it.each([["src"], ["/src"], ["src/"], [""], [42]])("rejects the folder %p", async (folder) => {
    await expectReject("<Solution>\n</Solution>", project(API, { folder }), "`options.folder`", SLNX);
  });

  it.each([
    ["an unknown option", { path: "x" }, "`options`"],
    ["a path that is not a project", "A/A.cs", '`path` "A/A.cs" is '],
  ])("rejects %s", async (_name, arg, fragment) => {
    const chain = typeof arg === "string" ? project(arg) : project(API, arg);
    await expectReject("<Solution>\n</Solution>", chain, fragment, SLNX);
  });

  it.each([["<Project Sdk=\"Microsoft.NET.Sdk\">\n</Project>"], [""]])("rejects a root that is not Solution: %p", async (source) => {
    await expectReject(source, project("../Shop.Domain/Shop.Domain.csproj"), "addProject", "Shop.Api.csproj");
  });

  it("escapes the path so it never becomes markup", async () => {
    await expectFile("<Solution>\n</Solution>", project('a&"b/x.csproj'), '<Solution>\n  <Project Path="a&amp;&quot;b/x.csproj" />\n</Solution>', SLNX);
  });
});
