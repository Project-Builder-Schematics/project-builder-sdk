import { describe, it, expect } from "bun:test";
import * as csharp from "../../../../../../../src/dialects/csharp/index.ts";
import { apply, expectFile, expectReject } from "./harness.ts";

describe("find (A-106)", () => {
  it("accepts .cs and rejects .csx, a bare extension and other files synchronously", () => {
    expect(() => csharp.find("src/Orders.cs")).not.toThrow();
    for (const path of ["a.csx", ".cs", "a..cs", "a.csproj", "a"]) {
      expect(() => csharp.find(path)).toThrow("dialect operation failed: ");
    }
  });

  it("fails the factory on a file that is not valid C# syntax and leaves it as it is", async () => {
    const outcome = await apply("public class A {\n", (h) => h.addUsing("System"));
    expect(outcome.error?.message).toContain('could not parse "a.cs"');
    expect(outcome.modifies).toBe(0);
    expect(outcome.after).toBe("public class A {\n");
  });

  it("accepts a compile error that is not a syntax error", async () => {
    await expectFile("public class A : UnknownBase\n{\n}\n", (h) => h.addUsing("System"), "using System;\n\npublic class A : UnknownBase\n{\n}\n");
  });
});

describe("argument checks (A-107)", () => {
  const source = "public class A\n{\n}\n";

  it.each([
    ["namespace", (h: csharp.CsharpDocument | any) => h.addUsing("System; class X {}", {}), '`namespace` "System; class X {}" is '],
    ["keyword namespace", (h: any) => h.addUsing("class", {}), '`namespace` "class" is '],
    ["base", (h: any) => h.addBaseType("A", "IA { }"), '`base` "IA { }" is '],
    ["typeName", (h: any) => h.addMember("1A", "void M() { }"), '`typeName` "1A" is '],
    ["keyword name", (h: any) => h.addConstructorParameter("A", "class", "int"), '`name` "class" is '],
    ["alias", (h: any) => h.addUsing("Shop.Data", { alias: "using" }), '`alias` "using" is '],
    ["from", (h: any) => h.addBaseType("A", "IA", { from: "Shop..Ports" }), '`from` "Shop..Ports" is '],
    ["two types", (h: any) => h.addConstructorParameter("A", "x", "int y, int"), '`type` "int y, int" is '],
  ])("rejects an invalid %s before any other check", async (_, chain, fragment) => {
    await expectReject(source, chain, fragment);
  });

  it("rejects an invalid value even where the op would leave the file as it is", async () => {
    await expectReject("public class A : IA\n{\n}\n", (h) => h.addBaseType("A", "IA /* x */"), "`base`");
  });

  it("allows contextual keywords as names", async () => {
    await expectFile(source, (h) => h.addConstructorParameter("A", "record", "int"), "public class A(int record)\n{\n}\n");
  });

  it("accepts generic, nullable, array and tuple types", async () => {
    await expectFile(
      source,
      (h) => h.addConstructorParameter("A", "a", "Dictionary<string, List<int>>?").addConstructorParameter("A", "b", "(int X, string Y)[]"),
      "public class A(Dictionary<string, List<int>>? a, (int X, string Y)[] b)\n{\n}\n"
    );
  });
});

describe("layout (A-108)", () => {
  it("follows the file's two-space indentation", async () => {
    await expectFile(
      "namespace Shop\n{\n  public class A\n  {\n    public int X { get; }\n  }\n}\n",
      (h) => h.addMember("A", "public int Y { get; }"),
      "namespace Shop\n{\n  public class A\n  {\n    public int X { get; }\n    public int Y { get; }\n  }\n}\n"
    );
  });

  it("splits a body written on one line and keeps its opening brace", async () => {
    await expectFile("public record A { }\n", (h) => h.addMember("A", "public int X { get; init; }"), "public record A {\n    public int X { get; init; }\n}\n");
  });

  it("splits a one-line body that already holds a member", async () => {
    await expectFile("public class A { int x; }\n", (h) => h.addMember("A", "int y;"), "public class A {\n    int x;\n    int y;\n}\n");
  });

  it("keeps CRLF line endings and the BOM", async () => {
    await expectFile(
      "﻿namespace Shop;\r\n\r\npublic class A\r\n{\r\n\tint x;\r\n}\r\n",
      (h) => h.addUsing("System").addMember("A", "void M()\n{\n    Run();\n}"),
      "﻿using System;\r\n\r\nnamespace Shop;\r\n\r\npublic class A\r\n{\r\n\tint x;\r\n\r\n\tvoid M()\r\n\t{\r\n\t    Run();\r\n\t}\r\n}\r\n"
    );
  });

  it("uses four spaces when the file has no member", async () => {
    await expectFile("namespace Shop;\n\npublic class A\n{\n}\n", (h) => h.addMember("A", "int x;"), "namespace Shop;\n\npublic class A\n{\n    int x;\n}\n");
  });
});

