import { describe, it, expect } from "bun:test";
import * as react from "../../../src/dialects/react/index.ts";
import type { JsxTarget } from "../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

async function addChild(source: string, target: JsxTarget, jsx: string) {
  const { client, emitted } = makeSpyClient({ "App.tsx": source });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await react.find("App.tsx").addJsxChild(target, jsx);
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), content: await client.read("App.tsx") };
}

const ROUTES = "const el = (\n  <Routes>\n    <Route path=\"/\" element={<Home />} />\n  </Routes>\n);\n";

describe("addJsxChild", () => {
  it("appends after the last child on its own line, at the siblings' indentation", async () => {
    const { caught, modifies } = await addChild(ROUTES, "Routes", '<Route path="/users" element={<Users />} />');

    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe(
      "const el = (\n  <Routes>\n    <Route path=\"/\" element={<Home />} />\n" +
        '    <Route path="/users" element={<Users />} />\n  </Routes>\n);\n'
    );
  });

  it("an empty multi-line element gets the child one level deeper than its closing tag", async () => {
    const source = "const el = (\n  <Routes>\n  </Routes>\n);\n";
    const { modifies } = await addChild(source, "Routes", "<Route />");

    expect(modifies[0]?.modify.content).toBe("const el = (\n  <Routes>\n    <Route />\n  </Routes>\n);\n");
  });

  it("an inline element gets the child inline, before its closing tag", async () => {
    const { modifies } = await addChild("const el = <p>Hi</p>;\n", "p", "<b />");

    expect(modifies[0]?.modify.content).toBe("const el = <p>Hi<b /></p>;\n");
  });

  it("a self-closing target becomes an open/close pair holding the child", async () => {
    const source = "function App() {\n  return <Layout title=\"x\" />;\n}\n";
    const { modifies } = await addChild(source, "Layout", "<Page />");

    expect(modifies[0]?.modify.content).toBe(
      'function App() {\n  return <Layout title="x">\n    <Page />\n  </Layout>;\n}\n'
    );
  });

  it("a fragment child is accepted", async () => {
    const { modifies } = await addChild("const el = <p></p>;\n", "p", "<><a /><b /></>");

    expect(modifies[0]?.modify.content).toBe("const el = <p><><a /><b /></></p>;\n");
  });

  it("a child with the same text already present is a no-op", async () => {
    const { caught, modifies } = await addChild(ROUTES, "Routes", '<Route path="/" element={<Home />} />');

    expect(caught).toBeUndefined();
    expect(modifies).toHaveLength(0);
  });

  it("uses the target to pick one of several same-tag elements", async () => {
    const source = '<><Menu id="a"></Menu><Menu id="b"></Menu></>;\n';
    const { modifies } = await addChild(source, { tag: "Menu", props: { id: '"b"' } }, "<Item />");

    expect(modifies[0]?.modify.content).toBe('<><Menu id="a"></Menu><Menu id="b"><Item /></Menu></>;\n');
  });

  for (const [label, jsx] of [
    ["text that is not JSX", "hello"],
    ["two sibling elements", "<a /><b />"],
    ["JSX followed by more code", "<a />); evil(<b />"],
    ["unclosed JSX", "<a>"],
  ] as const) {
    it(`rejects ${label} without echoing it, leaving the file unchanged`, async () => {
      const { caught, modifies, content } = await addChild(ROUTES, "Routes", jsx);

      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toContain("`jsx` must be exactly one JSX element or fragment");
      expect(message).not.toContain(jsx);
      expect(modifies).toHaveLength(0);
      expect(content).toBe(ROUTES);
    });
  }

  it("zero matches reject naming addJsxChild's target", async () => {
    const { caught, modifies } = await addChild(ROUTES, "Switch", "<Route />");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("no element named `Switch`");
    expect(modifies).toHaveLength(0);
  });
});
