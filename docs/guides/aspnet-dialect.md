# The ASP.NET dialect

`@pbuilder/sdk/aspnet` edits the same `.cs` files as [the C# dialect](./csharp-dialect.md), with
all its ops, and adds `addService`, which registers a service in the dependency injection container
of an ASP.NET Core application.

```ts
import * as aspnet from "@pbuilder/sdk/aspnet";

// Program.cs:
// var builder = WebApplication.CreateBuilder(args);
//
// var app = builder.Build();
//
// app.Run();
export const run = async () => {
  await aspnet
    .find("Program.cs")
    .addService("Scoped", "IOrders", "SqlOrders", {
      serviceFrom: "Shop.Application.Ports",
      implementationFrom: "Shop.Infrastructure",
    });
};
// -> using Shop.Application.Ports;
// -> using Shop.Infrastructure;
// ->
// -> var builder = WebApplication.CreateBuilder(args);
// -> builder.Services.AddScoped<IOrders, SqlOrders>();
// ->
// -> var app = builder.Build();
// ->
// -> app.Run();
```

## Named ops

Every op of the C# dialect: `addUsing`, `addBaseType`, `addMember`, `addConstructorParameter`.

### `addService(lifetime, service, implementation?, { serviceFrom?, implementationFrom?, method? })`

Writes `<receiver>.Add<lifetime><service, implementation>();`, where `lifetime` is `"Singleton"`,
`"Scoped"` or `"Transient"` and `service` and `implementation` are each one C# type. When
`implementation` is left out or equals `service`, it writes the single-type form
`<receiver>.Add<lifetime><service>();`, which ASP.NET uses for a concrete class, and `service`
counts as the implementation everywhere else, `implementationFrom` included.

```ts
aspnet.find("Program.cs").addService("Scoped", "OpenAccount");
// builder.Services.AddScoped<OpenAccount>();
```

- **Without `method`**, it edits the top-level statements of `Program.cs`. The one local variable
  initialized by `WebApplication.CreateBuilder`, `CreateSlimBuilder` or `CreateEmptyBuilder` is the
  builder, the receiver is `<builder>.Services`, and the registration goes on the line after the
  last statement before the one that calls `<builder>.Build()`.
- **With `method`**, it edits the one static method of that name whose first parameter is
  `this IServiceCollection`, such as the `AddInfrastructure` each layer exposes. The receiver is
  that parameter, and the registration goes before the method's last statement when that is a
  `return`, and after it otherwise.

`serviceFrom` and `implementationFrom` add the `using` of each type with the rules of the C#
dialect's `from`.

A registration of the same lifetime, service and implementation, called with no arguments,
already in those statements leaves the file as it is. `Add<lifetime><service>()` and
`Add<lifetime><service, service>()` count as the same registration.

## Rejections

Each rejects with the `dialect operation failed: ` prefix, naming `addService`, and leaves the
file as it is:

- a lifetime other than `Singleton`, `Scoped` or `Transient`;
- a registration of the same service and implementation with another lifetime;
- a registration of the same service and implementation that passes arguments, such as a factory
  `sp => new SqlOrders()`, whatever its lifetime: edit it with `.modify()`;
- a file whose top-level statements have no builder, or more than one, or no `Build()` call after it;
- with `method`, no such static extension method or more than one, or one with an expression body.

The op finds the place it edits when it runs, so any `.cs` file opens; a file without that place
rejects only when `addService` runs.

## The escape hatch: `.modify(fn)`

As in the C# dialect, `.modify(fn)` hands `fn` the live `CsharpDocument`; parse its `text` with
`astLibrary` (`web-tree-sitter`) and the exported `language`. Use it for registrations the op does
not write, such as `AddDbContext<ShopDb>(...)` or a factory lambda.
