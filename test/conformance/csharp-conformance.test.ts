/**
 * The C# and ASP.NET dialects pass the conformance kit. The fixtures re-assemble the same real
 * building blocks their index.ts files compose (the parse/print pair and the named ops), never a
 * mock, plus a C# sample corpus.
 */
import { describe, it, expect, setDefaultTimeout } from "bun:test";
import * as expectedAstLibrary from "web-tree-sitter";
import * as aspnet from "../../src/dialects/aspnet/index.ts";
import * as csharp from "../../src/dialects/csharp/index.ts";
import { defineDialect, defineOpPack, withOps } from "../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";
import { addService } from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/aspnet/ops.ts";
import { parse, print, type CsharpDocument } from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/csharp/ast.ts";
import { csharpOps } from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/csharp/pack.ts";
import { testDialect, testOpPack, type DialectFixture } from "../../src/conformance/index.ts";

setDefaultTimeout(30000);

const baseDialect = defineDialect({ extensions: [".cs"], ast: { parse, print }, ops: {} });
const serviceOps = defineOpPack<CsharpDocument, { addService: typeof addService }>({ addService });

const LARGE_UNIT = "    public int Field0 { get; init; } // generated\n";
const LARGE_SAMPLE = `namespace Big;\n\npublic class Big\n{\n${LARGE_UNIT.repeat(Math.ceil((4 * 1024 * 1024) / LARGE_UNIT.length))}}\n`;

const CORPUS = [
  "using System;\n\nnamespace Shop;\n\npublic sealed record Order(OrderId Id, decimal Total) : IEntity;\n",
  "﻿namespace Shop\r\n{\r\n\tpublic class A<T> where T : class\r\n\t{\r\n\t}\r\n}\r\n",
  'var builder = WebApplication.CreateBuilder(args);\nvar app = builder.Build();\napp.MapGet("/", () => """\n  raw "string"\n  """);\napp.Run();\n',
  "public class Orders(IClock clock)\n{\n    private readonly int[] _ids = [1, 2, 3];\n}\n",
  "// only a comment\n",
  "public static class E\n{\n    extension(string s)\n    {\n        public int Size => s.Length;\n    }\n}\n",
  "public record struct Point(int X, int Y);",
  LARGE_SAMPLE,
];

const libraryExercise: DialectFixture<typeof expectedAstLibrary>["libraryExercise"] = {
  path: "library.cs",
  seed: "internal class A\n{\n}\n",
  expect: "public class A\n{\n}\n",
  modify(ast, library) {
    const doc = ast as CsharpDocument;
    const parser = new library.Parser();
    parser.setLanguage(csharp.language);
    const tree = parser.parse(doc.text)!;
    const modifier = tree.rootNode.descendantsOfType("modifier")[0]!;
    doc.text = `${doc.text.slice(0, modifier.startIndex)}public${doc.text.slice(modifier.endIndex)}`;
    tree.delete();
  },
};

describe("conformance kit", () => {
  it.each([
    ["csharp", csharp],
    ["aspnet", aspnet],
  ])("testDialect %s: the C# corpus round-trips byte-exact; astLibrary is web-tree-sitter", async (_, module) => {
    const fixture: DialectFixture<typeof expectedAstLibrary> = { dialect: baseDialect, samples: CORPUS, module, expectedAstLibrary, libraryExercise };
    await expect(testDialect(fixture)).resolves.toBeUndefined();
  });

  it("invalid C# fails parse", () => {
    expect(() => parse("public class A {")).toThrow("invalid C#");
    expect(() => parse("class A { int x }")).toThrow("invalid C#");
  });

  it("testOpPack csharp: named ops are byte-exact, coalesce, split at a read boundary, and are idempotent", async () => {
    await expect(
      testOpPack({
        opPack: csharpOps,
        baseDialect: withOps(baseDialect, csharpOps),
        exercises: [
          {
            seed: "namespace Shop.Infrastructure;\n\npublic class Orders\n{\n    public int Count { get; }\n}\n",
            chain: [
              { op: "addUsing", args: ["System"] },
              { op: "addBaseType", args: ["Orders", "IOrders", { from: "Shop.Application.Ports" }] },
              { op: "addConstructorParameter", args: ["Orders", "clock", "IClock"] },
              { op: "addMember", args: ["Orders", "public int Total { get; }"] },
            ],
            expect:
              "using System;\nusing Shop.Application.Ports;\n\nnamespace Shop.Infrastructure;\n\npublic class Orders(IClock clock) : IOrders\n{\n    public int Count { get; }\n    public int Total { get; }\n}\n",
          },
          {
            seed: "﻿public record A { }\r\n",
            chain: [{ op: "addMember", args: ["A", "int X { get; }"] }],
            expect: "﻿public record A {\r\n    int X { get; }\r\n}\r\n",
          },
        ],
      })
    ).resolves.toBeUndefined();
  });

  it("testOpPack aspnet: addService is byte-exact, coalesces, and is idempotent", async () => {
    await expect(
      testOpPack({
        opPack: serviceOps,
        baseDialect: withOps(baseDialect, csharpOps, serviceOps),
        exercises: [
          {
            seed: "var builder = WebApplication.CreateBuilder(args);\n\nvar app = builder.Build();\n",
            chain: [
              { op: "addService", args: ["Scoped", "IOrders", "SqlOrders", { serviceFrom: "Shop.Ports" }] },
              { op: "addService", args: ["Singleton", "IClock", "SystemClock"] },
            ],
            expect:
              "using Shop.Ports;\n\nvar builder = WebApplication.CreateBuilder(args);\nbuilder.Services.AddScoped<IOrders, SqlOrders>();\nbuilder.Services.AddSingleton<IClock, SystemClock>();\n\nvar app = builder.Build();\n",
          },
        ],
      })
    ).resolves.toBeUndefined();
  });
});
