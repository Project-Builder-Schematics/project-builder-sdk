/**
 * schema-validate.ts unit coverage — resolved input -> findings (design §4.2/§4.3).
 * S-000 built the missing-required-key finding (RBV-01.1 site proof). S-003 (this file's
 * extension) triangulates the rest of the matrix: wrong-type/excess/non-JSON/reserved/
 * proto/null-trichotomy/template-opaque (constraint "RBV-01 spans S-000 + S-003" — slices
 * Coverage Check). Safe iteration (constraint 5): Object.keys/Object.hasOwn only.
 */
import { describe, it, expect } from "bun:test";
import { validateInput } from "../../src/core/schema/schema-validate.ts";
import type { Schema } from "../../src/core/schema/schema-model.ts";

const PORT_SCHEMA: Schema = {
  properties: [{ key: "port", type: "number", required: true }],
};

const MODE_SCHEMA: Schema = {
  properties: [{ key: "mode", type: "enum", choices: ["dev", "prod"], required: true }],
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

  describe("REQ-RBV-01.2 — wrong-typed value", () => {
    it("a string value against a number-typed property is 'wrong-type', declared type never the received kind", () => {
      const findings = validateInput(PORT_SCHEMA, { port: "8080" });

      expect(findings).toEqual([{ kind: "wrong-type", field: "port", expectedType: "number" }]);
    });

    it("triangulation: a number value against a string-typed property is also 'wrong-type'", () => {
      const schema: Schema = { properties: [{ key: "name", type: "string", required: true }] };

      expect(validateInput(schema, { name: 42 })).toEqual([
        { kind: "wrong-type", field: "name", expectedType: "string" },
      ]);
    });
  });

  describe("REQ-RBV-01.3 — excess key", () => {
    it("an input key outside the declared properties is 'disallowed-key', naming the excess key", () => {
      const findings = validateInput(PORT_SCHEMA, { port: 8080, extra: true });

      expect(findings).toEqual([{ kind: "disallowed-key", field: "extra" }]);
    });
  });

  describe("REQ-RBV-01.4 — non-JSON value", () => {
    it("a function value renders the DECLARED kind, never 'function' (no-echo of the received kind)", () => {
      const findings = validateInput(PORT_SCHEMA, { port: () => 8080 });

      expect(findings).toEqual([{ kind: "wrong-type", field: "port", expectedType: "number" }]);
    });
  });

  describe("REQ-RBV-01.5 — reserved-lifecycle-name key in resolved input", () => {
    it("a key literally named pre-execute is 'disallowed-key', unconditionally (even if satisfied by other properties)", () => {
      const input = JSON.parse('{"port": 8080, "pre-execute": "x"}');

      expect(validateInput(PORT_SCHEMA, input)).toEqual([
        { kind: "disallowed-key", field: "pre-execute" },
      ]);
    });
  });

  describe("REQ-RBV-01.6 — __proto__/constructor/prototype key (SEC-B2)", () => {
    it("a __proto__ own-property key (via JSON.parse) is 'disallowed-key'", () => {
      const input = JSON.parse('{"port": 8080, "__proto__": "malicious"}') as { [key: string]: unknown };
      // Sanity: JSON.parse gives an OWN data property named "__proto__", not a prototype
      // mutation — Object.keys must see it for this scenario to be meaningful at all.
      expect(Object.keys(input)).toContain("__proto__");

      expect(validateInput(PORT_SCHEMA, input)).toEqual([
        { kind: "disallowed-key", field: "__proto__" },
      ]);
    });

    it("a constructor key is 'disallowed-key'", () => {
      const input = { port: 8080, constructor: "x" };

      expect(validateInput(PORT_SCHEMA, input)).toEqual([
        { kind: "disallowed-key", field: "constructor" },
      ]);
    });

    it("a prototype key is 'disallowed-key'", () => {
      const input = { port: 8080, prototype: "x" };

      expect(validateInput(PORT_SCHEMA, input)).toEqual([
        { kind: "disallowed-key", field: "prototype" },
      ]);
    });

    it("safe iteration: inspecting a hostile __proto__ key never pollutes Object.prototype for sibling calls", () => {
      const canaryKey = "rbvSafeIterationCanary";
      (Object.prototype as Record<string, unknown>)[canaryKey] = "seeded";
      try {
        const input = JSON.parse('{"port": 8080, "__proto__": "malicious"}') as { [key: string]: unknown };

        validateInput(PORT_SCHEMA, input);

        expect(({} as Record<string, unknown>)[canaryKey]).toEqual("seeded");
      } finally {
        delete (Object.prototype as Record<string, unknown>)[canaryKey];
      }
    });
  });

  describe("REQ-RBV-01.7 — null / undefined / empty-string trichotomy for a required key", () => {
    it("(i) absent key is 'missing'", () => {
      expect(validateInput(PORT_SCHEMA, {})).toEqual([
        { kind: "missing", field: "port", expectedType: "number" },
      ]);
    });

    it("(ii) a present null value is 'wrong-type', never treated as equivalent to missing", () => {
      expect(validateInput(PORT_SCHEMA, { port: null })).toEqual([
        { kind: "wrong-type", field: "port", expectedType: "number" },
      ]);
    });

    it("(iii) a present empty string PASSES for a required string-typed property", () => {
      const schema: Schema = { properties: [{ key: "name", type: "string", required: true }] };

      expect(validateInput(schema, { name: "" })).toEqual([]);
    });
  });

  describe("REQ-RBV-01.8 — template-syntax values pass through as opaque data", () => {
    it("a '${...}'-shaped string value against a string-typed property PASSES, never evaluated/rejected", () => {
      const schema: Schema = { properties: [{ key: "name", type: "string", required: true }] };

      expect(validateInput(schema, { name: "${env.PORT}" })).toEqual([]);
    });
  });

  describe("enum properties (branch table (d))", () => {
    it("a valid choice PASSES", () => {
      expect(validateInput(MODE_SCHEMA, { mode: "dev" })).toEqual([]);
    });

    it("a value outside the declared choices is 'wrong-type', expectedType = 'one of: <choices>'", () => {
      expect(validateInput(MODE_SCHEMA, { mode: "qa" })).toEqual([
        { kind: "wrong-type", field: "mode", expectedType: "one of: dev, prod" },
      ]);
    });

    it("a missing enum key renders the same 'one of: <choices>' expectedType", () => {
      expect(validateInput(MODE_SCHEMA, {})).toEqual([
        { kind: "missing", field: "mode", expectedType: "one of: dev, prod" },
      ]);
    });
  });
});
