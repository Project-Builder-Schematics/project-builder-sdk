import { describe, it, expect } from "bun:test";
import * as angular from "../../../src/dialects/angular/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

const PATH = "src/app/user-card.ts";

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

const COMPONENT = [
  'import { Component } from "@angular/core";',
  "",
  '@Component({ selector: "app-user-card" })',
  "export class UserCard {",
  "  readonly compact = input(false);",
  "",
  "  save() {}",
  "}",
  "",
].join("\n");

const SERVICE = ["@Injectable({ providedIn: \"root\" })", "export class Users {", "  load() {}", "}", ""].join("\n");

describe("angular addInjection", () => {
  it("adds a private readonly inject() field after the last property, importing inject and the token", async () => {
    const content = await edit(COMPONENT, () =>
      angular.find(PATH).addInjection("http", "HttpClient", { imports: [{ name: "HttpClient", from: "@angular/common/http" }] })
    );
    expect(content).toBe(
      [
        'import { Component, inject } from "@angular/core";',
        'import { HttpClient } from "@angular/common/http";',
        "",
        '@Component({ selector: "app-user-card" })',
        "export class UserCard {",
        "  readonly compact = input(false);",
        "  private readonly http = inject(HttpClient);",
        "",
        "  save() {}",
        "}",
        "",
      ].join("\n")
    );
  });

  it("works in an @Injectable service, with a token expression and another scope", async () => {
    const content = await edit(SERVICE, () =>
      angular.find(PATH).addInjection("config", { expression: "forwardRef(() => Config)" }, { scope: "protected" })
    );
    expect(content).toBe(
      'import { inject } from "@angular/core";\n\n' +
        '@Injectable({ providedIn: "root" })\nexport class Users {\n  protected readonly config = inject(forwardRef(() => Config));\n  load() {}\n}\n'
    );
  });

  it("works in a @Service class", async () => {
    const content = await edit("@Service()\nexport class Users {}\n", () => angular.find(PATH).addInjection("router", "Router"));
    expect(content).toBe('import { inject } from "@angular/core";\n\n@Service()\nexport class Users {\n  private readonly router = inject(Router);\n}\n');
  });

  it("is a no-op when the same field is already there", async () => {
    const seed = 'import { inject } from "@angular/core";\n\n@Service()\nexport class Users {\n  private readonly router = inject(Router);\n}\n';
    const content = await edit(seed, () => angular.find(PATH).addInjection("router", "Router"));
    expect(content ?? seed).toBe(seed);
  });

  it("rejects a file without an injectable class", async () => {
    const error = await expectReject("export class Plain {}\n", () => angular.find(PATH).addInjection("router", "Router"));
    expect(error.message).toBe(
      `dialect operation failed: addInjection("router") on "${PATH}" — no class decorated with @Component, @Directive, @Pipe, ` +
        "@Injectable or @Service was found. Edit it with .modify()."
    );
  });
});

describe("angular addInput / addModel / addOutput", () => {
  it("addInput adds a required typed input with its type import", async () => {
    const content = await edit(COMPONENT, () =>
      angular.find(PATH).addInput("user", { type: "User", required: true, imports: [{ name: "User", from: "./user" }] })
    );
    expect(content).toContain('import { Component, input } from "@angular/core";\nimport { User } from "./user";\n');
    expect(content).toContain("  readonly compact = input(false);\n  readonly user = input.required<User>();\n\n  save() {}");
  });

  it("addInput adds an input with a type and an initial value", async () => {
    const content = await edit(COMPONENT, () => angular.find(PATH).addInput("size", { type: '"sm" | "lg"', initial: '"sm"' }));
    expect(content).toContain('  readonly size = input<"sm" | "lg">("sm");\n');
  });

  it("addModel adds a model input", async () => {
    const content = await edit(COMPONENT, () => angular.find(PATH).addModel("value", { initial: "0" }));
    expect(content).toContain('import { Component, model } from "@angular/core";');
    expect(content).toContain("  readonly value = model(0);\n");
  });

  it("addModel adds a required model input", async () => {
    const content = await edit(COMPONENT, () => angular.find(PATH).addModel("checked", { type: "boolean", required: true }));
    expect(content).toContain("  readonly checked = model.required<boolean>();\n");
  });

  it("addOutput adds a typed output", async () => {
    const content = await edit(COMPONENT, () => angular.find(PATH).addOutput("saved", { type: "string" }));
    expect(content).toContain('import { Component, output } from "@angular/core";');
    expect(content).toContain("  readonly saved = output<string>();\n");
  });

  it("an input with no options is a bare input()", async () => {
    const content = await edit("@Directive()\nexport class Tip {}\n", () => angular.find(PATH).addInput("text"));
    expect(content).toBe('import { input } from "@angular/core";\n\n@Directive()\nexport class Tip {\n  readonly text = input();\n}\n');
  });

  it("rejects an input on a class that is not a component or directive", async () => {
    const error = await expectReject(SERVICE, () => angular.find(PATH).addInput("text"));
    expect(error.message).toContain("no class decorated with @Component or @Directive was found");
  });

  it("rejects two components", async () => {
    const seed = "@Component({})\nclass A {}\n@Component({})\nclass B {}\n";
    const error = await expectReject(seed, () => angular.find(PATH).addOutput("saved"));
    expect(error.message).toContain("2 classes are decorated with @Component or @Directive; exactly one is required");
  });

  it("rejects required with an initial value", async () => {
    const error = await expectReject(COMPONENT, () => angular.find(PATH).addInput("user", { required: true, initial: "null" }));
    expect(error.message).toContain("`required` and `initial` cannot be combined");
  });

  it("rejects a type that is not exactly one type", async () => {
    const error = await expectReject(COMPONENT, () => angular.find(PATH).addInput("x", { type: "string>(); evil(<string" }));
    expect(error.message).toContain("`type` must be exactly one TypeScript type");
  });

  it("rejects an initial value that is not exactly one expression", async () => {
    await expectReject(COMPONENT, () => angular.find(PATH).addInput("x", { initial: "1); evil(" }));
  });

  it("rejects unknown options", async () => {
    const error = await expectReject(COMPONENT, () => angular.find(PATH).addOutput("saved", { initial: "1" } as never));
    expect(error.message).toContain("`options` must be { type?, imports? }");
  });
});
