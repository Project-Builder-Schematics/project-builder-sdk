/**
 * schema-locate.ts unit coverage (design §4.16, ADR-0032): the hand-rolled JSON position
 * locator that replaces the dead V8-only `at position N` engine-message extraction. Direct-call
 * home for both REQ-TFO-04.4 branches — position-known (structural grammar deviations) and
 * fallback (bounded fidelity: in-string escape violations return `undefined`).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locateFirstJsonSyntaxError } from "../../src/core/schema/schema-locate.ts";

const FIXTURES_ROOT = new URL("../fixtures/red/schema/", import.meta.url).pathname;

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_ROOT, name, "schema.json"), "utf-8");
}

describe("locateFirstJsonSyntaxError — position-known", () => {
  it("pins line 1 for a single-line unquoted-key deviation", () => {
    const raw = '{ port } garbage';

    expect(locateFirstJsonSyntaxError(raw)).toEqual({ line: 1, column: 3 });
  });

  it("pins the exact line and column on a multi-line fixture — falsifies a column-only implementation", () => {
    const raw = readFixture("malformed-syntax");

    // Line 4 is `      "type": BOGUS` — a column-only locator would report column 15 but the
    // wrong line (or no line at all); the newline-aware walk must land on both.
    expect(locateFirstJsonSyntaxError(raw)).toEqual({ line: 4, column: 15 });
  });

  it("pins the EOF offset for a truncated document", () => {
    const raw = '{"properties": {"port": {"type": ';

    expect(locateFirstJsonSyntaxError(raw)).toEqual({ line: 1, column: 34 });
  });

  it("pins offset 1 for an empty document", () => {
    expect(locateFirstJsonSyntaxError("")).toEqual({ line: 1, column: 1 });
  });

  it("pins a trailing comma before an object's closing brace", () => {
    const raw = '{"a":1,}';

    expect(locateFirstJsonSyntaxError(raw)).toEqual({ line: 1, column: 8 });
  });

  it("pins a malformed number token", () => {
    const raw = '{"a": 1.}';

    expect(locateFirstJsonSyntaxError(raw)).toEqual({ line: 1, column: 9 });
  });

  it("consumes a backslash-escaped quote as TWO characters (escape + escaped char) before " +
     "landing on a later structural error — falsifies an escape-skip that consumes only one " +
     "character and mistakes the escaped quote for the string terminator (ADR-0032 fidelity)", () => {
    // Raw content: {"a":"x\"y", @}  — the \" inside the string value must be consumed as a
    // single escaped character, not treated as the string's closing quote.
    const raw = '{"a":"x\\"y", @}';

    expect(locateFirstJsonSyntaxError(raw)).toEqual({ line: 1, column: 14 });
  });
});

describe("locateFirstJsonSyntaxError — fallback (bounded fidelity, ADR-0032)", () => {
  it("returns undefined for a bad \\u escape — strings are consumed structurally, not validated", () => {
    const raw = readFixture("bad-unicode-escape");

    expect(locateFirstJsonSyntaxError(raw)).toBeUndefined();
  });

  it("returns undefined for an invalid escape character", () => {
    const raw = '{"a":"\\q"}';

    expect(locateFirstJsonSyntaxError(raw)).toBeUndefined();
  });
});
