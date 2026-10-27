import { describe, it, expect } from "bun:test";
import * as json from "../../../src/dialects/json/index.ts";
import { makeSpyClient } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { RESERVED_HANDLE_NAMES } from "../../../src/core/define-dialect.ts";

const BASE_HANDLE_KEYS: ReadonlySet<string> = new Set(RESERVED_HANDLE_NAMES);

describe("REQ-JSD-01.1 — subpath resolves with the exact op-set", () => {
  it("the handle exposes exactly the fifteen named ops plus the base handle verbs", async () => {
    const { client } = makeSpyClient({ "package.json": "{}" });
    let opKeys: string[] = [];
    let baseKeys: string[] = [];
    const run = defineFactory<void>(async () => {
      const keys = Object.keys(json.find("package.json"));
      opKeys = keys.filter((k) => !BASE_HANDLE_KEYS.has(k)).sort();
      baseKeys = keys.filter((k) => BASE_HANDLE_KEYS.has(k));
    });
    await run(undefined, { client });

    expect(opKeys).toEqual(
      [
        "addKey",
        "appendItem",
        "copyValue",
        "insertItem",
        "merge",
        "moveItem",
        "moveValue",
        "removeItem",
        "removeKey",
        "removeValue",
        "renameKey",
        "replaceItem",
        "setValue",
        "sortKeys",
        "updateValue",
      ].sort()
    );
    expect(baseKeys).toContain("modify");
  });
});
