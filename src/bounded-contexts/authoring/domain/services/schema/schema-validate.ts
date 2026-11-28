// Resolved input -> findings (design §4.2/§4.3, ADR-0029 safe iteration). Two independent
// walks, both safe against a hostile `__proto__`-shaped input: (1) the schema's OWN
// declared properties drive missing/wrong-type checks (never `for...in`/bare access on the
// input); (2) Object.keys(input) drives excess/reserved/proto-key detection — Object.keys
// returns only OWN enumerable string keys, so it can never be redirected by a prototype
// getter, and this module never WRITES through a computed key (the actual pollution
// vector — `acc[key] = v` on a plain-object accumulator), only reads and reports names.
//
// S-000 built the "missing" finding (RBV-01.1 site proof). S-003 (this module) triangulates
// the remaining branches — see slices Coverage Check.

import type { ResultKind, ResultSchema, Schema, SchemaProperty } from "../../valueobjects/schema-model.ts";
import { FORBIDDEN_KEYS, RESERVED_LIFECYCLE_NAMES } from "../../valueobjects/schema-model.ts";

const RESERVED_INPUT_KEYS = new Set<string>(RESERVED_LIFECYCLE_NAMES);

export type ValidationFinding =
  | { kind: "missing"; field: string; expectedType: string }
  | { kind: "wrong-type"; field: string; expectedType: string }
  | { kind: "disallowed-key"; field: string };

// {expectedType} rendering (design §4.4, branch table): always the DECLARED expectation,
// never the received value's kind — an enum renders its choice list, everything else
// renders its SchemaKind verbatim.
function expectedTypeFor(property: SchemaProperty): string {
  if (property.type === "enum") {
    return `one of: ${(property.choices ?? []).join(", ")}`;
  }
  return property.type;
}

function matchesType(property: SchemaProperty, value: unknown): boolean {
  switch (property.type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "enum":
      return typeof value === "string" && (property.choices ?? []).includes(value);
  }
}

/** `imposed` names the inputs a role adds, which `schema.json` never declares (A-122). */
export function validateInput(schema: Schema, input: unknown, imposed: readonly string[] = []): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const record = (input !== null && typeof input === "object" ? input : {}) as { [key: string]: unknown };

  for (const property of schema.properties) {
    const isRequired = property.required !== false;
    // A present-but-undefined value is treated as absent (REQ-RBV-01.7's "undefined" leg
    // of the trichotomy is equivalent to "no key at all" — there is no JSON representation
    // of an explicit `undefined`).
    const present = Object.hasOwn(record, property.key) && record[property.key] !== undefined;

    if (!present) {
      if (isRequired) {
        findings.push({ kind: "missing", field: property.key, expectedType: expectedTypeFor(property) });
      }
      continue;
    }

    if (!matchesType(property, record[property.key])) {
      findings.push({ kind: "wrong-type", field: property.key, expectedType: expectedTypeFor(property) });
    }
  }

  // REQ-RBV-01.3/.5/.6: any input key that is not a declared property, OR is itself a
  // reserved lifecycle name, OR is __proto__/constructor/prototype — regardless of whether
  // it happens to also be declared — is a single "disallowed-key" class (branch→template
  // mapping, slices load-bearing literals).
  const declaredKeys = new Set(schema.properties.map((property) => property.key));
  for (const key of Object.keys(record)) {
    if (RESERVED_INPUT_KEYS.has(key) || FORBIDDEN_KEYS.has(key) || !(declaredKeys.has(key) || imposed.includes(key))) {
      findings.push({ kind: "disallowed-key", field: key });
    }
  }

  return findings;
}

// A-14 / E-40: the Result a factory returned, checked at its boundary before the final flush.
// Problems name where in the Result they are (`Result.items[0]`), never the value (no-echo).
type JsonObject = { [key: string]: unknown };

/** E-40: the largest JSON encoding of a Result, in UTF-8 bytes; exactly at it is allowed. */
export const RESULT_CEILING_BYTES = 1048576;

export type ResultCheck = { readonly result: unknown } | { readonly problem: string };

/**
 * Checks `value` as the Result of a factory whose declaration is `declared`. Without a
 * declaration only `undefined`, no Result, passes. A Result that passes comes back as a copy
 * parsed from its JSON encoding, so what is committed is exactly what was checked. The
 * declaration is a parameter so a Result shape a role imposes can be checked the same way as
 * one read from `schema.json`.
 */
