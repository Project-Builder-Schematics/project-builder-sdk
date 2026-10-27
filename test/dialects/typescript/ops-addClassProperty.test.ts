/**
 * `addClassProperty(className, name, initializer, options?)`: placement among the class's
 * members, layout, modifiers, the structural duplicate no-op, and the validation and location
 * rejects.
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";

type Handle = ReturnType<typeof ts.find>;
type Options = Parameters<Handle["addClassProperty"]>[3];

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

async function expectAdd(seed: string, args: [string, string, string, Options?], expected: string) {
  const { caught, modifies } = await run(seed, (h) => h.addClassProperty(...args));
  expect(caught).toBeUndefined();
  expect(modifies).toHaveLength(1);
  expect(modifies[0]?.modify.content).toBe(expected);
}

async function expectReject(seed: string, args: unknown[]): Promise<string> {
  const { caught, modifies, content } = await run(seed, (h) =>
    (h.addClassProperty as (...a: unknown[]) => PromiseLike<unknown>)(...args)
  );
  expect(caught).toBeInstanceOf(Error);
  expect(modifies).toHaveLength(0);
  expect(content).toBe(seed);
  return (caught as Error).message;
}

describe("addClassProperty — placement and layout", () => {
  it("goes after the last property, before the constructor, with the members' indentation", async () => {
    await expectAdd(
      "export class A {\n  a = 1;\n\n  constructor() {}\n}\n",
      ["A", "b", "2", { scope: "private", readonly: true }],
      "export class A {\n  a = 1;\n  private readonly b = 2;\n\n  constructor() {}\n}\n"
    );
  });

  it("keeps a trailing comment on the line of the property it belongs to", async () => {
    await expectAdd("class A {\n  a = 1; // first\n}\n", ["A", "b", "2"], "class A {\n  a = 1; // first\n  b = 2;\n}\n");
  });

  it("counts a decorated property as a property", async () => {
    await expectAdd(
      "class A {\n    @Input() a = 1;\n    m() {}\n}\n",
      ["A", "b", "2"],
      "class A {\n    @Input() a = 1;\n    b = 2;\n    m() {}\n}\n"
    );
  });

  it("goes first when the class has no property, above the first member's JSDoc", async () => {
    await expectAdd(
      "class A {\n  /** Docs. */\n  m() {}\n}\n",
      ["A", "b", "2", { scope: "protected" }],
      "class A {\n  protected b = 2;\n  /** Docs. */\n  m() {}\n}\n"
    );
  });

  it("fills an empty class at the class's indentation plus two spaces", async () => {
    await expectAdd("namespace N {\n    class A {}\n}\n", ["A", "b", "2"], "namespace N {\n    class A {\n      b = 2;\n    }\n}\n");
  });

  it("keeps a one-line class on one line", async () => {
    await expectAdd("class A { a = 1; m() {} }\n", ["A", "b", "2"], "class A { a = 1; b = 2; m() {} }\n");
    await expectAdd("class A { m() {} }\n", ["A", "b", "2"], "class A { b = 2; m() {} }\n");
  });

  it("writes the initializer as given, once validated", async () => {
    await expectAdd(
      "class A {}\n",
      ["A", "total", "computed(() => this.a() * 2)", { readonly: true }],
      "class A {\n  readonly total = computed(() => this.a() * 2);\n}\n"
    );
  });
});

describe("addClassProperty — duplicates", () => {
  it("is a no-op for the same declaration, ignoring spacing and the semicolon", async () => {
    const seed = "class A {\n  private readonly b = inject( B )\n}\n";
    const { caught, modifies, content } = await run(seed, (h) =>
      h.addClassProperty("A", "b", "inject(B)", { scope: "private", readonly: true })
    );
    expect(caught).toBeUndefined();
    expect(modifies).toHaveLength(0);
    expect(content).toBe(seed);
  });

  it("rejects a different property with the same name", async () => {
    const message = await expectReject("class A {\n  b = 1;\n}\n", ["A", "b", "2"]);
    expect(message).toBe(
      'dialect operation failed: addClassProperty("A", "b") on "a.ts" — the class already has a different member named "b". ' +
        "Edit it with .modify()."
    );
  });

  it("rejects a method with the same name", async () => {
    const message = await expectReject("class A {\n  b() {}\n}\n", ["A", "b", "2"]);
    expect(message).toContain('the class already has a different member named "b"');
  });
});

describe("addClassProperty — rejects", () => {
  it("rejects a missing class", async () => {
    const message = await expectReject("class B {}\n", ["A", "b", "2"]);
    expect(message).toBe('dialect operation failed: addClassProperty("A", "b") on "a.ts" — no class named "A" was found. Edit it with .modify().');
  });

  it("rejects two classes with the name", async () => {
    const message = await expectReject("namespace X { class A {} }\nnamespace Y { class A {} }\n", ["A", "b", "2"]);
    expect(message).toContain('2 classes are named "A"; exactly one is required');
  });

  it("rejects an initializer that is not exactly one expression", async () => {
    const message = await expectReject("class A {}\n", ["A", "b", "1; evil()"]);
    expect(message).toContain("must be exactly one JavaScript expression");
  });

  it("rejects an invalid property name", async () => {
    await expectReject("class A {}\n", ["A", "b-c", "1"]);
  });

  it("rejects unknown options", async () => {
    const message = await expectReject("class A {}\n", ["A", "b", "1", { scope: "internal" }]);
    expect(message).toContain("`options` must be { scope?, readonly? }");
  });
});
