// frame-reader.ts: streaming reassembler over raw chunks -> logical frames. Happy-path only
// here — the full split/coalesced/EOF-mid-frame fault matrix (SEC-10) lands in S-001.

import { describe, it, expect } from "bun:test";
import { encodeFrame, LENGTH_PREFIX_BYTES } from "../../src/transport/framing.ts";
import { FrameReader } from "../../src/transport/frame-reader.ts";
import { TransportFault } from "../../src/transport/stdio-engine-client.ts";
import { BATCH_CAP_BYTES } from "../../src/core/wire.ts";

async function* chunksOf(...buffers: Buffer[]): AsyncGenerator<Buffer> {
  for (const buf of buffers) yield buf;
}

async function collect<T>(source: AsyncGenerator<T>, count: number): Promise<T[]> {
  const out: T[] = [];
  for await (const value of source) {
    out.push(value);
    if (out.length === count) break;
  }
  return out;
}

describe("frame-reader — happy-path streaming reassembly", () => {
  it("decodes a single complete frame delivered in one chunk", async () => {
    const value = { method: "ready", protocolVersion: 1 };
    const reader = new FrameReader(chunksOf(encodeFrame(value)));

    const [decoded] = await collect(reader.frames(), 1);

    expect(decoded).toEqual(value);
  });

  it("decodes frames delivered across separate whole-frame chunks, in order", async () => {
    const first = { type: "request", id: "s0", method: "tree.read", params: { path: "a.ts" } };
    const second = { type: "request", id: "s1", method: "tree.read", params: { path: "b.ts" } };
    const reader = new FrameReader(chunksOf(encodeFrame(first), encodeFrame(second)));

    const decoded = await collect(reader.frames(), 2);

    expect(decoded).toEqual([first, second]);
  });

  it("decodes two frames coalesced into a single chunk, in order", async () => {
    const first = { type: "response", id: "s0", result: { appliedCount: 1 } };
    const second = { type: "response", id: "s1", result: {} };
    const coalesced = Buffer.concat([encodeFrame(first), encodeFrame(second)]);
    const reader = new FrameReader(chunksOf(coalesced));

    const decoded = await collect(reader.frames(), 2);

    expect(decoded).toEqual([first, second]);
  });
});

// Drains an async generator to completion, collecting every yielded value; re-throws
// whatever the generator itself throws (SEC-10.5's fault path) so callers can assert on it.
async function drainToFault<T>(source: AsyncGenerator<T>): Promise<{ yielded: T[]; error: unknown }> {
  const yielded: T[] = [];
  try {
    for await (const value of source) yielded.push(value);
    return { yielded, error: undefined };
  } catch (error) {
    return { yielded, error };
  }
}

describe("REQ-SEC-08 — inbound frame fault handling (frame-reader level)", () => {
  describe("Scenario REQ-SEC-08.2: desync never triggers a byte-scan resync", () => {
    it("a frame whose declared length undercounts its actual body fails closed — and the genuinely-valid NEXT frame is never dispatched (proves no forward byte-scan)", async () => {
      const first = { type: "response", id: "s0", result: { content: "hello world" } };
      const realFrame = encodeFrame(first);
      const realBodyLength = realFrame.readUInt32BE(0);
      const undercounted = Buffer.from(realFrame);
      undercounted.writeUInt32BE(realBodyLength - 5, 0); // declares 5 fewer bytes than the real body

      const second = { type: "response", id: "s1", result: {} }; // genuinely valid, would follow correctly
      const stream = Buffer.concat([undercounted, encodeFrame(second)]);
      const reader = new FrameReader(chunksOf(stream));

      const { yielded, error } = await drainToFault(reader.frames());

      // Neither frame is ever dispatched: not the truncated first (it fails to parse), and
      // NOT the genuinely-valid second one either — proving the reader does not scan
      // forward looking for the next plausible frame boundary.
      expect(yielded).toEqual([]);
      expect(error).toBeInstanceOf(TransportFault);
    });
  });
});

