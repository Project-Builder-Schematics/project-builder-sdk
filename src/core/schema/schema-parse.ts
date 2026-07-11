// Bytes -> Schema. Shared by the bin (TFO-04's parse-error template) and the runtime
// (RBV-05.1's fail-closed literal) — both format SchemaParseFailure into their own
// vocabulary; this module never renders a caller-facing message itself (no-echo, ADR-0027).

import type { Schema, SchemaKind, SchemaProperty } from "./schema-model.ts";
import { isPlainObject } from "./schema-model.ts";
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
 * `{ "properties": { "<key>": {...} } }`) into the in-memory `Schema` array model.
 * Fail-closed: invalid JSON or a missing/non-object `"properties"` key both throw
 * `SchemaParseFailure` on the same path — the raw content is never echoed.
 */
export function parseSchema(raw: string): Schema {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    // The locator re-scans already-rejected text and is itself recursive (ADR-0032) — a
    // pathologically deep document (e.g. thousands of nested `[`) can overflow the call
    // stack. That RangeError is not a grammar finding; degrade to the same "no offset"
    // fallback as a bounded-fidelity locator result rather than let it escape raw.
    let locator: { line: number; column: number } | undefined;
    if (err instanceof SyntaxError) {
      try {
        locator = locateFirstJsonSyntaxError(raw);
      } catch {
        locator = undefined;
      }
    }
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

  return { properties };
}
