// Resolved input -> findings (design §4.2/§4.3, ADR-0029 safe iteration). Iterates the
// schema's OWN declared properties (never `for...in`/bare access on the resolved input),
// so a hostile `__proto__`-shaped input can never influence which keys get inspected.
//
// S-000 scope: the "missing" finding only (RBV-01.1 site proof). S-003 triangulates the
// remaining branches (wrong-type/excess/non-JSON/reserved/proto/null-trichotomy/
// template-opaque) into this same module — see slices Coverage Check.

import type { Schema } from "./schema-model.ts";

export interface ValidationFinding {
  kind: "missing";
  field: string;
  expectedType: string;
}

export function validateInput(schema: Schema, input: unknown): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const record = (input !== null && typeof input === "object" ? input : {}) as { [key: string]: unknown };

  for (const property of schema.properties) {
    const isRequired = property.required !== false;
    if (!isRequired) continue;
    if (Object.hasOwn(record, property.key)) continue;
    findings.push({ kind: "missing", field: property.key, expectedType: property.type });
  }

  return findings;
}
