import { describe, it, expect } from "bun:test";
import { edited, expectRejected, expectUnchanged } from "./run-json.ts";

const value = (text: string) => JSON.parse(text) as unknown;

describe("REQ-JSD-02 — key mutations", () => {
  it("REQ-JSD-02.1: setValue creates intermediate objects", async () => {
    expect(await edited('{\n  "name": "app"\n}\n', (h) => h.setValue(["scripts", "build"], "tsc"))).toBe(
      '{\n  "name": "app",\n  "scripts": {\n    "build": "tsc"\n  }\n}\n'
    );
  });

  it("setValue replaces an existing value and setValue([]) replaces the document", async () => {
    expect(await edited('{\n  "a": 1\n}\n', (h) => h.setValue(["a"], { b: true }))).toBe('{\n  "a": {\n    "b": true\n  }\n}\n');
    expect(value(await edited('{\n  "a": 1\n}\n', (h) => h.setValue([], [1, 2])))).toEqual([1, 2]);
  });

  it("setValue of a deep-equal value leaves the bytes unchanged", async () => {
    await expectUnchanged('{ "a": { "b": [1, 2] } }', (h) => h.setValue(["a"], { b: [1, 2] }));
  });

  it("setValue replaces an array item and rejects an out-of-range index", async () => {
    expect(await edited('{ "x": [1, 2] }', (h) => h.setValue(["x", 1], 9))).toBe('{ "x": [1, 9] }');
    await expectRejected('{ "x": [1, 2] }', (h) => h.setValue(["x", 2], 9), '["x",2]', "out of range");
  });

  it("REQ-JSD-02.2: addKey is idempotent and rejects a conflict", async () => {
    await expectUnchanged('{ "a": 1 }', (h) => h.addKey(["a"], 1));
    await expectRejected('{ "a": 1 }', (h) => h.addKey(["a"], 2), 'addKey(["a"])');
  });

  it("addKey adds an absent key and rejects a missing parent", async () => {
    expect(await edited('{ "a": 1 }', (h) => h.addKey(["b"], 2))).toBe('{ "a": 1, "b": 2 }');
    await expectRejected('{ "a": 1 }', (h) => h.addKey(["x", "y"], 2), '["x","y"]', "parent object does not exist");
  });

  it("removeKey removes the member and its comma; an absent key is a no-op", async () => {
    expect(await edited('{\n  "a": 1,\n  "b": 2\n}\n', (h) => h.removeKey(["b"]))).toBe('{\n  "a": 1\n}\n');
    await expectUnchanged('{ "a": 1 }', (h) => h.removeKey(["zzz"]));
    await expectUnchanged('{ "a": 1 }', (h) => h.removeKey(["x", "y"]));
  });

  it("REQ-JSD-02.3: renameKey keeps position and value", async () => {
    expect(await edited('{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}\n', (h) => h.renameKey(["b"], "beta"))).toBe(
      '{\n  "a": 1,\n  "beta": 2,\n  "c": 3\n}\n'
    );
  });

  it("renameKey keeps comments, is a no-op when already renamed, and rejects both/neither", async () => {
    expect(await edited('{\n  // keep\n  "b": 2\n}\n', (h) => h.renameKey(["b"], "c"))).toBe('{\n  // keep\n  "c": 2\n}\n');
    await expectUnchanged('{ "beta": 2 }', (h) => h.renameKey(["b"], "beta"));
    await expectRejected('{ "b": 1, "beta": 2 }', (h) => h.renameKey(["b"], "beta"), '["b"]', "both");
    await expectRejected('{ "a": 1 }', (h) => h.renameKey(["b"], "beta"), '["b"]', "neither");
  });
});

