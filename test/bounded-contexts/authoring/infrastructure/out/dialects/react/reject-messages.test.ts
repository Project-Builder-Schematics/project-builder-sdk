// The React dialect's name and targeting rejections keep their whole message, so moving the
// React-only grammars and match tails into the React adapter cannot change what an author sees.
import { describe, it, expect } from "bun:test";
import * as react from "../../../../../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../../../../../src/bounded-contexts/authoring/application/usecases/run-factory/context.ts";
import { makeSpyClient } from "../../../../../../support/spy-client.ts";

async function messageOf(source: string, op: (file: ReturnType<typeof react.find>) => unknown): Promise<string> {
  const { client } = makeSpyClient({ "sample.tsx": source });
  const run = defineFactory<void>(async () => {
    await op(react.find("sample.tsx"));
  });
  try {
    await run(undefined, { client });
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error("the op did not reject");
}

describe("React name rejections", () => {
  it("an attribute name outside the grammar", async () => {
    expect(await messageOf("const el = <Button />;\n", (f) => f.setJsxProp("Button", "on click", "{f}"))).toBe(
      "dialect operation failed: `propName` must match the attribute-name grammar (letters, digits, underscore, and hyphen, with one optional `:namespace` segment) — fix the name, or use `.modify()` to make this edit directly."
    );
  });

  it("an element name outside the grammar", async () => {
    expect(await messageOf("const el = <Button />;\n", (f) => f.setJsxProp("Bad Name", "x", "{1}"))).toBe(
      "dialect operation failed: `elementName` must match the JSX element-name grammar (identifier or hyphenated segments, optionally joined by `.`) — fix the name, or use `.modify()` to make this edit directly."
    );
  });

  it("a denylisted attribute name", async () => {
    expect(await messageOf("const el = <Button />;\n", (f) => f.setJsxProp("Button", "__proto__", "{1}"))).toBe(
      'dialect operation failed: `propName` "__proto__" is a reserved name and cannot be used — fix the name, or use `.modify()` to make this edit directly.'
    );
  });
});

describe("React match rejections", () => {
  it("no element with the target's props", async () => {
    expect(
      await messageOf("const el = <Button />;\n", (f) => f.setJsxProp({ tag: "Button", props: { kind: '"primary"', disabled: true } }, "x", "{1}"))
    ).toBe(
      "dialect operation failed: no element named `Button` with props `kind`, `disabled` was found — use `.modify()` to inspect the file and edit it directly."
    );
  });

  it("an over-long element name is cut with a marker", async () => {
    const name = `A${"b".repeat(120)}`;
    expect(await messageOf("const el = <Button />;\n", (f) => f.setJsxProp(name, "x", "{1}"))).toBe(
      `dialect operation failed: no element named \`${name.slice(0, 100)}…\` was found — use \`.modify()\` to inspect the file and edit it directly.`
    );
  });

  it("several elements with the target's props", async () => {
    expect(
      await messageOf("const a = <Button kind=\"primary\" />;\nconst b = <Button kind=\"primary\" />;\n", (f) =>
        f.setJsxProp({ tag: "Button", props: { kind: '"primary"' } }, "x", "{1}")
      )
    ).toBe(
      "dialect operation failed: `Button` with props `kind` matched 2 elements — setJsxProp requires exactly one match; use `.modify()` to disambiguate."
    );
  });
});
