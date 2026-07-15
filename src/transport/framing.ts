// REQ-WPS-01: single owner of frame encode/decode — 4-byte big-endian length prefix +
// UTF-8 JSON body, symmetric in both directions (host<->runner). fit-31 (single-owner-of-
// framing) guards that no other module re-implements this codec.

import { exceedsBatchCap } from "../core/wire.ts";

export const LENGTH_PREFIX_BYTES = 4;

// The prefix is the UTF-8 SERIALIZED byte length of the JSON body — never the JS string's
// UTF-16 .length — so multi-byte payloads (WPS-01.3) round-trip exactly.
export function encodeFrame(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  const frame = Buffer.alloc(LENGTH_PREFIX_BYTES + body.length);
  frame.writeUInt32BE(body.length, 0);
  body.copy(frame, LENGTH_PREFIX_BYTES);
  return frame;
}

export function decodeFrameBody(body: Uint8Array): unknown {
  return JSON.parse(Buffer.from(body).toString("utf8"));
}

// REQ-WPS-04: reject-before-alloc on the INBOUND leg — checks the raw declared length
// prefix BEFORE the reader waits for/allocates a buffer for that many body bytes. A thin,
// semantically-named wrapper: the sole `>` comparison lives in wire.ts's `exceedsBatchCap`
// (fit-32 cap-single-source), never re-derived here.
export function isOversizeDeclaredLength(bodyLength: number): boolean {
  return exceedsBatchCap(bodyLength);
}

/**
 * The ONE sanctioned stdout reference in `src/transport/**` (fit-30 stdout-protocol-sacred):
 * captures the process's fd-1 write handle AT CALL TIME — call it before any factory import
 * — so later author-code reassignment of `process.stdout` cannot hijack the wire (the
 * BRB-02/RUN-08 defence, e2e-proven in S-003).
 *
 * REQ-SEC-09: capturing a reference alone is not enough — an author calling that stream's
 * own `.write(...)` DIRECTLY (no reassignment) would still reach the real fd, since it's
 * the SAME underlying object. So immediately after capturing the real write function,
 * `process.stdout` itself is replaced with a stub whose `.write` redirects to
 * stderr. Only the writer closure returned below (closed over the reference captured BEFORE
 * the replacement) still reaches the real fd; any later author access to `process.stdout` —
 * a direct `.write()` call, or a full reassignment/monkey-patch (BRB-02.1) — lands on the
 * stub, never the wire.
 */
export function captureFd1FrameWriter(): (value: unknown) => void {
  const write = process.stdout.write.bind(process.stdout);
  const stub = {
    write: (chunk: unknown): boolean => {
      process.stderr.write(typeof chunk === "string" || Buffer.isBuffer(chunk) ? chunk : String(chunk));
      return true;
    },
  } as unknown as typeof process.stdout;
  Object.defineProperty(process, "stdout", { value: stub, writable: true, configurable: true });
  return (value) => {
    write(encodeFrame(value));
  };
}

/**
 * REQ-BRB-03/RUN-08: redirects `console.log/info/warn/error/debug` to stderr — belt-and-
 * suspenders alongside the engine's own dup (A2), and the SAME guarantee on both entry
 * paths (the direct-spawn bin and the in-process bridge both call this). A single owner,
 * mirrored by `captureFd1FrameWriter`'s single ownership of the fd-1 side.
 */
export function redirectConsoleToStderr(): void {
  const write: typeof console.log = (...args) => {
    process.stderr.write(`${args.map((a) => (typeof a === "string" ? a : String(a))).join(" ")}\n`);
  };
  console.log = write;
  console.info = write;
  console.warn = write;
  console.error = write;
  console.debug = write;
}
