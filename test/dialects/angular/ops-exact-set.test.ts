import { describe, it, expect } from "bun:test";
import * as angular from "../../../src/dialects/angular/index.ts";
import * as typescript from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { RESERVED_HANDLE_NAMES } from "../../../src/core/define-dialect.ts";

const BASE_HANDLE_KEYS: ReadonlySet<string> = new Set(RESERVED_HANDLE_NAMES);
const ANGULAR_OPS = ["addComponentImport", "addComponentProvider", "addLazyRoute", "addRootProvider", "addRoute"];

async function opKeys(find: (path: string) => object): Promise<string[]> {
  const { client } = makeSpyClient({ "a.ts": "" });
  let keys: string[] = [];
  await defineFactory<void>(async () => {
    keys = Object.keys(find("a.ts")).filter((k) => !BASE_HANDLE_KEYS.has(k));
  })(undefined, { client });
  return keys.sort();
}

describe("angular dialect op set", () => {
  it("is every TypeScript op plus exactly the Angular ops", async () => {
    const inherited = await opKeys(typescript.find);
    expect(inherited.length).toBeGreaterThan(0);
    expect(await opKeys(angular.find)).toEqual([...inherited, ...ANGULAR_OPS].sort());
  });
});
