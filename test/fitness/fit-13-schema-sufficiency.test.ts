/**
 * FIT-13: schema-sufficiency hard-fail gate (REQ-SCP-02). A direct-call matrix, not a
 * fixture tree-walk (design §4.6a) — each scenario is a raw `schema.json` string literal
 * fed straight to `checkSufficiency`.
 */
import { describe, it, expect } from "bun:test";
import { checkSufficiency } from "../../src/core/schema/schema-sufficiency.ts";

function schemaJson(properties: unknown): string {
  return JSON.stringify({ properties });
}

describe("FIT-13 — schema-sufficiency hard-fail matrix", () => {
  it("REQ-SCP-02.1: missing type fails, naming the property", () => {
    const findings = checkSufficiency(schemaJson({ port: { label: "Server port" } }));

    expect(findings).toContainEqual({ key: "port", reason: "missing-type" });
  });

  it("REQ-SCP-02.2: missing label/title fails, naming the property", () => {
    const findings = checkSufficiency(schemaJson({ port: { type: "number" } }));

    expect(findings).toContainEqual({ key: "port", reason: "missing-label" });
  });

  it("REQ-SCP-02.3: enum missing choices fails, naming the property", () => {
    const findings = checkSufficiency(schemaJson({ mode: { type: "enum", label: "Mode" } }));

    expect(findings).toContainEqual({ key: "mode", reason: "enum-missing-choices" });
  });

  it("REQ-SCP-02.3b: enum with an EMPTY choices array also fails (zero choices is not sufficient)", () => {
    const findings = checkSufficiency(schemaJson({ mode: { type: "enum", label: "Mode", choices: [] } }));

    expect(findings).toContainEqual({ key: "mode", reason: "enum-missing-choices" });
  });

  it("REQ-SCP-02.4: unrecognized/nonsensical type value fails, naming the property and the value", () => {
    const findings = checkSufficiency(schemaJson({ port: { type: "flarb", label: "Server port" } }));

    expect(findings).toContainEqual({ key: "port", reason: "nonsensical-type", detail: "flarb" });
  });

  it("REQ-SCP-02.5: a __proto__ property key fails, naming the offending key", () => {
    const raw = '{"properties":{"__proto__":{"type":"string","label":"x"}}}';

    const findings = checkSufficiency(raw);

    expect(findings).toContainEqual({ key: "__proto__", reason: "forbidden-key" });
  });

  it("REQ-SCP-02.5: a constructor property key fails, naming the offending key", () => {
    const findings = checkSufficiency(schemaJson({ constructor: { type: "string", label: "x" } }));

    expect(findings).toContainEqual({ key: "constructor", reason: "forbidden-key" });
  });

  it("REQ-SCP-02.5: a prototype property key fails, naming the offending key", () => {
    const findings = checkSufficiency(schemaJson({ prototype: { type: "string", label: "x" } }));

    expect(findings).toContainEqual({ key: "prototype", reason: "forbidden-key" });
  });

  it("REQ-SCP-02.6: advisory-only fields (missing default/required/description) PASS", () => {
    const findings = checkSufficiency(
      schemaJson({ port: { type: "number", label: "Server port" } })
    );

    expect(findings).toEqual([]);
  });

  it("a fully sufficient multi-property schema PASSES with no findings", () => {
    const findings = checkSufficiency(
      schemaJson({
        port: { type: "number", label: "Server port", required: true, default: 8080 },
        mode: { type: "enum", label: "Mode", choices: ["dev", "prod"] },
      })
    );

    expect(findings).toEqual([]);
  });

  it("safe iteration: a __proto__-declaring schema does not corrupt iteration of sibling properties", () => {
    const raw = '{"properties":{"__proto__":{"type":"string","label":"x"},"port":{"type":"number","label":"Server port"}}}';

    const findings = checkSufficiency(raw);

    expect(findings).toContainEqual({ key: "__proto__", reason: "forbidden-key" });
    expect(findings.filter((f) => f.key === "port")).toEqual([]);
  });
});
