/**
 * REQ-YMD-08: the YAML dialect passes the conformance kit. The fixture dialect is assembled
 * from the same production building blocks `src/dialects/yaml/index.ts` composes (the real
 * parse/print pair and the real named ops), never a mock.
 */
import { describe, it, expect, setDefaultTimeout } from "bun:test";
import * as expectedAstLibrary from "yaml";
import { defineDialect, defineOpPack, withOps } from "../../src/core/define-dialect.ts";
import { parse, print, type YamlStream } from "../../src/dialects/yaml/ast.ts";
import * as yaml from "../../src/dialects/yaml/index.ts";
import { addDocument, removeDocument } from "../../src/dialects/yaml/documents.ts";
import { addMergeKey, setAnchor, setComment, setTag } from "../../src/dialects/yaml/presentation.ts";
import { appendItem, merge, setValue, sortKeys } from "../../src/dialects/yaml/structural.ts";
import { testDialect, testOpPack, type OpPackFixture } from "../../src/conformance/index.ts";

// The kit's derived 4 MiB sample and the 1 MiB corpus sample are real parse/print work (the
// `yaml` parser takes seconds on them), not a hang.
setDefaultTimeout(20000);

const ops = { setValue, appendItem, merge, sortKeys, setComment, setAnchor, addMergeKey, setTag, addDocument, removeDocument };
const opsPack = defineOpPack<YamlStream, typeof ops>(ops);
const realYamlDialect = withOps(defineDialect({ extensions: [".yaml", ".yml"], ast: { parse, print }, ops: {} }), opsPack);

const LARGE_UNIT = "  - name: item\n    value: 42 # entry\n";
const LARGE_SAMPLE = `items:\n${LARGE_UNIT.repeat(Math.ceil((1024 * 1024) / LARGE_UNIT.length))}`;

const CORPUS: string[] = [
  "# header\n\nname: app # inline\n# before port\nport: 80\n",
  "base: &base\n  image: node\nweb: *base\n",
  "defaults: &d\n  retries: 3\njob:\n  <<: *d\n  name: build\n",
  "%YAML 1.2\n%TAG !e! tag:example.com,2026:\n---\na: !e!thing 1\n...\n# between\n---\nb: 2\n",
  "literal: |\n  line one\n  line two\nfolded: >-\n  folded\n  text\nkeep: |+\n  kept\n\n",
  "flow: {a: 1, b: [1, 2, {c: d}]}\npadded: { x: [ 1 ] }\n",
  "a: 1\r\nb:\r\n  - x\r\n",
  "﻿a: 1\n",
  "a: 1",
  "",
  "# only a comment\n",
  "root:\n    child:\n    - a\n    - b\n",
  "quoted: 'single'\ndouble: \"double\"\nhex: 0x1F\nnull: ~\n",
  "? complex key\n: value\n",
  LARGE_SAMPLE,
];

describe("REQ-YMD-08 — conformance", () => {
  it("the YAML corpus and the kit's derived samples round-trip byte-exact via testDialect", async () => {
    await expect(
      testDialect({
        dialect: realYamlDialect,
        samples: CORPUS,
        module: yaml,
        expectedAstLibrary,
        libraryExercise: {
          path: "library.yaml",
          seed: "name: app\n",
          expect: "name: app\nversion: 1\n",
          modify(ast, library) {
            const document = (ast as YamlStream).documents[0];
            if (!(document instanceof library.Document)) throw new Error("library does not recognize the adapter AST");
            document.set("version", 1);
          },
        },
      })
    ).resolves.toBeUndefined();
  });

  it("named ops pass testOpPack with byte-exact single and coalesced exercises", async () => {
    const fixture: OpPackFixture = {
      opPack: opsPack,
      baseDialect: realYamlDialect,
      exercises: [
        {
          seed: "# app\nname: app # the name\nport: 80\n",
          chain: [{ op: "setValue", args: [["port"], 8080] }],
          expect: "# app\nname: app # the name\nport: 8080\n",
        },
        {
          seed: "base:\n  image: node\nweb:\n  port: 80\n",
          chain: [
            { op: "setAnchor", args: [["base"], "base"] },
            { op: "addMergeKey", args: [["web"], "base"] },
            { op: "setComment", args: [["web"], "Frontend"] },
          ],
          expect: "base: &base\n  image: node\n# Frontend\nweb:\n  <<: *base\n  port: 80\n",
        },
        {
          seed: "a:   1 # keep spacing\n---\nb: 2\n",
          chain: [
            { op: "setValue", args: [["b"], 3, { document: 1 }] },
            { op: "addDocument", args: [{ c: 4 }] },
          ],
          expect: "a:   1 # keep spacing\n---\nb: 3\n---\nc: 4\n",
        },
      ],
    };
    await expect(testOpPack(fixture)).resolves.toBeUndefined();
  });
});
