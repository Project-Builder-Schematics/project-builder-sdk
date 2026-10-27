import { describe, it } from "bun:test";
import { expectFile, expectReject } from "./harness.ts";

describe("REQ-YMD-02 — key mutations", () => {
  it("Scenario REQ-YMD-02.1: setValue keeps neighbour comments", async () => {
    await expectFile(
      "# app\nname: app # the name\nport: 80\n",
      (h) => h.setValue(["port"], 8080),
      "# app\nname: app # the name\nport: 8080\n"
    );
  });

  it("setValue creates intermediate mappings, replaces the root, and is a no-op for an equal value", async () => {
    await expectFile("name: app\n", (h) => h.setValue(["scripts", "build"], "tsc"), "name: app\nscripts:\n  build: tsc\n");
    await expectFile("a: 1\n", (h) => h.setValue([], { b: [1] }), "b:\n  - 1\n");
    await expectFile("a:   1 # same\n", (h) => h.setValue(["a"], 1), "a:   1 # same\n");
  });

  it("setValue keeps the comment and anchor of the replaced node", async () => {
    await expectFile("a: &x old # note\nb: *x\n", (h) => h.setValue(["a"], 2), "a: &x 2 # note\nb: *x\n");
  });

  it("setValue writes a sequence item in range and rejects out of range", async () => {
    await expectFile("x:\n  - 1\n  - 2\n", (h) => h.setValue(["x", 1], 3), "x:\n  - 1\n  - 3\n");
    await expectReject("x:\n  - 1\n", (h) => h.setValue(["x", 5], 3), '["x",5]');
  });

  it("Scenario REQ-YMD-02.2: renameKey keeps the comment", async () => {
    await expectFile("a: 1\n# about b\nb: 2\n", (h) => h.renameKey(["b"], "beta"), "a: 1\n# about b\nbeta: 2\n");
  });

  it("renameKey is a no-op when already renamed and rejects when both or neither exist", async () => {
    await expectFile("beta: 2\n", (h) => h.renameKey(["b"], "beta"), "beta: 2\n");
    await expectReject("b: 1\nbeta: 2\n", (h) => h.renameKey(["b"], "beta"), '["b"]');
    await expectReject("a: 1\n", (h) => h.renameKey(["b"], "beta"), '["b"]');
  });

  it("addKey adds, is idempotent, and rejects a conflict naming the path", async () => {
    await expectFile("a: 1\n", (h) => h.addKey(["b"], 2), "a: 1\nb: 2\n");
    await expectFile("a: 1\n", (h) => h.addKey(["a"], 1), "a: 1\n");
    await expectReject("a: 1\n", (h) => h.addKey(["a"], 2), '["a"]');
  });

  it("addKey does not create missing parents", async () => {
    await expectReject("a: 1\n", (h) => h.addKey(["x", "y"], 2), '["x","y"]');
  });

  it("removeKey removes the key and is a no-op when absent", async () => {
    await expectFile("a: 1\n# about b\nb: 2\nc: 3\n", (h) => h.removeKey(["b"]), "a: 1\nc: 3\n");
    await expectFile("a: 1\n", (h) => h.removeKey(["zzz"]), "a: 1\n");
  });
});

