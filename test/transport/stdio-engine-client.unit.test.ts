// REQ-SEC-01/03/06, REQ-WPS-05/10: StdioEngineClient over an in-memory FrameChannel double —
// no subprocess, no real stdio. Covers S-000's happy-path REQs only; SEC-02/04/05/08 (overlap
// guard, rejection-mapping edge cases, timeout, fail-closed) land in S-001/S-003.

import { describe, it, expect } from "bun:test";
import type { EngineClient } from "../../src/core/engine-client.ts";
import { EmitRejection } from "../../src/core/emit-rejection.ts";
import { BATCH_CAP_BYTES } from "../../src/core/wire.ts";
import { batchOfSerializedBytes, batchOverSerializedBytes } from "../fake/batch-cap-fixtures.ts";
import {
  StdioEngineClient,
  IntentRejectedError,
  TransportFault,
  type FrameChannel,
} from "../../src/transport/stdio-engine-client.ts";

// Scripted in-memory double: replies to the LAST written request via a per-method responder
// table. Single-in-flight only (ADR-03) — matches the client's own sequential contract.
class ScriptedChannel implements FrameChannel {
  written: unknown[] = [];
  stderrNotes: string[] = [];
  #responder: (request: any) => unknown;

  constructor(responder: (request: any) => unknown) {
    this.#responder = responder;
  }

  write(value: unknown): void {
    this.written.push(value);
  }

  writeStderr(text: string): void {
    this.stderrNotes.push(text);
  }

  async read(): Promise<unknown> {
    const last = this.written[this.written.length - 1];
    return this.#responder(last);
  }
}

function ackChannel(): ScriptedChannel {
  return new ScriptedChannel((req) => ({ type: "response", id: req.id, result: {} }));
}

// Queue-based double: supports pre-scripting a SEQUENCE of raw wire values (including
// non-matching/junk frames, for WPS-03 routing tests) or errors (simulating a frame-reader
// TransportFault) to return from successive read() calls, plus reads that never resolve
// (a hung host, for SEC-05.1) or resolve after a real delay (SEC-05.2).
type QueueEntry = { kind: "value"; value: unknown } | { kind: "error"; error: unknown };

class QueueChannel implements FrameChannel {
  written: unknown[] = [];
  stderrNotes: string[] = [];
  #queue: QueueEntry[] = [];
  #waiters: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

  write(value: unknown): void {
    this.written.push(value);
  }

  writeStderr(text: string): void {
    this.stderrNotes.push(text);
  }

  pushValue(value: unknown): void {
    this.#deliver({ kind: "value", value });
  }

  pushError(error: unknown): void {
    this.#deliver({ kind: "error", error });
  }

  #deliver(entry: QueueEntry): void {
    const waiter = this.#waiters.shift();
    if (waiter) {
      entry.kind === "value" ? waiter.resolve(entry.value) : waiter.reject(entry.error);
    } else {
      this.#queue.push(entry);
    }
  }

  read(): Promise<unknown> {
    const next = this.#queue.shift();
    if (next) {
      return next.kind === "value" ? Promise.resolve(next.value) : Promise.reject(next.error);
    }
    return new Promise((resolve, reject) => {
      this.#waiters.push({ resolve, reject });
    });
  }
}

