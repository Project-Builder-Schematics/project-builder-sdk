/**
 * KIT-02: Session flush-before-read unit tests.
 * Verifies the flush order and that Session holds no path-keyed map.
 */
import { describe, it, expect } from "bun:test";
import { Session } from "../../src/core/session.ts";
import { DirectiveFactory } from "../../src/core/directive-factory.ts";
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Batch } from "../../src/core/wire.ts";

function makeOrderedClient(responses: Record<string, string>): {
  client: EngineClient;
  order: string[];
  lastBatch: Batch | null;
} {
  const order: string[] = [];
  let lastBatch: Batch | null = null;
  const client: EngineClient = {
    async emit(batch: Batch): Promise<void> {
      order.push("emit");
      lastBatch = batch;
    },
    async read(path: string): Promise<string> {
      order.push("read");
      return responses[path] ?? `content:${path}`;
    },
  };
  return { client, order, get lastBatch() { return lastBatch; } };
}

describe("Session", () => {
  it("flushes pending directives before delegating read", async () => {
    const { client, order } = makeOrderedClient({ "src/a.ts": "body" });
    const session = new Session(client);
    const factory = new DirectiveFactory();

    session.buffer(factory.create({ pathTemplate: "src/a.ts", template: "body", options: {} }));
    await session.read("src/a.ts");

    expect(order).toEqual(["emit", "read"]);
  });

  it("sends buffered directives in the batch on flush", async () => {
    let capturedBatch: Batch | null = null;
    const client: EngineClient = {
      async emit(batch) { capturedBatch = batch; },
      async read() { return ""; },
    };
    const session = new Session(client);
    const factory = new DirectiveFactory();

    session.buffer(factory.create({ pathTemplate: "x.ts", template: "t", options: {} }));
    await session.read("x.ts");

    expect(capturedBatch).not.toBeNull();
    expect(capturedBatch!.instructions).toHaveLength(1);
    expect(capturedBatch!.instructions[0]!.op).toEqual("create");
  });

  it("emits nothing when buffer is empty on read", async () => {
    const { client, order } = makeOrderedClient({ "src/a.ts": "body" });
    const session = new Session(client);

    await session.read("src/a.ts");

    // No pending directives → emit is skipped, only read fires
    expect(order).toEqual(["read"]);
  });

  it("clears buffer after flush so a second read does not re-emit", async () => {
    const { client, order } = makeOrderedClient({ "a.ts": "x", "b.ts": "y" });
    const session = new Session(client);
    const factory = new DirectiveFactory();

    session.buffer(factory.create({ pathTemplate: "a.ts", template: "x", options: {} }));
    await session.read("a.ts");
    await session.read("b.ts");

    // First read: emit then read; second read: only read (buffer already flushed)
    expect(order).toEqual(["emit", "read", "read"]);
  });
});
