// REQ-WPS-01: single owner of frame encode/decode — 4-byte big-endian length prefix +
// UTF-8 JSON body, symmetric in both directions (host<->runner). fit-31 (single-owner-of-
// framing) guards that no other module re-implements this codec.

import { Console } from "node:console";
import { exceedsBatchCap } from "../core/wire.ts";

export const LENGTH_PREFIX_BYTES = 4;

// REQ-WPS-04.1 (owner ruling R2): the outbound cap is enforced on the ENCODED FRAME BODY, so
// the emitting client must serialize the frame value BEFORE the writer does. To keep that a
// single serialization (a Batch can be 4 MiB), the client attaches its already-encoded body
// to the frame value under this module-private symbol; `encodeFrame` below reuses those
// exact bytes. Non-enumerable + symbol-keyed: invisible to JSON, to structural inspection,
// and to every existing FrameChannel double.
const PRESERIALIZED_BODY = Symbol("pbuilder.preserializedFrameBody");

export function withPreserializedBody<T extends object>(value: T, body: Buffer): T {
  Object.defineProperty(value, PRESERIALIZED_BODY, { value: body });
  return value;
}

function preserializedBody(value: unknown): Buffer | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const body = (value as Record<symbol, unknown>)[PRESERIALIZED_BODY];
  return Buffer.isBuffer(body) ? body : undefined;
}

// The body half of the codec (fit-31 single-owner-of-framing: serialization lives HERE, the
// emitting client calls this instead of re-implementing it). UTF-8 SERIALIZED byte length —
// never the JS string's UTF-16 .length — so multi-byte payloads (WPS-01.3) round-trip exactly.
export function encodeFrameBody(value: unknown): Buffer {
  return preserializedBody(value) ?? Buffer.from(JSON.stringify(value), "utf8");
}

export function encodeFrame(value: unknown): Buffer {
  const body = encodeFrameBody(value);
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
// Judgment-day F10: the real fd-1 write handle, cached at module scope by the FIRST capture.
// A second capture (a second sequential enterBridge run in one engine process) must reuse it
// — re-capturing would bind the first capture's own stderr-redirecting stub as "fd 1" and
// silently send the whole second run's frames to stderr.
let realFd1Write: ((chunk: string | Uint8Array) => boolean) | undefined;

export function captureFd1FrameWriter(): (value: unknown) => void {
  if (realFd1Write === undefined) {
    realFd1Write = process.stdout.write.bind(process.stdout);
    const stub = {
      write: (chunk: unknown): boolean => {
        process.stderr.write(typeof chunk === "string" || Buffer.isBuffer(chunk) ? chunk : String(chunk));
        return true;
      },
    } as unknown as typeof process.stdout;
    Object.defineProperty(process, "stdout", { value: stub, writable: true, configurable: true });
  }
  const write = realFd1Write;
  return (value) => {
    write(encodeFrame(value));
  };
}

/**
 * REQ-BRB-03/RUN-08/REQ-SEC-09.1: redirects the ENTIRE console surface to stderr — belt-and-
 * suspenders alongside the engine's own dup (A2), and the SAME guarantee on both entry
 * paths (the direct-spawn bin and the in-process bridge both call this). A single owner,
 * mirrored by `captureFd1FrameWriter`'s single ownership of the fd-1 side.
 *
 * Judgment-day F2: a per-method override of log/info/warn/error/debug is NOT enough — in
 * Bun, `console.table/dir/group/count/trace` (and friends) write NATIVELY to fd 1, bypassing
 * both such overrides and the `process.stdout` stub (verified empirically). Replacing the
 * global console with a `node:console` Console bound to stderr on BOTH streams reroutes
 * every method at once, with no per-method list to drift as the console API grows.
 */
export function redirectConsoleToStderr(): void {
  const stderrConsole = new Console({ stdout: process.stderr, stderr: process.stderr });
  Object.defineProperty(globalThis, "console", { value: stderrConsole, writable: true, configurable: true });
}
