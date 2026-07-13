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

// The one shared measurer of what `instructions` serialize to inside the wire envelope —
// the SAME shape `Session.flush` emits and the fake's `emit` cap check measures
// (ADR-0018/0019). The expander's chunk heuristic and the batch-cap tests both consume
// this so the envelope shape can never drift between them.
export function serializedBatchSize(instructions: readonly Directive[]): number {
  const batch: Batch = { protocolVersion: 1, force: false, instructions: [...instructions] };
  return Buffer.byteLength(JSON.stringify(batch), "utf8");
}
