import { describe, it, expect } from "bun:test";
import * as angular from "../../../src/dialects/angular/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

const COMPONENT_PATH = "src/app/app.ts";
const CONFIG_PATH = "src/app/app.config.ts";
const MAIN_PATH = "src/main.ts";

async function edit(path: string, seed: string, run: () => PromiseLike<void>): Promise<string | undefined> {
  const { client, emitted } = makeSpyClient({ [path]: seed });
  await defineFactory<void>(async () => {
    await run();
  })(undefined, { client });
  const modifies = collectModifies(emitted);
  expect(modifies.length).toBeLessThanOrEqual(1);
  return modifies[0]?.modify.content;
}

async function expectReject(path: string, seed: string, run: () => PromiseLike<void>): Promise<Error> {
  const { client, emitted } = makeSpyClient({ [path]: seed });
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
  expect(await client.read(path)).toBe(seed);
  return caught as Error;
}

const COMPONENT = [
  'import { Component } from "@angular/core";',
  "",
  "@Component({",
  '  selector: "app-root",',
  "  imports: [],",
  '  templateUrl: "./app.html",',
  "})",
  "export class App {}",
  "",
].join("\n");

const CONFIG = [
  'import { ApplicationConfig } from "@angular/core";',
  'import { provideRouter } from "@angular/router";',
  'import { routes } from "./app.routes";',
  "",
  "export const appConfig: ApplicationConfig = {",
  "  providers: [provideRouter(routes)],",
  "};",
  "",
].join("\n");

const HTTP_IMPORTS = [
  { name: "provideHttpClient", from: "@angular/common/http" },
  { name: "withFetch", from: "@angular/common/http" },
];

describe("angular @Component ops", () => {
  it("addComponentImport imports the symbol and appends it to the component's imports", async () => {
    const content = await edit(COMPONENT_PATH, COMPONENT, () =>
      angular.find(COMPONENT_PATH).addComponentImport("RouterOutlet", [{ name: "RouterOutlet", from: "@angular/router" }])
    );
    expect(content).toBe(
      [
        'import { Component } from "@angular/core";',
        'import { RouterOutlet } from "@angular/router";',
        "",
        "@Component({",
        '  selector: "app-root",',
        "  imports: [RouterOutlet],",
        '  templateUrl: "./app.html",',
        "})",
        "export class App {}",
        "",
      ].join("\n")
    );
  });

  it("addComponentImport creates the imports array when the metadata has none", async () => {
    const seed = '@Component({ selector: "x" })\nexport class X {}\n';
    const content = await edit(COMPONENT_PATH, seed, () => angular.find(COMPONENT_PATH).addComponentImport("DatePipe"));
    expect(content).toBe('@Component({ selector: "x", imports: [DatePipe] })\nexport class X {}\n');
  });

  it("addComponentImport is a no-op when the element and its import are already there", async () => {
    const seed = 'import { DatePipe } from "@angular/common";\n\n@Component({ imports: [DatePipe] })\nexport class X {}\n';
    const content = await edit(COMPONENT_PATH, seed, () =>
      angular.find(COMPONENT_PATH).addComponentImport("DatePipe", [{ name: "DatePipe", from: "@angular/common" }])
    );
    expect(content ?? seed).toBe(seed);
  });

  it("addComponentProvider appends an expression to providers, creating the array", async () => {
    const seed = "@Component({})\nexport class X {}\n";
    const content = await edit(COMPONENT_PATH, seed, () =>
      angular
        .find(COMPONENT_PATH)
        .addComponentProvider({ expression: "{ provide: TOKEN, useValue: 1 }" }, [{ name: "TOKEN", from: "./token" }])
    );
    expect(content).toBe('import { TOKEN } from "./token";\n\n@Component({ providers: [{ provide: TOKEN, useValue: 1 }] })\nexport class X {}\n');
  });

  it("rejects a file without @Component and leaves it unchanged", async () => {
    const error = await expectReject(COMPONENT_PATH, "export class X {}\n", () =>
      angular.find(COMPONENT_PATH).addComponentImport("DatePipe")
    );
    expect(error.message).toBe(
      `dialect operation failed: addComponentImport("DatePipe") on "${COMPONENT_PATH}" — no "@Component" decorator was found. Edit it with .modify().`
    );
  });

  it("rejects malformed imports without touching the file", async () => {
    const error = await expectReject(COMPONENT_PATH, COMPONENT, () =>
      angular.find(COMPONENT_PATH).addComponentImport("DatePipe", [{ name: "DatePipe" }] as never)
    );
    expect(error.message).toContain("`imports` must be a list of { name, from }");
  });
});