describe("REQ-JSD-03 — array mutations", () => {
  it("insertItem inserts before index; index === length appends; out of range rejects", async () => {
    expect(value(await edited('{ "x": [1, 3] }', (h) => h.insertItem(["x"], 1, 2)))).toEqual({ x: [1, 2, 3] });
    expect(value(await edited('{ "x": [1] }', (h) => h.insertItem(["x"], 1, 2)))).toEqual({ x: [1, 2] });
    await expectRejected('{ "x": [1] }', (h) => h.insertItem(["x"], 2, 2), '["x"]', "out of range");
    await expectRejected('{ "x": [1] }', (h) => h.insertItem(["x"], -1, 2), "out of range");
  });

  it("REQ-JSD-03.1: appendItem unique skips a duplicate", async () => {
    await expectUnchanged('{ "plugins": ["a"] }', (h) => h.appendItem(["plugins"], "a", { unique: true }));
    expect(value(await edited('{ "plugins": ["a"] }', (h) => h.appendItem(["plugins"], "b", { unique: true })))).toEqual({
      plugins: ["a", "b"],
    });
  });

  it("appendItem appends to a multi-line array and creates an absent array", async () => {
    expect(await edited('{\n  "x": [\n    1\n  ]\n}\n', (h) => h.appendItem(["x"], 2))).toBe('{\n  "x": [\n    1,\n    2\n  ]\n}\n');
    expect(await edited("{}", (h) => h.appendItem(["a", "list"], 1))).toBe('{"a": {"list":[1]}}');
  });

  it("removeItem removes the item and its separator; out of range rejects", async () => {
    expect(await edited('{\n  "x": [\n    1,\n    2\n  ]\n}\n', (h) => h.removeItem(["x"], 0))).toBe('{\n  "x": [\n    2\n  ]\n}\n');
    await expectRejected('{ "x": [] }', (h) => h.removeItem(["x"], 0), "out of range");
  });

  it("removeValue removes every deep-equal item; no match is a no-op", async () => {
    expect(value(await edited('{ "x": [{"a":1}, 2, {"a":1}] }', (h) => h.removeValue(["x"], { a: 1 })))).toEqual({ x: [2] });
    await expectUnchanged('{ "x": [1] }', (h) => h.removeValue(["x"], 9));
  });

  it("replaceItem replaces in place; out of range rejects", async () => {
    expect(await edited('{ "x": [1, 2, 3] }', (h) => h.replaceItem(["x"], 1, "two"))).toBe('{ "x": [1, "two", 3] }');
    await expectRejected('{ "x": [1] }', (h) => h.replaceItem(["x"], 1, 0), "out of range");
  });

  it("REQ-JSD-03.2: moveItem reorders", async () => {
    expect(value(await edited('{ "x": [1, 2, 3] }', (h) => h.moveItem(["x"], 0, 2)))).toEqual({ x: [2, 3, 1] });
    expect(value(await edited('{ "x": [1, 2, 3] }', (h) => h.moveItem(["x"], 2, 0)))).toEqual({ x: [3, 1, 2] });
    await expectRejected('{ "x": [1] }', (h) => h.moveItem(["x"], 0, 1), "out of range");
  });

  it("every array op rejects a non-array value at the path", async () => {
    const seed = '{ "x": { "a": 1 } }';
    await expectRejected(seed, (h) => h.insertItem(["x"], 0, 1), "not an array");
    await expectRejected(seed, (h) => h.appendItem(["x"], 1), "not an array");
    await expectRejected(seed, (h) => h.removeItem(["x"], 0), "not an array");
    await expectRejected(seed, (h) => h.removeValue(["x"], 1), "not an array");
    await expectRejected(seed, (h) => h.replaceItem(["x"], 0, 1), "not an array");
    await expectRejected(seed, (h) => h.moveItem(["x"], 0, 0), "not an array");
  });
});

describe("REQ-JSD-04 — deep merge", () => {
  it("REQ-JSD-04.1: merge recurses into objects and replaces arrays", async () => {
    const out = await edited('{ "a": { "x": 1, "y": [1] }, "b": true }', (h) => h.merge([], { a: { y: [2], z: 3 } }));
    expect(value(out)).toEqual({ a: { x: 1, y: [2], z: 3 }, b: true });
  });

  it("merge leaves untouched members' bytes alone and is idempotent", async () => {
    const seed = '{\n  "keep":   [1,2],\n  "a": {\n    "x": 1\n  }\n}\n';
    const out = await edited(seed, (h) => h.merge([], { a: { z: 3 } }));
    expect(out).toBe('{\n  "keep":   [1,2],\n  "a": {\n    "x": 1,\n    "z": 3\n  }\n}\n');
    await expectUnchanged(out, (h) => h.merge([], { a: { z: 3 } }));
  });

  it("merge creates an absent target and rejects non-object target or value", async () => {
    expect(await edited("{}", (h) => h.merge(["a"], { b: 1 }))).toBe('{"a": {"b":1}}');
    await expectRejected('{ "a": [] }', (h) => h.merge(["a"], { b: 1 }), '["a"]', "not an object");
    await expectRejected("{}", (h) => h.merge([], [1] as never), "plain object");
  });
});

