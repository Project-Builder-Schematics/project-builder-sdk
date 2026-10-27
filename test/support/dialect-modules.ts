import * as typescript from "../../src/dialects/typescript/index.ts";
import * as react from "../../src/dialects/react/index.ts";
import * as nestjs from "../../src/dialects/nestjs/index.ts";
import * as angular from "../../src/dialects/angular/index.ts";
import * as json from "../../src/dialects/json/index.ts";
import * as yaml from "../../src/dialects/yaml/index.ts";
import * as expectedAstLibrary from "ts-morph";
import * as jsoncParser from "jsonc-parser";
import * as yamlLibrary from "yaml";
import { defineDialect } from "../../src/core/define-dialect.ts";
import * as typescriptAst from "../../src/dialects/typescript/ast.ts";
import * as reactAst from "../../src/dialects/react/ast.ts";
import * as jsonAst from "../../src/dialects/json/ast.ts";
import * as yamlAst from "../../src/dialects/yaml/ast.ts";

// TypeScript-syntax adversarial samples: the kit's mandatory set is format-neutral, so these
// stay covered here for both ts-morph dialects.
const TS_SYNTAX_SAMPLES = [
  "// just a comment, no statements\n",
  'import { a } from "m";\nimport { b } from "m";\n',
];

const libraryExercise = {
  seed: "let answer = 1;\n",
  expect: "const answer = 1;\n",
  modify(ast: unknown, library: typeof expectedAstLibrary) {
    if (!(ast instanceof library.SourceFile) || !library.Node.isSourceFile(ast)) {
      throw new Error("library does not recognize the adapter AST");
    }
    ast.getVariableStatements()[0]!.setDeclarationKind(library.VariableDeclarationKind.Const);
  },
};

export const DIALECT_MODULES = [
  {
    entrypoint: "src/dialects/typescript/index.ts", specifier: "ts-morph",
    adapter: new URL("../../src/dialects/typescript/ast.ts", import.meta.url),
    module: typescript, expectedAstLibrary,
    dialect: defineDialect({ extensions: [".ts"], ast: typescriptAst, ops: {} }),
    samples: ["const x = 1;\n", ...TS_SYNTAX_SAMPLES, `/*${"a".repeat(4 * 1024 * 1024)}*/\nconst x = 1;\n`],
    libraryExercise: { ...libraryExercise, path: "library.ts" },
  },
  {
    entrypoint: "src/dialects/react/index.ts", specifier: "ts-morph",
    adapter: new URL("../../src/dialects/react/ast.ts", import.meta.url),
    module: react, expectedAstLibrary,
    dialect: defineDialect({ extensions: [".tsx"], ast: reactAst, ops: {} }),
    samples: ["const el = <Button />;\n", ...TS_SYNTAX_SAMPLES], libraryExercise: { ...libraryExercise, path: "library.tsx" },
  },
  {
    entrypoint: "src/dialects/nestjs/index.ts", specifier: "ts-morph",
    adapter: new URL("../../src/dialects/typescript/ast.ts", import.meta.url),
    module: nestjs, expectedAstLibrary,
    dialect: defineDialect({ extensions: [".ts"], ast: typescriptAst, ops: {} }),
    samples: ["@Module({ providers: [A] })\nexport class M {}\n", ...TS_SYNTAX_SAMPLES],
    libraryExercise: { ...libraryExercise, path: "library.ts" },
  },
  {
    entrypoint: "src/dialects/angular/index.ts", specifier: "ts-morph",
    adapter: new URL("../../src/dialects/typescript/ast.ts", import.meta.url),
    module: angular, expectedAstLibrary,
    dialect: defineDialect({ extensions: [".ts"], ast: typescriptAst, ops: {} }),
    samples: ["@Component({ imports: [A] })\nexport class C {}\n", ...TS_SYNTAX_SAMPLES],
    libraryExercise: { ...libraryExercise, path: "library.ts" },
  },
  {
    entrypoint: "src/dialects/json/index.ts", specifier: "jsonc-parser",
    adapter: new URL("../../src/dialects/json/ast.ts", import.meta.url),
    module: json, expectedAstLibrary: jsoncParser,
    dialect: defineDialect({ extensions: [".json"], ast: jsonAst, ops: {} }),
    samples: ['{ "a": [1, 2] }\n'],
    libraryExercise: {
      path: "library.json", seed: '{ "answer": 1 }\n', expect: '{ "answer": 2 }\n',
      modify(ast: unknown, library: typeof jsoncParser) {
        const doc = ast as json.JsonDocument;
        if (library.parseTree(doc.text) === undefined) throw new Error("library does not recognize the adapter AST");
        doc.text = library.applyEdits(doc.text, library.modify(doc.text, ["answer"], 2, {}));
      },
    },
  },
  {
    entrypoint: "src/dialects/yaml/index.ts", specifier: "yaml",
    adapter: new URL("../../src/dialects/yaml/ast.ts", import.meta.url),
    module: yaml, expectedAstLibrary: yamlLibrary,
    dialect: defineDialect({ extensions: [".yaml"], ast: yamlAst, ops: {} }),
    samples: ["a:\n  - 1\n"],
    libraryExercise: {
      path: "library.yaml", seed: "answer: 1\n", expect: "answer: 2\n",
      modify(ast: unknown, library: typeof yamlLibrary) {
        const doc = (ast as yaml.YamlStream).documents[0];
        if (!library.isDocument(doc)) throw new Error("library does not recognize the adapter AST");
        doc.set("answer", 2);
      },
    },
  },
] as const;
