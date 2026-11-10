// REQ-TOE-01/02/03/05: composite (array/plain-object) option values reach the wire as native
// JSON (ADR-0082), string/scalar/null passthrough, and prototype-safe assembly.

import { describe, it, expect } from "bun:test";
import { encodeOptions } from "../../src/core/directive-factory.ts";
import type { JsonValue } from "../../src/core/wire.ts";

describe("REQ-TOE-01 — encodeOptions forwards composite values as native JSON", () => {
  it("Scenario REQ-TOE-01.1: a native array value stays a native array", () => {
    const options = { methods: [{ name: "load" }, { name: "save" }] };
    expect(encodeOptions(options)).toEqual({
      methods: [{ name: "load" }, { name: "save" }],
    });
  });

  it("Scenario REQ-TOE-01.2: a native plain object value stays a native object", () => {
    const options = { user: { name: "a" } };
    expect(encodeOptions(options)).toEqual({ user: { name: "a" } });
  });

  it("Scenario REQ-TOE-01.3: nested composites stay native at every depth", () => {
    const options = { methods: [{ tags: ["x", "y"] }] };
    expect(encodeOptions(options)).toEqual({ methods: [{ tags: ["x", "y"] }] });
  });

  it("Scenario REQ-TOE-01.9: composites are copied when scheduled — mutating the author's value afterwards leaves the result unchanged", () => {
    const methods = [{ name: "load" }];
    const result = encodeOptions({ methods });
    methods.push({ name: "save" });
    methods[0]!.name = "changed";
    expect(result).toEqual({ methods: [{ name: "load" }] });
  });

  it("[characterization] Scenario REQ-TOE-01.4: mixed composite/scalar values — order, encode, and passthrough all pinned together", () => {
    const options = { b: [1, 2], a: "x", c: 5 };
    const result = encodeOptions(options) as Record<string, JsonValue>;
    expect(Object.keys(result)).toEqual(["b", "a", "c"]);
    expect(result).toEqual({ b: [1, 2], a: "x", c: 5 });
  });

  it("Scenario REQ-TOE-01.5: a null-prototype object carrying composite data is forwarded as a plain object (dict-like container)", () => {
    const registry = Object.create(null) as Record<string, JsonValue>;
    registry.a = 1;
    registry.b = 2;
    const result = encodeOptions({ registry }) as { registry: object };
    expect(result).toEqual({ registry: { a: 1, b: 2 } });
    expect(Object.getPrototypeOf(result.registry)).toBe(Object.prototype);
  });

  it("Scenario REQ-TOE-01.6: empty composite values stay empty composites, not skipped", () => {
    const options = { tags: [] as JsonValue[], cfg: {} };
    expect(encodeOptions(options)).toEqual({ tags: [], cfg: {} });
  });

  it("[characterization] Scenario REQ-TOE-01.7: empty options object is a no-op", () => {
    expect(encodeOptions({})).toEqual({});
  });
});

describe("REQ-TOE-02 — string option values are never re-encoded", () => {
  it("[characterization] Scenario REQ-TOE-02.1: pre-stringified composite string passes through byte-identical", () => {
    const options = { methods: '[{"name":"load"}]' };
    expect(encodeOptions(options)).toEqual(options);
  });

  it("[characterization] Scenario REQ-TOE-02.2: an ordinary string beginning `[`/`{` passes through unmodified", () => {
    const options = { note: "[not actually an array]" };
    expect(encodeOptions(options)).toEqual(options);
  });
});

