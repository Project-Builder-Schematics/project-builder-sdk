// Bytes -> Schema. Shared by the bin (TFO-04's parse-error template) and the runtime
// (RBV-05.1's fail-closed literal) — both format SchemaParseFailure into their own
// vocabulary; this module never renders a caller-facing message itself (no-echo, ADR-0027).

import type { ResultKind, ResultSchema, Schema, SchemaKind, SchemaProperty } from "../../valueobjects/schema-model.ts";
import { FORBIDDEN_KEYS, isPlainObject, RESULT_KINDS } from "../../valueobjects/schema-model.ts";
import { locateFirstJsonSyntaxError } from "./schema-locate.ts";

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

// Shared parse-error locator suffix — both the runtime (context.ts's RBV-05.1 literal) and
// the bin (pbuilder-codegen.ts's TW-m6 pinned template) render a `SchemaParseFailure`'s
// line/column into their own message; this is the one place that formats it.
export function formatLocator(line: number | undefined, column: number | undefined): string {
  return line !== undefined && column !== undefined ? `(line ${line}, column ${column})` : "(position unknown)";
}

/**
 * Parses the on-disk WRAPPED `schema.json` wire shape (ADR-0027: top-level
 * `{ "properties": { "<key>": {...} } }`, plus an optional `"result"` declaration, A-14) into
 * the in-memory `Schema` array model.
 * Fail-closed: invalid JSON, a missing/non-object `"properties"` key or an invalid `"result"` throw
 * `SchemaParseFailure` on the same path — the raw content is never echoed.
 */
export function parseSchema(raw: string): Schema {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const locator = err instanceof SyntaxError ? locateFirstJsonSyntaxError(raw) : undefined;
    throw new SchemaParseFailure({
      problem: "invalid JSON",
      line: locator?.line,
      column: locator?.column,
    });
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

  if (!Object.hasOwn(parsed, "result")) return { properties };
  const result = parseResult(parsed.result);
  if (result === undefined) {
    throw new SchemaParseFailure({ problem: 'invalid "result" declaration', line: undefined, column: undefined });
  }
  return { properties, result };
}

// A-14: `type` (one kind or a list of kinds), and for an object `properties` and `required`,
// for an array `items`. Anything else, or a nested declaration that fails, is undefined.
function parseResult(raw: unknown): ResultSchema | undefined {
  if (!isPlainObject(raw)) return undefined;
  const types = Array.isArray(raw.type) ? raw.type : [raw.type];
  if (types.length === 0 || !types.every((type) => typeof type === "string" && RESULT_KINDS.has(type))) return undefined;
  const schema: ResultSchema = { types: types as ResultKind[] };

  if (raw.properties !== undefined) {
    if (!isPlainObject(raw.properties)) return undefined;
    const properties: NonNullable<ResultSchema["properties"]> = [];
    for (const key of Object.keys(raw.properties)) {
      const property = FORBIDDEN_KEYS.has(key) ? undefined : parseResult(raw.properties[key]);
      if (property === undefined) return undefined;
      properties.push({ key, schema: property });
    }
    schema.properties = properties;
  }
  if (raw.required !== undefined) {
    const declared = new Set(schema.properties?.map((property) => property.key));
    if (!Array.isArray(raw.required) || !raw.required.every((key) => typeof key === "string" && declared.has(key))) return undefined;
    schema.required = raw.required as string[];
  }
  if (raw.items !== undefined) {
    const items = parseResult(raw.items);
    if (items === undefined) return undefined;
    schema.items = items;
  }
  return schema;
}
