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

export type Directive =
  | { op: "create"; create: { pathTemplate: string; template: string; options: JsonValue; force?: boolean } }
  | { op: "modify"; modify: { path: string; content: string } }
  | { op: "delete"; delete: { path: string } }
  | { op: "rename"; rename: { path: string; newName: string; force?: boolean } }
  | { op: "move"; move: { path: string; toDir: string; force?: boolean } }
  | { op: "copy"; copy: { from: string; to: string; force?: boolean } };

// Envelope order is fixed: protocolVersion, force, instructions.
export type Batch = { protocolVersion: 1; force: boolean; instructions: Directive[] };