describe("REQ-JSD-05 — type-safe value updates", () => {
  it("REQ-JSD-05.1: updateValue bumps a number", async () => {
    const out = await edited('{ "version": 1 }', (h) => h.updateValue(["version"], (v) => (typeof v === "number" ? v + 1 : 1)));
    expect(value(out)).toEqual({ version: 2 });
  });

  it("updateValue receives undefined when absent and validates the return value", async () => {
    let seen: unknown = "unset";
    expect(
      value(
        await edited("{}", (h) =>
          h.updateValue(["n"], (v) => {
            seen = v;
            return 1;
          })
        )
      )
    ).toEqual({ n: 1 });
    expect(seen).toBeUndefined();
    await expectRejected("{}", (h) => h.updateValue(["n"], () => undefined as never), "JSON cannot represent");
  });

  it("REQ-JSD-05.2: a non-JSON value rejects without mutation", async () => {
    await expectRejected("{}", (h) => h.setValue(["when"], new Date() as never), "Date");
  });

  it("rejects undefined, functions, bigint, non-finite numbers, Map, and cycles, naming the path inside the value", async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const cases: [unknown, string][] = [
      [{ a: undefined }, '["a"]'],
      [[() => 1], "[0]"],
      [{ n: 10n }, '["n"]'],
      [{ n: Number.NaN }, '["n"]'],
      [{ m: new Map() }, '["m"]'],
      [cyclic, '["self"]'],
    ];
    for (const [bad, where] of cases) {
      await expectRejected("{}", (h) => h.setValue(["v"], bad as never), `value at ${where}`);
    }
  });
});

describe("REQ-JSD-06 — path resolution errors", () => {
  it("rejects a segment crossing a scalar, a number on an object, and a string on an array", async () => {
    await expectRejected('{ "a": 1 }', (h) => h.setValue(["a", "b"], 1), '["a","b"]', "crosses a number");
    await expectRejected('{ "a": {} }', (h) => h.setValue(["a", 0], 1), "indexes an object with a number");
    await expectRejected('{ "a": [] }', (h) => h.setValue(["a", "b"], 1), "names a key on an array");
  });

  it("creating ops never create an array parent", async () => {
    await expectRejected("{}", (h) => h.setValue(["a", 0], 1), "only objects are created");
  });

  it("rejects a malformed path", async () => {
    await expectRejected("{}", (h) => h.setValue(["a", 1.5] as never, 1), "path must be an array");
  });
});

