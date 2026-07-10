/**
 * schema-validate.ts unit coverage — resolved input -> findings (design §4.2/§4.3).
 * S-000 scope only: the missing-required-key finding (RBV-01.1 site proof). The full
 * wrong-type/excess/non-JSON/reserved/proto/null-trichotomy/template-opaque matrix is
 * S-003's triangulation (constraint "RBV-01 spans S-000 + S-003" — slices Coverage Check).
 */
import { describe, it, expect } from "bun:test";
import { validateInput } from "../../src/core/schema/schema-validate.ts";
import type { Schema } from "../../src/core/schema/schema-model.ts";

const PORT_SCHEMA: Schema = {
  properties: [{ key: "port", type: "number", required: true }],
};

describe("validateInput", () => {
  it("returns a 'missing' finding naming the field and its declared type when a required key is absent", () => {
    const findings = validateInput(PORT_SCHEMA, {});

    expect(findings).toEqual([{ kind: "missing", field: "port", expectedType: "number" }]);
  });

  it("returns no findings when every required key is present", () => {
    const findings = validateInput(PORT_SCHEMA, { port: 8080 });

    expect(findings).toEqual([]);
  });

  it("does not flag a property explicitly marked required: false when absent", () => {
    const schema: Schema = {
      properties: [{ key: "label", type: "string", required: false }],
    };

    expect(validateInput(schema, {})).toEqual([]);
  });
});
