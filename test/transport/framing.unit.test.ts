// REQ-WPS-01: frame envelope structure — 4-byte BE length prefix + UTF-8 JSON body,
// symmetric both directions. Unit-level: exercises framing.ts's codec directly, no subprocess.

import { describe, it, expect } from "bun:test";
import {
  encodeFrame,
  encodeFrameBody,
  withPreserializedBody,
  decodeFrameBody,
  isOversizeDeclaredLength,
} from "../../src/transport/framing.ts";
import { BATCH_CAP_BYTES, exceedsBatchCap } from "../../src/core/wire.ts";
import { batchOfSerializedBytes, batchOverSerializedBytes } from "../fake/batch-cap-fixtures.ts";

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

describe("REQ-WPS-04 — reject-before-alloc oversize handling", () => {
  describe("Scenario REQ-WPS-04.2: oversized inbound length prefix classified over-cap", () => {
    it("a declared length one byte over BATCH_CAP_BYTES is oversize", () => {
      expect(isOversizeDeclaredLength(BATCH_CAP_BYTES + 1)).toBe(true);
    });
  });

  describe("Scenario REQ-WPS-04.3: exactly-at-cap prefix and batch are accepted (B7 boundary)", () => {
    it("a declared length of EXACTLY BATCH_CAP_BYTES is NOT oversize (inbound leg)", () => {
      expect(isOversizeDeclaredLength(BATCH_CAP_BYTES)).toBe(false);
    });

    it("a Batch serialized to EXACTLY BATCH_CAP_BYTES does not exceed the cap (outbound leg)", () => {
      const batch = batchOfSerializedBytes(BATCH_CAP_BYTES);
      expect(exceedsBatchCap(batch)).toBe(false);
    });
  });

  describe("Scenario REQ-WPS-04.4: signed-read triangulation on the length prefix (m9)", () => {
    it("0x80000000 (negative if read as signed int32) is classified over-cap, never accepted", () => {
      // Kills a readInt32BE-instead-of-readUInt32BE mutant: as a signed 32-bit int this
      // value is negative, which a buggy `< 0` short-circuit could wrongly accept as
      // "small". isOversizeDeclaredLength must classify it over-cap regardless.
      expect(isOversizeDeclaredLength(0x80000000)).toBe(true);
    });
  });

  describe("Scenario REQ-WPS-04.1: oversized batch rejected before the frame would be written (outbound leg)", () => {
    it("a Batch built via batchOverSerializedBytes exceeds the cap — this fixture's serialized size is strictly over while raw content stays under, killing the serialized-vs-raw-content and UTF-16-length mutants", () => {
      const batch = batchOverSerializedBytes(BATCH_CAP_BYTES);
      expect(exceedsBatchCap(batch)).toBe(true);
    });
  });
});

describe("REQ-WPS-04.1 — single serialization: a preserialized frame body is reused by encodeFrame (judgment-day F7)", () => {
  it("encodeFrame emits the EXACT attached bytes for a value carrying a preserialized body", () => {
    const value = { type: "request", id: "s0", method: "ir.emit", params: { batch: { a: 1 } } };
    const body = encodeFrameBody(value);

    const frame = encodeFrame(withPreserializedBody(value, body));

    expect(frame.readUInt32BE(0)).toEqual(body.length);
    expect(frame.subarray(4).equals(body)).toBe(true);
    // The attachment is invisible to structural consumers: enumerable shape unchanged.
    expect(Object.keys(value)).toEqual(["type", "id", "method", "params"]);
    expect(JSON.parse(frame.subarray(4).toString("utf8"))).toEqual(value);
  });

  it("a tampered preserialized body is what actually hits the wire — proving reuse is real, not a re-serialization", () => {
    const value = { type: "request", id: "s0", method: "ir.commit", params: {} };
    const tampered = Buffer.from('{"tampered":true}', "utf8");

    const frame = encodeFrame(withPreserializedBody(value, tampered));

    expect(frame.readUInt32BE(0)).toEqual(tampered.length);
    expect(decodeFrameBody(frame.subarray(4))).toEqual({ tampered: true });
  });
});
