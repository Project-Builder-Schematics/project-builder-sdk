import { describe, it, expect } from "bun:test";
import * as react from "../../../src/dialects/react/index.ts";
import type { JsxTarget } from "../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

const ROUTES =
  "const el = (\n" +
  "  <Routes>\n" +
  '    <Route path="/" element={<Home />} />\n' +
  '    <Route path="/users" element={<Users />} />\n' +
  "  </Routes>\n" +
  ");\n";

async function setProp(source: string, target: JsxTarget, prop: string, value?: string) {
  const { client, emitted } = makeSpyClient({ "App.tsx": source });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await react.find("App.tsx").setJsxProp(target, prop, value);
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), content: await client.read("App.tsx") };
}

describe("JSX target — tag + props", () => {
  it("a prop value narrows several same-tag elements to the one whose initializer text matches", async () => {
    const { caught, modifies } = await setProp(ROUTES, { tag: "Route", props: { path: '"/users"' } }, "caseSensitive");

    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe(ROUTES.replace("element={<Users />}", "element={<Users />} caseSensitive"));
  });

  it("an expression initializer is matched by its source text", async () => {
    const source = "const el = <><Field name={first} /><Field name={last} /></>;\n";
    const { modifies } = await setProp(source, { tag: "Field", props: { name: "{last}" } }, "required");

    expect(modifies[0]?.modify.content).toBe("const el = <><Field name={first} /><Field name={last} required /></>;\n");
  });

  it("`true` matches a prop that is present with any value, shorthand included", async () => {
    const source = "const el = <><Button /><Button disabled /></>;\n";
    const { modifies } = await setProp(source, { tag: "Button", props: { disabled: true } }, "title", '"busy"');

    expect(modifies[0]?.modify.content).toBe('const el = <><Button /><Button disabled title="busy" /></>;\n');
  });

  it("a target object without props behaves as the tag string", async () => {
    const source = "const el = <Button />;\n";
    const { modifies } = await setProp(source, { tag: "Button" }, "disabled");

    expect(modifies[0]?.modify.content).toBe("const el = <Button disabled />;\n");
  });

  it("zero matches reject naming the tag and the prop names, never the prop values, and leave the file unchanged", async () => {
    const { caught, modifies, content } = await setProp(ROUTES, { tag: "Route", props: { path: '"/secret-value"' } }, "x");

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain("`Route`");
    expect(message).toContain("`path`");
    expect(message).not.toContain("secret-value");
    expect(modifies).toHaveLength(0);
    expect(content).toBe(ROUTES);
  });

  it("several matches still reject, naming the count", async () => {
    const { caught, modifies } = await setProp(ROUTES, { tag: "Route", props: { element: true } }, "x");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("matched 2 elements");
    expect(modifies).toHaveLength(0);
  });

  it("an invalid prop name in the target rejects before any mutation", async () => {
    const { caught, modifies } = await setProp(ROUTES, { tag: "Route", props: { "bad name": true } }, "x");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`propName`");
    expect(modifies).toHaveLength(0);
  });

  it("a prop value that is neither a string nor true rejects before any mutation", async () => {
    const target = { tag: "Route", props: { path: 1 } } as unknown as JsxTarget;
    const { caught, modifies } = await setProp(ROUTES, target, "x");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`target.props`");
    expect(modifies).toHaveLength(0);
  });
});
