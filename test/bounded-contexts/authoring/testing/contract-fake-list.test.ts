// The fake answers `list` as the engine's `tree.list` does (E-37, engine ADR-0070), so a factory
// tested with `runFactoryForTest` lists what the engine would.
import { describe, expect, it } from "bun:test";
import { ContractFake } from "../../../../src/bounded-contexts/authoring/testing/contract-fake.ts";

const SEED = {
  "src/a.ts": "a",
  "src/b.tsx": "b",
  "src/deep/c.ts": "c",
  "src/a.test.ts": "t",
  "lib/[x].ts": "x",
  "README.md": "r",
};

const list = (pattern: string, ignore?: readonly string[]) => new ContractFake({ seed: SEED }).list(pattern, ignore);

describe("ContractFake.list", () => {
  it("`*` stays in one segment, `**` spans any number of segments, zero included", async () => {
    expect(await list("src/*.ts")).toEqual(["src/a.test.ts", "src/a.ts"]);
    expect(await list("src/**/*.ts")).toEqual(["src/a.test.ts", "src/a.ts", "src/deep/c.ts"]);
    expect(await list("**")).toEqual(["README.md", "lib/[x].ts", "src/a.test.ts", "src/a.ts", "src/b.tsx", "src/deep/c.ts"]);
  });

  it("`?` is one character, `{a,b}` either alternative, nested groups included", async () => {
    expect(await list("src/?.ts")).toEqual(["src/a.ts"]);
    expect(await list("src/*.{ts,tsx}")).toEqual(["src/a.test.ts", "src/a.ts", "src/b.tsx"]);
    expect(await list("{src/{a,b}.ts*,README.md}")).toEqual(["README.md", "src/a.ts", "src/b.tsx"]);
  });

  it("every other character is literal, so `[` is no class and `!` no negation", async () => {
    expect(await list("lib/[x].ts")).toEqual(["lib/[x].ts"]);
    expect(await list("lib/[a-z].ts")).toEqual([]);
    expect(await list("!src/**")).toEqual([]);
  });

  it("leaves out what an ignore pattern matches, and answers [] when nothing matches", async () => {
    expect(await list("src/**", ["**/*.test.ts", "src/deep/**"])).toEqual(["src/a.ts", "src/b.tsx"]);
    expect(await list("docs/**")).toEqual([]);
  });

  it("sees staging: a created file is listed, a deleted one is not", async () => {
    const fake = new ContractFake({ seed: { "src/a.ts": "a" } });
    await fake.emit({
      protocolVersion: 1,
      force: false,
      instructions: [
        { op: "create", create: { pathTemplate: "src/b.ts", template: "b", options: {} } },
        { op: "delete", delete: { path: "src/a.ts" } },
      ],
    });
    expect(await fake.list("src/**")).toEqual(["src/b.ts"]);
  });

  it("rejects a pattern with an alternative that escapes the workspace", async () => {
    await expect(list("/etc/*")).rejects.toThrow("path escapes workspace");
    await expect(list("{src/*,../*}")).rejects.toThrow("path escapes workspace");
  });
});
