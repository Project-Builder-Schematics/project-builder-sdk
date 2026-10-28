import { describe, it, expect } from "bun:test";
import * as react from "../../../src/dialects/react/index.ts";
import type { JsxTarget } from "../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

async function rename(source: string, target: JsxTarget, tag: string) {
  const { client, emitted } = makeSpyClient({ "App.tsx": source });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await react.find("App.tsx").renameJsxElement(target, tag);
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), content: await client.read("App.tsx") };
}

describe("renameJsxElement", () => {
  it("renames the opening and closing tag together, keeping props and children", async () => {
    const { caught, modifies } = await rename('const el = <Button kind="x">Save</Button>;\n', "Button", "IconButton");

    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe('const el = <IconButton kind="x">Save</IconButton>;\n');
  });

  it("renames a self-closing element", async () => {
    const { modifies } = await rename("const el = <Spinner size={2} />;\n", "Spinner", "Ui.Loader");

    expect(modifies[0]?.modify.content).toBe("const el = <Ui.Loader size={2} />;\n");
  });

  it("only renames the targeted element, not nested elements with the same tag", async () => {
    const source = '<Box id="outer"><Box id="inner" /></Box>;\n';
    const { modifies } = await rename(source, { tag: "Box", props: { id: '"outer"' } }, "Card");

    expect(modifies[0]?.modify.content).toBe('<Card id="outer"><Box id="inner" /></Card>;\n');
  });

  it("renaming to the same tag is a no-op", async () => {
    const { caught, modifies } = await rename("const el = <Button />;\n", "Button", "Button");

    expect(caught).toBeUndefined();
    expect(modifies).toHaveLength(0);
  });

  it("an invalid new tag rejects before any mutation", async () => {
    const source = "const el = <Button />;\n";
    const { caught, modifies, content } = await rename(source, "Button", "Bad Tag");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("`tag`");
    expect(modifies).toHaveLength(0);
    expect(content).toBe(source);
  });

  it("several matches reject naming renameJsxElement", async () => {
    const { caught, modifies } = await rename("<><Button /><Button /></>;\n", "Button", "Link");

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("renameJsxElement requires exactly one match");
    expect(modifies).toHaveLength(0);
  });
});
