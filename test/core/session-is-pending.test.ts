/**
 * S-000 — Session.isPending(directive) (row-141 kept-half). A direct identity membership
 * test against the pending buffer, replacing the dialect handle's own
 * `pendingSnapshot().includes(...)` copy-then-scan for its orphan-guard check
 * (src/core/dialect-handle.ts#ensureOpen).
 */
import { describe, it, expect } from "bun:test";
import { Session } from "../../src/core/session.ts";
import type { EngineClient } from "../../src/core/engine-client.ts";
import type { Directive } from "../../src/core/wire.ts";

function noopClient(): EngineClient {
  return {
    async emit() {},
    async read() {
      return undefined;
    },
    async commit() {},
    async discard() {},
  };
}

describe("Session.isPending", () => {
  it("is false for a directive never buffered", () => {
    const session = new Session(noopClient());
    const directive: Directive = { op: "delete", delete: { path: "a.ts" } };
    expect(session.isPending(directive)).toBe(false);
  });

  it("is true for a directive that was buffered and not yet flushed", () => {
    const session = new Session(noopClient());
    const directive: Directive = { op: "delete", delete: { path: "a.ts" } };
    session.buffer(directive);
    expect(session.isPending(directive)).toBe(true);
  });

  it("is identity-based — a structurally-equal but distinct object is NOT pending", () => {
    const session = new Session(noopClient());
    session.buffer({ op: "delete", delete: { path: "a.ts" } });
    const lookalike: Directive = { op: "delete", delete: { path: "a.ts" } };
    expect(session.isPending(lookalike)).toBe(false);
  });

  it("is false once the buffer has been drained (flush splices it out)", async () => {
    const session = new Session(noopClient());
    const directive: Directive = { op: "delete", delete: { path: "a.ts" } };
    session.buffer(directive);
    await session.flush();
    expect(session.isPending(directive)).toBe(false);
  });
});
