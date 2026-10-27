import { describe, it, expect } from "bun:test";
import * as Library from "yaml";
import * as yaml from "../../../src/dialects/yaml/index.ts";
import { find, type YamlPath, type YamlStream, type YamlValue } from "../../../src/dialects/yaml/index.ts";
import { apply, expectFile, expectReject } from "./harness.ts";

describe("REQ-YMD-01 — subpath exports and the extension gate", () => {
  it("exports find and the complete yaml module as astLibrary", () => {
    expect(typeof yaml.find).toBe("function");
    expect(Object.keys(yaml.astLibrary).sort()).toEqual(Object.keys(Library).sort());
    expect(yaml.astLibrary.Document).toBe(Library.Document);
  });

  it("exports YamlValue, YamlPath, and YamlStream types", () => {
    const value: YamlValue = { a: [1, "b", null, true] };
    const path: YamlPath = ["a", 0];
    const stream: YamlStream | undefined = undefined;
    expect([value, path, stream]).toHaveLength(3);
  });

  it.each(["config.yaml", "dir/config.yml", "a.b.yaml"])("accepts %s", (path) => {
    expect(() => find(path)).not.toThrow();
  });

  it.each(["config.json", ".yaml", ".yml", "README", "config..yaml", "config.yaml.bak"])(
    "rejects %s synchronously with the contained prefix",
    (path) => {
      expect(() => find(path)).toThrow(/^dialect operation failed: find\(path\)/);
    }
  );
});

describe("REQ-YMD-07 — format preservation", () => {
  const roundTrips: Record<string, string> = {
    comments: "# head\na: 1 # inline\n\n# before b\nb:\n  - x # item\n",
    anchors: "base: &base\n  image: node\nweb: *base\nmerged:\n  <<: *base\n  port: 80\n",
    "indent four, unindented sequences": "root:\n    child:\n    - a\n    - b\n",
    "flow collections": "m: {a: 1, b: [1,2]}\n",
    "block scalars": "text: |\n  line1\n  line2\nf: >-\n  folded\n  text\n",
    "tags and hex": "a: !!str 1\nb: 0x1F\nc: !Ref x\n",
    crlf: "a: 1\r\nb: 2\r\n",
    bom: "﻿a: 1\n",
    "no trailing newline": "a: 1",
    empty: "",
    "comment only": "# nothing here\n",
    "multi-document with directives": "%YAML 1.2\n---\na: 1\n...\n# between\n---\nb: 2\n",
  };

  it.each(Object.entries(roundTrips))("a %s file round-trips byte-identical after an untouched modify", async (_, source) => {
    const outcome = await apply(source, (h) => h.modify(() => {}));
    expect(outcome.error).toBeUndefined();
    expect(outcome.modifies).toBe(0);
    expect(outcome.after).toBe(source);
  });

  it("a touched document re-uses the detected indentation and sequence indentation", async () => {
    await expectFile(
      "root:\n  child:\n  - a\n",
      (h) => h.appendItem(["root", "child"], "b"),
      "root:\n  child:\n  - a\n  - b\n"
    );
    await expectFile(
      "root:\n    child:\n        x: 1\n",
      (h) => h.setValue(["root", "y"], { z: 1 }),
      "root:\n    child:\n        x: 1\n    y:\n        z: 1\n"
    );
  });

  it("CRLF, BOM, and a missing trailing newline survive an edit", async () => {
    await expectFile("﻿a: 1\r\nb: 2", (h) => h.setValue(["b"], 3), "﻿a: 1\r\nb: 3");
  });

  it("a YAML syntax error fails parse, contained by the handle", async () => {
    const outcome = await apply("a: [1\n", (h) => h.setValue(["a"], 1));
    expect(outcome.error!.message).toBe('dialect operation failed: could not parse "config.yaml"');
    expect(outcome.modifies).toBe(0);
  });

  it("an alias to an undefined anchor fails parse", async () => {
    const outcome = await apply("a: *nowhere\n", (h) => h.setValue(["b"], 1));
    expect(outcome.error!.message).toBe('dialect operation failed: could not parse "config.yaml"');
    expect(outcome.modifies).toBe(0);
  });

  it("CRLF line endings apply to every re-serialized line", async () => {
    await expectFile("a: 1\r\n", (h) => h.setValue(["b"], { c: [1] }), "a: 1\r\nb:\r\n  c:\r\n    - 1\r\n");
  });

  it("an edit through .modify() is detected and printed", async () => {
    await expectFile(
      "a: 1\n",
      (h) =>
        h.modify((ast) => {
          ast.documents[0]!.set("b", 2);
        }),
      "a: 1\nb: 2\n"
    );
  });
});

describe("REQ-YMD-06 — multi-document files", () => {
  it("Scenario REQ-YMD-06.1: an op on document 1 leaves document 0 untouched", async () => {
    await expectFile(
      "a:   1 # keep spacing\n---\nb: 2\n",
      (h) => h.setValue(["b"], 3, { document: 1 }),
      "a:   1 # keep spacing\n---\nb: 3\n"
    );
  });

  it("addDocument inserts at the end by default and at an index", async () => {
    await expectFile("a: 1\n", (h) => h.addDocument({ b: 2 }), "a: 1\n---\nb: 2\n");
    await expectFile("a:  1\n", (h) => h.addDocument({ b: 2 }, { index: 0 }), "b: 2\n---\na:  1\n");
  });

  it("removeDocument removes a document", async () => {
    await expectFile("a: 1\n---\nb: 2\n---\nc: 3\n", (h) => h.removeDocument(1), "a: 1\n---\nc: 3\n");
  });

  it("out-of-range indices reject, for addDocument, removeDocument, and the { document } option", async () => {
    await expectReject("a: 1\n", (h) => h.addDocument(1, { index: 2 }), "index 2");
    await expectReject("a: 1\n", (h) => h.removeDocument(1), "document 1");
    await expectReject("a: 1\n", (h) => h.setValue(["a"], 2, { document: 1 }), "document 1");
    await expectReject("a: 1\n", (h) => h.setValue(["a"], 2, { document: -1 }), "document -1");
  });

  it("an empty file is a stream with zero documents; setValue creates document 0", async () => {
    await expectFile("", (h) => h.setValue(["a"], 1), "a: 1\n");
    await expectFile("", (h) => h.modify((ast) => expect(ast.documents).toHaveLength(0)), "");
    await expectReject("", (h) => h.removeKey(["a"]), "document 0");
  });

  it(".modify hands fn the live YamlStream of yaml Document instances", async () => {
    await expectFile(
      "a: 1\n---\nb: 2\n",
      (h) =>
        h.modify((ast) => {
          expect(ast.documents).toHaveLength(2);
          expect(ast.documents[1]).toBeInstanceOf(Library.Document);
        }),
      "a: 1\n---\nb: 2\n"
    );
  });
});
