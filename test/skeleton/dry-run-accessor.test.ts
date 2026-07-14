/**
 * REQ-DRE-01.4 — `dryRun()` called with no active `defineFactory` run propagates the
 * same outside-run error every other author verb raises (`currentContext()`,
 * `src/core/context.ts:20-24`) — no accessor-specific try/catch or fallback.
 *
 * S-002 extends this file with the buffer-state variants (REQ-DRE-01.2/.3): empty
 * buffer returns `[]`, and the accessor reflects only what is pending SINCE the last
 * flush (`Session.flush()`, fired by `read()`).
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { create, find, replaceContent, dryRun } from "../../src/commons/index.ts";
import { makeSpyClient } from "../support/spy-client.ts";

describe("dry-run accessor — outside-run propagation (REQ-DRE-01.4)", () => {
  it("throws the standard outside-run error when called with no active run", () => {
    expect(() => dryRun()).toThrow("can only be used while a schematic is running");
  });
});

describe("dry-run accessor — buffer-state variants (REQ-DRE-01.2, REQ-DRE-01.3)", () => {
  it("returns an empty array when the run has buffered no directive (REQ-DRE-01.2)", async () => {
    const { client } = makeSpyClient();

    const run = defineFactory<void>(async () => {
      expect(dryRun()).toEqual([]);
    });

    await run(undefined, { client });
  });

  it("reflects only directives buffered since the last flush (REQ-DRE-01.3)", async () => {
    const { client } = makeSpyClient({ "src/b.ts": "old" });

    const run = defineFactory<void>(async () => {
      create("src/a.ts", { template: "export const a = 1;", options: {} });
      await find("src/a.ts").read();
      replaceContent("src/b.ts", "content");

      expect(dryRun()).toEqual([{ verb: "modify", path: "src/b.ts" }]);
    });

    await run(undefined, { client });
  });
});
