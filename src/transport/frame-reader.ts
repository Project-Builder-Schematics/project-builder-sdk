// src/transport/frame-reader.ts — streaming reassembler over raw chunks (e.g. stdin) into
// logical frames. Owns chunk-boundary handling (split/coalesced/EOF-mid-frame, SEC-10);
// never byte-scans for a delimiter — length-prefixed only. Delegates body decoding to
// framing.ts (single owner of the codec, fit-31). Happy-path reassembly only in S-000; the
// fault matrix (malformed/oversize/EOF-mid-frame) lands in S-001.

import { decodeFrameBody } from "./framing.ts";

const LENGTH_PREFIX_BYTES = 4;

export class FrameReader {
  #buffer: Buffer = Buffer.alloc(0);
  readonly #source: AsyncIterable<Uint8Array>;

  constructor(source: AsyncIterable<Uint8Array>) {
    this.#source = source;
  }

  async *frames(): AsyncGenerator<unknown> {
    for await (const chunk of this.#source) {
      this.#buffer = Buffer.concat([this.#buffer, Buffer.from(chunk)]);
      for (const frame of this.#drainCompleteFrames()) {
        yield frame;
      }
    }
  }

  *#drainCompleteFrames(): Generator<unknown> {
    for (;;) {
      if (this.#buffer.length < LENGTH_PREFIX_BYTES) return;
      const bodyLength = this.#buffer.readUInt32BE(0);
      const frameLength = LENGTH_PREFIX_BYTES + bodyLength;
      if (this.#buffer.length < frameLength) return;

      const body = this.#buffer.subarray(LENGTH_PREFIX_BYTES, frameLength);
      this.#buffer = this.#buffer.subarray(frameLength);
      yield decodeFrameBody(body);
    }
  }
}
