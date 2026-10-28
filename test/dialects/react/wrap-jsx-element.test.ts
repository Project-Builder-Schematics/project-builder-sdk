import { describe, it, expect } from "bun:test";
import * as react from "../../../src/dialects/react/index.ts";
import type { JsxTarget } from "../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

async function wrap(source: string, target: JsxTarget, wrapper: string) {
  const { client, emitted } = makeSpyClient({ "main.tsx": source });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await react.find("main.tsx").wrapJsxElement(target, wrapper);
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), content: await client.read("main.tsx") };
}

describe("wrapJsxElement", () => {
  it("wraps a self-closing element in the wrapper, keeping the wrapper's props", async () => {
    const { caught, modifies } = await wrap("root.render(<App />);\n", "App", "<QueryProvider client={qc} />");

    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe("root.render(<QueryProvider client={qc}><App /></QueryProvider>);\n");
  });

  it("wraps an element with children as a whole", async () => {
    const { modifies } = await wrap("const el = <Layout><Page /></Layout>;\n", "Layout", "<Theme />");

    expect(modifies[0]?.modify.content).toBe("const el = <Theme><Layout><Page /></Layout></Theme>;\n");
  });

  it("a target whose direct parent already has the wrapper's tag is a no-op", async () => {
    const source = "root.render(<QueryProvider client={qc}><App /></QueryProvider>);\n";
    const { caught, modifies } = await wrap(source, "App", "<QueryProvider client={other} />");

    expect(caught).toBeUndefined();
    expect(modifies).toHaveLength(0);
  });

  it("uses the target to pick one of several same-tag elements", async () => {
    const source = '<><Panel id="a" /><Panel id="b" /></>;\n';
    const { modifies } = await wrap(source, { tag: "Panel", props: { id: '"b"' } }, "<Card />");

    expect(modifies[0]?.modify.content).toBe('<><Panel id="a" /><Card><Panel id="b" /></Card></>;\n');
  });

  for (const [label, wrapper] of [
    ["an element with children", "<A><B /></A>"],
    ["a fragment", "<></>"],
    ["text that is not JSX", "Provider"],
    ["JSX followed by more code", "<A />); evil(<B />"],
  ] as const) {
    it(`rejects ${label} as the wrapper without echoing it, leaving the file unchanged`, async () => {
      const source = "root.render(<App />);\n";
      const { caught, modifies, content } = await wrap(source, "App", wrapper);

      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toContain("`wrapper` must be exactly one self-closing JSX element");
      expect(message).not.toContain(wrapper);
      expect(modifies).toHaveLength(0);
      expect(content).toBe(source);
    });
  }

  it("several matches reject naming wrapJsxElement", async () => {
    const { caught, modifies } = await wrap("<><App /><App /></>;\n", "App", "<Strict />");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("wrapJsxElement requires exactly one match");
    expect(modifies).toHaveLength(0);
  });
});
