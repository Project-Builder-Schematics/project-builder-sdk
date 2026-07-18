// REQ-TOE-01: shallow top-level encode of composite (array/plain-object) option values.
// S-000 walking skeleton — minimal encode only; no rejection/validation yet (S-002).

import { describe, it, expect } from "bun:test";
import { encodeOptions } from "../../src/core/directive-factory.ts";

describe("REQ-TOE-01 — encodeOptions, shallow top-level composite encode", () => {
  it("Scenario REQ-TOE-01.1: native array value encodes to a JSON string", () => {
    const options = { methods: [{ name: "load" }, { name: "save" }] };
    expect(encodeOptions(options)).toEqual({
      methods: '[{"name":"load"},{"name":"save"}]',
    });
  });

  it("Scenario REQ-TOE-01.2: native plain object value encodes to a JSON string", () => {
    const options = { user: { name: "a" } };
    expect(encodeOptions(options)).toEqual({ user: '{"name":"a"}' });
  });
});
