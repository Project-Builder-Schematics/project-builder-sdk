# The C# dialect

`@pbuilder/sdk/csharp` edits `.cs` files through named ops that add using directives, base
types, members and primary constructor parameters. It is built for schematics that scaffold a
.NET solution, such as the ports and adapters of a hexagonal architecture: an adapter class
implements a port, takes its dependencies in its primary constructor, and imports the
namespaces it needs.

```ts
import * as csharp from "@pbuilder/sdk/csharp";

// src/Shop.Infrastructure/SqlOrders.cs:
// namespace Shop.Infrastructure;
//
// public class SqlOrders
// {
// }
export const run = async () => {
  await csharp
    .find("src/Shop.Infrastructure/SqlOrders.cs")
    .addBaseType("SqlOrders", "IOrders", { from: "Shop.Application.Ports" })
    .addConstructorParameter("SqlOrders", "db", "ShopDb", { from: "Shop.Data" })
    .addMember("SqlOrders", "public Task<Order?> GetAsync(OrderId id) => db.Orders.FindAsync(id).AsTask();");
};
// -> using Shop.Application.Ports;
// -> using Shop.Data;
// ->
// -> namespace Shop.Infrastructure;
// ->
// -> public class SqlOrders(ShopDb db) : IOrders
// -> {
// ->     public Task<Order?> GetAsync(OrderId id) => db.Orders.FindAsync(id).AsTask();
// -> }
```

Ops chained on one handle coalesce into one pending directive for the file.

## Files

`find` accepts a path whose file name ends in `.cs` and has a stem before it. Every other path,
`.csx` included, throws synchronously with the `dialect operation failed: ` prefix, before any op
runs. A file that is not valid C# syntax fails the factory with `could not parse "<path>"` and is
left as it is. A compile error that is not a syntax error, such as an unknown type, does not: the
dialect sees only its file and has no compiler behind it.

The parser is [tree-sitter-c-sharp](https://github.com/tree-sitter/tree-sitter-c-sharp) 0.24.0,
compiled to WebAssembly and run by `web-tree-sitter`, so the SDK ships no native binary. It reads
modern C#: file-scoped namespaces, records, primary constructors, top-level statements,
collection expressions, raw strings and extension blocks.

## Arguments

- A name (`typeName`, a parameter `name`, an `alias`) matches `^[A-Za-z_][A-Za-z0-9_]*$` and is
  not a reserved keyword of C#. Contextual keywords such as `var`, `async` or `record` are allowed.
- A namespace is one or more such names joined by dots.
- A type (`base`, a parameter `type`) parses as exactly one C# type: a name, a qualified name, a
  generic, nullable, array or tuple type.
- A member `source` is written as given and trusted as factory code, but it must parse as exactly
  one member declaration.

These checks run before any other, so an invalid value rejects even where the op would leave the
file as it is.

## Targets

`typeName` names a class, record, struct or interface declared at the top level of the file or
inside a namespace, file-scoped or block. Nested types are not targets. A name that matches no
declaration, or several, such as two parts of a partial class, rejects.

## Named ops

### `addUsing(namespace, { static?, global?, alias? })`

Writes `using namespace;`, `using static namespace;`, `global using namespace;` or
`using alias = namespace;`, once. A directive with the same namespace, alias and kind leaves the
file as it is; an alias another directive binds to a different namespace rejects, and so does
`static` with `alias`.

A global directive goes after the last global directive, or before the first directive. Any other
directive goes after the last directive of the file. A file with no directive gets it at the top,
after any leading comment, followed by a blank line. When every directive of the file sits inside
its one block namespace, a new one goes after the last of them, with their indentation.

### `addBaseType(typeName, base, { from? })`

Appends `base` to the base list, after the type parameters and the primary constructor and before
any `where` clause, creating the list when there is none. A base already in the list, compared as
written ignoring whitespace, leaves the file as it is. The list is never reordered, so add a base
class before the interfaces.

### `addMember(typeName, source)`

Appends one member after the last member of the type. It is separated from the last member as the
last two members are, by a blank line or none; after a single member, a one-line member follows on
the next line and a longer one after a blank line. A member with the same text, ignoring
whitespace, leaves the file as it is. A different member is never replaced, so an overload goes
next to the method it overloads. A record with no body (`record A(int Id);`) gets one.

### `addConstructorParameter(typeName, name, type, { from? })`

Appends `type name` to the primary constructor of a class, record or struct, creating it when the
type has no constructor at all. A list written one parameter per line gets the new parameter on its
own line. A parameter of that name and type leaves the file as it is; one of that name with
another type rejects. A type with an explicit constructor rejects, and so does an interface: edit
those with `.modify()`.

## Importing with `from`

Every op that takes a type name accepts `from`, the namespace that declares the type, and adds
`using from;` with the rules of `addUsing`, in the same edit. No directive is added when the file
already has it, or when `from` is the namespace the file declares or one that encloses it. Without
`from`, nothing is imported. The dialect never checks that the type exists, nor whether two
directives bring types of the same name.

## Format preservation

An op changes only the bytes it must; an unedited file is byte-identical. Inserted lines take the
file's line ending, and a UTF-8 byte order mark and the final newline are kept. A new member,
statement or directive is indented one unit deeper than the declaration that holds it, the unit
being the indentation the file already uses for members, four spaces when it has none. Each line
of a multi-line `source` keeps its indentation relative to its first line. A body written on one
line, such as `{ }`, is split when a member goes into it: the opening brace stays where it is and
the closing brace goes on its own line. The dialect never reads `.editorconfig`.

## The escape hatch: `.modify(fn)`

`.modify(fn)` hands `fn` the live `CsharpDocument`, whose `text` you may replace. Parse it with
`astLibrary` (`web-tree-sitter`) and the exported `language`; free each tree with `delete()`.

```ts
await csharp.find("Orders.cs").modify((doc) => {
  const parser = new csharp.astLibrary.Parser();
  parser.setLanguage(csharp.language);
  const tree = parser.parse(doc.text)!;
  const modifier = tree.rootNode.descendantsOfType("modifier")[0]!;
  doc.text = doc.text.slice(0, modifier.startIndex) + "public" + doc.text.slice(modifier.endIndex);
  tree.delete();
});
```
