/**
 * A-7 — the Session versions the content of each path as typed, and a read never overtakes a
 * flush that is still being emitted.
 */
import { describe, it, expect } from "bun:test";
import { Session } from "../../../../../../src/bounded-contexts/authoring/domain/aggregates/session/session.ts";
import type { EngineClient } from "../../../../../../src/bounded-contexts/authoring/domain/ports/engine-client.ts";
import type { Batch, Directive } from "../../../../../../src/bounded-contexts/authoring/domain/valueobjects/wire.ts";

function client(overrides: Partial<EngineClient> = {}): EngineClient {
  return {
    async emit() {},
    async read() {
      return undefined;
    },
    async commit() {},
    async discard() {},
    ...overrides,
  };
}

describe("Session.versionOf", () => {
  it("starts at 0 and counts every directive that touches the path", () => {
    const session = new Session(client());
    const touching: Directive[] = [
      { op: "modify", modify: { path: "a.ts", content: "x" } },
      { op: "delete", delete: { path: "a.ts" } },
      { op: "rename", rename: { path: "a.ts", newName: "b.ts" } },
      { op: "move", move: { path: "a.ts", toDir: "lib" } },
      { op: "create", create: { pathTemplate: "a.ts", template: "", options: {} } },
      { op: "copy", copy: { from: "c.ts", to: "a.ts" } },
    ];
    expect(session.versionOf("a.ts")).toBe(0);
    touching.forEach((directive, index) => {
      session.buffer(directive);
      expect(session.versionOf("a.ts")).toBe(index + 1);
    });
  });

  it("moves the destination of a rename or a move too", () => {
    const session = new Session(client());
    session.buffer({ op: "rename", rename: { path: "src/b.ts", newName: "a.ts" } });
    session.buffer({ op: "rename", rename: { path: "b.ts", newName: "a.ts" } });
    session.buffer({ op: "move", move: { path: "b.ts", toDir: "lib" } });
    expect(session.versionOf("src/a.ts")).toBe(1);
    expect(session.versionOf("a.ts")).toBe(1);
    expect(session.versionOf("lib/b.ts")).toBe(1);
  });

  it("does not move for a directive on another path, nor for the source of a copy", () => {
    const session = new Session(client());
    session.buffer({ op: "modify", modify: { path: "b.ts", content: "x" } });
    session.buffer({ op: "copy", copy: { from: "a.ts", to: "b.ts" } });
    expect(session.versionOf("a.ts")).toBe(0);
  });
});

describe("Session.read during a flush", () => {
  it("emits synchronously when no batch is in flight", () => {
    let emitted = 0;
    const session = new Session(client({ async emit() { emitted++; } }));
    session.buffer({ op: "modify", modify: { path: "a.ts", content: "x" } });
    void session.flush();
    expect(emitted).toBe(1);
  });

  it("waits for the batch still being emitted before reading", async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const session = new Session(
      client({
        async emit(_batch: Batch) {
          order.push("emit start");
          await gate;
          order.push("emit end");
        },
        async read() {
          order.push("read");
          return "content";
        },
      })
    );
    session.buffer({ op: "modify", modify: { path: "a.ts", content: "x" } });
    const flushing = session.flush();
    const reading = session.read("a.ts");
    await Promise.resolve();
    release();
    await Promise.all([flushing, reading]);
    expect(order).toEqual(["emit start", "emit end", "read"]);
  });

  it("still reads after a flush that failed", async () => {
    const session = new Session(
      client({
        async emit() {
          throw new Error("rejected");
        },
        async read() {
          return "content";
        },
      })
    );
    session.buffer({ op: "modify", modify: { path: "a.ts", content: "x" } });
    await expect(session.flush()).rejects.toThrow();
    expect(await session.read("a.ts")).toBe("content");
  });
});
