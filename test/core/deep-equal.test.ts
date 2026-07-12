/**
 * S-000 — src/core/deep-equal.ts (kit-internal, no barrel/subpath). Structural equality —
 * `Object.is`-based, not `===` — proven standalone before S-005 wires it into
 * src/conformance/index.ts and src/testing/contract-fake.ts as their shared implementation.
 */
import { describe, it, expect } from "bun:test";
import { deepEqual } from "../../src/core/deep-equal.ts";

describe("deep-equal — structural equality", () => {
  it("primitives equal via Object.is", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true); // Object.is(NaN, NaN) === true, unlike ===
  });

  it("primitives that differ are not equal", () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("a", "b")).toBe(false);
    expect(deepEqual(0, -0)).toBe(false); // Object.is(0, -0) === false
  });

  it("arrays are equal element-wise, order-sensitive", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false);
  });

  it("arrays of different length are not equal", () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("an array is never equal to a non-array object", () => {
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });

  it("plain objects are equal key-by-key, order-insensitive", () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("objects with a mismatched value are not equal", () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("objects with different key sets are not equal", () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("nested structures are compared recursively", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  it("a key present with an undefined value differs from the key being absent", () => {
    expect(deepEqual({ a: undefined }, {})).toBe(false);
  });
});