describe("REQ-YMD-02 — sequence mutations", () => {
  it("insertItem inserts before index, appends at length, rejects out of range", async () => {
    await expectFile("x:\n  - a\n  - c\n", (h) => h.insertItem(["x"], 1, "b"), "x:\n  - a\n  - b\n  - c\n");
    await expectFile("x: [a]\n", (h) => h.insertItem(["x"], 1, "b"), "x: [a, b]\n");
    await expectReject("x: [a]\n", (h) => h.insertItem(["x"], 2, "b"), "index 2");
    await expectReject("x: [a]\n", (h) => h.insertItem(["x"], -1, "b"), "index -1");
  });

  it("appendItem appends, creates the sequence, and { unique: true } skips a duplicate", async () => {
    await expectFile("plugins:\n  - a\n", (h) => h.appendItem(["plugins"], "a", { unique: true }), "plugins:\n  - a\n");
    await expectFile("plugins:\n  - a\n", (h) => h.appendItem(["plugins"], "b", { unique: true }), "plugins:\n  - a\n  - b\n");
    await expectFile("a: 1\n", (h) => h.appendItem(["list"], { k: 1 }), "a: 1\nlist:\n  - k: 1\n");
  });

  it("removeItem removes and rejects out of range", async () => {
    await expectFile("x:\n  - a\n  - b\n", (h) => h.removeItem(["x"], 0), "x:\n  - b\n");
    await expectReject("x:\n  - a\n", (h) => h.removeItem(["x"], 1), "index 1");
  });

  it("removeValue removes every deep-equal item; no match is a no-op", async () => {
    await expectFile("x:\n  - a\n  - b\n  - a\n", (h) => h.removeValue(["x"], "a"), "x:\n  - b\n");
    await expectFile("x:\n  - a\n", (h) => h.removeValue(["x"], "z"), "x:\n  - a\n");
  });

  it("replaceItem replaces in place keeping the item comment, and rejects out of range", async () => {
    await expectFile("x:\n  - a # first\n  - b\n", (h) => h.replaceItem(["x"], 0, "z"), "x:\n  - z # first\n  - b\n");
    await expectReject("x:\n  - a\n", (h) => h.replaceItem(["x"], 3, "z"), "index 3");
  });

  it("moveItem reorders and rejects out of range", async () => {
    await expectFile("x: [1, 2, 3]\n", (h) => h.moveItem(["x"], 0, 2), "x: [2, 3, 1]\n");
    await expectReject("x: [1, 2, 3]\n", (h) => h.moveItem(["x"], 0, 3), "index 3");
  });

  it("every sequence op rejects when the value exists and is not a sequence", async () => {
    await expectReject("x: 1\n", (h) => h.appendItem(["x"], 2), "not a sequence");
    await expectReject("x:\n  a: 1\n", (h) => h.insertItem(["x"], 0, 2), "not a sequence");
  });
});

describe("REQ-YMD-02 — deep merge", () => {
  it("merge recurses into mappings, replaces sequences, and keeps comments of untouched keys", async () => {
    await expectFile(
      "a:\n  x: 1 # keep x\n  y:\n    - 1\nb: true\n",
      (h) => h.merge([], { a: { y: [2], z: 3 } }),
      "a:\n  x: 1 # keep x\n  y:\n    - 2\n  z: 3\nb: true\n"
    );
  });

  it("merging an already-merged value leaves the bytes unchanged; non-mappings reject", async () => {
    await expectFile("a:  { x: 1 }\n", (h) => h.merge(["a"], { x: 1 }), "a:  { x: 1 }\n");
    await expectReject("a: 1\n", (h) => h.merge(["a"], { x: 1 }), "not a mapping");
    await expectReject("a: {}\n", (h) => h.merge(["a"], [1] as never), "plain object");
  });

  it("merge creates the target when absent", async () => {
    await expectFile("a: 1\n", (h) => h.merge(["b"], { c: 1 }), "a: 1\nb:\n  c: 1\n");
  });
});

describe("REQ-YMD-02 — value validation and updateValue", () => {
  it("updateValue bumps a number and sees undefined when absent", async () => {
    await expectFile("version: 1\n", (h) => h.updateValue(["version"], (v) => (typeof v === "number" ? v + 1 : 1)), "version: 2\n");
    await expectFile("a: 1\n", (h) => h.updateValue(["v"], (v) => (v === undefined ? "new" : "old")), "a: 1\nv: new\n");
  });

  it("updateValue reads through an alias", async () => {
    await expectFile("a: &x 1\nb: *x\n", (h) => h.updateValue(["c"], (v) => v ?? 0), "a: &x 1\nb: *x\nc: 0\n");
    await expectFile("a: &x 4\nb: *x\nc: 0\n", (h) => h.updateValue(["c"], () => 4), "a: &x 4\nb: *x\nc: 4\n");
  });

  it("a non-JSON value rejects without mutation, naming the path inside the value", async () => {
    await expectReject("{}\n", (h) => h.setValue(["when"], new Date() as never), "Date");
    await expectReject("a: 1\n", (h) => h.setValue(["a"], { x: [undefined] } as never), '["x",0]');
    await expectReject("a: 1\n", (h) => h.updateValue(["a"], () => Number.NaN), "NaN");
  });
});

