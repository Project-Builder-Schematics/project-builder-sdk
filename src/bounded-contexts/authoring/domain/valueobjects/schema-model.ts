// In-memory schema representation (design §4.3). Kept an ARRAY (never a Record) so
// FIT-07's no-path-keyed-collection guard stays clean over src/core/**.
//
// This is a DISTINCT shape from the on-disk wire contract (ADR-0027): the wire form is a
// wrapped `{ "properties": { "<key>": {...} } }` map (the SDK<->Go-CLI cross-repo contract);
// schema-parse.ts lifts that map into this array, `key` becoming an explicit field.

export type SchemaKind = "string" | "number" | "boolean" | "enum";

export interface SchemaProperty {
  key: string;
  type: SchemaKind;
  label?: string;
  choices?: string[];
  default?: unknown;
  required?: boolean;
  description?: string;
}

export interface Schema {
  properties: SchemaProperty[];
}

// Cross-repo lifecycle tokens (2026-07-06 engine handoff) — schematic-level, kebab-case,
// case-insensitive matching lives in the reserved-name scan (S-004, ADR-0028).
export const RESERVED_LIFECYCLE_NAMES = ["pre-execute", "post-execute"] as const;

// Proto-pollution guard (ADR-0029 safe iteration): shared by schema-validate.ts's
// input-key scan and schema-sufficiency.ts's declared-property-key scan.
export const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
