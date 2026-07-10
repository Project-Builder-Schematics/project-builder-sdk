// Schema-sufficiency hard-fail rules (design §4.7, REQ-SCP-02, FIT-13). Operates on the RAW
// wrapped wire shape directly (ADR-0027) — not the narrowed in-memory `Schema` array
// (schema-parse.ts casts `type` to `SchemaKind`, which would make an absent/garbage `type`
// value unrepresentable to this checker without fighting the type system; sufficiency's
// whole job is auditing data that may NOT conform to that narrowed shape).
//
// Safe iteration via Object.keys only (constraint 5) — a hostile `__proto__`-named property
// is itself one of the hard-fail conditions this module exists to catch, so the walk must
// never trigger a prototype getter via bare/for-in access.

// Exported as the single canonical allow-list — `emitPropertyType` (bin/emit-type.ts) reuses
// this same Set as its last-line-of-defence guard against an unrecognized `type`, rather than
// duplicating the recognized-kind vocabulary at the emit boundary.
export const RECOGNIZED_KINDS = new Set(["string", "number", "boolean", "enum"]);
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type SufficiencyReason =
  | "forbidden-key"
  | "missing-type"
  | "nonsensical-type"
  | "enum-missing-choices"
  | "missing-label";

export interface SufficiencyFinding {
  key: string;
  reason: SufficiencyReason;
  detail?: string;
}

function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Hard-fail rules over the raw `schema.json` `"properties"` map (REQ-SCP-02): missing
 * `type`; an unrecognized `type` value; an enum property missing (or empty) `choices`; a
 * missing `label`; or a `__proto__`/`constructor`/`prototype` property key. Does NOT fail
 * for a property missing `default`, `required`, or `description` (advisory only, SCP-02.6).
 *
 * Assumes `raw` is syntactically valid JSON (JSON-validity is schema-parse.ts's/RBV-05's
 * concern, not sufficiency's) — a malformed `raw` throws, same as `JSON.parse` would.
 */
export function checkSufficiency(raw: string): SufficiencyFinding[] {
  const parsed = JSON.parse(raw) as unknown;
  const findings: SufficiencyFinding[] = [];
  if (!isPlainObject(parsed) || !isPlainObject(parsed.properties)) {
    return findings; // shape validity (missing/non-object "properties") is parse's concern
  }

  const propertiesMap = parsed.properties;
  for (const key of Object.keys(propertiesMap)) {
    if (FORBIDDEN_KEYS.has(key)) {
      findings.push({ key, reason: "forbidden-key" });
      continue;
    }

    const value = propertiesMap[key];
    if (!isPlainObject(value)) continue; // non-object property values are parse's concern

    const type = value.type;
    if (type === undefined) {
      findings.push({ key, reason: "missing-type" });
    } else if (typeof type !== "string" || !RECOGNIZED_KINDS.has(type)) {
      findings.push({ key, reason: "nonsensical-type", detail: String(type) });
    } else if (type === "enum" && (!Array.isArray(value.choices) || value.choices.length === 0)) {
      findings.push({ key, reason: "enum-missing-choices" });
    }

    if (typeof value.label !== "string") {
      findings.push({ key, reason: "missing-label" });
    }
  }

  return findings;
}