export function checkResult(declared: ResultSchema | undefined, value: unknown): ResultCheck {
  if (declared === undefined) {
    return value === undefined ? { result: undefined } : { problem: "the factory declares no Result in schema.json but returned a value" };
  }
  let encoded: string;
  try {
    const problem = jsonProblem(value, "Result", new Set());
    if (problem !== undefined) return { problem };
    encoded = JSON.stringify(value);
  } catch (err) {
    // A getter or proxy that throws, or nesting too deep to walk; what it threw is not echoed.
    return { problem: err instanceof RangeError ? "the Result is nested too deeply" : "the Result could not be read" };
  }
  const result: unknown = JSON.parse(encoded);
  const problem = shapeProblem(declared, result, "Result");
  if (problem !== undefined) return { problem };
  const bytes = Buffer.byteLength(encoded, "utf8");
  return bytes > RESULT_CEILING_BYTES
    ? { problem: `the JSON encoding of the Result is ${bytes} bytes, past the 1 MiB ceiling (${RESULT_CEILING_BYTES} bytes)` }
    : { result };
}

// JSON.stringify drops or rewrites what is not JSON (undefined, functions, NaN, a Date's
// toJSON) instead of failing, so the walk refuses each of them explicitly.
function jsonProblem(value: unknown, where: string, ancestors: Set<object>): string | undefined {
  switch (typeof value) {
    case "string":
    case "boolean":
      return undefined;
    case "number":
      // NaN and ±Infinity are the numbers for which this is not 0 (the runner closure admits no Number.isFinite).
      return value - value === 0 ? undefined : `${where} is a non-finite number`;
    case "undefined":
    case "function":
    case "bigint":
    case "symbol":
      return `${where} is ${typeof value === "undefined" ? "undefined" : `a ${typeof value}`}`;
  }
  if (value === null) return undefined;
  const object = value as object;
  if (ancestors.has(object)) return `${where} is a cycle`;
  if (!Array.isArray(object)) {
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) {
      return `${where} is ${object instanceof Date ? "a Date" : object instanceof Map ? "a Map" : "a class instance"}`;
    }
    if (typeof (object as { toJSON?: unknown }).toJSON === "function") return `${where} has a toJSON method`;
  }
  // Ancestors only, so a value shared twice without a cycle is accepted, as JSON.stringify does.
  ancestors.add(object);
  try {
    const entries: Array<[string, unknown]> = [];
    if (Array.isArray(object)) {
      for (let index = 0; index < object.length; index++) entries.push([`${where}[${index}]`, object[index]]);
    } else {
      for (const key of Object.keys(object)) entries.push([`${where}.${key}`, (object as JsonObject)[key]]);
    }
    for (const [at, item] of entries) {
      const problem = jsonProblem(item, at, ancestors);
      if (problem !== undefined) return problem;
    }
    return undefined;
  } finally {
    ancestors.delete(object);
  }
}

function kindOf(value: unknown): ResultKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as ResultKind;
}

// Runs on the parsed copy, so every value here is JSON.
function shapeProblem(declared: ResultSchema, value: unknown, where: string): string | undefined {
  const kind = kindOf(value);
  if (!declared.types.includes(kind)) return `${where} must be ${declared.types.join(" or ")}`;
  if (kind === "string" && declared.choices !== undefined && !declared.choices.includes(value as string)) {
    return `${where} must be one of: ${declared.choices.join(", ")}`;
  }
  if (kind === "array" && declared.items !== undefined) {
    const items = declared.items;
    for (const [index, item] of (value as unknown[]).entries()) {
      const problem = shapeProblem(items, item, `${where}[${index}]`);
      if (problem !== undefined) return problem;
    }
  }
  if (kind === "object" && declared.properties !== undefined) {
    const record = value as JsonObject;
    const required = new Set(declared.required);
    for (const { key, schema } of declared.properties) {
      if (!Object.hasOwn(record, key)) {
        if (required.has(key)) return `${where}.${key} must be ${schema.types.join(" or ")}`;
        continue;
      }
      const problem = shapeProblem(schema, record[key], `${where}.${key}`);
      if (problem !== undefined) return problem;
    }
    const declaredKeys = new Set(declared.properties.map((property) => property.key));
    const extra = Object.keys(record).find((key) => !declaredKeys.has(key));
    if (extra !== undefined) return `${where}.${extra} is not declared`;
  }
  return undefined;
}