describe("REQ-SEC-01 — EngineClient port conformance", () => {
  it("Scenario REQ-SEC-01.1: a StdioEngineClient instance type-checks against EngineClient", () => {
    const client: EngineClient = new StdioEngineClient(ackChannel());
    expect(typeof client.emit).toBe("function");
    expect(typeof client.read).toBe("function");
    expect(typeof client.commit).toBe("function");
    expect(typeof client.discard).toBe("function");
  });

  it("read() never throws for a not-found path — resolves to undefined instead", async () => {
    const channel = new ScriptedChannel((req) => ({ type: "response", id: req.id, result: null }));
    const client = new StdioEngineClient(channel);

    const result = await client.read("missing.ts");

    expect(result).toBeUndefined();
  });

  it("commit() rejects with IntentRejectedError, never a bare Error, on a host rejection", async () => {
    const channel = new ScriptedChannel((req) => ({
      type: "response",
      id: req.id,
      error: { code: -32000, message: "run not resolved" },
    }));
    const client = new StdioEngineClient(channel);

    let caught: unknown;
    try {
      await client.commit();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(IntentRejectedError);
  });

  it("each of the four methods' returned promise settles to a single outcome", async () => {
    const client = new StdioEngineClient(ackChannel());
    await expect(client.emit({ protocolVersion: 1, force: false, instructions: [] })).resolves.toBeUndefined();
    await expect(client.commit()).resolves.toBeUndefined();
    await expect(client.discard()).resolves.toBeUndefined();
  });
});

describe("REQ-WPS-10 — per-method reverse-callback payload schemas", () => {
  it("Scenario REQ-WPS-10.1: tree.read request params round-trip exactly {path}", async () => {
    const channel = new ScriptedChannel((req) => ({ type: "response", id: req.id, result: { content: "x" } }));
    const client = new StdioEngineClient(channel);

    await client.read("src/foo.ts");

    const [request] = channel.written as any[];
    expect(request.method).toEqual("tree.read");
    expect(request.params).toEqual({ path: "src/foo.ts" });
  });

  it("Scenario REQ-WPS-10.2: ir.emit request carries the Batch envelope with its own protocolVersion, no top-level wire-version field", async () => {
    const channel = new ScriptedChannel((req) => ({ type: "response", id: req.id, result: { appliedCount: 0 } }));
    const client = new StdioEngineClient(channel);
    const batch = { protocolVersion: 1 as const, force: false, instructions: [] };

    await client.emit(batch);

    const [request] = channel.written as any[];
    expect(request.method).toEqual("ir.emit");
    expect(request.params).toEqual({ batch });
    expect(request.params.batch.protocolVersion).toEqual(1);
    expect(request).not.toHaveProperty("protocolVersion");
  });

  it("Scenario REQ-WPS-10.3: ir.commit/ir.discard success ack uses `result`, never `error`", async () => {
    const channel = ackChannel();
    const client = new StdioEngineClient(channel);

    await client.commit();
    await client.discard();

    const [commitRequest, discardRequest] = channel.written as any[];
    expect(commitRequest.method).toEqual("ir.commit");
    expect(commitRequest.params).toEqual({});
    expect(discardRequest.method).toEqual("ir.discard");
    expect(discardRequest.params).toEqual({});
  });
});

describe("REQ-WPS-05 — reverse-callback allowlist, realized by StdioEngineClient", () => {
  it("Scenario REQ-WPS-05.1: every issued request's method is one of the four allowlisted methods", async () => {
    const channel = new ScriptedChannel((req) => {
      if (req.method === "tree.read") return { type: "response", id: req.id, result: null };
      return { type: "response", id: req.id, result: {} };
    });
    const client = new StdioEngineClient(channel);

    await client.read("a.ts");
    await client.emit({ protocolVersion: 1, force: false, instructions: [] });
    await client.commit();
    await client.discard();

    const methods = (channel.written as any[]).map((frame) => frame.method);
    expect(methods).toEqual(["tree.read", "ir.emit", "ir.commit", "ir.discard"]);
    for (const method of methods) {
      expect(["tree.read", "ir.emit", "ir.commit", "ir.discard"]).toContain(method);
    }
  });
});

describe("REQ-SEC-03 — advisory commit/discard", () => {
  it("Scenario REQ-SEC-03.1: commit acknowledged — the promise resolves and the run is considered complete", async () => {
    const client = new StdioEngineClient(ackChannel());
    await expect(client.commit()).resolves.toBeUndefined();
  });

  it("Scenario REQ-SEC-03.2: a host rejection of ir.commit rejects with the stable IntentRejectedError identity", async () => {
    const channel = new ScriptedChannel((req) => ({
      type: "response",
      id: req.id,
      error: { code: -32000, message: "double-commit" },
    }));
    const client = new StdioEngineClient(channel);

    let caught: unknown;
    try {
      await client.commit();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(IntentRejectedError);
    expect(caught).not.toBeInstanceOf(EmitRejection);
  });

  it("a host rejection of ir.discard also rejects with IntentRejectedError, never silently resolved", async () => {
    const channel = new ScriptedChannel((req) => ({
      type: "response",
      id: req.id,
      error: { code: -32000, message: "nothing to discard" },
    }));
    const client = new StdioEngineClient(channel);

    let caught: unknown;
    try {
      await client.discard();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(IntentRejectedError);
  });
});

describe("REQ-SEC-06 — not-found vs. empty-string vs. content distinction", () => {
  it("Scenario REQ-SEC-06.1: a null result maps to undefined, not empty string", async () => {
    const channel = new ScriptedChannel((req) => ({ type: "response", id: req.id, result: null }));
    const client = new StdioEngineClient(channel);

    const result = await client.read("missing.ts");

    expect(result).toBeUndefined();
  });

  it("Scenario REQ-SEC-06.2: {content: \"\"} maps to empty string, never undefined", async () => {
    const channel = new ScriptedChannel((req) => ({ type: "response", id: req.id, result: { content: "" } }));
    const client = new StdioEngineClient(channel);

    const result = await client.read("empty.ts");

    expect(result).toEqual("");
  });

  it("a populated content result maps to that exact string", async () => {
    const channel = new ScriptedChannel((req) => ({
      type: "response",
      id: req.id,
      result: { content: "export const x = 1;" },
    }));
    const client = new StdioEngineClient(channel);

    const result = await client.read("populated.ts");

    expect(result).toEqual("export const x = 1;");
  });
});

describe("REQ-WPS-03 — post-boot frame routing", () => {
  it("Scenario REQ-WPS-03.1: an unknown-type frame is discarded on the wire, noted to stderr, and the next frame is still dispatched", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel);

    channel.pushValue({ type: "notification", id: "h0" });
    channel.pushValue({ type: "response", id: "s0", result: { content: "x" } });

    const result = await client.read("a.ts");

    expect(result).toEqual("x");
    expect(channel.stderrNotes.length).toBeGreaterThan(0);
  });

  it("Scenario REQ-WPS-03.1: a frame with an absent type is discarded the same way", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel);

    channel.pushValue({ id: "h0", foo: "bar" });
    channel.pushValue({ type: "response", id: "s0", result: { content: "y" } });

    const result = await client.read("b.ts");

    expect(result).toEqual("y");
  });

  it("Scenario REQ-WPS-03.2: a response with a stale/foreign id is discarded, no pending call affected", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel);

    channel.pushValue({ type: "response", id: "s999", result: { content: "never requested" } });
    channel.pushValue({ type: "response", id: "s0", result: { content: "genuine" } });

    const result = await client.read("c.ts");

    expect(result).toEqual("genuine");
  });

  it("Scenario REQ-WPS-03.3: the genuinely-pending call still resolves after TWO unrelated discards (M16 liveness)", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel);

    channel.pushValue({ type: "notification" });
    channel.pushValue({ type: "response", id: "s999", result: {} });
    channel.pushValue({ type: "response", id: "s0", result: { content: "still resolves" } });

    const result = await client.read("d.ts");

    expect(result).toEqual("still resolves");
    expect(channel.stderrNotes.length).toEqual(2);
  });
});