describe("REQ-TOE-03 — scalar and null option values pass through verbatim", () => {
  it("[characterization] Scenario REQ-TOE-03.1: number and boolean values pass through unmodified", () => {
    const options = { count: 3, active: true };
    expect(encodeOptions(options)).toEqual({ count: 3, active: true });
  });

  it('[characterization] Scenario REQ-TOE-03.2: null passes through as null, never the string "null"', () => {
    const result = encodeOptions({ note: null }) as { note: unknown };
    expect(result.note).toBeNull();
  });

  // REQ-TOE-03.3: non-finite numbers (NaN/Infinity) are `typeof "number"` and deliberately
  // pass the plain-JSON predicate, at any depth. Rejecting them at scheduling time would make
  // Stage-2 REQ-14.3's flush-time `unrepresentable-content` guard unreachable for create
  // options; that guard rejects them instead (test/fake/encode-recorded-batch.test.ts).
  it("[characterization] Scenario REQ-TOE-03.3: a top-level non-finite number (NaN) passes the predicate and coerces to wire null (REQ-TOE-03 carve-out)", () => {
    const result = encodeOptions({ n: NaN }) as { n: unknown };
    expect(result.n).toBeNaN();
  });

  it("Scenario REQ-TOE-03.3: a non-finite number (Infinity) nested inside a composite value is kept as a number, never coerced to null", () => {
    const result = encodeOptions({ nums: [Infinity] }) as { nums: number[] };
    expect(result.nums).toEqual([Infinity]);
  });
});

describe("REQ-TOE-04 — loud rejection of non-plain-JSON option values", () => {
  const ALLOWED_SET_SUFFIX = "Options must be strings, numbers, booleans, null, arrays, or plain objects.";

  it("Scenario REQ-TOE-04.1: top-level undefined option value rejects loud, naming the key", () => {
    const options = { userMethods: undefined } as unknown as Record<string, JsonValue>;
    expect(() => encodeOptions(options)).toThrow(
      `option "userMethods" is not a plain-JSON value the engine can render (undefined at userMethods). ${ALLOWED_SET_SUFFIX}`
    );
  });

  it("Scenario REQ-TOE-04.2: nested undefined inside a composite value rejects loud, never silently dropped", () => {
    const options = { methods: [{ name: "load", tag: undefined }] } as unknown as Record<string, JsonValue>;
    expect(() => encodeOptions(options)).toThrow(
      `option "methods" is not a plain-JSON value the engine can render (undefined at methods[0].tag). ${ALLOWED_SET_SUFFIX}`
    );
  });

  it("Scenario REQ-TOE-04.3: function/symbol/BigInt values reject loud, never coerced or a raw serializer TypeError", () => {
    expect(() => encodeOptions({ handler: (() => {}) as unknown as JsonValue })).toThrow(
      `option "handler" is not a plain-JSON value the engine can render (function at handler). ${ALLOWED_SET_SUFFIX}`
    );
    expect(() => encodeOptions({ tag: Symbol("s") as unknown as JsonValue })).toThrow(
      `option "tag" is not a plain-JSON value the engine can render (symbol at tag). ${ALLOWED_SET_SUFFIX}`
    );

    let bigIntError: unknown;
    try {
      encodeOptions({ big: 10n as unknown as JsonValue });
    } catch (err) {
      bigIntError = err;
    }
    expect((bigIntError as Error).message).toEqual(
      `option "big" is not a plain-JSON value the engine can render (BigInt at big). ${ALLOWED_SET_SUFFIX}`
    );
    expect((bigIntError as Error).message).not.toContain("Do not know how to serialize a BigInt");
  });

  it("Scenario REQ-TOE-04.4: circular reference rejects loud, not a raw TypeError", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    let circularError: unknown;
    try {
      encodeOptions({ self: circular as unknown as JsonValue });
    } catch (err) {
      circularError = err;
    }
    expect((circularError as Error).message).toEqual(
      `option "self" is not a plain-JSON value the engine can render (a circular reference at self.self). ${ALLOWED_SET_SUFFIX}`
    );
    expect((circularError as Error).message).not.toContain("Converting circular structure to JSON");
  });

  it("Scenario REQ-TOE-04.5: Date value rejects as non-plain-JSON, never silently coerced to its ISO string", () => {
    expect(() => encodeOptions({ when: new Date() as unknown as JsonValue })).toThrow(
      `option "when" is not a plain-JSON value the engine can render (Date at when). ${ALLOWED_SET_SUFFIX}`
    );
  });

  it("Scenario REQ-TOE-04.6: Map value rejects loud, never silently accepted as an empty object", () => {
    const methodRegistry = new Map([["a", 1]]);
    expect(() => encodeOptions({ methodRegistry: methodRegistry as unknown as JsonValue })).toThrow(
      `option "methodRegistry" is not a plain-JSON value the engine can render (Map at methodRegistry). ${ALLOWED_SET_SUFFIX}`
    );
  });

  it("Scenario REQ-TOE-04.7: class instance value rejects loud, never accepted as its own-property JSON", () => {
    class UserProfile {
      x = 1;
    }
    expect(() => encodeOptions({ userProfile: new UserProfile() as unknown as JsonValue })).toThrow(
      `option "userProfile" is not a plain-JSON value the engine can render (a class instance at userProfile). ${ALLOWED_SET_SUFFIX}`
    );
  });

  it("Scenario REQ-TOE-04.8: nested function/symbol inside a composite value rejects loud, never silently dropped", () => {
    expect(() =>
      encodeOptions({ methods: [{ name: "load", handler: () => {} }] } as unknown as Record<string, JsonValue>)
    ).toThrow(
      `option "methods" is not a plain-JSON value the engine can render (function at methods[0].handler). ${ALLOWED_SET_SUFFIX}`
    );
    expect(() => encodeOptions({ userTags: [Symbol("x")] } as unknown as Record<string, JsonValue>)).toThrow(
      `option "userTags" is not a plain-JSON value the engine can render (symbol at userTags[0]). ${ALLOWED_SET_SUFFIX}`
    );
  });
});

