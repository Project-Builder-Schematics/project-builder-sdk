// REQ-WPS-01: single owner of frame encode/decode — 4-byte big-endian length prefix +
// UTF-8 JSON body, symmetric in both directions (host<->runner). fit-31 (single-owner-of-
// framing) guards that no other module re-implements this codec.

const LENGTH_PREFIX_BYTES = 4;

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
