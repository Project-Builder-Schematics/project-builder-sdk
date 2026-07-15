// ADR-0001 / ADR-0013: SDK↔engine wire contract (adopts engine ADR-0028 directive shapes).
// The SDK emits these shapes over JSON; the engine deserialises them. Types are opaque to
// the template DSL — SDK treats template/pathTemplate as uninterpreted strings.

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

/**
 * The wire-level mutation instruction the SDK emits and the engine applies (ADR-0001,
 * ADR-0013). Opaque to the template DSL — `template`/`pathTemplate` are uninterpreted
 * strings from the SDK's perspective; rendering (if any) is the engine's job.
 *
 * @example
 * const directive: Directive = {
 *   op: "create",
 *   create: {
 *     pathTemplate: "src/greeting.ts",
 *     template: "export const greeting = '{{name}}';",
 *     options: { name: "world" },
 *   },
 * };
 */
export type Directive =
  | { op: "create"; create: { pathTemplate: string; template: string; options: JsonValue; force?: boolean } }
  | { op: "modify"; modify: { path: string; content: string } }
  | { op: "delete"; delete: { path: string } }
  | { op: "rename"; rename: { path: string; newName: string; force?: boolean } }
  | { op: "move"; move: { path: string; toDir: string; force?: boolean } }
  | { op: "copy"; copy: { from: string; to: string; force?: boolean } }
  // ADR-0043: by-reference package-local copy — additive 7th op. `from` is relative to the
  // RESOLUTION anchor (packageDir), never absolute (REQ-BRC-07); no content field — the
  // engine reads and copies the source at apply time, text-only invariant preserved
  // (ADR-0019 amendment).
  | { op: "copyIn"; copyIn: { from: string; to: string; force?: boolean } };

/**
 * The all-or-nothing wire envelope the SDK emits per `emit()` call — a fixed-order set of
 * `Directive`s plus the flags the engine checks before applying anything. Envelope field
 * order is fixed: `protocolVersion`, `force`, `instructions`.
 *
 * @example
 * const batch: Batch = { protocolVersion: 1, force: false, instructions: [] };
 */
export type Batch = { protocolVersion: 1; force: boolean; instructions: Directive[] };

// ADR-0019: 4 MiB cap on Buffer.byteLength(JSON.stringify(batch), 'utf8') — the fake
// (engine stand-in) enforces this at emit, never the SDK (ADR-0018). Provenance: an
// SDK-chosen placeholder, not engine-confirmed; cheap to change until the Stage 6
// semver freeze.
export const BATCH_CAP_BYTES = 4 * 1024 * 1024;

// REQ-WPS-04 / fit-32 (cap-single-source, stdio-engine-client change): the UTF-8 serialized
// byte length of a full Batch envelope — the one measurer both `serializedBatchSize` (below)
// and `exceedsBatchCap`'s outbound leg consume, so the envelope shape can never drift.
export function serializedBatchBytes(batch: Batch): number {
  return Buffer.byteLength(JSON.stringify(batch), "utf8");
}

// The one shared measurer of what `instructions` serialize to inside the wire envelope —
// the SAME shape `Session.flush` emits and the fake's `emit` cap check measures
// (ADR-0018/0019). The expander's chunk heuristic and the batch-cap tests both consume
// this so the envelope shape can never drift between them.
export function serializedBatchSize(instructions: readonly Directive[]): number {
  const batch: Batch = { protocolVersion: 1, force: false, instructions: [...instructions] };
  return serializedBatchBytes(batch);
}

// REQ-WPS-04 / fit-32 (cap-single-source): the ONE `> BATCH_CAP_BYTES` comparison in the
// whole codebase. Two legs share it: the OUTBOUND leg (via `exceedsEmitBatchBudget` below,
// which folds in the frame-envelope allowance before delegating here) and the INBOUND leg
// (a raw declared length prefix read off the wire before the body is even buffered — pass
// the byte count directly, no Batch exists yet to construct). `> BATCH_CAP_BYTES`, never
// `>=` (a size exactly at the cap is WITHIN it, REQ-WPS-04.3).
export function exceedsBatchCap(subject: Batch): boolean;
export function exceedsBatchCap(subject: number): boolean;
export function exceedsBatchCap(subject: Batch | number): boolean {
  const bytes = typeof subject === "number" ? subject : serializedBatchBytes(subject);
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

// The ONE outbound-leg measurer (fit-32 cap-single-source): both `ContractFake.emit` (the
// engine stand-in) and `StdioEngineClient.emit` (the real transport) route through this,
// so the two can never diverge on an accept/reject verdict for the same batch. `>` via
// `exceedsBatchCap`, never a re-derived comparison: exactly-at-budget is WITHIN the budget.
export function exceedsEmitBatchBudget(batch: Batch): boolean {
  return exceedsBatchCap(serializedBatchBytes(batch) + EMIT_FRAME_ENVELOPE_ALLOWANCE_BYTES);
}
