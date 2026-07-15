// REQ-WPS-02: versioned ready handshake, fail-at-greeting.
// REQ-WPS-05: reverse-callback allowlist — the closed 4-method set.

import { describe, it, expect } from "bun:test";
import {
  WIRE_PROTOCOL_VERSION,
  REVERSE_CALLBACK_METHODS,
  isStructurallyValidGreeting,
  versionMatches,
  isReverseMethod,
} from "../../src/transport/wire-protocol.ts";

describe("REQ-WPS-02 — versioned ready handshake, fail-at-greeting", () => {
  describe("Scenario REQ-WPS-02.1: matching versions proceed", () => {
    it("accepts a greeting whose protocolVersion equals the runner's compiled-in wire version", () => {
      const greeting = { method: "ready" as const, protocolVersion: WIRE_PROTOCOL_VERSION };
      expect(isStructurallyValidGreeting(greeting)).toBe(true);
      expect(versionMatches(greeting)).toBe(true);
    });
  });

  describe("Scenario REQ-WPS-02.2: mismatch fails at greeting, zero callbacks dispatched", () => {
    it("flags a structurally valid greeting whose protocolVersion does not match", () => {
      const greeting = { method: "ready" as const, protocolVersion: WIRE_PROTOCOL_VERSION + 1 };
      expect(isStructurallyValidGreeting(greeting)).toBe(true);
      expect(versionMatches(greeting)).toBe(false);
    });
  });

  describe("Scenario REQ-WPS-02.3: structurally invalid greeting fails the same way (M17)", () => {
    it("rejects a greeting missing method: \"ready\"", () => {
      expect(isStructurallyValidGreeting({ protocolVersion: WIRE_PROTOCOL_VERSION })).toBe(false);
    });

    it("rejects a greeting whose method is not exactly \"ready\"", () => {
      expect(isStructurallyValidGreeting({ method: "hello", protocolVersion: WIRE_PROTOCOL_VERSION })).toBe(false);
    });

    it("rejects a greeting with an absent protocolVersion", () => {
      expect(isStructurallyValidGreeting({ method: "ready" })).toBe(false);
    });

    it("rejects a greeting with a non-integer protocolVersion", () => {
      expect(isStructurallyValidGreeting({ method: "ready", protocolVersion: "1" })).toBe(false);
      expect(isStructurallyValidGreeting({ method: "ready", protocolVersion: 1.5 })).toBe(false);
    });

    it("rejects a non-object greeting", () => {
      expect(isStructurallyValidGreeting(null)).toBe(false);
      expect(isStructurallyValidGreeting("ready")).toBe(false);
    });
  });
});

describe("REQ-WPS-05 — reverse-callback allowlist", () => {
  describe("Scenario REQ-WPS-05.1: only allowlisted methods are issued", () => {
    it("the closed set is exactly the four reverse-callback methods", () => {
      expect(REVERSE_CALLBACK_METHODS).toEqual(["tree.read", "ir.emit", "ir.commit", "ir.discard"]);
    });

    it("recognizes each of the four allowlisted methods", () => {
      for (const method of REVERSE_CALLBACK_METHODS) {
        expect(isReverseMethod(method)).toBe(true);
      }
    });

    it("rejects a fifth, non-allowlisted method name", () => {
      expect(isReverseMethod("runFactory")).toBe(false);
      expect(isReverseMethod("tree.write")).toBe(false);
    });
  });
});