describe("REQ-TOE-01 (shared-ref DAG, ARCH-F2) — an acyclic shared reference encodes, never a circular false-positive", () => {
  it("the SAME object reference used at two sibling keys encodes both, not rejected as circular", () => {
    const s = { x: 1 };
    const options = { a: s, b: s };
    expect(encodeOptions(options)).toEqual({ a: { x: 1 }, b: { x: 1 } });
  });

  // QA-F1: the top-level-sibling test above gives EACH key a fresh `ancestors` Set
  // (encodeOptions calls assertEncodable(value, key) per Object.entries iteration), so it
  // never exercises delete-on-ascent — commenting out `ancestors.delete(value)` still passes
  // it. A shared reference at NESTED sibling positions shares the SAME ancestors Set across
  // both occurrences within one top-level call, so it only encodes correctly if the first
  // occurrence's descent is cleaned up (deleted) before the second occurrence is checked.
  it("the SAME object reference used at NESTED sibling positions (array) encodes both, not rejected as circular", () => {
    const s = { x: 1 };
    const options = { cfg: [s, s] };
    expect(encodeOptions(options)).toEqual({ cfg: [{ x: 1 }, { x: 1 }] });
  });

  it("the SAME object reference used at NESTED sibling positions (object) encodes both, not rejected as circular", () => {
    const s = { x: 1 };
    const options = { cfg: { p: s, q: s } };
    expect(encodeOptions(options)).toEqual({ cfg: { p: { x: 1 }, q: { x: 1 } } });
  });
});

describe("REQ-TOE-05 — prototype-safe encoding", () => {
  it('[characterization] Scenario REQ-TOE-05.1: an option keyed "__proto__" encodes as a normal own key', () => {
    const options: Record<string, JsonValue> = {};
    Object.defineProperty(options, "__proto__", {
      value: [1, 2],
      enumerable: true,
      writable: true,
      configurable: true,
    });

    const result = encodeOptions(options) as Record<string, JsonValue>;

    expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(result, "__proto__")?.value).toEqual([1, 2]);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });
});
