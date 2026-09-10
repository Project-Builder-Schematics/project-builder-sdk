import * as typescript from "../../src/dialects/typescript/index.ts";
import * as react from "../../src/dialects/react/index.ts";
import * as expectedAstLibrary from "ts-morph";
import { defineDialect } from "../../src/core/define-dialect.ts";
import * as typescriptAst from "../../src/dialects/typescript/ast.ts";
import * as reactAst from "../../src/dialects/react/ast.ts";

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
    samples: ["const x = 1;\n"], libraryExercise: { ...libraryExercise, path: "library.ts" },
  },
  {
    entrypoint: "src/dialects/react/index.ts", specifier: "ts-morph",
    adapter: new URL("../../src/dialects/react/ast.ts", import.meta.url),
    module: react, expectedAstLibrary,
    dialect: defineDialect({ extensions: [".tsx"], ast: reactAst, ops: {} }),
    samples: ["const el = <Button />;\n"], libraryExercise: { ...libraryExercise, path: "library.tsx" },
  },
] as const;