describe("REQ-SEC-08 — inbound frame fault handling", () => {
  it("Scenario REQ-SEC-08.1: a malformed-JSON transport-fault from the channel rejects the pending call, classified", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel);

    channel.pushError(new TransportFault("malformed", "inbound frame body failed to parse as JSON"));

    let caught: unknown;
    try {
      await client.read("e.ts");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TransportFault);
    expect((caught as TransportFault).kind).toEqual("malformed");
  });

  it("Scenario REQ-SEC-08.3: stdin EOF while a callback is pending rejects promptly as transport-fault (eof), not deferred to the timeout", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel, { timeoutMs: 5_000 });

    channel.pushError(new TransportFault("eof", "stream ended while a response was still expected"));

    const started = performance.now();
    let caught: unknown;
    try {
      await client.commit();
    } catch (err) {
      caught = err;
    }
    const elapsedMs = performance.now() - started;

    expect(caught).toBeInstanceOf(TransportFault);
    expect((caught as TransportFault).kind).toEqual("eof");
    expect(elapsedMs).toBeLessThan(1_000); // observably faster than the 5s bound, never waiting for it
  });
});

describe("REQ-SEC-05 — bounded-wait timeout contract", () => {
  it("Scenario REQ-SEC-05.1: a hung host times out instead of hanging forever, classified transport-fault (timeout)", async () => {
    const channel = new QueueChannel(); // never pushes anything — read() hangs forever
    const client = new StdioEngineClient(channel, { timeoutMs: 20 });

    let caught: unknown;
    try {
      await client.read("hung.ts");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TransportFault);
    expect((caught as TransportFault).kind).toEqual("timeout");
  });

  it("Scenario REQ-SEC-05.2: a slow-but-successful response resolves normally, no stray rejection afterward (M10)", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel, { timeoutMs: 200 });

    setTimeout(() => channel.pushValue({ type: "response", id: "s0", result: { content: "just in time" } }), 20);

    const result = await client.read("slow.ts");
    expect(result).toEqual("just in time");

    // Grace period past the original bound: if the timer weren't cleared on resolution,
    // a stray rejection would have to surface as an unhandled rejection by now.
    await new Promise((resolve) => setTimeout(resolve, 250));
  });

  it("an injected timeoutMs is honored over the 30_000ms default", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel, { timeoutMs: 15 });

    const started = performance.now();
    let caught: unknown;
    try {
      await client.discard();
    } catch (err) {
      caught = err;
    }
    const elapsedMs = performance.now() - started;

    expect(caught).toBeInstanceOf(TransportFault);
    expect(elapsedMs).toBeLessThan(1_000);
  });
});