describe("REQ-SEC-10 — partial/chunked frame reassembly (fault matrix)", () => {
  // Characterization (S-001): SEC-10.1/.2/.3/.4 are already satisfied by the generic
  // byte-buffering drain loop built in S-000 — these tests pin that behavior under its
  // REQ-SEC-10 citation (needed for S-004's spec-coverage map) rather than driving new
  // production code.
  describe("Scenario REQ-SEC-10.1: split mid-prefix reassembles to one dispatch (SC-7)", () => {
    it("[characterization] the 4-byte length prefix split 2+2 across two reads still yields one correctly-lengthed frame", async () => {
      const value = { type: "response", id: "s0", result: { content: "x" } };
      const frame = encodeFrame(value);
      const reader = new FrameReader(chunksOf(frame.subarray(0, 2), frame.subarray(2)));

      const decoded = await collect(reader.frames(), 1);

      expect(decoded).toEqual([value]);
    });
  });

  describe("Scenario REQ-SEC-10.2: split mid-payload reassembles to one dispatch (SC-7)", () => {
    it("[characterization] a JSON body split across three reads yields one frame with the exact original payload", async () => {
      const value = { type: "response", id: "s0", result: { content: "line one\nline two" } };
      const frame = encodeFrame(value);
      const third = Math.floor(frame.length / 3);
      const reader = new FrameReader(
        chunksOf(frame.subarray(0, third), frame.subarray(third, 2 * third), frame.subarray(2 * third))
      );

      const decoded = await collect(reader.frames(), 1);

      expect(decoded).toEqual([value]);
    });
  });

  describe("Scenario REQ-SEC-10.3: two coalesced frames in one read dispatch exactly twice (M9)", () => {
    it("[characterization] never a merged dispatch, never a dropped frame", async () => {
      const first = { type: "request", id: "s0", method: "tree.read", params: { path: "a.ts" } };
      const second = { type: "request", id: "s1", method: "tree.read", params: { path: "b.ts" } };
      const coalesced = Buffer.concat([encodeFrame(first), encodeFrame(second)]);
      const reader = new FrameReader(chunksOf(coalesced));

      const decoded = await collect(reader.frames(), 2);

      expect(decoded).toEqual([first, second]);
    });
  });

  describe("Scenario REQ-SEC-10.4: complete frame plus a partial next prefix dispatches one, buffers the rest (M9)", () => {
    it("[characterization] the complete frame dispatches immediately; the partial prefix is buffered, never dispatched early", async () => {
      const first = { type: "response", id: "s0", result: {} };
      const second = { type: "response", id: "s1", result: { content: "later" } };
      const secondFrame = encodeFrame(second);
      // One read: frame1 complete + the first 2 bytes of frame2's 4-byte prefix.
      const firstChunk = Buffer.concat([encodeFrame(first), secondFrame.subarray(0, 2)]);
      const reader = new FrameReader(chunksOf(firstChunk, secondFrame.subarray(2)));

      const decoded = await collect(reader.frames(), 2);

      expect(decoded).toEqual([first, second]);
    });
  });

  describe("Scenario REQ-SEC-10.5: stream ends mid-frame — buffered partial is never dispatched (B5)", () => {
    it("classifies transport-fault (kind: eof) when EOF arrives after a valid prefix but before the full payload", async () => {
      const value = { type: "response", id: "s0", result: { content: "never seen" } };
      const frame = encodeFrame(value);
      // Deliver the 4-byte prefix plus a few payload bytes, then end the stream — never
      // the full body.
      const truncated = frame.subarray(0, 4 + 3);
      const reader = new FrameReader(chunksOf(truncated));

      const { yielded, error } = await drainToFault(reader.frames());

      expect(yielded).toEqual([]);
      expect(error).toBeInstanceOf(TransportFault);
      expect((error as InstanceType<typeof TransportFault>).kind).toEqual("eof");
    });

    it("classifies transport-fault (kind: eof) when EOF arrives mid-length-prefix (fewer than 4 bytes ever arrive)", async () => {
      const reader = new FrameReader(chunksOf(Buffer.from([0x00, 0x00])));

      const { yielded, error } = await drainToFault(reader.frames());

      expect(yielded).toEqual([]);
      expect(error).toBeInstanceOf(TransportFault);
      expect((error as InstanceType<typeof TransportFault>).kind).toEqual("eof");
    });

    it("a clean EOF with nothing buffered ends the generator normally — no fault (no partial frame to lose)", async () => {
      const value = { type: "response", id: "s0", result: {} };
      const reader = new FrameReader(chunksOf(encodeFrame(value)));

      const { yielded, error } = await drainToFault(reader.frames());

      expect(yielded).toEqual([value]);
      expect(error).toBeUndefined();
    });
  });
});

describe("REQ-WPS-04.2/.4 — reject-before-alloc at the FrameReader level (oversize declared length)", () => {
  // Each case delivers ONLY the 4-byte length prefix — never any of the declared body bytes.
  // The reader must fault on the prefix alone, proving the declared body is never awaited or
  // allocated (a real oversize body would exhaust memory before a byte-scan ever caught it).
  it("a frame declaring 0x80000000 bytes throws TransportFault(kind: 'oversize') without ever waiting for the declared body", async () => {
    const prefix = Buffer.alloc(LENGTH_PREFIX_BYTES);
    prefix.writeUInt32BE(0x80000000, 0);
    const reader = new FrameReader(chunksOf(prefix));

    const { yielded, error } = await drainToFault(reader.frames());

    expect(yielded).toEqual([]);
    expect(error).toBeInstanceOf(TransportFault);
    expect((error as InstanceType<typeof TransportFault>).kind).toEqual("oversize");
  });

  it("a frame declaring BATCH_CAP_BYTES + 1 bytes throws TransportFault(kind: 'oversize') without ever waiting for the declared body", async () => {
    const prefix = Buffer.alloc(LENGTH_PREFIX_BYTES);
    prefix.writeUInt32BE(BATCH_CAP_BYTES + 1, 0);
    const reader = new FrameReader(chunksOf(prefix));

    const { yielded, error } = await drainToFault(reader.frames());

    expect(yielded).toEqual([]);
    expect(error).toBeInstanceOf(TransportFault);
    expect((error as InstanceType<typeof TransportFault>).kind).toEqual("oversize");
  });
});
