import { describe, it, expect } from "bun:test";
import * as css from "../../../src/dialects/css/index.ts";
import { makeSpyClient } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { RESERVED_HANDLE_NAMES } from "../../../src/core/define-dialect.ts";

const BASE_HANDLE_KEYS: ReadonlySet<string> = new Set(RESERVED_HANDLE_NAMES);

describe("subpath resolves with the exact op-set", () => {
  it("the handle exposes exactly setDeclaration, removeDeclaration, and the getDeclaration query plus the base handle verbs", async () => {
    const { client } = makeSpyClient({ "tokens.css": "" });

    let opKeys: string[] = [];
    const run = defineFactory<void>(async () => {
      opKeys = Object.keys(css.find("tokens.css"))
        .filter((k) => !BASE_HANDLE_KEYS.has(k))
        .sort();
    });
    await run(undefined, { client });

    expect(opKeys).toEqual(["getDeclaration", "removeDeclaration", "setDeclaration"]);
  });

  it("rejects a path that is not .css synchronously", () => {
    expect(() => css.find("tokens.scss")).toThrow("dialect operation failed: ");
  });
});
