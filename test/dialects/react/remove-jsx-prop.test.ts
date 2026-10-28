import { describe, it, expect } from "bun:test";
import * as react from "../../../src/dialects/react/index.ts";
import type { JsxTarget } from "../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

async function removeProp(source: string, target: JsxTarget, prop: string) {
  const { client, emitted } = makeSpyClient({ "App.tsx": source });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await react.find("App.tsx").removeJsxProp(target, prop);
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), content: await client.read("App.tsx") };
}

describe("removeJsxProp", () => {
  it("removes the named prop and keeps the others in place", async () => {
    const { caught, modifies } = await removeProp('const el = <Button disabled onClick={go} title="x" />;\n', "Button", "onClick");

    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe('const el = <Button disabled title="x" />;\n');
  });

  it("removes the only prop of an element with children", async () => {
    const { modifies } = await removeProp("const el = <Button disabled>Save</Button>;\n", "Button", "disabled");

    expect(modifies[0]?.modify.content).toBe("const el = <Button>Save</Button>;\n");
  });

  it("an absent prop is a no-op", async () => {
    const source = "const el = <Button disabled />;\n";
    const { caught, modifies, content } = await removeProp(source, "Button", "onClick");

    expect(caught).toBeUndefined();
    expect(modifies).toHaveLength(0);
    expect(content).toBe(source);
  });

  it("never touches a spread attribute", async () => {
    const { modifies } = await removeProp("const el = <Button {...rest} disabled />;\n", "Button", "disabled");

    expect(modifies[0]?.modify.content).toBe("const el = <Button {...rest} />;\n");
  });

  it("uses the target to pick one of several same-tag elements", async () => {
    const source = '<><Button kind="save" disabled /><Button kind="cancel" disabled /></>;\n';
    const { modifies } = await removeProp(source, { tag: "Button", props: { kind: '"cancel"' } }, "disabled");

    expect(modifies[0]?.modify.content).toBe('<><Button kind="save" disabled /><Button kind="cancel" /></>;\n');
  });

  it("several matches reject naming removeJsxProp, and leave the file unchanged", async () => {
    const source = "<><Button disabled /><Button disabled /></>;\n";
    const { caught, modifies, content } = await removeProp(source, "Button", "disabled");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("matched 2 elements — removeJsxProp requires exactly one match");
    expect(modifies).toHaveLength(0);
    expect(content).toBe(source);
  });

  it("an invalid prop name rejects before any mutation", async () => {
    const { caught, modifies } = await removeProp("const el = <Button />;\n", "Button", "bad name");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`propName`");
    expect(modifies).toHaveLength(0);
  });
});
