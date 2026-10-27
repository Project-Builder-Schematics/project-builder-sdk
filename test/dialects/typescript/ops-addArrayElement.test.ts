/**
 * `addArrayElement(locator, element)`: the locator (typed root + path), layout-preserving
 * append, created missing levels, structural duplicate no-op, and the validation and
 * location rejects.
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";

type Handle = ReturnType<typeof ts.find>;
type Locator = Parameters<Handle["addArrayElement"]>[0];
type Element = Parameters<Handle["addArrayElement"]>[1];

async function run(seed: string, apply: (handle: Handle) => PromiseLike<unknown>) {
  const { client, emitted } = makeSpyClient({ "a.ts": seed });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await apply(ts.find("a.ts"));
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), content: await client.read("a.ts") };
}

async function expectAppend(seed: string, locator: Locator, element: Element, expected: string) {
  const { caught, modifies } = await run(seed, (h) => h.addArrayElement(locator, element));
  expect(caught).toBeUndefined();
  expect(modifies).toHaveLength(1);
  expect(modifies[0]?.modify.content).toBe(expected);
}

async function expectNoOp(seed: string, locator: Locator, element: Element) {
  const { caught, modifies, content } = await run(seed, (h) => h.addArrayElement(locator, element));
  expect(caught).toBeUndefined();
  expect(modifies).toHaveLength(0);
  expect(content).toBe(seed);
}

async function expectReject(seed: string, locator: unknown, element: unknown): Promise<string> {
  const { caught, modifies, content } = await run(seed, (h) =>
    h.addArrayElement(locator as Locator, element as Element)
  );
  expect(caught).toBeInstanceOf(Error);
  const message = (caught as Error).message;
  expect(message).toStartWith("dialect operation failed: ");
  expect(modifies).toHaveLength(0);
  expect(content).toBe(seed);
  return message;
}

function locationMessage(locator: string, reason: string): string {
  return `dialect operation failed: addArrayElement(${locator}) on "a.ts" — ${reason}. Edit it with .modify().`;
}

const APP_CONFIG = { variable: "appConfig", path: ["providers"] } as const;
const APP_CONFIG_ECHO = '{"variable":"appConfig","path":["providers"]}';

describe("addArrayElement — variable root", () => {
  it("appends an identifier to a one-line array", async () => {
    await expectAppend(
      "export const appConfig = { providers: [A] };\n",
      APP_CONFIG,
      "B",
      "export const appConfig = { providers: [A, B] };\n"
    );
  });

  it("appends to a multi-line array at the last entry's indentation, keeping the trailing comma", async () => {
    await expectAppend(
      "export const appConfig = {\n  providers: [\n    A,\n  ],\n};\n",
      APP_CONFIG,
      "B",
      "export const appConfig = {\n  providers: [\n    A,\n    B,\n  ],\n};\n"
    );
  });

  it("appends an { expression } element", async () => {
    await expectAppend(
      "export const appConfig = { providers: [provideRouter(routes)] };\n",
      APP_CONFIG,
      { expression: "provideHttpClient()" },
      "export const appConfig = { providers: [provideRouter(routes), provideHttpClient()] };\n"
    );
  });

  it("fills an empty array", async () => {
    await expectAppend("export const appConfig = { providers: [] };\n", APP_CONFIG, "A", "export const appConfig = { providers: [A] };\n");
  });

  it("looks through `satisfies` and `as` around the initializer", async () => {
    await expectAppend(
      "export const appConfig = { providers: [A] } satisfies ApplicationConfig;\n",
      APP_CONFIG,
      "B",
      "export const appConfig = { providers: [A, B] } satisfies ApplicationConfig;\n"
    );
    await expectAppend(
      "export const appConfig = { providers: [A] as Provider[] };\n",
      APP_CONFIG,
      "B",
      "export const appConfig = { providers: [A, B] as Provider[] };\n"
    );
  });

  it("matches a quoted property key", async () => {
    await expectAppend(
      'export const appConfig = { "providers": [A] };\n',
      APP_CONFIG,
      "B",
      'export const appConfig = { "providers": [A, B] };\n'
    );
  });

  it("targets the variable's own array when the path is empty", async () => {
    await expectAppend(
      'export const routes = [{ path: "" }];\n',
      { variable: "routes", path: [] },
      { expression: '{ path: "admin", component: Admin }' },
      'export const routes = [{ path: "" }, { path: "admin", component: Admin }];\n'
    );
  });
});

describe("addArrayElement — call and decorator roots", () => {
  it("appends inside an argument of the only call to the callee", async () => {
    await expectAppend(
      "bootstrapApplication(App, { providers: [A] });\n",
      { call: "bootstrapApplication", argument: 1, path: ["providers"] },
      "B",
      "bootstrapApplication(App, { providers: [A, B] });\n"
    );
  });

  it("creates the next missing call argument", async () => {
    await expectAppend(
      "bootstrapApplication(App);\n",
      { call: "bootstrapApplication", argument: 1, path: ["providers"] },
      "X",
      "bootstrapApplication(App, { providers: [X] });\n"
    );
  });

  it("appends inside the only decorator's argument", async () => {
    await expectAppend(
      "@NgModule({ imports: [A] })\nexport class AppModule {}\n",
      { decorator: "NgModule", path: ["imports"] },
      "B",
      "@NgModule({ imports: [A, B] })\nexport class AppModule {}\n"
    );
  });

  it("creates the decorator's missing argument", async () => {
    await expectAppend(
      "@NgModule()\nexport class AppModule {}\n",
      { decorator: "NgModule", path: ["imports"] },
      "X",
      "@NgModule({ imports: [X] })\nexport class AppModule {}\n"
    );
  });
});

describe("addArrayElement — path segments and missing levels", () => {
  const ROUTES = 'export const routes = [\n  { path: "", component: Home },\n  { path: "admin", providers: [A] },\n];\n';

  it("selects the only array element whose property equals the match value", async () => {
    await expectAppend(
      ROUTES,
      { variable: "routes", path: [{ path: "admin" }, "providers"] },
      "B",
      'export const routes = [\n  { path: "", component: Home },\n  { path: "admin", providers: [A, B] },\n];\n'
    );
  });

  it("creates a missing key on the matched element", async () => {
    await expectAppend(
      ROUTES,
      { variable: "routes", path: [{ path: "" }, "providers"] },
      "X",
      'export const routes = [\n  { path: "", component: Home, providers: [X] },\n  { path: "admin", providers: [A] },\n];\n'
    );
  });

  it("creates the final array when the key is missing", async () => {
    await expectAppend("export const appConfig = {};\n", APP_CONFIG, "X", "export const appConfig = { providers: [X] };\n");
  });

  it("creates every missing intermediate object", async () => {
    await expectAppend(
      "export const config = { a: 1 };\n",
      { variable: "config", path: ["b", "c"] },
      "X",
      "export const config = { a: 1, b: { c: [X] } };\n"
    );
  });

  it("is a no-op when run again on its own created output", async () => {
    await expectNoOp("bootstrapApplication(App, { providers: [X] });\n", { call: "bootstrapApplication", argument: 1, path: ["providers"] }, "X");
  });

  it("rejects when the match selects no element", async () => {
    const message = await expectReject(ROUTES, { variable: "routes", path: [{ path: "users" }, "providers"] }, "X");
    expect(message).toBe(locationMessage('{"variable":"routes","path":[{"path":"users"},"providers"]}', "path[0] matched no element"));
  });

  it("rejects when the match selects several elements", async () => {
    const seed = 'export const routes = [{ path: "a" }, { path: "a" }];\n';
    const message = await expectReject(seed, { variable: "routes", path: [{ path: "a" }, "providers"] }, "X");
    expect(message).toBe(
      locationMessage('{"variable":"routes","path":[{"path":"a"},"providers"]}', "path[0] matched 2 elements; exactly one is required")
    );
  });

  it("rejects a match segment after a missing key, which cannot be created", async () => {
    const message = await expectReject("export const config = {};\n", { variable: "config", path: ["routes", { path: "a" }, "providers"] }, "X");
    expect(message).toContain('path[0] "routes" is missing and cannot be created before a match segment');
  });

  it("rejects a target that is not an array literal", async () => {
    const message = await expectReject("export const appConfig = { providers: base };\n", APP_CONFIG, "X");
    expect(message).toBe(locationMessage(APP_CONFIG_ECHO, "the target is not an array literal"));
  });

  it("rejects a key applied to something that is not an object literal", async () => {
    const message = await expectReject("export const appConfig = makeConfig();\n", APP_CONFIG, "X");
    expect(message).toBe(locationMessage(APP_CONFIG_ECHO, 'path[0] "providers" expects an object literal'));
  });

  it("rejects a shorthand property it would have to look into", async () => {
    const message = await expectReject("export const appConfig = { providers };\n", APP_CONFIG, "X");
    expect(message).toBe(locationMessage(APP_CONFIG_ECHO, 'path[0] "providers" is not a plain property assignment'));
  });
});

describe("addArrayElement — root lookup rejects", () => {
  it("rejects a missing variable", async () => {
    const message = await expectReject("export const other = { providers: [] };\n", APP_CONFIG, "X");
    expect(message).toBe(locationMessage(APP_CONFIG_ECHO, 'no top-level variable named "appConfig" was found'));
  });

  it("rejects a variable without an initializer", async () => {
    const message = await expectReject("export let appConfig;\n", APP_CONFIG, "X");
    expect(message).toBe(locationMessage(APP_CONFIG_ECHO, '"appConfig" has no initializer'));
  });

  it("rejects several calls to the callee", async () => {
    const message = await expectReject("f({ a: [] });\nf({ a: [] });\n", { call: "f", argument: 0, path: ["a"] }, "X");
    expect(message).toBe(locationMessage('{"call":"f","argument":0,"path":["a"]}', '2 calls to "f" were found; exactly one is required'));
  });

  it("rejects a missing call", async () => {
    const message = await expectReject("g();\n", { call: "f", argument: 0, path: [] }, "X");
    expect(message).toBe(locationMessage('{"call":"f","argument":0,"path":[]}', 'no call to "f" was found'));
  });

  it("rejects an argument beyond the next one", async () => {
    const message = await expectReject("f();\n", { call: "f", argument: 1, path: ["a"] }, "X");
    expect(message).toBe(locationMessage('{"call":"f","argument":1,"path":["a"]}', '"f" is called with 0 arguments; only argument 0 can be created'));
  });

  it("rejects several decorators with the name", async () => {
    const seed = "@NgModule({})\nclass A {}\n@NgModule({})\nclass B {}\n";
    const message = await expectReject(seed, { decorator: "NgModule", path: ["imports"] }, "X");
    expect(message).toBe(
      locationMessage('{"decorator":"NgModule","path":["imports"]}', '2 "@NgModule" decorators were found; exactly one is required')
    );
  });

  it("rejects a missing decorator", async () => {
    const message = await expectReject("class A {}\n", { decorator: "NgModule", path: ["imports"] }, "X");
    expect(message).toBe(locationMessage('{"decorator":"NgModule","path":["imports"]}', 'no "@NgModule" decorator was found'));
  });
});

describe("addArrayElement — structural duplicates", () => {
  it("is a no-op when the identifier is already listed", async () => {
    await expectNoOp("export const appConfig = { providers: [A, B] };\n", APP_CONFIG, "B");
  });

  it("is a no-op when the same expression is listed with different spacing, comments, and trailing comma", async () => {
    await expectNoOp(
      "export const appConfig = { providers: [provideHttpClient( withFetch(), /* fetch */ )] };\n",
      APP_CONFIG,
      { expression: "provideHttpClient(withFetch())" }
    );
  });

  it("appends a different expression", async () => {
    await expectAppend(
      "export const appConfig = { providers: [provideHttpClient(withFetch())] };\n",
      APP_CONFIG,
      { expression: "provideHttpClient()" },
      "export const appConfig = { providers: [provideHttpClient(withFetch()), provideHttpClient()] };\n"
    );
  });
});

