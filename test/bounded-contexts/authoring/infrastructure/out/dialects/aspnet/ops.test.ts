import { describe, it, expect } from "bun:test";
import * as aspnet from "../../../../../../../src/dialects/aspnet/index.ts";
import { apply, expectFile, expectReject } from "../csharp/harness.ts";

const PROGRAM = "var builder = WebApplication.CreateBuilder(args);\n\nvar app = builder.Build();\n\napp.Run();\n";
const REGISTERED = "var builder = WebApplication.CreateBuilder(args);\nbuilder.Services.AddScoped<IOrders, SqlOrders>();\n\nvar app = builder.Build();\n";
const EXTENSION =
  "namespace Shop.Infrastructure;\n\npublic static class DependencyInjection\n{\n    public static IServiceCollection AddInfrastructure(this IServiceCollection services)\n    {\n        return services;\n    }\n}\n";

describe("find and the C# ops (A-115)", () => {
  it("accepts the same .cs files as the C# dialect and carries its ops", async () => {
    expect(() => aspnet.find("a.csx")).toThrow("dialect operation failed: ");
    await expectFile("public class A\n{\n}\n", (h) => (h as any).addBaseType("A", "IA"), "public class A : IA\n{\n}\n", aspnet.find);
  });

  it("rejects addService on a file without a place to edit", async () => {
    await expectReject('Console.WriteLine("hi");\n', (h) => (h as any).addService("Scoped", "IOrders", "Orders"), "addService", aspnet.find);
  });

  it("rejects a file with two builders", async () => {
    const two = "var a = WebApplication.CreateBuilder(args);\nvar b = WebApplication.CreateSlimBuilder(args);\nvar app = a.Build();\n";
    await expectReject(two, (h) => (h as any).addService("Scoped", "IOrders", "Orders"), "found 2", aspnet.find);
  });
});

describe("addService in the top-level statements (A-116)", () => {
  it("registers the service before the application is built, importing both namespaces", async () => {
    await expectFile(
      PROGRAM,
      (h) => (h as any).addService("Scoped", "IOrders", "SqlOrders", { serviceFrom: "Shop.Application.Ports", implementationFrom: "Shop.Infrastructure" }),
      `using Shop.Application.Ports;\nusing Shop.Infrastructure;\n\n${PROGRAM.replace("(args);\n", "(args);\nbuilder.Services.AddScoped<IOrders, SqlOrders>();\n")}`,
      aspnet.find
    );
  });

  it("goes after the last statement before Build, with CreateEmptyBuilder", async () => {
    const source = "var b = WebApplication.CreateEmptyBuilder(new());\nb.Services.AddSingleton<IClock, Clock>();\nvar app = b.Build();\n";
    await expectFile(
      source,
      (h) => (h as any).addService("Transient", "IOrders", "SqlOrders"),
      source.replace("Clock>();\n", "Clock>();\nb.Services.AddTransient<IOrders, SqlOrders>();\n"),
      aspnet.find
    );
  });

  it("leaves the file as it is when the same registration is there", async () => {
    await expectFile(REGISTERED, (h) => (h as any).addService("Scoped", "IOrders", "SqlOrders", { serviceFrom: "Shop.Ports" }), REGISTERED, aspnet.find);
  });

  it.each([["Singleton", "already registered"], ["Pooled", "`lifetime` \"Pooled\" is not a lifetime"]])(
    "rejects the lifetime %s",
    async (lifetime, fragment) => {
      await expectReject(REGISTERED, (h) => (h as any).addService(lifetime, "IOrders", "SqlOrders"), fragment, aspnet.find);
    }
  );

  it("rejects a service that is not one C# type", async () => {
    await expectReject(PROGRAM, (h) => (h as any).addService("Scoped", "IOrders>, X<Y", "SqlOrders"), "`service`", aspnet.find);
  });
});

describe("addService in a service collection extension method (A-116)", () => {
  it("registers before the method's return", async () => {
    await expectFile(
      EXTENSION,
      (h) => (h as any).addService("Scoped", "IOrders", "SqlOrders", { method: "AddInfrastructure" }),
      EXTENSION.replace("        return", "        services.AddScoped<IOrders, SqlOrders>();\n        return"),
      aspnet.find
    );
  });

  it("registers after the last statement when it is not a return, and in an empty body", async () => {
    const voidMethod = "static class D\n{\n    public static void Add(this IServiceCollection s)\n    {\n        s.AddScoped<IA, A>();\n    }\n}\n";
    await expectFile(
      voidMethod,
      (h) => (h as any).addService("Singleton", "IB", "B", { method: "Add" }),
      voidMethod.replace("A>();\n", "A>();\n        s.AddSingleton<IB, B>();\n"),
      aspnet.find
    );
    const empty = "static class D\n{\n    public static void Add(this IServiceCollection s)\n    {\n    }\n}\n";
    await expectFile(
      empty,
      (h) => (h as any).addService("Singleton", "IB", "B", { method: "Add" }),
      empty.replace("    {\n    }", "    {\n        s.AddSingleton<IB, B>();\n    }"),
      aspnet.find
    );
  });

  it.each([
    ["an expression body", "static class D\n{\n    public static IServiceCollection Add(this IServiceCollection s) => s;\n}\n", "expression body"],
    ["no such method", EXTENSION.replaceAll("AddInfrastructure", "AddDomain"), "found 0"],
    ["a method that is not an extension", "static class D\n{\n    public static void Add(IServiceCollection s)\n    {\n    }\n}\n", "found 0"],
  ])("rejects %s", async (_, source, fragment) => {
    await expectReject(source, (h) => (h as any).addService("Scoped", "IA", "A", { method: source.includes("AddInfrastructure") ? "AddInfrastructure" : "Add" }), fragment, aspnet.find);
  });

  it("checks for an existing registration in the method only", async () => {
    const outcome = await apply(
      EXTENSION.replace("        return", "        services.AddScoped<IOrders, SqlOrders>();\n        return"),
      (h) => (h as any).addService("Scoped", "IOrders", "SqlOrders", { method: "AddInfrastructure" }),
      "a.cs",
      aspnet.find
    );
    expect(outcome.error).toBeUndefined();
    expect(outcome.modifies).toBe(0);
  });
});
