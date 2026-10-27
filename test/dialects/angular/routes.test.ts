import { describe, it, expect } from "bun:test";
import * as angular from "../../../src/dialects/angular/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

const PATH = "src/app/app.routes.ts";

async function edit(seed: string, run: () => PromiseLike<void>): Promise<string | undefined> {
  const { client, emitted } = makeSpyClient({ [PATH]: seed });
  await defineFactory<void>(async () => {
    await run();
  })(undefined, { client });
  const modifies = collectModifies(emitted);
  expect(modifies.length).toBeLessThanOrEqual(1);
  return modifies[0]?.modify.content;
}

async function expectReject(seed: string, run: () => PromiseLike<void>): Promise<Error> {
  const { client, emitted } = makeSpyClient({ [PATH]: seed });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await run();
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(collectModifies(emitted)).toHaveLength(0);
  expect(await client.read(PATH)).toBe(seed);
  return caught as Error;
}

const ROUTES = [
  'import { Routes } from "@angular/router";',
  'import { Home } from "./home/home";',
  "",
  "export const routes: Routes = [",
  '  { path: "", component: Home },',
  "];",
  "",
].join("\n");

const WITH_WILDCARD = [
  "export const routes: Routes = [",
  '  { path: "", component: Home },',
  '  { path: "**", redirectTo: "" },',
  "];",
  "",
].join("\n");

describe("angular addRoute", () => {
  it("imports the component and appends an eager route", async () => {
    const content = await edit(ROUTES, () => angular.find(PATH).addRoute({ path: "about", component: "About", from: "./about/about" }));
    expect(content).toBe(
      [
        'import { Routes } from "@angular/router";',
        'import { Home } from "./home/home";',
        'import { About } from "./about/about";',
        "",
        "export const routes: Routes = [",
        '  { path: "", component: Home },',
        '  { path: "about", component: About },',
        "];",
        "",
      ].join("\n")
    );
  });

  it("inserts before a wildcard route, which must stay last", async () => {
    const content = await edit(WITH_WILDCARD, () => angular.find(PATH).addRoute({ path: "about", component: "About", from: "./about/about" }));
    expect(content).toBe(
      [
        'import { About } from "./about/about";',
        "",
        "export const routes: Routes = [",
        '  { path: "", component: Home },',
        '  { path: "about", component: About },',
        '  { path: "**", redirectTo: "" },',
        "];",
        "",
      ].join("\n")
    );
  });

  it("inserts before a wildcard route in a one-line array", async () => {
    const seed = 'export const routes: Route[] = [{ path: "**", component: NotFound }];\n';
    const content = await edit(seed, () => angular.find(PATH).addRoute({ path: "a", component: "A", from: "./a" }));
    expect(content).toBe('import { A } from "./a";\n\nexport const routes: Route[] = [{ path: "a", component: A }, { path: "**", component: NotFound }];\n');
  });

  it("finds a routes array declared with satisfies Routes", async () => {
    const seed = "const appRoutes = [] satisfies Routes;\n";
    const content = await edit(seed, () => angular.find(PATH).addRoute({ path: "a", component: "A", from: "./a" }));
    expect(content).toBe('import { A } from "./a";\n\nconst appRoutes = [{ path: "a", component: A }] satisfies Routes;\n');
  });

  it("is a no-op for an equal route", async () => {
    const seed = 'import { About } from "./about/about";\n\nexport const routes: Routes = [{ path: "about", component: About }];\n';
    const content = await edit(seed, () => angular.find(PATH).addRoute({ path: "about", component: "About", from: "./about/about" }));
    expect(content ?? seed).toBe(seed);
  });

  it("rejects a different route with the same path", async () => {
    const seed = 'export const routes: Routes = [{ path: "about", component: Other }];\n';
    const error = await expectReject(seed, () => angular.find(PATH).addRoute({ path: "about", component: "About", from: "./about/about" }));
    expect(error.message).toBe(
      `dialect operation failed: addRoute("about") on "${PATH}" — a different route with path "about" already exists. Edit it with .modify().`
    );
  });

  it("rejects a path starting with a slash", async () => {
    const error = await expectReject(ROUTES, () => angular.find(PATH).addRoute({ path: "/about", component: "About", from: "./about/about" }));
    expect(error.message).toContain('a route path cannot start with "/"');
  });

  it("rejects a file without a Routes variable", async () => {
    const error = await expectReject("export const x = [];\n", () => angular.find(PATH).addRoute({ path: "a", component: "A", from: "./a" }));
    expect(error.message).toBe(
      `dialect operation failed: addRoute("a") on "${PATH}" — no top-level variable typed Routes or Route[] was found. Edit it with .modify().`
    );
  });

  it("rejects a malformed route", async () => {
    const error = await expectReject(ROUTES, () => angular.find(PATH).addRoute({ path: "a", component: "A" } as never));
    expect(error.message).toContain("`route` must be { path, component, from }");
  });
});

describe("angular addLazyRoute", () => {
  it("adds a loadComponent route with the named export", async () => {
    const content = await edit(ROUTES, () =>
      angular.find(PATH).addLazyRoute({ path: "settings", loadComponent: "./settings/settings", export: "Settings" })
    );
    expect(content).toContain('  { path: "settings", loadComponent: () => import("./settings/settings").then((m) => m.Settings) },\n];');
  });

  it("adds a loadChildren route from a default export, with no import", async () => {
    const content = await edit(ROUTES, () => angular.find(PATH).addLazyRoute({ path: "admin", loadChildren: "./admin/admin.routes" }));
    expect(content).toBe(
      [
        'import { Routes } from "@angular/router";',
        'import { Home } from "./home/home";',
        "",
        "export const routes: Routes = [",
        '  { path: "", component: Home },',
        '  { path: "admin", loadChildren: () => import("./admin/admin.routes") },',
        "];",
        "",
      ].join("\n")
    );
  });

  it("inserts before a wildcard route", async () => {
    const content = await edit(WITH_WILDCARD, () => angular.find(PATH).addLazyRoute({ path: "admin", loadChildren: "./admin/admin.routes" }));
    expect(content).toContain('  { path: "admin", loadChildren: () => import("./admin/admin.routes") },\n  { path: "**", redirectTo: "" },');
  });

  it("rejects both loadComponent and loadChildren", async () => {
    const error = await expectReject(ROUTES, () =>
      angular.find(PATH).addLazyRoute({ path: "a", loadComponent: "./a", loadChildren: "./b" } as never)
    );
    expect(error.message).toContain("`route` must be { path, loadComponent | loadChildren, export? }");
  });
});
