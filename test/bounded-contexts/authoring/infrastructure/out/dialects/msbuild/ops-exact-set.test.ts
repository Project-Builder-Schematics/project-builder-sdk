import { describe, it, expect } from "bun:test";
import * as msbuild from "../../../../../../../src/dialects/msbuild/index.ts";
import { makeSpyClient } from "../../../../../../support/spy-client.ts";
import { defineFactory } from "../../../../../../../src/bounded-contexts/authoring/application/usecases/run-factory/context.ts";
import { RESERVED_HANDLE_NAMES } from "../../../../../../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";

const BASE_HANDLE_KEYS: ReadonlySet<string> = new Set(RESERVED_HANDLE_NAMES);

describe("subpath resolves with the exact op-set", () => {
  it("the handle exposes exactly addProject and addProjectReference plus the base handle verbs", async () => {
    const { client } = makeSpyClient({ "A.csproj": "<Project />" });

    let opKeys: string[] = [];
    const run = defineFactory<void>(async () => {
      opKeys = Object.keys(msbuild.find("A.csproj"))
        .filter((k) => !BASE_HANDLE_KEYS.has(k))
        .sort();
    });
    await run(undefined, { client });

    expect(opKeys).toEqual(["addProject", "addProjectReference"]);
  });

  it("rejects a .sln path synchronously", () => {
    expect(() => msbuild.find("Shop.sln")).toThrow("dialect operation failed: ");
  });
});
