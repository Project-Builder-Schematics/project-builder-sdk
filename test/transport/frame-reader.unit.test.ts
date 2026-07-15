// frame-reader.ts: streaming reassembler over raw chunks -> logical frames. Happy-path only
// here — the full split/coalesced/EOF-mid-frame fault matrix (SEC-10) lands in S-001.

import { describe, it, expect } from "bun:test";
import { encodeFrame } from "../../src/transport/framing.ts";
import { FrameReader } from "../../src/transport/frame-reader.ts";

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
