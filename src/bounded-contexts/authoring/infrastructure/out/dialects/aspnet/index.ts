import { defineDialect, defineOpPack, withOps, type Handle } from "../../../../domain/services/define-dialect.ts";
import { parse, print, type CsharpDocument } from "../csharp/ast.ts";
import { csharpOps, type CsharpOps } from "../csharp/pack.ts";
import { addService, type Lifetime, type ServiceOptions } from "./ops.ts";

export * as astLibrary from "web-tree-sitter";
export { language } from "../csharp/ast.ts";
export type { CsharpDocument, FromOptions, UsingOptions } from "../csharp/index.ts";
export type { Lifetime, ServiceOptions };

type ServiceOps = {
  addService: (ast: CsharpDocument, lifetime: Lifetime, service: string, implementation?: string, options?: ServiceOptions) => void;
};

type AspnetOps = CsharpOps & ServiceOps;

const serviceOps = defineOpPack<CsharpDocument, ServiceOps>({ addService });

const aspnetDialect = withOps(defineDialect({ extensions: [".cs"], ast: { parse, print }, ops: {} }), csharpOps, serviceOps);

/**
 * Opens a `.cs` file of an ASP.NET Core application. The handle carries every
 * `@pbuilder/sdk/csharp` op plus `addService`, chained on one handle and written once.
 *
 * `addService(lifetime, service, implementation?, { serviceFrom?, implementationFrom?, method? })`
 * writes `<receiver>.Add<lifetime><service, implementation>();` once, `lifetime` being
 * `"Singleton"`, `"Scoped"` or `"Transient"`; when `implementation` is left out or equals
 * `service`, it writes `<receiver>.Add<lifetime><service>();`. Without `method` it edits the top-level statements
 * of `Program.cs`: the receiver is `<builder>.Services` of the one variable initialized by
 * `WebApplication.CreateBuilder` (or `CreateSlimBuilder`, `CreateEmptyBuilder`), and the line
 * goes just before the statement that calls `<builder>.Build()`. With `method` it edits the one
 * static method of that name whose first parameter is `this IServiceCollection`, before its
 * `return`. `serviceFrom` and `implementationFrom` add the `using` of each type unless the file
 * already sees it. The same registration already there, called with no arguments, changes
 * nothing (`Add<L><S>()` and `Add<L><S, S>()` are the same registration); the same pair with
 * another lifetime or with arguments such as a factory, or a file with no such place, rejects and
 * leaves the file as it is.
 *
 * @example
 * import * as aspnet from "@pbuilder/sdk/aspnet";
 *
 * // Program.cs before:
 * // var builder = WebApplication.CreateBuilder(args);
 * //
 * // var app = builder.Build();
 * export const run = async () => {
 *   await aspnet
 *     .find("Program.cs")
 *     .addService("Scoped", "IOrders", "SqlOrders", { serviceFrom: "Shop.Application.Ports", implementationFrom: "Shop.Infrastructure" });
 * };
 * // -> using Shop.Application.Ports;
 * // -> using Shop.Infrastructure;
 * // ->
 * // -> var builder = WebApplication.CreateBuilder(args);
 * // -> builder.Services.AddScoped<IOrders, SqlOrders>();
 * // ->
 * // -> var app = builder.Build();
 */
export function find(path: string): Handle<"found", CsharpDocument, AspnetOps> {
  return aspnetDialect.find(path);
}
