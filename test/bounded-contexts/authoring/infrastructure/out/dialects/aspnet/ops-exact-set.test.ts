import { describe, it, expect } from "bun:test";
import * as aspnet from "../../../../../../../src/dialects/aspnet/index.ts";
import { makeSpyClient } from "../../../../../../support/spy-client.ts";
import { defineFactory } from "../../../../../../../src/bounded-contexts/authoring/application/usecases/run-factory/context.ts";
import { RESERVED_HANDLE_NAMES } from "../../../../../../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";

const BASE_HANDLE_KEYS: ReadonlySet<string> = new Set(RESERVED_HANDLE_NAMES);

describe("subpath resolves with the exact op-set", () => {
  it("the handle exposes exactly its ops plus the base handle verbs", async () => {
    const { client } = makeSpyClient({ "a.cs": "public class A\n{\n}\n" });

    let opKeys: string[] = [];
    const run = defineFactory<void>(async () => {
      opKeys = Object.keys(aspnet.find("a.cs"))
        .filter((k) => !BASE_HANDLE_KEYS.has(k))
        .sort();
    });
    await run(undefined, { client });

    expect(opKeys).toEqual(["addBaseType", "addConstructorParameter", "addMember", "addService", "addUsing"]);
  });
});