describe("REQ-WPS-04.1 — emit() rejects an over-cap batch locally, never writes it to the wire", () => {
  it("Scenario REQ-WPS-04.1: an over-cap batch rejects with EmitRejection{code:\"cap\"} without ever calling write()", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel);
    const batch = batchOverSerializedBytes(BATCH_CAP_BYTES);

    let caught: unknown;
    try {
      await client.emit(batch);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(EmitRejection);
    expect((caught as EmitRejection).code).toEqual("cap");
    expect(channel.written).toEqual([]);
  });

  it("Scenario REQ-WPS-04.3: a batch at EXACTLY the cap is written to the wire, not rejected locally", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel);
    const batch = batchOfSerializedBytes(BATCH_CAP_BYTES);
    channel.pushValue({ type: "response", id: "s0", result: { appliedCount: 1 } });

    await client.emit(batch);

    expect(channel.written.length).toEqual(1);
  });
});

describe("REQ-SEC-04 — EmitRejection mapping with failedIndex precondition", () => {
  it("Scenario REQ-SEC-04.1: a directive-level rejection (collision) carries failedIndex through exactly", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel);
    channel.pushValue({
      type: "response",
      id: "s0",
      error: { code: -32001, message: "collision", data: { emitRejectionCode: "collision", failedIndex: 3, appliedCount: 3 } },
    });

    let caught: unknown;
    try {
      await client.emit({ protocolVersion: 1, force: false, instructions: [] });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(EmitRejection);
    expect((caught as EmitRejection).code).toEqual("collision");
    expect((caught as EmitRejection).failedIndex).toEqual(3);
  });

  it("Scenario REQ-SEC-04.2: a batch-level rejection (cap) carries no failedIndex, never a guessed index", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel);
    channel.pushValue({
      type: "response",
      id: "s0",
      error: { code: -32001, message: "cap", data: { emitRejectionCode: "cap", appliedCount: 0 } },
    });

    let caught: unknown;
    try {
      await client.emit({ protocolVersion: 1, force: false, instructions: [] });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(EmitRejection);
    expect((caught as EmitRejection).code).toEqual("cap");
    expect((caught as EmitRejection).failedIndex).toBeUndefined();
  });

  it("Scenario REQ-SEC-04.3: three out-of-contract payloads all degrade to unknown, never crash (M7)", async () => {
    const malformedPayloads = [
      { emitRejectionCode: "bogus-code", appliedCount: 0 },
      { emitRejectionCode: "cap", failedIndex: 1, appliedCount: 1 }, // batch-level code carrying a directive-level field
      { emitRejectionCode: "collision", failedIndex: -1, appliedCount: 0 }, // negative index
    ];

    for (const data of malformedPayloads) {
      const channel = new QueueChannel();
      const client = new StdioEngineClient(channel);
      channel.pushValue({ type: "response", id: "s0", error: { code: -32001, message: "malformed", data } });

      let caught: unknown;
      try {
        await client.emit({ protocolVersion: 1, force: false, instructions: [] });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(EmitRejection);
      expect((caught as EmitRejection).code as string).toEqual("unknown");
      expect((caught as EmitRejection).failedIndex).toBeUndefined();
    }
  });
});

describe("REQ-WPS-08 — factory-pointer/ir.emit rejection wire shape", () => {
  it("Scenario REQ-WPS-08.2: a domain-classified rejection round-trips exactly, never inventing a code by parsing message text", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel);
    channel.pushValue({
      type: "response",
      id: "s0",
      error: {
        code: -32001,
        message: "this text says something totally different from the code",
        data: { emitRejectionCode: "collision", failedIndex: 2, appliedCount: 2 },
      },
    });

    let caught: unknown;
    try {
      await client.emit({ protocolVersion: 1, force: false, instructions: [] });
    } catch (err) {
      caught = err;
    }

    expect((caught as EmitRejection).code).toEqual("collision");
    expect((caught as EmitRejection).failedIndex).toEqual(2);
    expect((caught as EmitRejection).appliedCount).toEqual(2);
  });

  it("Scenario REQ-WPS-08.3: an explicit \"unknown\" code round-trips like any other allowlisted code, not special-cased into a crash (M7)", async () => {
    const channel = new QueueChannel();
    const client = new StdioEngineClient(channel);
    channel.pushValue({
      type: "response",
      id: "s0",
      error: { code: -32001, message: "unclassified", data: { emitRejectionCode: "unknown", appliedCount: 0 } },
    });

    let caught: unknown;
    try {
      await client.emit({ protocolVersion: 1, force: false, instructions: [] });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(EmitRejection);
    expect((caught as EmitRejection).code as string).toEqual("unknown");
    expect((caught as EmitRejection).failedIndex).toBeUndefined();
  });
});
