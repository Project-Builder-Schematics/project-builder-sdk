// Judgment-day F1 (REQ-SEC-08.3 + REQ-EXC-01, owner ruling R3): Session.flush translates
// ONLY port-contract rejections (EmitRejection and the ERM-03 degrade family) into
// AuthoringError — a transport-class fault from the client (TransportFault) passes through
// UNTRANSLATED so the runner classifies it exit 3 (transport-fault), never exit 2 via an
// AuthoringError{unknown} degrade. ERM-03's plain-Error degrade is pinned here too, proving
// the pass-through is surgical, not a blanket rethrow.

import { describe, it, expect } from "bun:test";
import type { EngineClient } from "../../src/core/engine-client.ts";
import { Session } from "../../src/core/session.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { TransportFault } from "../../src/transport/stdio-engine-client.ts";

function rejectingClient(rejection: unknown): EngineClient {
  return {
    emit: () => Promise.reject(rejection),
    read: () => Promise.resolve(undefined),
    commit: () => Promise.resolve(),
    discard: () => Promise.resolve(),
  };
}

function sessionWithPendingWrite(client: EngineClient): Session {
  const session = new Session(client);
  session.buffer({ op: "create", create: { pathTemplate: "a.ts", template: "x", options: {} } });
  return session;
}

describe("Session.flush — transport-class faults pass through untranslated (REQ-SEC-08.3)", () => {
  it("a TransportFault from client.emit rejects flush() with the SAME TransportFault — never AuthoringError{unknown}", async () => {
    const fault = new TransportFault("eof", "wire closed while a response was pending");
    const session = sessionWithPendingWrite(rejectingClient(fault));

    let caught: unknown;
    try {
      await session.flush();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBe(fault);
    expect(caught).not.toBeInstanceOf(AuthoringError);
  });

  it("every TransportFault kind passes through — malformed, oversize, timeout, eof", async () => {
    for (const kind of ["malformed", "oversize", "timeout", "eof"] as const) {
      const fault = new TransportFault(kind, `fault of kind ${kind}`);
      const session = sessionWithPendingWrite(rejectingClient(fault));

      let caught: unknown;
      try {
        await session.flush();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBe(fault);
    }
  });

  it("REQ-ERM-03 is preserved: a metadata-less plain Error still degrades to AuthoringError{reason: unknown}", async () => {
    const session = sessionWithPendingWrite(rejectingClient(new Error("boom")));

    let caught: unknown;
    try {
      await session.flush();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("unknown");
  });
});
