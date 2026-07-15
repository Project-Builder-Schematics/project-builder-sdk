// REQ-SEC-01/03/06, REQ-WPS-05/10: StdioEngineClient over an in-memory FrameChannel double —
// no subprocess, no real stdio. Covers S-000's happy-path REQs only; SEC-02/04/05/08 (overlap
// guard, rejection-mapping edge cases, timeout, fail-closed) land in S-001/S-003.

import { describe, it, expect } from "bun:test";
import type { EngineClient } from "../../src/core/engine-client.ts";
import { EmitRejection } from "../../src/core/emit-rejection.ts";
import {
  StdioEngineClient,
  IntentRejectedError,
  type FrameChannel,
} from "../../src/transport/stdio-engine-client.ts";

// Scripted in-memory double: replies to the LAST written request via a per-method responder
// table. Single-in-flight only (ADR-03) — matches the client's own sequential contract.
class ScriptedChannel implements FrameChannel {
  written: unknown[] = [];
  #responder: (request: any) => unknown;

  constructor(responder: (request: any) => unknown) {
    this.#responder = responder;
  }

  write(value: unknown): void {
    this.written.push(value);
  }

  async read(): Promise<unknown> {
    const last = this.written[this.written.length - 1];
    return this.#responder(last);
  }
}

function ackChannel(): ScriptedChannel {
  return new ScriptedChannel((req) => ({ type: "response", id: req.id, result: {} }));
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
