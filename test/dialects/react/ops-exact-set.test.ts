import { describe, it, expect } from "bun:test";
import * as react from "../../../src/dialects/react/index.ts";
import * as typescript from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { RESERVED_HANDLE_NAMES } from "../../../src/core/define-dialect.ts";

const BASE_HANDLE_KEYS: ReadonlySet<string> = new Set(RESERVED_HANDLE_NAMES);
const REACT_OPS = ["addJsxChild", "removeJsxProp", "setJsxProp"];

async function opKeys(find: (path: string) => object, path: string): Promise<string[]> {
  const { client } = makeSpyClient({ [path]: "" });
  let keys: string[] = [];
  await defineFactory<void>(async () => {
    keys = Object.keys(find(path)).filter((k) => !BASE_HANDLE_KEYS.has(k));
  })(undefined, { client });
  return keys.sort();
}

describe("react dialect op set", () => {
  it("is every TypeScript op plus exactly the JSX ops", async () => {
    const inherited = await opKeys(typescript.find, "a.ts");
    expect(inherited.length).toBeGreaterThan(0);
    expect(await opKeys(react.find, "a.tsx")).toEqual([...inherited, ...REACT_OPS].sort());
  });
});
