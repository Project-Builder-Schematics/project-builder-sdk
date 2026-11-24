import { defineDialect, withOps, type Handle } from "../../../../domain/services/define-dialect.ts";
import { parse, print, type CsharpDocument } from "./ast.ts";
import type { FromOptions, UsingOptions } from "./ops.ts";
import { csharpOps, type CsharpOps } from "./pack.ts";

export * as astLibrary from "web-tree-sitter";
export { language } from "./ast.ts";
export type { CsharpDocument, FromOptions, UsingOptions };

const csharpDialect = withOps(defineDialect({ extensions: [".cs"], ast: { parse, print }, ops: {} }), csharpOps);

/**
 * Opens a `.cs` file for editing (`.csx` excluded). A file that is not valid C# syntax fails the
 * factory; a compile error such as an unknown type does not, since the dialect has no compiler.
 * Every op edits only the bytes it must, and inserted code follows the file's line ending, BOM
 * and member indentation (four spaces when it has none); `.editorconfig` is never read.
 *
 * - `addUsing(namespace, { static?, global?, alias? })` adds a using directive once.
 * - `addBaseType(typeName, base, { from? })` appends a base type to the base list once.
 * - `addMember(typeName, source)` appends one member; an identical member changes nothing.
 * - `addConstructorParameter(typeName, name, type, { from? })` appends a primary constructor
 *   parameter; a type with an explicit constructor, or an interface, rejects.
 *
 * `typeName` names the one class, record, struct or interface of that name at the top level or
 * in a namespace. `from` names the namespace that declares the type and adds its `using`
 * unless the file already sees it. `.modify(fn)` hands `fn` the live `CsharpDocument`; parse its
 * `text` with `astLibrary` (`web-tree-sitter`) and `language` for anything the ops do not cover.
 *
 * @example
 * import * as csharp from "@pbuilder/sdk/csharp";
 *
 * // Orders.cs before: namespace Shop.Infrastructure;\n\npublic class Orders\n{\n}\n
 * export const run = async () => {
 *   await csharp
 *     .find("Orders.cs")
 *     .addBaseType("Orders", "IOrders", { from: "Shop.Application.Ports" })
 *     .addConstructorParameter("Orders", "db", "ShopDb", { from: "Shop.Data" });
 * };
 * // -> using Shop.Application.Ports;
 * // -> using Shop.Data;
 * // ->
 * // -> namespace Shop.Infrastructure;
 * // ->
 * // -> public class Orders(ShopDb db) : IOrders
 * // -> {
 * // -> }
 */
export function find(path: string): Handle<"found", CsharpDocument, CsharpOps> {
  return csharpDialect.find(path);
}
