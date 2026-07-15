// src/transport/frame-reader.ts — streaming reassembler over raw chunks (e.g. stdin) into
// logical frames. Owns chunk-boundary handling (split/coalesced/EOF-mid-frame, SEC-10);
// never byte-scans for a delimiter — length-prefixed only. Delegates body decoding AND the
// inbound reject-before-alloc cap check to framing.ts (single owner of the codec, fit-31 /
// fit-32). REQ-SEC-08.1/.2 (malformed JSON, desync): both collapse to the SAME `kind:
// "malformed"` classification in this implementation — mechanically, an undercounted length
// prefix (desync) manifests identically to deliberately-corrupt JSON once the misaligned
// byte range reaches decodeFrameBody (a JSON.parse failure); there is no reliable signal at
// this layer to distinguish "corrupt on purpose" from "corrupt because the frame boundary
// drifted" without risking false positives against REQ-WPS-03's silent-discard territory
// (a structurally-odd-but-valid-JSON object, e.g. `{type:"notification"}`, is WPS-03's job,
// never a frame-reader fail-closed fault).

import { decodeFrameBody, isOversizeDeclaredLength, LENGTH_PREFIX_BYTES } from "./framing.ts";
import { TransportFault } from "./stdio-engine-client.ts";

export class FrameReader {
  #buffer: Buffer = Buffer.alloc(0);
  readonly #source: AsyncIterable<Uint8Array>;

  constructor(source: AsyncIterable<Uint8Array>) {
    this.#source = source;
  }

  async *frames(): AsyncGenerator<unknown> {
    for await (const chunk of this.#source) {
      this.#buffer = Buffer.concat([this.#buffer, chunk]);
      for (const frame of this.#drainCompleteFrames()) {
        yield frame;
      }
    }
    // REQ-SEC-10.5: the stream ended (EOF) with an incomplete frame still buffered
    // (partial prefix or partial body) — fail closed, the partial is NEVER dispatched.
    // A clean EOF with nothing buffered is a normal, expected closure — not a fault.
    if (this.#buffer.length > 0) {
      throw new TransportFault(
        "eof",
        `stream ended with ${this.#buffer.length} buffered byte(s) short of a complete frame`
      );
    }
  }

  *#drainCompleteFrames(): Generator<unknown> {
    for (;;) {
      if (this.#buffer.length < LENGTH_PREFIX_BYTES) return;
      const bodyLength = this.#buffer.readUInt32BE(0);
      // REQ-WPS-04.2/.4: reject-before-alloc — classified BEFORE waiting for/allocating a
      // buffer for the declared body, using the raw declared length alone (unsigned read,
      // never misread as negative/small — WPS-04.4).
      if (isOversizeDeclaredLength(bodyLength)) {
        throw new TransportFault(
          "oversize",
          `inbound frame declares ${bodyLength} bytes, exceeding the reject-before-alloc cap`
        );
      }
      const frameLength = LENGTH_PREFIX_BYTES + bodyLength;
      if (this.#buffer.length < frameLength) return;

      const body = this.#buffer.subarray(LENGTH_PREFIX_BYTES, frameLength);
      this.#buffer = this.#buffer.subarray(frameLength);
      let decoded: unknown;
      try {
        decoded = decodeFrameBody(body);
      } catch {
        // REQ-SEC-08.1/.2: fails closed, attributed structurally by the caller (SEC-02
        // single-in-flight) — never resynchronized by byte-scanning (SEC-08.2).
        throw new TransportFault("malformed", "inbound frame body failed to parse as JSON");
      }
      yield decoded;
    }
  }
}
