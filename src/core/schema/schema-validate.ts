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

import type { Schema, SchemaProperty } from "./schema-model.ts";
import { FORBIDDEN_KEYS, RESERVED_LIFECYCLE_NAMES } from "./schema-model.ts";

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

export function validateInput(schema: Schema, input: unknown): ValidationFinding[] {
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
    if (RESERVED_INPUT_KEYS.has(key) || FORBIDDEN_KEYS.has(key) || !declaredKeys.has(key)) {
      findings.push({ kind: "disallowed-key", field: key });
    }
  }

  return findings;
}
