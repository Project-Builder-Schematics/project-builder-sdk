// REQ-WPS-01: frame envelope structure — 4-byte BE length prefix + UTF-8 JSON body,
// symmetric both directions. Unit-level: exercises framing.ts's codec directly, no subprocess.

import { describe, it, expect } from "bun:test";
import { encodeFrame, decodeFrameBody } from "../../src/transport/framing.ts";

describe("REQ-WPS-01 — frame envelope structure", () => {
  describe("Scenario REQ-WPS-01.1: round-trip frame integrity", () => {
    it("encodes a 4-byte BE length prefix equal to the UTF-8 body byte length", () => {
      const value = { method: "tree.read", params: { path: "src/foo.ts" } };
      const frame = encodeFrame(value);
      const expectedBodyBytes = Buffer.byteLength(JSON.stringify(value), "utf8");

      expect(frame.readUInt32BE(0)).toEqual(expectedBodyBytes);
      expect(frame.length).toEqual(4 + expectedBodyBytes);
    });

    it("JSON.parses the body back to the original value", () => {
      const value = { type: "response", id: "s0", result: { appliedCount: 3 } };
      const frame = encodeFrame(value);
      const bodyLength = frame.readUInt32BE(0);
      const body = frame.subarray(4, 4 + bodyLength);

      expect(decodeFrameBody(body)).toEqual(value);
    });
  });

  describe("Scenario REQ-WPS-01.2: newline-in-payload survives intact", () => {
    it("reconstructs a string value containing literal \\n bytes exactly", () => {
      const value = { content: "line one\nline two\nline three" };
      const frame = encodeFrame(value);
      const bodyLength = frame.readUInt32BE(0);
      const body = frame.subarray(4, 4 + bodyLength);

      expect(decodeFrameBody(body)).toEqual(value);
    });
  });

  describe("Scenario REQ-WPS-01.3: multi-byte UTF-8 payload — prefix is a byte count, not a char count", () => {
    it("prefixes a 3-byte-per-char string (€) with its UTF-8 byte length, not its UTF-16 .length", () => {
      const value = { content: "€€€" };
      const frame = encodeFrame(value);
      const expectedBodyBytes = Buffer.byteLength(JSON.stringify(value), "utf8");

      // "€" is 1 UTF-16 code unit but 3 UTF-8 bytes — a .length-based mutant would prefix
      // with the (smaller) code-unit count instead.
      expect(frame.readUInt32BE(0)).toEqual(expectedBodyBytes);
      expect(frame.readUInt32BE(0)).toBeGreaterThan(JSON.stringify(value).length);
    });

    it("prefixes a surrogate-pair string (😀) with its UTF-8 byte length, not its UTF-16 .length", () => {
      const value = { content: "😀" };
      const frame = encodeFrame(value);
      const expectedBodyBytes = Buffer.byteLength(JSON.stringify(value), "utf8");
      const bodyLength = frame.readUInt32BE(0);
      const body = frame.subarray(4, 4 + bodyLength);

      // "😀" is a 2-code-unit surrogate pair (JS .length === 2) but 4 UTF-8 bytes.
      expect(bodyLength).toEqual(expectedBodyBytes);
      expect(decodeFrameBody(body)).toEqual(value);
    });
  });
});