describe("addUsing (A-109)", () => {
  it.each([
    ["namespace Shop;\n", "System", {}, "using System;\n\nnamespace Shop;\n"],
    ["using System;\n\nnamespace Shop;\n", "Shop.Domain", {}, "using System;\nusing Shop.Domain;\n\nnamespace Shop;\n"],
    ["using System;\n\nnamespace Shop;\n", "System", {}, "using System;\n\nnamespace Shop;\n"],
    ["using System;\n\nnamespace Shop;\n", "System.Math", { static: true }, "using System;\nusing static System.Math;\n\nnamespace Shop;\n"],
    ["using System;\n\nnamespace Shop;\n", "Shop.Domain", { global: true }, "global using Shop.Domain;\nusing System;\n\nnamespace Shop;\n"],
    ["using System;\n\nnamespace Shop;\n", "Shop.Data", { alias: "Db" }, "using System;\nusing Db = Shop.Data;\n\nnamespace Shop;\n"],
    [
      "namespace Shop\n{\n    using System;\n\n    class A\n    {\n    }\n}\n",
      "Shop.Domain",
      {},
      "namespace Shop\n{\n    using System;\n    using Shop.Domain;\n\n    class A\n    {\n    }\n}\n",
    ],
    ["global using A;\nusing B;\n", "C", { global: true }, "global using A;\nglobal using C;\nusing B;\n"],
    ["// Copyright\nnamespace Shop;\n", "System", {}, "// Copyright\nusing System;\n\nnamespace Shop;\n"],
    ["global using static System.Math;\n", "System.Math", { global: true, static: true }, "global using static System.Math;\n"],
    ["using System;\n", "System", { global: true }, "global using System;\nusing System;\n"],
  ])("%j + addUsing(%j, %j)", async (before, namespace, options, after) => {
    await expectFile(before, (h) => h.addUsing(namespace, options), after);
  });

  it("rejects an alias another directive binds to a different namespace", async () => {
    await expectReject("using Db = Shop.Legacy;\n", (h) => h.addUsing("Shop.Data", { alias: "Db" }), "addUsing");
  });

  it("rejects static combined with an alias", async () => {
    await expectReject("namespace Shop;\n", (h) => h.addUsing("System.Math", { static: true, alias: "M" }), "`static` and `alias` cannot be combined");
  });
});

describe("from (A-110)", () => {
  const before = "namespace Shop.Infrastructure;\n\npublic class Orders\n{\n}\n";
  it.each([
    [before, "Shop.Application.Ports", "using Shop.Application.Ports;\n\nnamespace Shop.Infrastructure;\n\npublic class Orders : IOrders\n{\n}\n"],
    [before, "Shop", "namespace Shop.Infrastructure;\n\npublic class Orders : IOrders\n{\n}\n"],
    [before, "Shop.Infrastructure", "namespace Shop.Infrastructure;\n\npublic class Orders : IOrders\n{\n}\n"],
    [
      "using Shop.Ports;\n\nnamespace Shop.Data;\n\npublic class Orders\n{\n}\n",
      "Shop.Ports",
      "using Shop.Ports;\n\nnamespace Shop.Data;\n\npublic class Orders : IOrders\n{\n}\n",
    ],
  ])("addBaseType with from %#", async (source, from, after) => {
    await expectFile(source, (h) => h.addBaseType("Orders", "IOrders", { from }), after);
  });

  it("does not count a namespace that only shares a prefix", async () => {
    await expectFile(before, (h) => h.addBaseType("Orders", "IOrders", { from: "Sho" }), `using Sho;\n\n${before.replace("Orders\n", "Orders : IOrders\n")}`);
  });

  it("imports for addConstructorParameter, and imports nothing when the file is left as it is", async () => {
    await expectFile(before, (h) => h.addConstructorParameter("Orders", "db", "ShopDb", { from: "Shop.Data" }), `using Shop.Data;\n\n${before.replace("Orders\n", "Orders(ShopDb db)\n")}`);
    const has = "namespace Shop;\n\npublic class Orders : IOrders\n{\n}\n";
    await expectFile(has, (h) => h.addBaseType("Orders", "IOrders", { from: "Shop.Ports" }), has);
  });
});

describe("targets (A-111)", () => {
  it.each([
    "public class B\n{\n}\n",
    "public partial class A\n{\n}\n\npublic partial class A\n{\n}\n",
    "public class B\n{\n    public class A\n    {\n    }\n}\n",
    "public enum A { X }\n",
  ])("rejects without exactly one type named A: %j", async (content) => {
    await expectReject(content, (h) => h.addMember("A", "void M() { }"), "addMember");
  });

  it("finds a type in a block namespace and a record struct", async () => {
    await expectFile("namespace S\n{\n    record struct A(int X);\n}\n", (h) => h.addBaseType("A", "IA"), "namespace S\n{\n    record struct A(int X) : IA;\n}\n");
  });
});