describe("angular addRootProvider", () => {
  it("appends to the providers of the ApplicationConfig variable, with its imports", async () => {
    const content = await edit(CONFIG_PATH, CONFIG, () =>
      angular.find(CONFIG_PATH).addRootProvider({ expression: "provideHttpClient(withFetch())" }, HTTP_IMPORTS)
    );
    expect(content).toBe(
      [
        'import { ApplicationConfig } from "@angular/core";',
        'import { provideRouter } from "@angular/router";',
        'import { routes } from "./app.routes";',
        'import { provideHttpClient, withFetch } from "@angular/common/http";',
        "",
        "export const appConfig: ApplicationConfig = {",
        "  providers: [provideRouter(routes), provideHttpClient(withFetch())],",
        "};",
        "",
      ].join("\n")
    );
  });

  it("finds a config declared with satisfies ApplicationConfig under any name", async () => {
    const seed = "export const serverConfig = { providers: [] } satisfies ApplicationConfig;\n";
    const content = await edit(CONFIG_PATH, seed, () => angular.find(CONFIG_PATH).addRootProvider({ expression: "provideServerRendering()" }));
    expect(content).toBe("export const serverConfig = { providers: [provideServerRendering()] } satisfies ApplicationConfig;\n");
  });

  it("is a no-op for a provider already listed", async () => {
    const seed = "export const appConfig: ApplicationConfig = { providers: [provideHttpClient( withFetch() )] };\n";
    const content = await edit(CONFIG_PATH, seed, () => angular.find(CONFIG_PATH).addRootProvider({ expression: "provideHttpClient(withFetch())" }));
    expect(content ?? seed).toBe(seed);
  });

  it("falls back to an inline bootstrapApplication config, creating it when missing", async () => {
    const seed = "bootstrapApplication(App);\n";
    const content = await edit(MAIN_PATH, seed, () => angular.find(MAIN_PATH).addRootProvider({ expression: "provideAnimations()" }));
    expect(content).toBe("bootstrapApplication(App, { providers: [provideAnimations()] });\n");
  });

  it("rejects when bootstrapApplication receives an imported config, naming the module to edit", async () => {
    const seed = 'import { appConfig } from "./app/app.config";\n\nbootstrapApplication(App, appConfig);\n';
    const error = await expectReject(MAIN_PATH, seed, () => angular.find(MAIN_PATH).addRootProvider("X"));
    expect(error.message).toBe(
      `dialect operation failed: addRootProvider("X") on "${MAIN_PATH}" — the bootstrapApplication config is "appConfig", imported from "./app/app.config"; ` +
        "add the provider in that file. Edit it with .modify()."
    );
  });

  it("rejects a file with neither an ApplicationConfig variable nor a bootstrapApplication call", async () => {
    const error = await expectReject(CONFIG_PATH, "export const x = 1;\n", () => angular.find(CONFIG_PATH).addRootProvider("X"));
    expect(error.message).toBe(
      `dialect operation failed: addRootProvider("X") on "${CONFIG_PATH}" — no top-level variable typed ApplicationConfig and no bootstrapApplication call was found. ` +
        "Edit it with .modify()."
    );
  });

  it("rejects two ApplicationConfig variables", async () => {
    const seed = "export const a: ApplicationConfig = { providers: [] };\nexport const b: ApplicationConfig = { providers: [] };\n";
    const error = await expectReject(CONFIG_PATH, seed, () => angular.find(CONFIG_PATH).addRootProvider("X"));
    expect(error.message).toContain("2 top-level variables are typed ApplicationConfig; exactly one is required");
  });
});
