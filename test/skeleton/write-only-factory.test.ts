/**
 * REQ-KIT-05: run-end flush.
 * A factory that only creates/modifies (never calls .read()) MUST still emit its batch
 * when the runner resolves. The session MUST flush after fn resolves.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { create, modify } from "../../src/commons/index.ts";

describe("REQ-KIT-05 — run-end flush (write-only factory)", () => {
  it("a factory that only create()s (no read) emits its directive to the client", async () => {
    const fake = new ContractFake({ seed: {} });
    const emitSpy = spyOn(fake, "emit");

    const run = defineFactory<void>(() => {
      create("src/generated.ts", { template: "export const x = 1;", options: {} });
    });

    await run(undefined, { client: fake });

    // The emit spy must have been called at least once with the create directive.
    expect(emitSpy).toHaveBeenCalled();
    // ADR-01: on success the batch is committed — staging is cleared, content lives in committed.
    expect(fake.committedTree().get("src/generated.ts")).toEqual("export const x = 1;");
  });

  it("a factory that only modify()s (no read) emits its directive to the client", async () => {
    const fake = new ContractFake({ seed: { "src/existing.ts": "old content" } });

    const run = defineFactory<void>(() => {
      modify("src/existing.ts", "new content");
    });

    await run(undefined, { client: fake });

    expect(fake.committedTree().get("src/existing.ts")).toEqual("new content");
  });

  it("all-or-nothing: a throwing factory commits nothing (ADR-01 contract reversal)", async () => {
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(() => {
      create("src/partial.ts", { template: "partial", options: {} });
      throw new Error("factory error");
    });

    await expect(run(undefined, { client: fake })).rejects.toThrow("factory error");
    // ADR-01: directives buffered before the throw are discarded — the committed tree is empty.
    expect(fake.committedTree().size).toEqual(0);
  });

  it("read-triggered flush (REQ-KIT-02) still works alongside run-end flush", async () => {
    const fake = new ContractFake({ seed: {} });

    const run = defineFactory<void>(async () => {
      create("src/a.ts", { template: "content-a", options: {} });
      // find().read() goes through Session#read, which triggers mid-run flush (REQ-KIT-02).
      const { find: findFn } = await import("../../src/commons/index.ts");
      const content = await findFn("src/a.ts").read();
      // After mid-run flush, create another file — it will be flushed by run-end flush.
      create("src/b.ts", { template: `derived:${content}`, options: {} });
    });

    await run(undefined, { client: fake });

    // ADR-01: both files are committed on success (mid-run read still works on staging during the run).
    expect(fake.committedTree().get("src/a.ts")).toEqual("content-a");
    // src/b.ts must also be flushed by run-end flush, then committed.
    expect(fake.committedTree().get("src/b.ts")).toEqual("derived:content-a");
  });
});
