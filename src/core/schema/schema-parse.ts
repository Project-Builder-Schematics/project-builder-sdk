// Bytes -> Schema. Shared by the bin (TFO-04's parse-error template) and the runtime
// (RBV-05.1's fail-closed literal) — both format SchemaParseFailure into their own
// vocabulary; this module never renders a caller-facing message itself (no-echo, ADR-0027).

import type { Schema, SchemaKind, SchemaProperty } from "./schema-model.ts";

export interface SchemaParseFailureInfo {
  problem: string;
  line: number | undefined;
  column: number | undefined;
}

export class SchemaParseFailure extends Error {
  readonly problem: string;
  readonly line: number | undefined;
  readonly column: number | undefined;

  constructor(info: SchemaParseFailureInfo) {
    super(`schema parse failure: ${info.problem}`);
    this.name = "SchemaParseFailure";
    this.problem = info.problem;
    this.line = info.line;
    this.column = info.column;
  }
}

// Gap 8 (ADR-0027): extract the engine's byte offset when present, convert to a 1-based
// (line, column) by walking the raw text — engine-independent once the offset is known.
// No offset in the message -> caller renders the pinned "(position unknown)" fallback.
function locateFromSyntaxError(raw: string, err: SyntaxError): { line: number | undefined; column: number | undefined } {
  const match = /at position (\d+)/.exec(err.message);
  const offsetText = match?.[1];
  if (offsetText === undefined) {
    return { line: undefined, column: undefined };
  }
  const offset = Number(offsetText);
  let line = 1;
  let lastNewlineAt = -1;
  for (let i = 0; i < offset && i < raw.length; i++) {
    if (raw[i] === "\n") {
      line++;
      lastNewlineAt = i;
    }
  }
  return { line, column: offset - lastNewlineAt };
}

function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Parses the on-disk WRAPPED `schema.json` wire shape (ADR-0027: top-level
 * `{ "properties": { "<key>": {...} } }`) into the in-memory `Schema` array model.
 * Fail-closed: invalid JSON or a missing/non-object `"properties"` key both throw
 * `SchemaParseFailure` on the same path — the raw content is never echoed.
 */
export function parseSchema(raw: string): Schema {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const locator = err instanceof SyntaxError
      ? locateFromSyntaxError(raw, err)
      : { line: undefined, column: undefined };
    throw new SchemaParseFailure({ problem: "invalid JSON", ...locator });
  }

  if (!isPlainObject(parsed) || !isPlainObject(parsed.properties)) {
    throw new SchemaParseFailure({
      problem: 'missing "properties" object',
      line: undefined,
      column: undefined,
    });
  }

  const propertiesMap = parsed.properties;
  const properties: SchemaProperty[] = [];
  // Object.keys (never for-in / bare property access) — safe iteration (constraint 5).
  for (const key of Object.keys(propertiesMap)) {
    const value = propertiesMap[key];
    if (!isPlainObject(value)) continue;
    properties.push({
      key,
      type: value.type as SchemaKind,
      label: typeof value.label === "string" ? value.label : undefined,
      choices: Array.isArray(value.choices) ? (value.choices as string[]) : undefined,
      default: value.default,
      required: typeof value.required === "boolean" ? value.required : undefined,
      description: typeof value.description === "string" ? value.description : undefined,
    });
  }

  return { properties };
}
