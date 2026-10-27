import { describe, it, expect } from "bun:test";
import * as nestjs from "../../../src/dialects/nestjs/index.ts";
import * as typescript from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { RESERVED_HANDLE_NAMES } from "../../../src/core/define-dialect.ts";

const BASE_HANDLE_KEYS: ReadonlySet<string> = new Set(RESERVED_HANDLE_NAMES);
const NEST_OPS = ["addController", "addExport", "addModuleImport", "addProvider"];

async function opKeys(find: (path: string) => object): Promise<string[]> {
  const { client } = makeSpyClient({ "a.ts": "" });
  let keys: string[] = [];
  await defineFactory<void>(async () => {
    keys = Object.keys(find("a.ts")).filter((k) => !BASE_HANDLE_KEYS.has(k));
  })(undefined, { client });
  return keys.sort();
}

describe("nestjs dialect op set", () => {
  it("is every TypeScript op plus exactly the four @Module ops", async () => {
    const inherited = await opKeys(typescript.find);
    expect(inherited.length).toBeGreaterThan(0);
    expect(await opKeys(nestjs.find)).toEqual([...inherited, ...NEST_OPS].sort());
  });
});