describe("addArrayElement — element validation", () => {
  const SEED = "export const appConfig = { providers: [A] };\n";

  it("rejects an identifier element that is not a JavaScript identifier, echoing nothing", async () => {
    const message = await expectReject(SEED, APP_CONFIG, "x]; process.exit(");
    expect(message).toBe(
      "dialect operation failed: `element` must be a valid JavaScript identifier — fix the name, or use `.modify()` to make this edit directly."
    );
  });

  for (const payload of ['x } from "evil"; import { y', "x\ny", "x/*", "x`", "1x", ""]) {
    it(`rejects the injection-shaped identifier ${JSON.stringify(payload)} for element and root names`, async () => {
      expect(await expectReject(SEED, APP_CONFIG, payload)).toContain("`element` must be a valid JavaScript identifier");
      expect(await expectReject(SEED, { variable: payload, path: [] }, "X")).toContain("`variable` must be a valid JavaScript identifier");
      expect(await expectReject(SEED, { call: payload, argument: 0, path: [] }, "X")).toContain("`call` must be a valid JavaScript identifier");
      expect(await expectReject(SEED, { decorator: payload, path: [] }, "X")).toContain("`decorator` must be a valid JavaScript identifier");
    });
  }

  for (const [label, expression] of [
    ["array breakout", "a]; evil("],
    ["two elements", "a, b"],
    ["line comment eating the bracket", "a //"],
    ["block comment eating the bracket", "a /*"],
    ["spread", "...others"],
    ["empty", ""],
    ["element access breakout", "a]\n[b"],
  ] as const) {
    it(`rejects an { expression } that is not exactly one expression: ${label}`, async () => {
      const message = await expectReject(SEED, APP_CONFIG, { expression });
      expect(message).toBe(
        "dialect operation failed: `expression` must be exactly one JavaScript expression — fix the expression, or use `.modify()` to make this edit directly."
      );
    });
  }

  it("rejects an element that is neither a string nor { expression }", async () => {
    for (const element of [42, null, {}, { expression: 1 }, { expression: "a", extra: true }]) {
      const message = await expectReject(SEED, APP_CONFIG, element);
      expect(message).toContain("`element` must be an identifier string or { expression: string }");
    }
  });

  it("validates the element before the duplicate no-op", async () => {
    await expectReject("export const appConfig = { providers: [A] };\n", APP_CONFIG, "A B");
  });
});

