import { describe, it, expect } from "bun:test";
import * as yaml from "../../../src/dialects/yaml/index.ts";
import { makeSpyClient } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { RESERVED_HANDLE_NAMES } from "../../../src/core/define-dialect.ts";

const BASE_HANDLE_KEYS: ReadonlySet<string> = new Set(RESERVED_HANDLE_NAMES);

describe("Scenario REQ-YMD-01.1 — subpath resolves with the exact op-set", () => {
  it("the handle exposes exactly the twenty-five named ops plus the base handle verbs", async () => {
    const { client } = makeSpyClient({ "config.yml": "" });

    let opKeys: string[] = [];
    const run = defineFactory<void>(async () => {
      const handle = yaml.find("config.yml");
      opKeys = Object.keys(handle)
        .filter((k) => !BASE_HANDLE_KEYS.has(k))
        .sort();
    });
    await run(undefined, { client });

    expect(opKeys).toEqual(
      [
        "setValue", "addKey", "removeKey", "renameKey", "insertItem", "appendItem", "removeItem",
        "removeValue", "replaceItem", "moveItem", "merge", "updateValue", "setComment",
        "removeComment", "setAnchor", "removeAnchor", "setAlias", "addMergeKey", "setStyle",
        "addDocument", "removeDocument", "moveValue", "copyValue", "sortKeys", "setTag",
      ].sort()
    );
  });
});
