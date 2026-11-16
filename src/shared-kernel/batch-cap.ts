// The engine's byte cap on one IR batch and the frame budget derived from it, shared by the
// runner bootstrap and Authoring's engine client. Kept free of any context's types: the cap
// is compared on byte counts only.

// ADR-0019: 4 MiB cap on Buffer.byteLength(JSON.stringify(batch), 'utf8') — the fake
// (engine stand-in) enforces this at emit, never the SDK (ADR-0018). Provenance: an
// SDK-chosen placeholder, not engine-confirmed; cheap to change until the Stage 6
// semver freeze.
export const BATCH_CAP_BYTES = 4 * 1024 * 1024;

// REQ-WPS-04 / fit-32 (cap-single-source): the ONE `> BATCH_CAP_BYTES` comparison in the
// whole codebase. Both legs measure bytes: the OUTBOUND leg (a serialized Batch plus the
// frame-envelope allowance, measured in `wire.ts`) and the INBOUND leg (a raw declared length
// prefix read off the wire before the body is even buffered). `> BATCH_CAP_BYTES`, never `>=`
// (a size exactly at the cap is WITHIN it, REQ-WPS-04.3).
export function exceedsBatchCap(bytes: number): boolean {
  return bytes > BATCH_CAP_BYTES;
}

// REQ-WPS-04.1 (spec V4, judgment-day R2): the outbound cap is enforced on the ENCODED
// ir.emit FRAME BODY — `{type,id,method,params:{batch}}` — but the enforcement must be
// DETERMINISTIC (independent of the request id's length, which varies with the call
// ordinal) and IDENTICAL between `StdioEngineClient` and `ContractFake` (FEH-01 parity).
// So the budget reserves a FIXED allowance: the envelope's serialized overhead with the
// LONGEST id the client can ever mint. Request ids are `s${n}` with `n` a monotonically
// incremented non-negative integer, so `s${Number.MAX_SAFE_INTEGER}` (17 chars) bounds the
// id and the allowance bounds every real envelope's overhead — an accepted batch's actual
// encoded frame body can NEVER exceed BATCH_CAP_BYTES. Derived by measuring the envelope
// shape itself (the `0` placeholder stands where the batch JSON goes; its own 1 serialized
// byte is subtracted back out) — never a hand-waved literal; the derivation is asserted
// against the client's real written bytes in test.
export const EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES =
  Buffer.byteLength(
    JSON.stringify({ type: "request", id: `s${Number.MAX_SAFE_INTEGER}`, method: "ir.emit", params: { batch: 0 } }),
    "utf8"
  ) - Buffer.byteLength(JSON.stringify(0), "utf8");

// The author-visible outbound batch budget: the largest serialized Batch that is
// GUARANTEED to fit an ir.emit frame body within BATCH_CAP_BYTES for any request id.
export const EMIT_BATCH_BUDGET_BYTES = BATCH_CAP_BYTES - EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES;
