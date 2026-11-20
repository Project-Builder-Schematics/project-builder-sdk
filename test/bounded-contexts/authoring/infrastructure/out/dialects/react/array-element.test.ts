/**
 * `addArrayElement` and `addClassProperty` under the React dialect parse author code as the file
 * does: JSX is accepted in `.tsx` and `.jsx`, type syntax only in `.tsx`.
 */
import { describe, it, expect } from "bun:test";
import * as react from "../../../../../../../src/dialects/react/index.ts";
import { defineFactory } from "../../../../../../../src/bounded-contexts/authoring/application/usecases/run-factory/context.ts";
import { makeSpyClient, collectModifies } from "../../../../../../support/spy-client.ts";

type Handle = ReturnType<typeof react.find>;

async function run(path: string, source: string, edit: (handle: Handle) => PromiseLike<unknown>) {
  const { client, emitted } = makeSpyClient({ [path]: source });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await edit(react.find(path));
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  const modifies = collectModifies(emitted);
  return { caught, content: modifies.at(-1)?.modify.content, unchanged: modifies.length === 0 && (await client.read(path)) === source };
}

const ROUTES = { variable: "routes", path: [] };

describe("react addArrayElement — JSX elements", () => {
  it("adds a JSX element to an array in a .tsx file (A-73)", async () => {
    const { caught, content } = await run("a.tsx", "export const routes = [];\n", (h) => h.addArrayElement(ROUTES, { expression: "<Home />" }));
    expect(caught).toBeUndefined();
    expect(content).toBe("export const routes = [<Home />];\n");
  });

  it("adds an object holding JSX, keeping the array's trailing comma", async () => {
    const seed = "const cases = [\n  { name: 'Button', ui: <Button /> },\n];\n";
    const { caught, content } = await run("a.test.tsx", seed, (h) =>
      h.addArrayElement({ variable: "cases", path: [] }, { expression: "{ name: 'StatusPill', ui: <StatusPill /> }" })
    );
    expect(caught).toBeUndefined();
    expect(content).toBe("const cases = [\n  { name: 'Button', ui: <Button /> },\n  { name: 'StatusPill', ui: <StatusPill /> },\n];\n");
  });

  it("adds a JSX element in a .jsx file", async () => {
    const { caught, content } = await run("a.jsx", "export const routes = [];\n", (h) => h.addArrayElement(ROUTES, { expression: "<Home />" }));
    expect(caught).toBeUndefined();
    expect(content).toBe("export const routes = [<Home />];\n");
  });

  it("rejects type syntax in a .jsx file, which cannot hold it", async () => {
    const { caught, unchanged } = await run("a.jsx", "export const routes = [];\n", (h) =>
      h.addArrayElement(ROUTES, { expression: "home as Route" })
    );
    expect((caught as Error).message).toContain("`expression` must be exactly one JavaScript expression");
    expect(unchanged).toBe(true);
  });

  it("still rejects a spread element", async () => {
    const { caught, unchanged } = await run("a.tsx", "export const routes = [];\n", (h) =>
      h.addArrayElement(ROUTES, { expression: "...more" })
    );
    expect((caught as Error).message).toContain("`expression` must be exactly one JavaScript expression");
    expect(unchanged).toBe(true);
  });
});

describe("react addClassProperty — a JSX initializer", () => {
  it("is accepted in a .tsx file", async () => {
    const { caught, content } = await run("a.tsx", "class A {}\n", (h) => h.addClassProperty("A", "icon", "<Icon />"));
    expect(caught).toBeUndefined();
    expect(content).toBe("class A {\n  icon = <Icon />;\n}\n");
  });
});