describe("REQ-YMD-02 — path resolution", () => {
  it("rejects crossing a scalar, an index into a mapping, and a key into a sequence", async () => {
    await expectReject("a: 1\n", (h) => h.setValue(["a", "b"], 1), "scalar");
    await expectReject("a:\n  k: 1\n", (h) => h.setValue(["a", 0], 1), "mapping");
    await expectReject("a:\n  - 1\n", (h) => h.setValue(["a", "k"], 1), "sequence");
  });

  it("only creates missing parents as mappings", async () => {
    await expectReject("a: 1\n", (h) => h.setValue(["x", 0], 1), '["x",0]');
  });

  it("rejects an edit that would write through an alias, naming the alias", async () => {
    await expectReject("base: &base\n  image: node\nweb: *base\n", (h) => h.setValue(["web", "image"], "deno"), "*base");
    await expectFile("base: &base\n  image: node\nweb: *base\n", (h) => h.setValue(["web"], 1), "base: &base\n  image: node\nweb: 1\n");
  });
});

describe("REQ-YMD-09 — relocation, copy, key position, key order", () => {
  it("moveValue relocates across parents", async () => {
    await expectFile("a:\n  x: 1\nb: {}\n", (h) => h.moveValue(["a", "x"], ["b", "x"]), "a: {}\nb: { x: 1 }\n");
    await expectFile("a:\n  x: 1\nb:\n  y: 2\n", (h) => h.moveValue(["a", "x"], ["b", "x"]), "a: {}\nb:\n  y: 2\n  x: 1\n");
  });

  it("moveValue inserts at a number segment, is a no-op when already moved, and rejects otherwise", async () => {
    await expectFile("a: z\nl:\n  - x\n", (h) => h.moveValue(["a"], ["l", 0]), "l:\n  - z\n  - x\n");
    await expectFile("b: 1\n", (h) => h.moveValue(["a"], ["b"]), "b: 1\n");
    await expectReject("c: 1\n", (h) => h.moveValue(["a"], ["b"]), '["a"]');
    await expectReject("a:\n  b: 1\n", (h) => h.moveValue(["a"], ["a", "c"]), "inside");
  });

  it("moveValue keeps anchors on the moved node and rejects an alias left before its anchor", async () => {
    await expectReject("a: &x 1\nb: *x\n", (h) => h.moveValue(["a"], ["c"]), "*x");
  });

  it("copyValue copies resolved data without duplicating an anchor", async () => {
    await expectFile("a: &x\n  k: 1\n", (h) => h.copyValue(["a"], ["b"]), "a: &x\n  k: 1\nb:\n  k: 1\n");
    await expectFile("a: 1\nb: 1\n", (h) => h.copyValue(["a"], ["b"]), "a: 1\nb: 1\n");
    await expectReject("a: 1\n", (h) => h.copyValue(["z"], ["b"]), '["z"]');
  });

  it("setValue and addKey place a new key before or after a sibling", async () => {
    await expectFile(
      "name: app\nversion: 1.0.0\n",
      (h) => h.addKey(["private"], true, { after: "name" }),
      "name: app\nprivate: true\nversion: 1.0.0\n"
    );
    await expectFile("a: 1\nb: 2\n", (h) => h.setValue(["z"], 0, { before: "a" }), "z: 0\na: 1\nb: 2\n");
    await expectFile("a: 1\nb: 2\n", (h) => h.setValue(["b"], 3, { before: "a" }), "a: 1\nb: 3\n");
    await expectReject("a: 1\n", (h) => h.addKey(["z"], 0, { after: "nope" }), "nope");
    await expectReject("a: 1\n", (h) => h.addKey(["z"], 0, { after: "a", before: "a" }), "both");
  });

  it("sortKeys orders keys, keeps comments with their keys, and is a no-op when sorted", async () => {
    await expectFile("b: 1 # bee\n# about a\na: 2\n", (h) => h.sortKeys([]), "# about a\na: 2\nb: 1 # bee\n");
    await expectFile("a: 1\nb:   2\n", (h) => h.sortKeys([]), "a: 1\nb:   2\n");
    await expectFile(
      "z:\n  d: 1\n  c: 2\na: 0\n",
      (h) => h.sortKeys([], { recursive: true }),
      "a: 0\nz:\n  c: 2\n  d: 1\n"
    );
    await expectReject("a: [1]\n", (h) => h.sortKeys(["a"]), "not a mapping");
  });
});