describe("REQ-JSD-09 — relocation, copy, key position, key order", () => {
  it("REQ-JSD-09.1: moveValue relocates across parents", async () => {
    const out = await edited('{ "a": { "x": 1 }, "b": {} }', (h) => h.moveValue(["a", "x"], ["b", "x"]));
    expect(value(out)).toEqual({ a: {}, b: { x: 1 } });
  });

  it("moveValue replaces an existing destination, inserts at a number index, and removes an item from an array", async () => {
    expect(value(await edited('{ "a": 1, "b": 2 }', (h) => h.moveValue(["a"], ["b"])))).toEqual({ b: 1 });
    expect(value(await edited('{ "a": 9, "x": [1, 2] }', (h) => h.moveValue(["a"], ["x", 1])))).toEqual({ x: [1, 9, 2] });
    expect(value(await edited('{ "x": [1, 2], "y": [] }', (h) => h.moveValue(["x", 0], ["y", 0])))).toEqual({ x: [2], y: [1] });
  });

  it("moveValue is a no-op when already moved and rejects both absent or a destination inside the source", async () => {
    await expectUnchanged('{ "b": 1 }', (h) => h.moveValue(["a"], ["b"]));
    await expectRejected("{}", (h) => h.moveValue(["a"], ["b"]), '["a"]', "neither");
    await expectRejected('{ "a": {} }', (h) => h.moveValue(["a"], ["a", "b"]), "inside the source");
  });

  it("moveValue rejects a bad destination without mutating", async () => {
    await expectRejected('{ "a": 1, "x": [] }', (h) => h.moveValue(["a"], ["x", 5]), "out of range");
  });

  it("copyValue copies with setValue's rules; deep-equal is a no-op; an absent source rejects", async () => {
    expect(value(await edited('{ "a": { "x": [1] } }', (h) => h.copyValue(["a"], ["b", "c"])))).toEqual({
      a: { x: [1] },
      b: { c: { x: [1] } },
    });
    await expectUnchanged('{ "a": 1, "b": 1 }', (h) => h.copyValue(["a"], ["b"]));
    await expectRejected("{}", (h) => h.copyValue(["a"], ["b"]), '["a"]', "does not exist");
  });

  it("REQ-JSD-09.2: addKey after a sibling", async () => {
    expect(
      await edited('{\n  "name": "app",\n  "version": "1.0.0"\n}\n', (h) => h.addKey(["private"], true, { after: "name" }))
    ).toBe('{\n  "name": "app",\n  "private": true,\n  "version": "1.0.0"\n}\n');
  });

  it("setValue before a sibling; no effect when the key exists; rejects an absent sibling or both options", async () => {
    expect(await edited('{\n  "a": 1,\n  "c": 3\n}\n', (h) => h.setValue(["b"], 2, { before: "c" }))).toBe(
      '{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}\n'
    );
    expect(await edited('{ "a": 1, "b": 2 }', (h) => h.setValue(["b"], 5, { before: "a" }))).toBe('{ "a": 1, "b": 5 }');
    await expectRejected('{ "a": 1 }', (h) => h.addKey(["b"], 2, { after: "zzz" }), '"zzz" does not exist');
    await expectRejected('{ "a": 1 }', (h) => h.setValue(["b"], 2, { before: "a", after: "a" }), "not both");
  });

  it("REQ-JSD-09.3: sortKeys orders members", async () => {
    const out = await edited('{ "b": 1, "a": 2 }', (h) => h.sortKeys([]));
    expect(out).toBe('{ "a": 2, "b": 1 }');
    expect(Object.keys(value(out) as object)).toEqual(["a", "b"]);
  });

  it("sortKeys carries comments with members, sorts recursively, and is a no-op when sorted", async () => {
    const seed = '{\n  // about b\n  "b": { "z": 1, "y": 2 },\n  "a": 2\n}\n';
    expect(await edited(seed, (h) => h.sortKeys([]))).toBe('{\n  "a": 2,\n  // about b\n  "b": { "z": 1, "y": 2 }\n}\n');
    expect(await edited(seed, (h) => h.sortKeys([], { recursive: true }))).toBe(
      '{\n  "a": 2,\n  // about b\n  "b": { "y": 2, "z": 1 }\n}\n'
    );
    await expectUnchanged('{ "a": 1, "b": [{ "d": 1, "c": 2 }] }', (h) => h.sortKeys([]));
    expect(await edited('{ "b": [{ "d": 1, "c": 2 }] }', (h) => h.sortKeys([], { recursive: true }))).toBe(
      '{ "b": [{ "c": 2, "d": 1 }] }'
    );
    await expectRejected('{ "a": [] }', (h) => h.sortKeys(["a"]), "not an object");
  });

  it("sortKeys uses code-point order", async () => {
    expect(Object.keys(value(await edited('{ "b": 1, "B": 2, "\u{1F600}": 3, "￿": 4 }', (h) => h.sortKeys([]))) as object)).toEqual([
      "B",
      "b",
      "￿",
      "\u{1F600}",
    ]);
  });
});

describe("coalescing", () => {
  it("a chain of ops on one handle emits exactly one modify", async () => {
    const out = await edited('{\n  "name": "app"\n}\n', (h) =>
      h.setValue(["version"], "1.0.0").appendItem(["files"], "dist").renameKey(["name"], "title")
    );
    expect(value(out)).toEqual({ title: "app", version: "1.0.0", files: ["dist"] });
  });
});
