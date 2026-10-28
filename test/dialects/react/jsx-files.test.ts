import { describe, it, expect } from "bun:test";
import * as react from "../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { RESERVED_HANDLE_NAMES } from "../../../src/core/define-dialect.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

type Handle = ReturnType<typeof react.find>;

async function run(source: string, edit: (handle: Handle) => PromiseLike<unknown>, path = "App.jsx") {
  const { client, emitted } = makeSpyClient({ [path]: source });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await edit(react.find(path));
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), content: await client.read(path) };
}

const APP =
  "import { Routes, Route } from \"react-router-dom\";\n\n" +
  "export default function App() {\n" +
  "  return (\n" +
  "    <Routes>\n" +
  "      <Route path=\"/\" element={<Home />} />\n" +
  "    </Routes>\n" +
  "  );\n" +
  "}\n";

describe(".jsx files", () => {
  it("chains JSX, hook and import ops on a .jsx file, byte-exact", async () => {
    const { caught, modifies } = await run(APP, (h) =>
      h
        .addImport("Users", "./Users")
        .addHookCall("App", "const t = useTranslation();")
        .addJsxChild("Routes", '<Route path="/users" element={<Users />} />')
    );

    expect(caught).toBeUndefined();
    expect(modifies).toHaveLength(1);
    expect(modifies[0]?.modify.content).toBe(
      'import { Routes, Route } from "react-router-dom";\n' +
        'import { Users } from "./Users";\n\n' +
        "export default function App() {\n" +
        "  const t = useTranslation();\n" +
        "  return (\n" +
        "    <Routes>\n" +
        '      <Route path="/" element={<Home />} />\n' +
        '      <Route path="/users" element={<Users />} />\n' +
        "    </Routes>\n" +
        "  );\n" +
        "}\n"
    );
  });

  it("parses an angle-bracket JSX element that TSX would read as a cast", async () => {
    const { caught, modifies } = await run("const el = <div>{x}</div>;\n", (h) => h.setJsxProp("div", "hidden"));

    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe("const el = <div hidden>{x}</div>;\n");
  });

  it("an untouched .jsx file is not rewritten", async () => {
    const { modifies } = await run(APP, async () => {});

    expect(modifies).toHaveLength(0);
  });

  it("carries the same ops as a .tsx handle", async () => {
    const keysOf = async (path: string) => {
      const { client } = makeSpyClient({ [path]: "" });
      let keys: string[] = [];
      await defineFactory<void>(async () => {
        keys = Object.keys(react.find(path)).filter((key) => !RESERVED_HANDLE_NAMES.includes(key as never));
      })(undefined, { client });
      return keys.sort();
    };

    expect(await keysOf("a.jsx")).toEqual(await keysOf("a.tsx"));
  });

  for (const [op, edit] of [
    ["addComponentProp", (h: Handle) => h.addComponentProp("App", "title", "string")],
    ["addTypeImport", (h: Handle) => h.addTypeImport("Props", "./types")],
    ["addClassProperty", (h: Handle) => h.addClassProperty("Store", "count", "0", { scope: "private" })],
  ] as const) {
    it(`${op} writes type syntax, so it rejects on a .jsx file and leaves it unchanged`, async () => {
      const source = "class Store {}\nexport default function App() {\n  return <div />;\n}\n";
      const { caught, modifies, content } = await run(source, edit);

      expect(caught).toBeInstanceOf(Error);
      const message = (caught as Error).message;
      expect(message).toContain(op);
      expect(message).toContain(".jsx");
      expect(modifies).toHaveLength(0);
      expect(content).toBe(source);
    });
  }

  it("addClassProperty without TypeScript modifiers still works on a .jsx file", async () => {
    const { caught, modifies } = await run("class Store {}\n", (h) => h.addClassProperty("Store", "count", "0"));

    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe("class Store {\n  count = 0;\n}\n");
  });

  it("a .jsx path with no name before the extension is rejected", () => {
    expect(() => react.find("src/.jsx")).toThrow(/\.tsx and \.jsx are the only extensions/);
  });

  it("an unrelated extension names both supported extensions", () => {
    expect(() => react.find("README.md")).toThrow(/\.tsx and \.jsx are the only extensions/);
  });
});
