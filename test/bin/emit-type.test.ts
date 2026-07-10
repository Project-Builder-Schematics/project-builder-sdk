/**
 * bin/emit-type.ts unit coverage — Schema + digest -> `export type Input` text
 * (design §4.3/§4.4, ADR-0027 Gap-4 emission table). Written correctly from the start
 * (constraint 2) — S-001 adds the adversarial hostile-schema CLI-level red-proof against
 * this already-correct implementation.
 */
import { describe, it, expect } from "bun:test";
import { emitInputType, GENERATED_HEADER } from "../../bin/emit-type.ts";
import type { Schema } from "../../src/core/schema/schema-model.ts";

describe("emitInputType", () => {
  it("emits the AUTO-GENERATED header and an embedded schema-digest line", () => {
    const schema: Schema = { properties: [{ key: "port", type: "number", required: true }] };

    const output = emitInputType(schema, "deadbeef");

    expect(output).toContain(GENERATED_HEADER);
    expect(output).toContain("// @schema-digest sha256:deadbeef");
  });

  it("emits a required property as a non-optional typed member (ADR-0027 emission table)", () => {
    const schema: Schema = { properties: [{ key: "port", type: "number", required: true }] };

    const output = emitInputType(schema, "digest");

    expect(output).toContain("port: number;");
  });

  it("emits required:false as an optional member (key?: T)", () => {
    const schema: Schema = { properties: [{ key: "label", type: "string", required: false }] };

    const output = emitInputType(schema, "digest");

    expect(output).toContain("label?: string;");
  });

  it("emits an enum property as a union of its choices, each via JSON.stringify (SEC-1)", () => {
    const schema: Schema = {
      properties: [{ key: "mode", type: "enum", choices: ["dev", "prod"], required: true }],
    };

    const output = emitInputType(schema, "digest");

    expect(output).toContain('mode: "dev" | "prod";');
  });

  it("emits a labeled property with a leading JSDoc doc comment", () => {
    const schema: Schema = {
      properties: [{ key: "port", type: "number", label: "Server port", required: true }],
    };

    const output = emitInputType(schema, "digest");

    expect(output).toContain("/** Server port */");
  });

  it("quotes a property key that is not a valid identifier", () => {
    const schema: Schema = {
      properties: [{ key: "not-an-identifier", type: "string", required: true }],
    };

    const output = emitInputType(schema, "digest");

    expect(output).toContain('"not-an-identifier": string;');
  });

  it("guards the */ comment-breakout sequence in a hostile label (SEC-1 inertness)", () => {
    const schema: Schema = {
      properties: [{ key: "port", type: "number", label: "*/ import(\"evil\") /*", required: true }],
    };

    const output = emitInputType(schema, "digest");

    expect(output).not.toContain('*/ import("evil")');
  });
});
