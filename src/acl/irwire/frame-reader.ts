// src/acl/irwire/frame-reader.ts — streaming reassembler over raw chunks (e.g. stdin) into
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

import { decodeFrameBody, isOversizeDeclaredLength, LENGTH_PREFIX_BYTES } from "../../shared-kernel/framing.ts";
import { TransportFault } from "./stdio-engine-client.ts";

// REQ-SEC-08.1: the per-frame fault marker. A malformed BODY is fully consumed by the time
// decoding fails (its boundary was known from the length prefix), so failing the ONE pending
// call is enough — the stream itself is still aligned. The generator YIELDS this marker
// instead of throwing, because a generator throw completes it permanently and would tear the
// connection down, contradicting SEC-08.1's "remains usable for subsequent calls". Consumers
// (runner.ts's FrameChannel, test/support/frame-host.ts) convert it to a rejection of the
// pending read. `oversize` and `eof` stay THROWN (fatal, fail-closed): after either, the
// stream position is not trustworthy or the stream is gone.
export class FrameFault {
  readonly fault: TransportFault;

  constructor(fault: TransportFault) {
    this.fault = fault;
  }
}

/**
 * One byte source shared by every reader of it, such as one stdin across sequential runs in one
 * process. At most one read from the source is outstanding, and its chunk goes to a reader that
 * is still open: a reader closed while its read is parked withdraws without taking the chunk, so
 * the next reader of the same source gets it (#167).
 */
class SharedSource {
  readonly source: AsyncIterable<Uint8Array>;
  readonly #iterator: AsyncIterator<Uint8Array>;
  #pull: Promise<IteratorResult<Uint8Array>> | undefined;

  constructor(source: AsyncIterable<Uint8Array>) {
    this.source = source;
    this.#iterator = iterate(source);
  }

  async next(isOpen: () => boolean): Promise<IteratorResult<Uint8Array>> {
    for (;;) {
      this.#pull ??= this.#iterator.next();
      const pull = this.#pull;
      const result = await pull;
      if (!isOpen()) return { value: undefined, done: true };
      if (result.done) return result;
      if (this.#pull !== pull) continue;
      this.#pull = undefined;
      return result;
    }
  }
}

// Drives `source` through one iterator. A named generator, since the runner closure admits
// neither `Symbol.asyncIterator` nor a keyed weak map (scripts/capability-admission.ts).
async function* iterate(source: AsyncIterable<Uint8Array>): AsyncGenerator<Uint8Array> {
  yield* source;
}

// Sequential runs read the same input object, so remembering the last one is enough.
let lastShared: SharedSource | undefined;

function sharedSource(source: AsyncIterable<Uint8Array>): SharedSource {
  if (lastShared?.source !== source) lastShared = new SharedSource(source);
  return lastShared;
}

export class FrameReader {
  #buffer: Buffer = Buffer.alloc(0);
  readonly #source: SharedSource;
  #closed = false;

  constructor(source: AsyncIterable<Uint8Array>) {
    this.#source = sharedSource(source);
  }

  /** Ends this reader: a read it left parked hands its bytes to the next reader of the source. */
  close(): void {
    this.#closed = true;
  }

  async *frames(): AsyncGenerator<unknown> {
    for (;;) {
      const next = await this.#source.next(() => !this.#closed);
      if (this.#closed) return;
      if (next.done) break;
      this.#buffer = Buffer.concat([this.#buffer, next.value]);
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
        // REQ-SEC-08.1/.2: fails the pending call closed, attributed structurally by the
        // caller (SEC-02 single-in-flight) — never resynchronized by byte-scanning
        // (SEC-08.2). Yielded as a FrameFault marker, NOT thrown: the malformed body was
        // fully consumed at a boundary the prefix declared, so the stream stays aligned and
        // the connection remains usable for subsequent calls (SEC-08.1).
        yield new FrameFault(new TransportFault("malformed", "inbound frame body failed to parse as JSON"));
        continue;
      }
      yield decoded;
    }
  }
}
