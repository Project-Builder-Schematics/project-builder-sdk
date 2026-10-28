import { describe, it, expect } from "bun:test";
import * as angular from "../../../src/dialects/angular/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

const PATH = "src/app/app.module.ts";

async function run(seed: string, apply: () => PromiseLike<void>) {
  const { client, emitted } = makeSpyClient({ [PATH]: seed });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await apply();
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught: caught as Error | undefined, modifies: collectModifies(emitted), content: await client.read(PATH) };
}

const MODULE = [
  'import { NgModule } from "@angular/core";',
  "",
  "@NgModule({",
  "  declarations: [App],",
  "  imports: [BrowserModule],",
  "  bootstrap: [App],",
  "})",
  "export class AppModule {}",
  "",
].join("\n");

describe("angular @NgModule ops", () => {
  it("addDeclaration imports the component and appends it to declarations", async () => {
    const { caught, modifies } = await run(MODULE, () =>
      angular.find(PATH).addDeclaration("UserCard", [{ name: "UserCard", from: "./user-card" }])
    );
    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe(
      [
        'import { NgModule } from "@angular/core";',
        'import { UserCard } from "./user-card";',
        "",
        "@NgModule({",
        "  declarations: [App, UserCard],",
        "  imports: [BrowserModule],",
        "  bootstrap: [App],",
        "})",
        "export class AppModule {}",
        "",
      ].join("\n")
    );
  });

  it("addNgModuleImport takes an expression such as a forRoot call", async () => {
    const { modifies } = await run(MODULE, () =>
      angular.find(PATH).addNgModuleImport({ expression: "StoreModule.forRoot({})" }, [{ name: "StoreModule", from: "@ngrx/store" }])
    );
    expect(modifies[0]?.modify.content).toContain("  imports: [BrowserModule, StoreModule.forRoot({})],\n");
  });

  it("addNgModuleProvider, addNgModuleExport and addBootstrap create their arrays", async () => {
    const seed = "@NgModule({})\nexport class M {}\n";
    const { modifies } = await run(seed, () =>
      angular.find(PATH).addNgModuleProvider("Api").addNgModuleExport("Shared").addBootstrap("Shell")
    );
    expect(modifies[0]?.modify.content).toBe("@NgModule({ providers: [Api], exports: [Shared], bootstrap: [Shell] })\nexport class M {}\n");
  });

  it("is a no-op for an entry already listed", async () => {
    const { caught, modifies } = await run(MODULE, () => angular.find(PATH).addDeclaration("App"));
    expect(caught).toBeUndefined();
    expect(modifies).toHaveLength(0);
  });

  it("rejects a file without @NgModule, leaving it unchanged", async () => {
    const seed = "@Component({})\nexport class App {}\n";
    const { caught, modifies, content } = await run(seed, () => angular.find(PATH).addNgModuleProvider("Api"));
    expect(caught?.message).toBe(
      `dialect operation failed: addNgModuleProvider("Api") on "${PATH}" — no "@NgModule" decorator was found. Edit it with .modify().`
    );
    expect(modifies).toHaveLength(0);
    expect(content).toBe(seed);
  });
});

describe("angular routes in an NgModule", () => {
  it("addRoute appends to the inline array of RouterModule.forRoot", async () => {
    const seed = '@NgModule({\n  imports: [RouterModule.forRoot([{ path: "", component: Home }])],\n})\nexport class AppRoutingModule {}\n';
    const { caught, modifies } = await run(seed, () => angular.find(PATH).addRoute({ path: "about", component: "About", from: "./about" }));
    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe(
      'import { About } from "./about";\n\n' +
        '@NgModule({\n  imports: [RouterModule.forRoot([{ path: "", component: Home }, { path: "about", component: About }])],\n})\n' +
        "export class AppRoutingModule {}\n"
    );
  });

  it("addLazyRoute follows an untyped routes variable passed to forChild, before the wildcard", async () => {
    const seed = [
      "const routes = [",
      '  { path: "", component: List },',
      '  { path: "**", redirectTo: "" },',
      "];",
      "",
      "@NgModule({ imports: [RouterModule.forChild(routes)] })",
      "export class UsersRoutingModule {}",
      "",
    ].join("\n");
    const { modifies } = await run(seed, () =>
      angular.find(PATH).addLazyRoute({ path: "detail", loadComponent: "./detail", export: "Detail" })
    );
    expect(modifies[0]?.modify.content).toContain(
      '  { path: "", component: List },\n  { path: "detail", loadComponent: () => import("./detail").then((m) => m.Detail) },\n  { path: "**", redirectTo: "" },'
    );
  });

  it("prefers a typed Routes variable over the forRoot argument", async () => {
    const seed = "const routes: Routes = [];\nconst other = [];\n@NgModule({ imports: [RouterModule.forRoot(other)] })\nexport class M {}\n";
    const { modifies } = await run(seed, () => angular.find(PATH).addLazyRoute({ path: "a", loadChildren: "./a" }));
    expect(modifies[0]?.modify.content).toContain('const routes: Routes = [{ path: "a", loadChildren: () => import("./a") }];');
    expect(modifies[0]?.modify.content).toContain("const other = [];");
  });

  it("rejects a file with neither shape, naming both", async () => {
    const { caught } = await run("export const x = 1;\n", () => angular.find(PATH).addLazyRoute({ path: "a", loadChildren: "./a" }));
    expect(caught?.message).toBe(
      `dialect operation failed: addLazyRoute("a") on "${PATH}" — no top-level variable typed Routes or Route[] and no ` +
        "RouterModule.forRoot or forChild call was found. Edit it with .modify()."
    );
  });

  it("rejects two RouterModule calls", async () => {
    const seed = "@NgModule({ imports: [RouterModule.forRoot([]), RouterModule.forChild([])] })\nexport class M {}\n";
    const { caught } = await run(seed, () => angular.find(PATH).addLazyRoute({ path: "a", loadChildren: "./a" }));
    expect(caught?.message).toContain("2 RouterModule.forRoot or forChild calls were found; exactly one is required");
  });

  it("rejects a forRoot argument that is neither an array nor a same-file array variable", async () => {
    const seed = 'import { routes } from "./routes";\n@NgModule({ imports: [RouterModule.forRoot(routes)] })\nexport class M {}\n';
    const { caught } = await run(seed, () => angular.find(PATH).addLazyRoute({ path: "a", loadChildren: "./a" }));
    expect(caught?.message).toContain("the RouterModule routes are not an array literal in this file");
  });
});
