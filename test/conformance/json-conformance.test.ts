/**
 * REQ-JSD-08: the JSON dialect passes the conformance kit. The fixture re-assembles the same
 * real building blocks `src/dialects/json/index.ts` composes (its parse/print pair and its
 * named ops), never a mock, plus a JSONC sample corpus.
 */
import { describe, it, expect, setDefaultTimeout } from "bun:test";
import * as expectedAstLibrary from "jsonc-parser";
import * as json from "../../src/dialects/json/index.ts";
import { defineDialect, defineOpPack, withOps } from "../../src/core/define-dialect.ts";
import { parse, print, type JsonDocument } from "../../src/dialects/json/ast.ts";
import * as ops from "../../src/dialects/json/ops.ts";
import { testDialect, testOpPack, type DialectFixture, type OpPackFixture } from "../../src/conformance/index.ts";

setDefaultTimeout(20000);

const opsPack = defineOpPack<JsonDocument, typeof ops>({ ...ops });
const baseDialect = defineDialect({ extensions: [".json", ".jsonc"], ast: { parse, print }, ops: {} });
const realJsonDialect = withOps(baseDialect, opsPack);

const LARGE_UNIT = '    { "id": 1, "name": "entry", "tags": ["a", "b"] },\n';
const LARGE_SAMPLE = `{\n  "items": [\n${LARGE_UNIT.repeat(Math.ceil((4 * 1024 * 1024) / LARGE_UNIT.length))}    null\n  ]\n}\n`;

const CORPUS = [
  '{\n  // line comment\n  "a": 1, /* block */\n  "b": [1, 2,],\n}\n',
  '{\r\n  "crlf": true\r\n}\r\n',
  '﻿{\n  "bom": true\n}\n',
  '{\n\t"tabs": {\n\t\t"nested": 1\n\t}\n}\n',
  '{"noTrailingNewline":1}',
  '{ "nested": [[1, [2, [3]]], []] }\n',
  "{}",
  "[]\n",
  '"just a string"\n',
  "// only a comment\n",
  LARGE_SAMPLE,
];

describe("REQ-JSD-08 — conformance kit", () => {
  it("testDialect: the JSONC corpus plus the kit's samples round-trip byte-exact; astLibrary is jsonc-parser", async () => {
    const fixture: DialectFixture<typeof expectedAstLibrary> = {
      dialect: baseDialect,
      samples: CORPUS,
      module: json,
      expectedAstLibrary,
      libraryExercise: {
        path: "library.json",
        seed: '{\n  "name": "app"\n}\n',
        expect: '{\n  "name": "app",\n  "private": true\n}\n',
        modify(ast, library) {
          const doc = ast as JsonDocument;
          const edits = library.modify(doc.text, ["private"], true, { formattingOptions: { insertSpaces: true, tabSize: 2 } });
          doc.text = library.applyEdits(doc.text, edits);
        },
      },
    };
    await expect(testDialect(fixture)).resolves.toBeUndefined();
  });

  it("invalid JSON fails parse", () => {
    expect(() => parse("{ nope")).toThrow();
    expect(() => parse("const x = 1;\n")).toThrow();
  });

  it("testOpPack: named ops are byte-exact, coalesce, and split at a read boundary", async () => {
    const fixture: OpPackFixture = {
      opPack: opsPack,
      baseDialect: realJsonDialect,
      exercises: [
        {
          seed: '{\n  // tool\n  "name": "app"\n}\n',
          chain: [
            { op: "setValue", args: [["scripts", "build"], "tsc"] },
            { op: "appendItem", args: [["files"], "dist", { unique: true }] },
          ],
          expect: '{\n  // tool\n  "name": "app",\n  "scripts": {\n    "build": "tsc"\n  },\n  "files": [\n    "dist"\n  ]\n}\n',
        },
        {
          seed: '{\r\n  "b": 2,\r\n  "a": 1\r\n}\r\n',
          chain: [
            { op: "sortKeys", args: [[]] },
            { op: "renameKey", args: [["a"], "alpha"] },
          ],
          expect: '{\r\n  "alpha": 1,\r\n  "b": 2\r\n}\r\n',
        },
        {
          seed: '﻿{\n\t"x": [1, 2, 3]\n}',
          chain: [{ op: "moveItem", args: [["x"], 0, 2] }],
          expect: '﻿{\n\t"x": [2, 3, 1]\n}',
        },
      ],
    };
    await expect(testOpPack(fixture)).resolves.toBeUndefined();
  });
});
