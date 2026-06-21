/**
 * SKEL-01: byte-exact read-your-own-write through the contract fake.
 * Flow: defineFactory → create(P) → flush → fake.emit → fake.read → byte-exact content
 * The flush-before-read ORDER is asserted via a call-order log on a wrapper client.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Batch } from "../../src/core/wire.ts";
import { create, find } from "../../src/commons/index.ts";

/** Wraps an EngineClient to record the order in which emit/read are called. */
function observeCallOrder(inner: EngineClient): { client: EngineClient; order: string[] } {
  const order: string[] = [];
  const client: EngineClient = {
    async emit(batch: Batch): Promise<void> {
      order.push("emit");
      return inner.emit(batch);
    },
    async read(path: string): Promise<string> {
      order.push("read");
      return inner.read(path);
    },
    async commit(): Promise<void> {
      return inner.commit();
    },
    async discard(): Promise<void> {
      return inner.discard();
    },
  };
  return { client, order };
}

describe("SKEL-01 — read-your-own-write", () => {
  it("returns content byte-exact after create, flushing before read", async () => {
    const path = "src/hello.ts";
    const content = "export const hello = 'world';";

    const fake = new ContractFake({ seed: {} });
    const { client, order } = observeCallOrder(fake);

    const run = defineFactory<void>(async () => {
      create(path, { template: content, options: {} });
      const result = await find(path).read();
      expect(result).toEqual(content);
    });

    await run(undefined, { client });

    // flush (emit) must precede client.read
    expect(order).toEqual(["emit", "read"]);
  });
});