describe("addBaseType (A-112)", () => {
  it.each([
    ["public class A\n{\n}\n", "public class A : IA\n{\n}\n"],
    ["public class A : B\n{\n}\n", "public class A : B, IA\n{\n}\n"],
    ["public class A(int x)\n{\n}\n", "public class A(int x) : IA\n{\n}\n"],
    ["public class A<T> where T : class\n{\n}\n", "public class A<T> : IA where T : class\n{\n}\n"],
    ["public interface A : IB, IA\n{\n}\n", "public interface A : IB, IA\n{\n}\n"],
    ["public class A : IB, I A\n{\n}\n".replace("I A", "IC"), "public class A : IB, IC, IA\n{\n}\n"],
  ])("%j", async (before, after) => {
    await expectFile(before, (h) => h.addBaseType("A", "IA"), after);
  });

  it("compares bases as written ignoring whitespace", async () => {
    const source = "public class A : IRepo<int,string>\n{\n}\n";
    await expectFile(source, (h) => h.addBaseType("A", "IRepo<int, string>"), source);
  });
});

describe("addMember (A-113)", () => {
  it.each([
    ["public interface IA\n{\n    void M();\n}\n", "Task<Order?> GetAsync(OrderId id);", "public interface IA\n{\n    void M();\n    Task<Order?> GetAsync(OrderId id);\n}\n"],
    [
      "public class IA\n{\n    public int X { get; }\n}\n",
      "public void M()\n{\n    Run();\n}",
      "public class IA\n{\n    public int X { get; }\n\n    public void M()\n    {\n        Run();\n    }\n}\n",
    ],
    ["public interface IA\n{\n    void M();\n}\n", "void  M();", "public interface IA\n{\n    void M();\n}\n"],
    ["public class IA\n{\n    int a;\n\n    int b;\n}\n", "int c;", "public class IA\n{\n    int a;\n\n    int b;\n\n    int c;\n}\n"],
    ["public interface IA\n{\n    void M();\n}\n", "void M(int x);", "public interface IA\n{\n    void M();\n    void M(int x);\n}\n"],
    ["public record IA(int Id);\n", "public int X => Id;", "public record IA(int Id)\n{\n    public int X => Id;\n}\n"],
  ])("%j + %j", async (before, source, after) => {
    await expectFile(before, (h) => h.addMember("IA", source), after);
  });

  it.each(["int x; int y;", "", "class", "using System;"])("rejects a source that is not exactly one member: %j", async (source) => {
    await expectReject("public class A\n{\n}\n", (h) => h.addMember("A", source), "`source` must");
  });
});

describe("addConstructorParameter (A-114)", () => {
  it.each([
    ["public class A(IClock clock)\n{\n}\n", "public class A(IClock clock, IOrders orders)\n{\n}\n"],
    ["public class A\n{\n}\n", "public class A(IOrders orders)\n{\n}\n"],
    ["public record A(int Id);\n", "public record A(int Id, IOrders orders);\n"],
    ["public class A(\n    IClock clock)\n{\n}\n", "public class A(\n    IClock clock,\n    IOrders orders)\n{\n}\n"],
    ["public class A(IOrders orders)\n{\n}\n", "public class A(IOrders orders)\n{\n}\n"],
    ["public class A<T>()\n{\n}\n", "public class A<T>(IOrders orders)\n{\n}\n"],
    ["public struct A\n{\n    static A() { }\n}\n", "public struct A(IOrders orders)\n{\n    static A() { }\n}\n"],
  ])("%j", async (before, after) => {
    await expectFile(before, (h) => h.addConstructorParameter("A", "orders", "IOrders"), after);
  });

  it.each([
    ["public class A\n{\n    public A() { }\n}\n", "explicit constructor"],
    ["public interface A\n{\n}\n", "interface"],
    ["public class A(IOrderStore orders)\n{\n}\n", "already declared"],
  ])("rejects %j", async (content, fragment) => {
    await expectReject(content, (h) => h.addConstructorParameter("A", "orders", "IOrders"), fragment);
  });
});

describe("chaining", () => {
  it("coalesces every op of a chain into one write", async () => {
    const outcome = await apply("namespace Shop;\n\npublic class A\n{\n}\n", (h) =>
      h.addUsing("System").addBaseType("A", "IA").addConstructorParameter("A", "x", "int").addMember("A", "int Y => x;")
    );
    expect(outcome.error).toBeUndefined();
    expect(outcome.modifies).toBe(1);
    expect(outcome.content).toBe("using System;\n\nnamespace Shop;\n\npublic class A(int x) : IA\n{\n    int Y => x;\n}\n");
  });

  it("writes nothing when a later op rejects", async () => {
    await expectReject("public class A\n{\n}\n", (h) => h.addUsing("System").addMember("B", "int x;"), "addMember");
  });
});