describe("addArrayElement — locator validation", () => {
  const SEED = "export const appConfig = { providers: [A] };\n";
  const SHAPE = "`locator` must be { variable, path }, { call, argument, path }, or { decorator, path }";

  for (const [label, locator] of [
    ["not an object", "appConfig"],
    ["no root", { path: ["providers"] }],
    ["two roots", { variable: "appConfig", decorator: "NgModule", path: [] }],
    ["unknown key", { variable: "appConfig", path: [], unique: true }],
    ["missing path", { variable: "appConfig" }],
    ["path not an array", { variable: "appConfig", path: "providers" }],
    ["argument on a variable root", { variable: "appConfig", argument: 0, path: [] }],
    ["call without argument", { call: "f", path: [] }],
    ["negative argument", { call: "f", argument: -1, path: [] }],
    ["fractional argument", { call: "f", argument: 0.5, path: [] }],
  ] as const) {
    it(`rejects a malformed locator: ${label}`, async () => {
      const message = await expectReject(SEED, locator, "X");
      expect(message).toContain(SHAPE);
    });
  }

  it("validates root names as identifiers", async () => {
    const message = await expectReject(SEED, { variable: "app Config", path: [] }, "X");
    expect(message).toBe(
      "dialect operation failed: `variable` must be a valid JavaScript identifier — fix the name, or use `.modify()` to make this edit directly."
    );
  });

  for (const [label, segment] of [
    ["injection-shaped key", "a: 1, b"],
    ["__proto__ key", "__proto__"],
    ["number segment", 0],
    ["match with two keys", { a: "x", b: "y" }],
    ["match with a non-string value", { path: 1 }],
    ["match with an invalid key", { "a b": "x" }],
  ] as const) {
    it(`rejects a malformed path segment: ${label}`, async () => {
      const message = await expectReject(SEED, { variable: "appConfig", path: [segment] }, "X");
      expect(message).toContain("`path`");
    });
  }

  it("bounds long root names and path keys in the echo", async () => {
    const long = "v".repeat(150);
    for (const locator of [
      { variable: long, path: [] },
      { call: long, argument: 0, path: [] },
      { decorator: long, path: [] },
      { variable: "appConfig", path: [long] },
    ]) {
      const message = await expectReject("export const appConfig = makeConfig();\n", locator, "X");
      expect(message).toContain(`${"v".repeat(100)}…`);
      expect(message).not.toContain("v".repeat(101));
    }
  });

  it("bounds a long match value in the echo", async () => {
    const value = "v".repeat(150);
    const message = await expectReject(SEED, { variable: "appConfig", path: [{ path: value }] }, "X");
    expect(message).toContain(`${"v".repeat(100)}…`);
    expect(message).not.toContain("v".repeat(101));
  });
});
