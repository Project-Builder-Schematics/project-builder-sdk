/**
 * The CSS dialect passes the conformance kit. The fixture re-assembles the same real building
 * blocks `src/dialects/css/index.ts` composes (its parse/print pair and its named ops), never a
 * mock, plus a CSS sample corpus.
 */
import { describe, it, expect, setDefaultTimeout } from "bun:test";
import * as expectedAstLibrary from "postcss";
import type { Root } from "postcss";
import * as css from "../../src/dialects/css/index.ts";
import { defineDialect, defineOpPack, withOps } from "../../src/core/define-dialect.ts";
import { parse, print } from "../../src/dialects/css/ast.ts";
import { removeDeclaration, setDeclaration } from "../../src/dialects/css/ops.ts";
import { testDialect, testOpPack, type DialectFixture, type OpPackFixture } from "../../src/conformance/index.ts";

setDefaultTimeout(20000);

const opsPack = defineOpPack<Root, { setDeclaration: typeof setDeclaration; removeDeclaration: typeof removeDeclaration }>({
  setDeclaration,
  removeDeclaration,
});
const baseDialect = defineDialect({ extensions: [".css"], ast: { parse, print }, ops: {} });
const realCssDialect = withOps(baseDialect, opsPack);

const LARGE_UNIT = "  --token: #0b254d; /* brand */\n";
const LARGE_SAMPLE = `:root {\n${LARGE_UNIT.repeat(Math.ceil((4 * 1024 * 1024) / LARGE_UNIT.length))}}\n`;

const CORPUS = [
  '@import "tailwindcss";\n@custom-variant dark (&:where(.dark, .dark *));\n\n@theme {\n  --color-*: initial;\n  --color-primary: #0b254d;\n}\n',
  ":root {\r\n  --a: 1;\r\n}\r\n",
  "﻿:root { --bom: 1; }\n",
  "a{color:red}b{color:blue}",
  "@media (prefers-color-scheme: dark) {\n\t:root {\n\t\t--a: 2;\n\t}\n}\n",
  "/* only a comment */\n",
  '.q::before { content: ";}"; }\n',
  "@layer base, components;\n",
  LARGE_SAMPLE,
];

describe("conformance kit", () => {
  it("testDialect: the CSS corpus plus the kit's samples round-trip byte-exact; astLibrary is postcss", async () => {
    const fixture: DialectFixture<typeof expectedAstLibrary> = {
      dialect: baseDialect,
      samples: CORPUS,
      module: css,
      expectedAstLibrary,
      libraryExercise: {
        path: "library.css",
        seed: ":root {\n  --a: 1;\n}\n",
        expect: ":root {\n  --a: 2;\n}\n",
        modify(ast, library) {
          if (!(ast instanceof library.Root)) throw new Error("library does not recognize the adapter AST");
          ast.walkDecls("--a", (node) => {
            node.value = "2";
          });
        },
      },
    };
    await expect(testDialect(fixture)).resolves.toBeUndefined();
  });

  it("invalid CSS fails parse", () => {
    expect(() => parse("a {")).toThrow("invalid CSS");
    expect(() => parse("a { color: red; }}")).toThrow("invalid CSS");
  });

  it("testOpPack: named ops are byte-exact, coalesce, and split at a read boundary", async () => {
    const fixture: OpPackFixture = {
      opPack: opsPack,
      baseDialect: realCssDialect,
      exercises: [
        {
          seed: '@import "tailwindcss";\n\n@theme {\n  --a: 1;\n  --b: 2;\n}\n',
          chain: [
            { op: "setDeclaration", args: [{ atRule: "theme" }, "--a", "10"] },
            { op: "removeDeclaration", args: [{ atRule: "theme" }, "--b"] },
            { op: "setDeclaration", args: [{ selector: ".dark" }, "--a", "20"] },
          ],
          expect: '@import "tailwindcss";\n\n@theme {\n  --a: 10;\n}\n\n.dark {\n  --a: 20;\n}\n',
        },
        {
          seed: "﻿:root {\r\n  --a: 1;\r\n}\r\n",
          chain: [{ op: "setDeclaration", args: [{ selector: ":root" }, "--b", "2", { before: "--a" }] }],
          expect: "﻿:root {\r\n  --b: 2;\r\n  --a: 1;\r\n}\r\n",
        },
      ],
    };
    await expect(testOpPack(fixture)).resolves.toBeUndefined();
  });
});
