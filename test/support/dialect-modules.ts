import * as typescript from "../../src/dialects/typescript/index.ts";
import * as react from "../../src/dialects/react/index.ts";
import * as nestjs from "../../src/dialects/nestjs/index.ts";
import * as angular from "../../src/dialects/angular/index.ts";
import * as json from "../../src/dialects/json/index.ts";
import * as yaml from "../../src/dialects/yaml/index.ts";
import * as css from "../../src/dialects/css/index.ts";
import * as csharp from "../../src/dialects/csharp/index.ts";
import * as aspnet from "../../src/dialects/aspnet/index.ts";
import * as msbuild from "../../src/dialects/msbuild/index.ts";
import * as expectedAstLibrary from "ts-morph";
import * as jsoncParser from "jsonc-parser";
import * as yamlLibrary from "yaml";
import * as postcss from "postcss";
import * as webTreeSitter from "web-tree-sitter";
import * as saxes from "saxes";
import { defineDialect } from "../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";
import * as typescriptAst from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/typescript/ast.ts";
import * as reactAst from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/react/ast.ts";
import * as jsonAst from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/json/ast.ts";
import * as yamlAst from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/yaml/ast.ts";
import * as cssAst from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/css/ast.ts";
import * as csharpAst from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/csharp/ast.ts";
import * as msbuildAst from "../../src/bounded-contexts/authoring/infrastructure/out/dialects/msbuild/ast.ts";

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

const csharpLibraryExercise = {
  seed: "internal class A\n{\n}\n",
  expect: "public class A\n{\n}\n",
  modify(ast: unknown, library: typeof webTreeSitter) {
    const doc = ast as csharp.CsharpDocument;
    const parser = new library.Parser();
    parser.setLanguage(csharp.language);
    const tree = parser.parse(doc.text);
    if (tree === null || tree.rootNode.hasError) throw new Error("library does not recognize the adapter AST");
    const modifier = tree.rootNode.descendantsOfType("modifier")[0]!;
    doc.text = `${doc.text.slice(0, modifier.startIndex)}public${doc.text.slice(modifier.endIndex)}`;
    tree.delete();
  },
};

