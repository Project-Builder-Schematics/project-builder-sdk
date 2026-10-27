import { describe, it, expect } from "bun:test";
import * as json from "../../../src/dialects/json/index.ts";
import * as jsoncParser from "jsonc-parser";
import { edited, expectRejected, expectUnchanged, runJson } from "./run-json.ts";

describe("REQ-JSD-01.2 — find() extension gate", () => {
  for (const path of ["config.yaml", ".json", "README", "src/.jsonc", "a..json", "file.json5"]) {
    it(`rejects ${JSON.stringify(path)} synchronously with the contained prefix`, () => {
      expect(() => json.find(path)).toThrow(/^dialect operation failed: find\(path\) — the JSON dialect accepts only/);
    });
  }

  it("accepts .json, .jsonc, and a dotfile with a real stem", async () => {
    for (const path of ["package.json", "tsconfig.jsonc", ".eslintrc.json"]) {
      const { error, content } = await runJson("{}", (h) => h.setValue(["a"], 1), path);
      expect(error).toBeUndefined();
      expect(content).toBe('{"a": 1}');
    }
  });

  it("exports astLibrary as the complete jsonc-parser module", () => {
    expect(Object.keys(json.astLibrary).sort()).toEqual(Object.keys(jsoncParser).sort());
    expect(json.astLibrary.modify).toBe(jsoncParser.modify);
  });
});

describe("REQ-JSD-07 — format preservation", () => {
  it("REQ-JSD-07.1: comments survive an edit", async () => {
    expect(await edited('{\n  // build tool\n  "tool": "tsc"\n}\n', (h) => h.setValue(["tool"], "esbuild"))).toBe(
      '{\n  // build tool\n  "tool": "esbuild"\n}\n'
    );
  });

  it("block comments, blank lines, and key order outside the edit survive", async () => {
    const seed = '{\n  /* first */\n  "b": 1,\n\n  "a": 2\n}\n';
    expect(await edited(seed, (h) => h.setValue(["c"], 3))).toBe('{\n  /* first */\n  "b": 1,\n\n  "a": 2,\n  "c": 3\n}\n');
  });

  it("new content uses detected tab indentation", async () => {
    expect(await edited('{\n\t"a": 1\n}\n', (h) => h.setValue(["b", "c"], 1))).toBe(
      '{\n\t"a": 1,\n\t"b": {\n\t\t"c": 1\n\t}\n}\n'
    );
  });

  it("new content uses detected four-space indentation", async () => {
    expect(await edited('{\n    "a": 1\n}\n', (h) => h.setValue(["b", "c"], 1))).toBe(
      '{\n    "a": 1,\n    "b": {\n        "c": 1\n    }\n}\n'
    );
  });

  it("new content uses the document's CRLF line ending", async () => {
    expect(await edited('{\r\n  "a": 1\r\n}\r\n', (h) => h.setValue(["b"], [1]))).toBe(
      '{\r\n  "a": 1,\r\n  "b": [\r\n    1\r\n  ]\r\n}\r\n'
    );
  });

  it("a UTF-8 BOM round-trips", async () => {
    expect(await edited('﻿{\n  "a": 1\n}\n', (h) => h.setValue(["a"], 2))).toBe('﻿{\n  "a": 2\n}\n');
  });

  it("a missing trailing newline stays missing", async () => {
    expect(await edited('{\n  "a": 1\n}', (h) => h.setValue(["b"], 2))).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it("a one-line object stays on one line", async () => {
    expect(await edited('{ "a": 1 }\n', (h) => h.setValue(["b"], 2))).toBe('{ "a": 1, "b": 2 }\n');
  });

  it("an empty document gains a root object", async () => {
    expect(await edited("", (h) => h.setValue(["a"], 1))).toBe('{\n  "a": 1\n}');
  });

  it("trailing commas and comments parse", async () => {
    expect(await edited('{\n  "a": 1, // one\n}\n', (h) => h.setValue(["a"], 2))).toBe('{\n  "a": 2, // one\n}\n');
  });

  it("invalid JSON fails parse, contained by the handle, with zero directives", async () => {
    const message = await expectRejected("{ nope", (h) => h.setValue(["a"], 1));
    expect(message).toBe('dialect operation failed: could not parse "file.json"');
  });

  it("an empty or whitespace-only file round-trips and setValue creates the root", async () => {
    expect(json.find("a.json")).toBeDefined();
    expect(await edited("", (h) => h.setValue([], { a: 1 }))).toBe('{\n  "a": 1\n}');
    expect(await edited("\n", (h) => h.setValue(["a"], 1))).toBe('{\n  "a": 1\n}\n');
    await expectUnchanged("", (h) => h.modify(() => {}));
  });
});

describe("REQ-JSD-08 — escape hatch (named ops and .modify share one live document)", () => {
  it(".modify(fn) hands the live JsonDocument whose text a jsonc-parser edit can rewrite", async () => {
    const out = await edited('{\n  "a": 1\n}\n', (h) =>
      h.modify((doc) => {
        expect(doc.text).toBe('{\n  "a": 1\n}\n');
        const edits = json.astLibrary.modify(doc.text, ["a"], 2, { formattingOptions: { insertSpaces: true, tabSize: 2 } });
        doc.text = json.astLibrary.applyEdits(doc.text, edits);
      })
    );
    expect(out).toBe('{\n  "a": 2\n}\n');
  });

  it("ops after .modify(fn) see the edited text", async () => {
    const out = await edited('{\n  "a": 1\n}\n', (h) =>
      h
        .modify((doc) => {
          doc.text = doc.text.replace('"a": 1', '"a": 1, /* note */ "b": 2');
        })
        .setValue(["b"], 3)
    );
    expect(out).toBe('{\n  "a": 1, /* note */ "b": 3\n}\n');
  });
});
