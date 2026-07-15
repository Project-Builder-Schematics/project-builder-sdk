// REQ-WPS-01: single owner of frame encode/decode — 4-byte big-endian length prefix +
// UTF-8 JSON body, symmetric in both directions (host<->runner). fit-31 (single-owner-of-
// framing) guards that no other module re-implements this codec.

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

/**
 * The ONE sanctioned stdout reference in `src/transport/**` (fit-30 stdout-protocol-sacred):
 * captures the process's fd-1 write handle AT CALL TIME — call it before any factory import
 * — so later author-code reassignment of `process.stdout` cannot hijack the wire (the
 * BRB-02/RUN-08 defence, e2e-proven in S-003). Everything else writes frames only through
 * the function this returns.
 */
export function captureFd1FrameWriter(): (value: unknown) => void {
  const write = process.stdout.write.bind(process.stdout);
  return (value) => {
    write(encodeFrame(value));
  };
}