export const DIALECT_MODULES = [
  {
    entrypoint: "src/dialects/typescript/index.ts", specifier: "ts-morph",
    adapter: new URL("../../src/bounded-contexts/authoring/infrastructure/out/dialects/typescript/ast.ts", import.meta.url),
    module: typescript, expectedAstLibrary,
    dialect: defineDialect({ extensions: [".ts"], ast: typescriptAst, ops: {} }),
    samples: ["const x = 1;\n", ...TS_SYNTAX_SAMPLES, `/*${"a".repeat(4 * 1024 * 1024)}*/\nconst x = 1;\n`],
    libraryExercise: { ...libraryExercise, path: "library.ts" },
  },
  {
    entrypoint: "src/dialects/react/index.ts", specifier: "ts-morph",
    adapter: new URL("../../src/bounded-contexts/authoring/infrastructure/out/dialects/react/ast.ts", import.meta.url),
    module: react, expectedAstLibrary,
    dialect: defineDialect({ extensions: [".tsx"], ast: reactAst, ops: {} }),
    samples: ["const el = <Button />;\n", ...TS_SYNTAX_SAMPLES], libraryExercise: { ...libraryExercise, path: "library.tsx" },
  },
  {
    entrypoint: "src/dialects/nestjs/index.ts", specifier: "ts-morph",
    adapter: new URL("../../src/bounded-contexts/authoring/infrastructure/out/dialects/typescript/ast.ts", import.meta.url),
    module: nestjs, expectedAstLibrary,
    dialect: defineDialect({ extensions: [".ts"], ast: typescriptAst, ops: {} }),
    samples: ["@Module({ providers: [A] })\nexport class M {}\n", ...TS_SYNTAX_SAMPLES],
    libraryExercise: { ...libraryExercise, path: "library.ts" },
  },
  {
    entrypoint: "src/dialects/angular/index.ts", specifier: "ts-morph",
    adapter: new URL("../../src/bounded-contexts/authoring/infrastructure/out/dialects/typescript/ast.ts", import.meta.url),
    module: angular, expectedAstLibrary,
    dialect: defineDialect({ extensions: [".ts"], ast: typescriptAst, ops: {} }),
    samples: ["@Component({ imports: [A] })\nexport class C {}\n", ...TS_SYNTAX_SAMPLES],
    libraryExercise: { ...libraryExercise, path: "library.ts" },
  },
  {
    entrypoint: "src/dialects/json/index.ts", specifier: "jsonc-parser",
    adapter: new URL("../../src/bounded-contexts/authoring/infrastructure/out/dialects/json/ast.ts", import.meta.url),
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
    adapter: new URL("../../src/bounded-contexts/authoring/infrastructure/out/dialects/yaml/ast.ts", import.meta.url),
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
  {
    entrypoint: "src/dialects/css/index.ts", specifier: "postcss",
    adapter: new URL("../../src/bounded-contexts/authoring/infrastructure/out/dialects/css/ast.ts", import.meta.url),
    module: css, expectedAstLibrary: postcss,
    dialect: defineDialect({ extensions: [".css"], ast: cssAst, ops: {} }),
    samples: [":root {\n  --a: 1;\n}\n"],
    libraryExercise: {
      path: "library.css", seed: "a { color: red; }\n", expect: "a { color: blue; }\n",
      modify(ast: unknown, library: typeof postcss) {
        if (!(ast instanceof library.Root)) throw new Error("library does not recognize the adapter AST");
        ast.walkDecls("color", (node) => {
          node.value = "blue";
        });
      },
    },
  },
  {
    entrypoint: "src/dialects/csharp/index.ts", specifier: "web-tree-sitter",
    adapter: new URL("../../src/bounded-contexts/authoring/infrastructure/out/dialects/csharp/ast.ts", import.meta.url),
    module: csharp, expectedAstLibrary: webTreeSitter,
    dialect: defineDialect({ extensions: [".cs"], ast: csharpAst, ops: {} }),
    samples: ["namespace Shop;\n\npublic class A(int x) : IA\n{\n}\n"],
    libraryExercise: { ...csharpLibraryExercise, path: "library.cs" },
  },
  {
    entrypoint: "src/dialects/aspnet/index.ts", specifier: "web-tree-sitter",
    adapter: new URL("../../src/bounded-contexts/authoring/infrastructure/out/dialects/csharp/ast.ts", import.meta.url),
    module: aspnet, expectedAstLibrary: webTreeSitter,
    dialect: defineDialect({ extensions: [".cs"], ast: csharpAst, ops: {} }),
    samples: ["var builder = WebApplication.CreateBuilder(args);\nvar app = builder.Build();\n"],
    libraryExercise: { ...csharpLibraryExercise, path: "library.cs" },
  },
  {
    entrypoint: "src/dialects/msbuild/index.ts", specifier: "saxes",
    adapter: new URL("../../src/bounded-contexts/authoring/infrastructure/out/dialects/msbuild/ast.ts", import.meta.url),
    module: msbuild, expectedAstLibrary: saxes,
    dialect: defineDialect({ extensions: [".csproj"], ast: msbuildAst, ops: {} }),
    samples: ['<Project Sdk="Microsoft.NET.Sdk">\n</Project>\n'],
    libraryExercise: {
      path: "library.csproj", seed: "<Project>\n  <A>1</A>\n</Project>\n", expect: "<Project>\n  <A>2</A>\n</Project>\n",
      modify(ast: unknown, library: typeof saxes) {
        const doc = ast as msbuild.MsbuildDocument;
        let wellFormed = true;
        const parser = new library.SaxesParser();
        parser.on("error", () => void (wellFormed = false));
        parser.write(doc.text).close();
        if (!wellFormed) throw new Error("library does not recognize the adapter AST");
        doc.text = doc.text.replace("<A>1</A>", "<A>2</A>");
      },
    },
  },
] as const;
