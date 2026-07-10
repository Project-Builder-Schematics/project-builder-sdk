/**
 * schema-parse.ts unit coverage — Bytes → Schema (design §4.2/§4.3, ADR-0027 wrapped shape).
 * Malformed/invalid-shape locator behaviour is shared by the bin (TFO-04) and the runtime
 * (RBV-05.1) — pinned here once since this module is the single parser both consume.
 */
import { describe, it, expect } from "bun:test";
import { parseSchema, SchemaParseFailure } from "../../src/core/schema/schema-parse.ts";

describe("parseSchema", () => {
  it("lifts a wrapped schema.json properties map into a Schema properties array", () => {
    const raw = JSON.stringify({
      properties: {
        port: { type: "number", label: "Server port", required: true },
      },
    });

    const schema = parseSchema(raw);

    expect(schema).toEqual({
      properties: [
        { key: "port", type: "number", label: "Server port", required: true },
      ],
    });
  });

  it("throws SchemaParseFailure with problem 'invalid JSON' and a line/column locator for malformed JSON", () => {
    const raw = "{\n  \"properties\": {\n    \"port\": INVALID\n  }\n}";

    let caught: unknown;
    try {
      parseSchema(raw);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SchemaParseFailure);
    const failure = caught as SchemaParseFailure;
    expect(failure.problem).toEqual("invalid JSON");
    // ADR-0032: the hand-rolled locator pins the "INVALID" bareword deviation on line 3.
    expect(failure.line).toEqual(3);
    expect(failure.column).toEqual(13);
  });

  it("throws SchemaParseFailure with problem 'missing \"properties\" object' when properties is absent", () => {
    const raw = JSON.stringify({ notProperties: {} });

    let caught: unknown;
    try {
      parseSchema(raw);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SchemaParseFailure);
    expect((caught as SchemaParseFailure).problem).toEqual('missing "properties" object');
  });

  it("throws the same 'missing properties object' problem when properties is not an object", () => {
    const raw = JSON.stringify({ properties: "nope" });

    let caught: unknown;
    try {
      parseSchema(raw);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SchemaParseFailure);
    expect((caught as SchemaParseFailure).problem).toEqual('missing "properties" object');
  });

  it("never echoes the raw invalid content in the failure (no-echo discipline)", () => {
    const raw = "{ \"properties\": { \"port\": BOGUS_TOKEN_CANARY } }";

    let caught: unknown;
    try {
      parseSchema(raw);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SchemaParseFailure);
    const failure = caught as SchemaParseFailure;
    expect(failure.message).not.toContain("BOGUS_TOKEN_CANARY");
    expect(failure.problem).not.toContain("BOGUS_TOKEN_CANARY");
  });
});
